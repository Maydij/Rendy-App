-- ==========================================================================
-- Migration 012: Multi-Jurisdiction Adaptive E-Receipts & Universal Tax Fields
-- ==========================================================================
-- PURPOSE:
-- Add universal neutral fiscal columns to `gastos` to support Mexico (SAT),
-- Latin America, Europe, and international receipts alongside USA and Venezuela:
-- - nombre_impuesto_local: e.g. 'Sales Tax', 'IVA', 'VAT', 'IGV', 'IEPS'
-- - tasa_impuesto_aplicada: e.g. 7.00, 16.00, 8.00, 21.00
-- - impuesto_local_monto: exact local tax amount extracted
-- - subtotal_local: exact local pre-tax subtotal
-- - folio_fiscal_uuid: CFDI UUID or authorization voucher code
-- ==========================================================================

ALTER TABLE gastos
  ADD COLUMN IF NOT EXISTS nombre_impuesto_local VARCHAR(40),
  ADD COLUMN IF NOT EXISTS tasa_impuesto_aplicada NUMERIC(5,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS impuesto_local_monto NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS subtotal_local NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS folio_fiscal_uuid VARCHAR(100),
  ADD COLUMN IF NOT EXISTS es_deducible_fiscal BOOLEAN DEFAULT TRUE;

-- Recarga inmediata de la caché de PostgREST
NOTIFY pgrst, 'reload schema';
