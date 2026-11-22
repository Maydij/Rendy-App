-- ============================================================================
-- Migration: 016_hardening_multitenant_rls_y_constraints.sql
-- Purpose: Complete Multi-Tenant Security Hardening (Zero-Leakage Guarantee)
--          1. Scope unique constraints and indexes on `gastos` by `(empresa_id, ...)`
--             so two different organizations can upload identical physical receipts.
--          2. Ensure `intentos_duplicados` and `reportes_generados` tables exist
--             with proper multi-tenant `empresa_id` isolation.
--          3. Remove overly permissive RLS policies and enforce strict tenant
--             isolation policies based on authenticated user's `empresa_id`.
--          4. Defensive guards (to_regclass): works even if optional prior
--             migrations have not been executed.
--          5. Reload schema cache for PostgREST.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────
-- 1. GASTOS: MULTI-TENANT COMPOSITE CONSTRAINTS & INDEXES
-- ─────────────────────────────────────────────────────────────

-- A. Drop legacy global indexes on gastos that lacked empresa_id
DROP INDEX IF EXISTS public.idx_gastos_hash_duplicado;
DROP INDEX IF EXISTS public.idx_gastos_verificacion_duplicados;
DROP INDEX IF EXISTS public.idx_gastos_hash_comprobante;

-- B. Drop legacy global unique constraints if any were created
ALTER TABLE public.gastos
  DROP CONSTRAINT IF EXISTS gastos_hash_duplicado_key,
  DROP CONSTRAINT IF EXISTS gastos_hash_comprobante_key,
  DROP CONSTRAINT IF EXISTS gastos_numero_factura_key;

-- C. Composite Unique Index: Enforce duplicate prevention ONLY within the same tenant
--    Uses estado <> 'RECHAZADO' to be strictly compatible with the estado_gasto enum.
CREATE UNIQUE INDEX IF NOT EXISTS idx_gastos_empresa_hash_unique
  ON public.gastos (empresa_id, hash_duplicado)
  WHERE hash_duplicado IS NOT NULL AND estado <> 'RECHAZADO';

-- D. Composite Index: Secondary defensive lock (RIF + Factura + Monto) within tenant
CREATE INDEX IF NOT EXISTS idx_gastos_empresa_rif_factura_monto
  ON public.gastos (empresa_id, rif_comercio, numero_factura, monto_total)
  WHERE rif_comercio IS NOT NULL AND numero_factura IS NOT NULL;

-- E. Composite Index: File SHA-256 hash match within tenant
CREATE INDEX IF NOT EXISTS idx_gastos_empresa_hash_comprobante
  ON public.gastos (empresa_id, hash_comprobante)
  WHERE hash_comprobante IS NOT NULL;


-- ─────────────────────────────────────────────────────────────
-- 2. AUDIT TRAIL: INTENTOS_DUPLICADOS TENANT ISOLATION
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.intentos_duplicados (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id         UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  empleado_id        UUID REFERENCES public.usuarios(id),
  telefono_remitente VARCHAR(20)    NOT NULL,
  rif_comercio       VARCHAR(20),
  numero_factura     VARCHAR(50),
  monto_total        NUMERIC(12,2),
  hash_duplicado     VARCHAR(64)    NOT NULL,
  gasto_original_id  UUID REFERENCES public.gastos(id),
  creado_en          TIMESTAMPTZ    DEFAULT NOW()
);

ALTER TABLE public.intentos_duplicados
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;

-- Backfill existing records if any
UPDATE public.intentos_duplicados idup
SET empresa_id = g.empresa_id
FROM public.gastos g
WHERE idup.gasto_original_id = g.id AND idup.empresa_id IS NULL;

UPDATE public.intentos_duplicados idup
SET empresa_id = u.empresa_id
FROM public.usuarios u
WHERE idup.empleado_id = u.id AND idup.empresa_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_intentos_duplicados_empresa
  ON public.intentos_duplicados (empresa_id);

CREATE INDEX IF NOT EXISTS idx_intentos_duplicados_empresa_hash
  ON public.intentos_duplicados (empresa_id, hash_duplicado);


-- ─────────────────────────────────────────────────────────────
-- 3. REPORTES GENERADOS (CREAR SI NO EXISTE)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reportes_generados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  nombre_reporte VARCHAR(150) NOT NULL,
  formato VARCHAR(10) NOT NULL DEFAULT 'XLSX',
  filtros_aplicados JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_gastos_incluidos INT DEFAULT 0,
  monto_total_usd NUMERIC(12,2) DEFAULT 0.00,
  monto_total_ves NUMERIC(12,2) DEFAULT 0.00,
  url_archivo TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reportes_empresa_fecha 
  ON public.reportes_generados (empresa_id, creado_en DESC);


-- ─────────────────────────────────────────────────────────────
-- 4. TENANT SECURITY FUNCTION & ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────────

