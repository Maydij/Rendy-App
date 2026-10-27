-- =====================================================================
-- MIGRATION: Sesiones de Conversación WhatsApp (Sprint 2)
-- Descripción: Tabla para rastrear el estado de la conversación de cada
--              usuario en WhatsApp y manejar timeout por inactividad.
--
-- Ejecutar en el SQL Editor de Supabase (Dashboard → SQL → New query).
-- =====================================================================

CREATE TABLE IF NOT EXISTS sesiones_whatsapp (
  telefono            VARCHAR(20) PRIMARY KEY,
  estado              VARCHAR(50) DEFAULT 'INICIO',     -- 'INICIO', 'ESPERANDO_RECIBO', 'CONFIRMACION', etc.
  datos_temporales    JSONB DEFAULT NULL,                -- Borrador de datos OCR mientras el usuario confirma
  ultima_interaccion  TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS (acceso solo por service role)
ALTER TABLE sesiones_whatsapp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso completo service role en sesiones_whatsapp"
  ON sesiones_whatsapp
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- =====================================================================
-- LISTO — Ejecutar este script una vez en el SQL Editor de Supabase.
-- =====================================================================
