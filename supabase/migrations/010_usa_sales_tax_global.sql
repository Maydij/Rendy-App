-- ==========================================================================
-- Migration 010: Multi-Tenant Global USA Sales Tax Extraction & Reporting
-- ==========================================================================
-- PURPOSE:
-- 1. Optional US tax certificate support at company level:
--    - nombre_certificado_usa (e.g. 'Annual Resale Certificate', 'Tax-Exempt 501(c)(3)')
--    - url_certificado_usa (public storage URL in certificados_fiscales)
--    - us_tax_exempt and url_certificado_tax_exempt (kept for backward compatibility)
-- 2. Objective geographic jurisdiction & numerical tax breakdown on `gastos`:
--    - pais_gasto: 'US' | 'VE' | 'MX' | 'OTRO'
--    - estado_region: 2-letter uppercase ISO US state code (FL, TX, NY, CA, etc.)
--    - ciudad: City name
--    - codigo_postal: ZIP code
--    - tiene_sales_tax: Boolean flag (true if sales_tax_usd > 0)
--    - subtotal_usd: Base amount before taxes and gratuities
--    - sales_tax_usd: Exact state/county/city sales tax paid
--    - propina_usd: Voluntary tip / gratuity strictly isolated from taxes
--    - estado_tax_usa: Maintained for legacy compatibility
-- 3. Composite performance index on `gastos` for state-level reporting.
-- 4. Storage bucket `certificados_fiscales` configuration.
-- ==========================================================================

-- 1. Soporte opcional de certificado fiscal USA a nivel de empresa
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS nombre_certificado_usa VARCHAR(120) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS url_certificado_usa TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS us_tax_exempt BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS url_certificado_tax_exempt TEXT DEFAULT NULL;

-- 2. Campos de jurisdicción y desglose numérico USA en la tabla gastos
ALTER TABLE gastos
  ADD COLUMN IF NOT EXISTS pais_gasto VARCHAR(10) DEFAULT 'VE',
  ADD COLUMN IF NOT EXISTS estado_region VARCHAR(50),
  ADD COLUMN IF NOT EXISTS ciudad VARCHAR(100),
  ADD COLUMN IF NOT EXISTS codigo_postal VARCHAR(20),
  ADD COLUMN IF NOT EXISTS tiene_sales_tax BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS subtotal_usd NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS sales_tax_usd NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS propina_usd NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS estado_tax_usa VARCHAR(30) DEFAULT 'NO_APLICA';

-- 3. Backfill coherente de tiene_sales_tax para gastos existentes
UPDATE gastos
SET tiene_sales_tax = (COALESCE(sales_tax_usd, 0) > 0)
WHERE pais_gasto = 'US';

-- 4. Índice compuesto para optimizar el filtrado y agrupación por estado en reportes
CREATE INDEX IF NOT EXISTS idx_gastos_usa_desglose 
  ON gastos (empresa_id, pais_gasto, estado_region, tiene_sales_tax)
  WHERE pais_gasto = 'US';

-- 5. Bucket de Storage para certificados fiscales de clientes
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificados_fiscales', 'certificados_fiscales', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 6. Recarga inmediata de la caché de PostgREST
NOTIFY pgrst, 'reload schema';