-- Helper function: Returns the empresa_id of the currently authenticated Supabase user
CREATE OR REPLACE FUNCTION public.get_auth_empresa_id()
RETURNS UUID AS $$
  SELECT empresa_id FROM public.usuarios WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Enable RLS defensively on existing tables
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'gastos',
    'solicitudes_viaticos',
    'viaticos',
    'categorias_gastos',
    'proyectos',
    'intentos_duplicados',
    'reportes_generados',
    'usuarios',
    'empresas',
    'sesiones_whatsapp'
  ])
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    END IF;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 5. RLS POLICIES APPLIED DEFENSIVELY (TABLA POR TABLA)
-- ─────────────────────────────────────────────────────────────

-- GASTOS
DO $$
BEGIN
  IF to_regclass('public.gastos') IS NOT NULL THEN
    DROP POLICY IF EXISTS "tenant_isolation_gastos_select" ON public.gastos;
    DROP POLICY IF EXISTS "tenant_isolation_gastos_insert" ON public.gastos;
    DROP POLICY IF EXISTS "tenant_isolation_gastos_update" ON public.gastos;
    DROP POLICY IF EXISTS "tenant_isolation_gastos_delete" ON public.gastos;
    DROP POLICY IF EXISTS "service_role_all_gastos" ON public.gastos;
    DROP POLICY IF EXISTS "service_role_unrestricted_gastos" ON public.gastos;

    CREATE POLICY "service_role_all_gastos" ON public.gastos FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "tenant_isolation_gastos_select" ON public.gastos FOR SELECT TO authenticated USING (empresa_id = public.get_auth_empresa_id());
    CREATE POLICY "tenant_isolation_gastos_insert" ON public.gastos FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_auth_empresa_id());
    CREATE POLICY "tenant_isolation_gastos_update" ON public.gastos FOR UPDATE TO authenticated USING (empresa_id = public.get_auth_empresa_id()) WITH CHECK (empresa_id = public.get_auth_empresa_id());
    CREATE POLICY "tenant_isolation_gastos_delete" ON public.gastos FOR DELETE TO authenticated USING (empresa_id = public.get_auth_empresa_id());
  END IF;
END $$;

-- SOLICITUDES_VIATICOS
DO $$
BEGIN
  IF to_regclass('public.solicitudes_viaticos') IS NOT NULL THEN
    DROP POLICY IF EXISTS "tenant_isolation_solicitudes_select" ON public.solicitudes_viaticos;
    DROP POLICY IF EXISTS "tenant_isolation_solicitudes_insert" ON public.solicitudes_viaticos;
    DROP POLICY IF EXISTS "tenant_isolation_solicitudes_update" ON public.solicitudes_viaticos;
    DROP POLICY IF EXISTS "service_role_all_solicitudes" ON public.solicitudes_viaticos;

    CREATE POLICY "service_role_all_solicitudes" ON public.solicitudes_viaticos FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "tenant_isolation_solicitudes_select" ON public.solicitudes_viaticos FOR SELECT TO authenticated USING (empresa_id = public.get_auth_empresa_id());
    CREATE POLICY "tenant_isolation_solicitudes_insert" ON public.solicitudes_viaticos FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_auth_empresa_id());
    CREATE POLICY "tenant_isolation_solicitudes_update" ON public.solicitudes_viaticos FOR UPDATE TO authenticated USING (empresa_id = public.get_auth_empresa_id()) WITH CHECK (empresa_id = public.get_auth_empresa_id());
  END IF;
END $$;

-- VIATICOS
DO $$
BEGIN
  IF to_regclass('public.viaticos') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Full access service role on viaticos" ON public.viaticos;
    DROP POLICY IF EXISTS "service_role_all_viaticos" ON public.viaticos;
    DROP POLICY IF EXISTS "tenant_isolation_viaticos_select" ON public.viaticos;
    DROP POLICY IF EXISTS "tenant_isolation_viaticos_insert" ON public.viaticos;
    DROP POLICY IF EXISTS "tenant_isolation_viaticos_update" ON public.viaticos;

    CREATE POLICY "service_role_all_viaticos" ON public.viaticos FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "tenant_isolation_viaticos_select" ON public.viaticos FOR SELECT TO authenticated USING (empresa_id = public.get_auth_empresa_id());
    CREATE POLICY "tenant_isolation_viaticos_insert" ON public.viaticos FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_auth_empresa_id());
    CREATE POLICY "tenant_isolation_viaticos_update" ON public.viaticos FOR UPDATE TO authenticated USING (empresa_id = public.get_auth_empresa_id()) WITH CHECK (empresa_id = public.get_auth_empresa_id());
  END IF;
END $$;

-- CATEGORIAS_GASTOS
DO $$
BEGIN
  IF to_regclass('public.categorias_gastos') IS NOT NULL THEN
    DROP POLICY IF EXISTS "service_role_all_categorias" ON public.categorias_gastos;
    DROP POLICY IF EXISTS "tenant_isolation_categorias_select" ON public.categorias_gastos;
    DROP POLICY IF EXISTS "tenant_isolation_categorias_insert" ON public.categorias_gastos;
    DROP POLICY IF EXISTS "tenant_isolation_categorias_update" ON public.categorias_gastos;

    CREATE POLICY "service_role_all_categorias" ON public.categorias_gastos FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "tenant_isolation_categorias_select" ON public.categorias_gastos FOR SELECT TO authenticated USING (empresa_id = public.get_auth_empresa_id());
    CREATE POLICY "tenant_isolation_categorias_insert" ON public.categorias_gastos FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_auth_empresa_id());
    CREATE POLICY "tenant_isolation_categorias_update" ON public.categorias_gastos FOR UPDATE TO authenticated USING (empresa_id = public.get_auth_empresa_id()) WITH CHECK (empresa_id = public.get_auth_empresa_id());
  END IF;
