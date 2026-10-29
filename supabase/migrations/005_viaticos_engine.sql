-- ==========================================================================
-- Migration 005: Viáticos Engine — Budget Allocations & Gastos Imputation
-- Sprint 2 - Bloque 2: Operational Viáticos Model + Dual Routing
-- ==========================================================================
-- PURPOSE: Create the `viaticos` table for per-project budget allocations
-- and add imputation columns (`viatico_id`, `es_reembolso`) to `gastos`.
-- Also ensures `sesiones_whatsapp` has `empleado_id` for stateful sessions.
--
-- NOTE: The FK `empleado_id` references `usuarios(id)` (custom table),
-- NOT `auth.users(id)`, since Rendy uses its own user management layer.
-- ==========================================================================

-- 1. Viáticos / Budget Allocations per Project
CREATE TABLE IF NOT EXISTS viaticos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id         UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  empresa_id          UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre_proyecto     VARCHAR(100) NOT NULL,
  proyecto_id         UUID REFERENCES proyectos(id) ON DELETE SET NULL,
  monto_asignado_usd  NUMERIC(12,2) NOT NULL CHECK (monto_asignado_usd > 0),
  estado              VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE_APROBACION',
  fecha_inicio        DATE DEFAULT CURRENT_DATE,
  fecha_cierre        DATE,
  creado_en           TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE viaticos IS 'Active budget allocations per employee/project. Tracks assigned USD amount and lifecycle state.';
COMMENT ON COLUMN viaticos.estado IS 'PENDIENTE_APROBACION | ACTIVO | CERRADO | RECHAZADO';
COMMENT ON COLUMN viaticos.monto_asignado_usd IS 'Total budget assigned to this viático in USD';

-- 2. Imputation & Reimbursement columns on gastos
ALTER TABLE gastos
  ADD COLUMN IF NOT EXISTS viatico_id    UUID REFERENCES viaticos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS es_reembolso  BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN gastos.viatico_id IS 'FK to the viático budget this expense is charged against (NULL = reimbursement)';
COMMENT ON COLUMN gastos.es_reembolso IS 'True if the employee paid with personal funds (reimbursement flow)';

-- 3. Ensure sesiones_whatsapp has empleado_id for session identity
ALTER TABLE sesiones_whatsapp
  ADD COLUMN IF NOT EXISTS empleado_id UUID REFERENCES usuarios(id) ON DELETE CASCADE;

-- 4. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_viaticos_empleado_estado
  ON viaticos (empleado_id, estado);

CREATE INDEX IF NOT EXISTS idx_gastos_viatico_acumulado
  ON gastos (viatico_id, estado)
  WHERE viatico_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sesiones_whatsapp_ultima
  ON sesiones_whatsapp (ultima_interaccion);

-- 5. RLS Policies for viaticos
ALTER TABLE viaticos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Full access service role on viaticos"
  ON viaticos
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ==========================================================================
-- DONE — Execute this script once in Supabase SQL Editor.
-- ==========================================================================

