-- ==========================================================================
-- Migration 006: Corporate Reimbursements Lifecycle & Dashboard Optimization
-- ==========================================================================
-- PURPOSE:
-- 1. Standardize reimbursement lifecycle states in `estado_gasto` enum:
--    - 'PROCESADO': Validated by accounting, ready for transfer/payment.
--    - 'TRANSFERIDO': Payment issued and settled with the employee.
-- 2. Add `actualizado_en` audit timestamp to `gastos` table.
-- 3. Create a partial index for multi-tenant reimbursement queries in the dashboard.
-- ==========================================================================

-- 1. Extend enum `estado_gasto` with reimbursement settlement statuses
ALTER TYPE estado_gasto ADD VALUE IF NOT EXISTS 'PROCESADO';
ALTER TYPE estado_gasto ADD VALUE IF NOT EXISTS 'TRANSFERIDO';

-- 2. Add audit column for updates
ALTER TABLE gastos
  ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ DEFAULT NOW();

-- 3. Composite partial index for multi-tenant reimbursement dashboard queries
CREATE INDEX IF NOT EXISTS idx_gastos_reembolsos_dashboard 
  ON gastos (empresa_id, es_reembolso, estado, fecha_gasto DESC) 
  WHERE es_reembolso = TRUE;

