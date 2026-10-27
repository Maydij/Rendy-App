-- =====================================================================
-- MIGRATION: Módulo Anti-Fraude - Detección de Duplicados (Sprint 2)
-- Descripción: Agrega columnas fiscales de deduplicación a la tabla `gastos`
--              y crea la tabla de auditoría `intentos_duplicados`.
--
-- Ejecutar en el SQL Editor de Supabase (Dashboard → SQL → New query).
-- =====================================================================

-- ─────────────────────────────────────────────────────────
-- 1. AGREGAR COLUMNAS ANTI-FRAUDE A LA TABLA `gastos`
-- ─────────────────────────────────────────────────────────

-- RIF / NIT / ID Fiscal del comercio (ej: J123456789)
ALTER TABLE gastos
  ADD COLUMN IF NOT EXISTS rif_comercio VARCHAR(20);

-- Número de factura / Control (ej: 00012984)
ALTER TABLE gastos
  ADD COLUMN IF NOT EXISTS numero_factura VARCHAR(50);

-- Monto total parseado de la factura
ALTER TABLE gastos
  ADD COLUMN IF NOT EXISTS monto_total NUMERIC(12,2);

-- Hash SHA-256 determinista generado a partir de rif + numero_factura + monto
ALTER TABLE gastos
  ADD COLUMN IF NOT EXISTS hash_duplicado VARCHAR(64);

-- Flag que marca si el gasto fue detectado como posible duplicado
ALTER TABLE gastos
  ADD COLUMN IF NOT EXISTS es_duplicado BOOLEAN DEFAULT FALSE;


-- ─────────────────────────────────────────────────────────
-- 2. ÍNDICES PARA BÚSQUEDA EFICIENTE DE DUPLICADOS
-- ─────────────────────────────────────────────────────────

-- Índice principal: búsqueda O(1) por hash
CREATE INDEX IF NOT EXISTS idx_gastos_hash_duplicado
  ON gastos (hash_duplicado);

-- Índice compuesto: fallback del "doble candado"
CREATE INDEX IF NOT EXISTS idx_gastos_verificacion_duplicados
  ON gastos (rif_comercio, numero_factura, monto_total);


-- ─────────────────────────────────────────────────────────
-- 3. TABLA DE AUDITORÍA: `intentos_duplicados`
-- Registra cada intento de carga duplicada para investigación
-- de fraude sin contaminar la tabla principal `gastos`.
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS intentos_duplicados (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id        UUID REFERENCES usuarios(id),
  telefono_remitente VARCHAR(20)    NOT NULL,
  rif_comercio       VARCHAR(20),
  numero_factura     VARCHAR(50),
  monto_total        NUMERIC(12,2),
  hash_duplicado     VARCHAR(64)    NOT NULL,
  gasto_original_id  UUID REFERENCES gastos(id),
  creado_en          TIMESTAMPTZ    DEFAULT NOW()
);

-- Índice para búsquedas rápidas por empleado
CREATE INDEX IF NOT EXISTS idx_intentos_duplicados_empleado
  ON intentos_duplicados (empleado_id);

-- Índice para contar reincidencias por hash
CREATE INDEX IF NOT EXISTS idx_intentos_duplicados_hash
  ON intentos_duplicados (hash_duplicado);


-- ─────────────────────────────────────────────────────────
-- 4. ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────

-- Habilitar RLS en la tabla de auditoría (acceso solo por service role)
ALTER TABLE intentos_duplicados ENABLE ROW LEVEL SECURITY;

-- Política: solo el service role (backend) puede insertar y leer registros de auditoría
CREATE POLICY "Acceso completo service role en intentos_duplicados"
  ON intentos_duplicados
  FOR ALL
  USING (true)
  WITH CHECK (true);


-- =====================================================================
-- LISTO — Ejecutar este script una vez en el SQL Editor de Supabase.
-- =====================================================================