END $$;

-- PROYECTOS
DO $$
BEGIN
  IF to_regclass('public.proyectos') IS NOT NULL THEN
    DROP POLICY IF EXISTS "service_role_all_proyectos" ON public.proyectos;
    DROP POLICY IF EXISTS "tenant_isolation_proyectos_select" ON public.proyectos;
    DROP POLICY IF EXISTS "tenant_isolation_proyectos_insert" ON public.proyectos;
    DROP POLICY IF EXISTS "tenant_isolation_proyectos_update" ON public.proyectos;

    CREATE POLICY "service_role_all_proyectos" ON public.proyectos FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "tenant_isolation_proyectos_select" ON public.proyectos FOR SELECT TO authenticated USING (empresa_id = public.get_auth_empresa_id());
    CREATE POLICY "tenant_isolation_proyectos_insert" ON public.proyectos FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_auth_empresa_id());
    CREATE POLICY "tenant_isolation_proyectos_update" ON public.proyectos FOR UPDATE TO authenticated USING (empresa_id = public.get_auth_empresa_id()) WITH CHECK (empresa_id = public.get_auth_empresa_id());
  END IF;
END $$;

-- INTENTOS_DUPLICADOS
DO $$
BEGIN
  IF to_regclass('public.intentos_duplicados') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Acceso completo service role en intentos_duplicados" ON public.intentos_duplicados;
    DROP POLICY IF EXISTS "service_role_all_intentos" ON public.intentos_duplicados;
    DROP POLICY IF EXISTS "tenant_isolation_intentos_select" ON public.intentos_duplicados;

    CREATE POLICY "service_role_all_intentos" ON public.intentos_duplicados FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "tenant_isolation_intentos_select" ON public.intentos_duplicados FOR SELECT TO authenticated USING (empresa_id = public.get_auth_empresa_id());
  END IF;
END $$;

-- REPORTES_GENERADOS
DO $$
BEGIN
  IF to_regclass('public.reportes_generados') IS NOT NULL THEN
    DROP POLICY IF EXISTS "tenant_isolation_reportes_all" ON public.reportes_generados;
    CREATE POLICY "tenant_isolation_reportes_all" ON public.reportes_generados FOR ALL TO authenticated USING (empresa_id = public.get_auth_empresa_id()) WITH CHECK (empresa_id = public.get_auth_empresa_id());
  END IF;
END $$;

-- SESIONES_WHATSAPP
DO $$
BEGIN
  IF to_regclass('public.sesiones_whatsapp') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Acceso completo service role en sesiones_whatsapp" ON public.sesiones_whatsapp;
    DROP POLICY IF EXISTS "service_role_all_sesiones" ON public.sesiones_whatsapp;
    CREATE POLICY "service_role_all_sesiones" ON public.sesiones_whatsapp FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- EMPRESAS
DO $$
BEGIN
  IF to_regclass('public.empresas') IS NOT NULL THEN
    DROP POLICY IF EXISTS "service_role_all_empresas" ON public.empresas;
    DROP POLICY IF EXISTS "tenant_isolation_empresas_select" ON public.empresas;
    DROP POLICY IF EXISTS "tenant_isolation_empresas_update" ON public.empresas;

    CREATE POLICY "service_role_all_empresas" ON public.empresas FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "tenant_isolation_empresas_select" ON public.empresas FOR SELECT TO authenticated USING (id = public.get_auth_empresa_id());
    CREATE POLICY "tenant_isolation_empresas_update" ON public.empresas FOR UPDATE TO authenticated USING (id = public.get_auth_empresa_id()) WITH CHECK (id = public.get_auth_empresa_id());
  END IF;
END $$;

-- USUARIOS
DO $$
BEGIN
  IF to_regclass('public.usuarios') IS NOT NULL THEN
    DROP POLICY IF EXISTS "service_role_all_usuarios" ON public.usuarios;
    DROP POLICY IF EXISTS "tenant_isolation_usuarios_select" ON public.usuarios;
    DROP POLICY IF EXISTS "tenant_isolation_usuarios_update" ON public.usuarios;

    CREATE POLICY "service_role_all_usuarios" ON public.usuarios FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "tenant_isolation_usuarios_select" ON public.usuarios FOR SELECT TO authenticated USING (empresa_id = public.get_auth_empresa_id());
    CREATE POLICY "tenant_isolation_usuarios_update" ON public.usuarios FOR UPDATE TO authenticated USING (empresa_id = public.get_auth_empresa_id()) WITH CHECK (empresa_id = public.get_auth_empresa_id());
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────
-- 6. RELOAD SCHEMA CACHE
-- ─────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
