-- ==========================================================================
-- Migration 004: Fiscal Tax Breakdown & Dual-Currency Support
-- Sprint 2 - Bloque 1: Venezuelan Fiscal Logic
-- ==========================================================================
-- PURPOSE: Add fiscal decomposition columns (base_imponible, iva, exento, igtf)
-- and dual-currency consolidation (monto_ves, monto_usd) to the gastos table.
-- This enables SENIAT-compliant accounting and bimonetary traceability.
--
-- NOTE: This migration was applied directly in Supabase. This file serves as
-- a version-controlled reference for the schema changes.
-- ==========================================================================

ALTER TABLE gastos
  -- Currency & Exchange Rate Metadata
  ADD COLUMN IF NOT EXISTS moneda_original VARCHAR(3) DEFAULT 'VES',
  ADD COLUMN IF NOT EXISTS tasa_cambio NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS origen_tasa VARCHAR(20) DEFAULT 'sistema',

  -- Fiscal Tax Breakdown in Bolívares (Legal Fiscal Currency)
  ADD COLUMN IF NOT EXISTS base_imponible_ves NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS iva_ves NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS exento_ves NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS igtf_ves NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS monto_ves NUMERIC(12,2) DEFAULT 0.00,

  -- USD Consolidation (Internal Control Currency)
  ADD COLUMN IF NOT EXISTS monto_usd NUMERIC(12,2) DEFAULT 0.00,

  -- Audit Flags
  ADD COLUMN IF NOT EXISTS requiere_revision_fiscal BOOLEAN DEFAULT FALSE;

-- Add comments for documentation
COMMENT ON COLUMN gastos.moneda_original IS 'Original currency of the invoice: VES or USD';
COMMENT ON COLUMN gastos.origen_tasa IS 'Source of the exchange rate: factura (printed on invoice) or sistema (BCV official rate)';
COMMENT ON COLUMN gastos.base_imponible_ves IS 'Tax base amount in VES (goods/services subject to IVA)';
COMMENT ON COLUMN gastos.iva_ves IS 'IVA 16% amount in VES';
COMMENT ON COLUMN gastos.exento_ves IS 'Tax-exempt amount in VES';
COMMENT ON COLUMN gastos.igtf_ves IS 'IGTF 3% amount in VES (large financial transactions tax)';
COMMENT ON COLUMN gastos.monto_ves IS 'Total invoice amount in VES';
COMMENT ON COLUMN gastos.monto_usd IS 'Total invoice amount in USD';
COMMENT ON COLUMN gastos.requiere_revision_fiscal IS 'Flag: true if fiscal breakdown does not match total (discrepancy > 0.05)';

