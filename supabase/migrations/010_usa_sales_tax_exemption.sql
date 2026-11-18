-- ==========================================================================
-- Migration 010: USA Sales Tax Audit & Tax-Exempt Management
-- ==========================================================================
-- PURPOSE:
-- 1. Add `us_tax_exempt` and `url_certificado_tax_exempt` to `empresas` table
--    to support US sales tax-exempt company registration and certificate storage.
-- 2. Add geographic and US sales tax breakdown fields to `gastos`:
--    - `pais_gasto`: Country code ('US' | 'VE' | 'MX' | 'OTRO')
--    - `estado_region`: 2-letter uppercase US state code (e.g. 'FL', 'TX', 'NY')
--    - `ciudad`: City name
--    - `codigo_postal`: ZIP code
--    - `estado_tax_usa`: Audit tax classification ('EXENTO_APLICADO' | 'FUGA_FISCAL_RECUPERABLE' | 'ESTADO_SIN_SALES_TAX' | 'NO_APLICA')
--    - `subtotal_usd`: Base amount before sales taxes and tips
--    - `sales_tax_usd`: State and local sales tax amount
--    - `propina_usd`: Tip / gratuity amount
-- 3. Create composite index on `gastos` for US tax queries.
-- 4. Ensure Supabase Storage bucket `certificados_fiscales` exists for PDF/image uploads.
-- ==========================================================================

-- 1. Configuración de exención fiscal en la tabla empresas
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS us_tax_exempt BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS url_certificado_tax_exempt TEXT DEFAULT NULL;

-- 2. Campos de ubicación y desglose fiscal USA en gastos
ALTER TABLE gastos
  ADD COLUMN IF NOT EXISTS pais_gasto VARCHAR(10) DEFAULT 'VE',
  ADD COLUMN IF NOT EXISTS estado_region VARCHAR(50),
  ADD COLUMN IF NOT EXISTS ciudad VARCHAR(100),
  ADD COLUMN IF NOT EXISTS codigo_postal VARCHAR(20),
  ADD COLUMN IF NOT EXISTS estado_tax_usa VARCHAR(30) DEFAULT 'NO_APLICA',
  ADD COLUMN IF NOT EXISTS subtotal_usd NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS sales_tax_usd NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS propina_usd NUMERIC(12,2) DEFAULT 0.00;

-- 3. Índice para agrupar recuperaciones de impuestos por estado
CREATE INDEX IF NOT EXISTS idx_gastos_usa_tax 
  ON gastos (empresa_id, pais_gasto, estado_region, estado_tax_usa)
  WHERE pais_gasto = 'US';

-- 4. Bucket de Storage para el Certificado Tax-Exempt
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificados_fiscales', 'certificados_fiscales', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Document table and columns
COMMENT ON COLUMN empresas.us_tax_exempt IS 'Indicates whether the company possesses a valid US Sales Tax Exemption Certificate';
COMMENT ON COLUMN empresas.url_certificado_tax_exempt IS 'Public storage URL for the current active Tax-Exempt Certificate document or image';
COMMENT ON COLUMN gastos.pais_gasto IS 'Country where the expense took place (US, VE, MX, OTRO)';
COMMENT ON COLUMN gastos.estado_region IS '2-letter US State ISO code (FL, TX, NY, CA, etc.) or regional jurisdiction';
COMMENT ON COLUMN gastos.estado_tax_usa IS 'Audit classification: EXENTO_APLICADO, FUGA_FISCAL_RECUPERABLE, ESTADO_SIN_SALES_TAX, NO_APLICA';
COMMENT ON COLUMN gastos.subtotal_usd IS 'Base expense amount in USD before taxes and gratuities';
COMMENT ON COLUMN gastos.sales_tax_usd IS 'State and local sales tax paid in USD';
COMMENT ON COLUMN gastos.propina_usd IS 'Voluntary tip or service charge in USD';

-- 5. Recarga inmediata de la caché de esquema en Supabase PostgREST
NOTIFY pgrst, 'reload schema';
