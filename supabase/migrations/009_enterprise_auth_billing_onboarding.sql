-- ============================================================================
-- Migration: 009_enterprise_auth_billing_onboarding.sql
-- Purpose: Multi-tenant B2B enterprise onboarding, partial lead capture,
--          Netflix-style 7-day trial subscriptions, immutable financial audit
--          logs, RBAC (ADMIN vs EMPLOYEE), FTUX state, and encrypted employee
--          invitations with category permission switches.
-- ============================================================================

-- 1. Extend `empresas` (Organizations / Tenants)
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS rif_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS rif_blind_index VARCHAR(64),
  ADD COLUMN IF NOT EXISTS sector VARCHAR(100),
  ADD COLUMN IF NOT EXISTS employee_range VARCHAR(50),
  ADD COLUMN IF NOT EXISTS estimated_employees INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS plan_id VARCHAR(50) DEFAULT 'GROWTH',
  ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) DEFAULT 'MONTHLY' CHECK (billing_cycle IN ('MONTHLY', 'ANNUAL')),
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(120) UNIQUE,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ftux_state JSONB DEFAULT '{
    "accounting_template_selected": null,
    "setup_call_scheduled": false,
    "first_employee_invited": false,
    "checklist_dismissed": false
  }'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_rif_blind_index
  ON public.empresas (rif_blind_index)
  WHERE rif_blind_index IS NOT NULL;

-- 2. Extend `usuarios` (RBAC, Encrypted PII & Category Permissions)
ALTER TABLE public.usuarios
  ALTER COLUMN telefono_whatsapp DROP NOT NULL;
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'EMPLOYEE' CHECK (role IN ('ADMIN', 'EMPLOYEE')),
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('INVITED', 'ACTIVE', 'SUSPENDED')),
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS cedula_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS cedula_blind_index VARCHAR(64),
  ADD COLUMN IF NOT EXISTS whatsapp_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_blind_index VARCHAR(64),
  ADD COLUMN IF NOT EXISTS department VARCHAR(100),
  ADD COLUMN IF NOT EXISTS allowed_expense_categories JSONB DEFAULT '{
    "ALIMENTACION": true,
    "TRANSPORTE": true,
    "HOSPEDAJE": true,
    "REPRESENTACION": false,
    "OTROS": true
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mfa_secret_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_usuarios_cedula_blind
  ON public.usuarios (empresa_id, cedula_blind_index)
  WHERE cedula_blind_index IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_usuarios_whatsapp_blind
  ON public.usuarios (whatsapp_blind_index)
  WHERE whatsapp_blind_index IS NOT NULL;

-- 3. Partial Persistence: Onboarding Leads (Abandoned Cart & Commercial Follow-Up)
CREATE TABLE IF NOT EXISTS public.onboarding_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  company_name VARCHAR(200) NOT NULL,
  password_hash TEXT NOT NULL,
  rif_encrypted TEXT,
  rif_blind_index VARCHAR(64),
  sector VARCHAR(100),
  employee_range VARCHAR(50),
  estimated_employees INTEGER,
  selected_plan_id VARCHAR(50),
  billing_cycle VARCHAR(20) CHECK (billing_cycle IN ('MONTHLY', 'ANNUAL')),
  current_step INTEGER NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 1 AND 5),
  status VARCHAR(30) NOT NULL DEFAULT 'STEP_1_ACCOUNT'
    CHECK (status IN ('STEP_1_ACCOUNT', 'STEP_2_FISCAL', 'STEP_3_PLAN', 'STEP_4_CHECKOUT', 'CONVERTED', 'ABANDONED')),
  converted_empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  utm_source VARCHAR(100),
  utm_campaign VARCHAR(100),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_leads_status_activity
  ON public.onboarding_leads (status, last_activity_at DESC);

-- 4. Subscriptions (Netflix-Style 7-Day Free Trial & Recurring Billing)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL UNIQUE REFERENCES public.empresas(id) ON DELETE CASCADE,
  stripe_subscription_id VARCHAR(120) NOT NULL UNIQUE,
  stripe_price_id VARCHAR(120) NOT NULL,
  plan_id VARCHAR(50) NOT NULL,
  billing_cycle VARCHAR(20) NOT NULL CHECK (billing_cycle IN ('MONTHLY', 'ANNUAL')),
  status VARCHAR(30) NOT NULL
    CHECK (status IN ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'UNPAID')),
  trial_start TIMESTAMPTZ NOT NULL,
  trial_end TIMESTAMPTZ NOT NULL,
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  card_brand VARCHAR(30),
  card_last4 VARCHAR(4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Immutable Append-Only Financial Audit Logs (PCI-DSS Compliance)
CREATE TABLE IF NOT EXISTS public.payment_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  user_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  psp_provider VARCHAR(30) NOT NULL DEFAULT 'STRIPE',
  psp_event_id VARCHAR(150) UNIQUE,
  psp_transaction_ref VARCHAR(150),
  event_state VARCHAR(30) NOT NULL
    CHECK (event_state IN ('INITIATED', 'TRIAL_STARTED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'CANCELED')),
  amount_cents BIGINT NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  card_brand VARCHAR(30),
  card_last4 VARCHAR(4),
  idempotency_key VARCHAR(64),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce strict immutability (forbid UPDATE or DELETE on financial audit logs)
CREATE OR REPLACE FUNCTION public.prevent_payment_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Security Violation: payment_audit_logs is strictly append-only and immutable.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_payment_audit_logs ON public.payment_audit_logs;
CREATE TRIGGER trg_immutable_payment_audit_logs
  BEFORE UPDATE OR DELETE ON public.payment_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_payment_audit_modification();

-- 6. Employee Invitations (Magic Link / QR Code & Category Switches)
CREATE TABLE IF NOT EXISTS public.employee_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  invited_by_user_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  cedula_encrypted TEXT NOT NULL,
  cedula_blind_index VARCHAR(64) NOT NULL,
  whatsapp_encrypted TEXT NOT NULL,
  whatsapp_blind_index VARCHAR(64) NOT NULL,
  department VARCHAR(100) NOT NULL,
  allowed_expense_categories JSONB NOT NULL DEFAULT '{
    "ALIMENTACION": true,
    "TRANSPORTE": true,
    "HOSPEDAJE": false,
    "REPRESENTACION": false,
    "OTROS": true
  }'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED')),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_invitations_empresa_status
  ON public.employee_invitations (empresa_id, status);

-- 7. Refresh Token Rotation (RTR) & Token Reuse Detection
CREATE TABLE IF NOT EXISTS public.refresh_token_families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  current_token_hash VARCHAR(64) NOT NULL UNIQUE,
  family_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_reason VARCHAR(100),
  user_agent_hash VARCHAR(64),
  ip_hash VARCHAR(64),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Enable Row-Level Security (RLS) on all new tables
ALTER TABLE public.onboarding_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refresh_token_families ENABLE ROW LEVEL SECURITY;