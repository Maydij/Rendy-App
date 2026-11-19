-- ==========================================================================
-- Migration 011: Multi-Tenant Expense Categories & Daily Spending Limits
-- ==========================================================================
-- PURPOSE:
-- 1. Table `categorias_gastos` multi-tenant with daily limit `limite_diario_usd`.
-- 2. Trigger `trg_seed_categorias_empresa` to seed the 8 official Rendy categories:
--    - Food/Beverage (🍔)
--    - Parking & Tolls/Taxi (🚕)
--    - Hotel (🏨)
--    - Gas (Fuel) (⛽)
--    - Airfare/train (✈️)
--    - Car Rental (🚗)
--    - Materiales (📦)
--    - Miscellaneous (📌)
-- 3. Backfill block for all existing companies.
-- 4. PostgREST schema cache reload.
-- ==========================================================================

-- 1. Tabla multi-tenant de categorías con límite diario integrado
CREATE TABLE IF NOT EXISTS categorias_gastos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  codigo VARCHAR(60) NOT NULL,
  nombre VARCHAR(60) NOT NULL,
  descripcion VARCHAR(100),
  icono VARCHAR(16) DEFAULT '📌',
  limite_diario_usd NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (limite_diario_usd >= 0),
  es_sistema BOOLEAN DEFAULT FALSE,
  activa BOOLEAN DEFAULT TRUE,
  orden INT DEFAULT 0,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (empresa_id, codigo)
);

-- Asegurar columna si la tabla ya existía previamente
ALTER TABLE categorias_gastos
  ADD COLUMN IF NOT EXISTS limite_diario_usd NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (limite_diario_usd >= 0);

CREATE INDEX IF NOT EXISTS idx_categorias_empresa_activas 
  ON categorias_gastos (empresa_id, activa, orden, nombre);

-- 2. Función trigger para sembrar las 8 categorías oficiales al crear una empresa nueva
CREATE OR REPLACE FUNCTION seed_categorias_defecto_empresa()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO categorias_gastos (empresa_id, codigo, nombre, descripcion, icono, limite_diario_usd, es_sistema, activa, orden)
  VALUES
    (NEW.id, 'FOOD_BEVERAGE', 'Food/Beverage', 'Comidas, restaurantes y bebidas', '🍔', 0.00, TRUE, TRUE, 1),
    (NEW.id, 'PARKING_TOLLS_TAXI', 'Parking & Tolls/Taxi', 'Estacionamientos, peajes, taxis y Uber', '🚕', 0.00, TRUE, TRUE, 2),
    (NEW.id, 'HOTEL', 'Hotel', 'Hoteles, posadas y alojamiento', '🏨', 0.00, TRUE, TRUE, 3),
    (NEW.id, 'GAS_FUEL', 'Gas (Fuel)', 'Combustible, gasolina y diésel', '⛽', 0.00, TRUE, TRUE, 4),
    (NEW.id, 'AIRFARE_TRAIN', 'Airfare/train', 'Boletos aéreos, trenes y pasajes', '✈️', 0.00, TRUE, TRUE, 5),
    (NEW.id, 'CAR_RENTAL', 'Car Rental', 'Alquiler de vehículos y transporte', '🚗', 0.00, TRUE, TRUE, 6),
    (NEW.id, 'MATERIALES', 'Materiales', 'Insumos, repuestos y materiales operativos', '📦', 0.00, TRUE, TRUE, 7),
    (NEW.id, 'MISCELLANEOUS', 'Miscellaneous', 'Gastos varios y misceláneos', '📌', 0.00, TRUE, TRUE, 99)
  ON CONFLICT (empresa_id, codigo) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger en tabla empresas
DROP TRIGGER IF EXISTS trg_seed_categorias_empresa ON empresas;
CREATE TRIGGER trg_seed_categorias_empresa
  AFTER INSERT ON empresas
  FOR EACH ROW
  EXECUTE FUNCTION seed_categorias_defecto_empresa();

-- 4. Sincronizar empresas existentes con el catálogo oficial por defecto
DO $$
DECLARE
  emp RECORD;
BEGIN
  -- Limpiar categorías de prueba anteriores si existieran
  DELETE FROM categorias_gastos
  WHERE es_sistema = TRUE AND codigo NOT IN (
    'FOOD_BEVERAGE', 'PARKING_TOLLS_TAXI', 'HOTEL', 'GAS_FUEL',
    'AIRFARE_TRAIN', 'CAR_RENTAL', 'MATERIALES', 'MISCELLANEOUS'
  );

  FOR emp IN SELECT id FROM empresas LOOP
    INSERT INTO categorias_gastos (empresa_id, codigo, nombre, descripcion, icono, limite_diario_usd, es_sistema, activa, orden)
    VALUES
      (emp.id, 'FOOD_BEVERAGE', 'Food/Beverage', 'Comidas, restaurantes y bebidas', '🍔', 0.00, TRUE, TRUE, 1),
      (emp.id, 'PARKING_TOLLS_TAXI', 'Parking & Tolls/Taxi', 'Estacionamientos, peajes, taxis y Uber', '🚕', 0.00, TRUE, TRUE, 2),
      (emp.id, 'HOTEL', 'Hotel', 'Hoteles, posadas y alojamiento', '🏨', 0.00, TRUE, TRUE, 3),
      (emp.id, 'GAS_FUEL', 'Gas (Fuel)', 'Combustible, gasolina y diésel', '⛽', 0.00, TRUE, TRUE, 4),
      (emp.id, 'AIRFARE_TRAIN', 'Airfare/train', 'Boletos aéreos, trenes y pasajes', '✈️', 0.00, TRUE, TRUE, 5),
      (emp.id, 'CAR_RENTAL', 'Car Rental', 'Alquiler de vehículos y transporte', '🚗', 0.00, TRUE, TRUE, 6),
      (emp.id, 'MATERIALES', 'Materiales', 'Insumos, repuestos y materiales operativos', '📦', 0.00, TRUE, TRUE, 7),
      (emp.id, 'MISCELLANEOUS', 'Miscellaneous', 'Gastos varios y misceláneos', '📌', 0.00, TRUE, TRUE, 99)
    ON CONFLICT (empresa_id, codigo) DO NOTHING;
  END LOOP;
END $$;

-- 5. Recarga inmediata del schema cache de PostgREST
NOTIFY pgrst, 'reload schema';
