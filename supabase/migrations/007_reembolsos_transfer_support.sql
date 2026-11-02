-- ==========================================================================
-- Migration 007: Reimbursement Transfer Proof & Audit Support
-- ==========================================================================
-- PURPOSE:
-- 1. Add `url_comprobante_pago`, `fecha_transferencia`, and `transferido_por`
--    columns to `gastos` table to persist bank transfer settlements.
-- 2. Ensure `comprobantes_pago` storage bucket exists.
-- 3. Synchronize legacy personal expenses so they are tracked as reimbursements.
-- ==========================================================================

ALTER TABLE gastos
  ADD COLUMN IF NOT EXISTS url_comprobante_pago TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fecha_transferencia TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS transferido_por UUID REFERENCES usuarios(id) ON DELETE SET NULL;

INSERT INTO storage.buckets (id, name, public)
VALUES ('comprobantes_pago', 'comprobantes_pago', true)
ON CONFLICT (id) DO NOTHING;

-- Synchronize legacy personal expenses without viático / corporate payment method
UPDATE gastos
SET es_reembolso = TRUE
WHERE viatico_id IS NULL
  AND solicitud_id IS NULL
  AND metodo_pago_id IS NULL
  AND es_reembolso IS NOT TRUE;

