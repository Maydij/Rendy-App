-- ==========================================================================
-- Migration 013: Bank Transfer Proof & Disbursement Audit for Viáticos
-- ==========================================================================
-- PURPOSE:
-- 1. Add audit columns to track bank transfer receipts (images or PDFs),
--    bank reference numbers, transfer timestamps, and disbursement notes
--    when approving travel allowances (solicitudes_viaticos) and syncing to viaticos.
-- 2. Create index to easily identify approved allowances pending transfer receipts.
-- 3. Ensure storage bucket for disbursement transfer proofs exists and is accessible.
-- ==========================================================================

-- 1. Agregar campos de auditoría de transferencia en la tabla solicitudes_viaticos
ALTER TABLE solicitudes_viaticos
  ADD COLUMN IF NOT EXISTS url_comprobante_transferencia TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS referencia_transferencia VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fecha_transferencia TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS transferido_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notas_desembolso TEXT DEFAULT NULL;

-- Sincronizar columnas equivalentes en la tabla viaticos (usada por viaticosEngine)
ALTER TABLE viaticos
  ADD COLUMN IF NOT EXISTS url_comprobante_transferencia TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS referencia_transferencia VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fecha_transferencia TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS transferido_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notas_desembolso TEXT DEFAULT NULL;

-- 2. Índice para filtrar rápidamente solicitudes de viáticos aprobadas sin soporte de transferencia
CREATE INDEX IF NOT EXISTS idx_solicitudes_viaticos_pendiente_comprobante 
  ON solicitudes_viaticos (empresa_id, estado) 
  WHERE url_comprobante_transferencia IS NULL;

-- 3. Crear bucket público en Supabase Storage para comprobantes de transferencias
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'comprobantes_transferencias',
  'comprobantes_transferencias',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf'];

-- Políticas de seguridad para storage.objects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Permitir subida de comprobantes de transferencia a autenticados'
  ) THEN
    CREATE POLICY "Permitir subida de comprobantes de transferencia a autenticados"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'comprobantes_transferencias');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Permitir lectura publica de comprobantes de transferencias'
  ) THEN
    CREATE POLICY "Permitir lectura publica de comprobantes de transferencias"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'comprobantes_transferencias');
  END IF;
END $$;

-- Recarga inmediata de la caché de PostgREST
NOTIFY pgrst, 'reload schema';
