-- ==========================================================================
-- Migration 018: Fiscal Validity & Delivery Notes Tracking (Venezuela & Global)
-- ==========================================================================
-- PURPOSE:
-- Adds columns to track formal tax validity (SENIAT invoices in VE vs.
-- delivery notes / Notas de Entrega / non-fiscal receipts) and document type.
--
-- SECURITY & MULTI-TENANT AUDIT:
-- Strictly preserves existing Row-Level Security (RLS) policies and
-- tenant composite indexing (Migration 016).
-- ==========================================================================

ALTER TABLE public.gastos
  ADD COLUMN IF NOT EXISTS tiene_validez_fiscal BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS tipo_documento TEXT NOT NULL DEFAULT 'FACTURA_FISCAL';

COMMENT ON COLUMN public.gastos.tiene_validez_fiscal IS 'Indica si el comprobante cumple validez tributaria (ej. Factura Fiscal SENIAT en VE = true; Nota de Entrega / Recibo = false).';
COMMENT ON COLUMN public.gastos.tipo_documento IS 'Clasificación del comprobante: FACTURA_FISCAL, NOTA_ENTREGA, RECIBO_NO_FISCAL, E_RECEIPT.';

CREATE INDEX IF NOT EXISTS idx_gastos_empresa_validez_fiscal
  ON public.gastos (empresa_id, tiene_validez_fiscal);
