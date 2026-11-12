-- ==========================================================================
-- Migration 008: Accounting Reports Generation & Audit History
-- ==========================================================================
-- PURPOSE:
-- 1. Create table `reportes_generados` to audit and log all exported financial
--    reports (Excel/PDF) per company, tracking applied filters, totals, and metadata.
-- 2. Add high-performance composite index for dashboard history lookup.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS reportes_generados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre_reporte VARCHAR(150) NOT NULL,
  formato VARCHAR(10) NOT NULL DEFAULT 'XLSX',
  filtros_aplicados JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_gastos_incluidos INT DEFAULT 0,
  monto_total_usd NUMERIC(12,2) DEFAULT 0.00,
  monto_total_ves NUMERIC(12,2) DEFAULT 0.00,
  url_archivo TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Fast lookup index for company reports ordered chronologically
CREATE INDEX IF NOT EXISTS idx_reportes_empresa_fecha 
  ON reportes_generados (empresa_id, creado_en DESC);

-- Document table and columns
COMMENT ON TABLE reportes_generados IS 'Audit log of generated accounting reports and exported spreadsheets';
COMMENT ON COLUMN reportes_generados.nombre_reporte IS 'Human readable title of the report (e.g. Reporte_Gastos_2026-11)';
COMMENT ON COLUMN reportes_generados.formato IS 'File format of the export: XLSX or PDF';
COMMENT ON COLUMN reportes_generados.filtros_aplicados IS 'JSON snapshot of the filter parameters used during report generation';
COMMENT ON COLUMN reportes_generados.total_gastos_incluidos IS 'Number of expense line-items included in the report';
COMMENT ON COLUMN reportes_generados.monto_total_usd IS 'Aggregated total in USD at the time of export';
COMMENT ON COLUMN reportes_generados.monto_total_ves IS 'Aggregated total in VES at the time of export';

