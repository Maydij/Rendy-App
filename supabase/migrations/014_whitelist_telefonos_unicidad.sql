-- ==========================================================================
-- Migration 014: Phone Whitelist for QA, Uniqueness Enforcement & Multi-Profile Support
-- ==========================================================================
-- PURPOSE:
-- 1. Ensure phone number uniqueness across active users in production (1 Phone = 1 Active User).
-- 2. Whitelist test numbers to allow multiple active profiles across organizations for QA.
-- 3. Support multi-profile switching in WhatsApp sessions for whitelisted numbers.
-- ==========================================================================

-- 1. Ensure active status column exists on usuarios
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Drop rigid UNIQUE constraints on telefono_whatsapp if any exist
ALTER TABLE usuarios
  DROP CONSTRAINT IF EXISTS usuarios_telefono_whatsapp_key,
  DROP CONSTRAINT IF EXISTS usuarios_telefono_key;

DROP INDEX IF EXISTS idx_usuarios_telefono_unique;

-- 3. Table for phone whitelist authorized for multiple active registrations
CREATE TABLE IF NOT EXISTS whitelist_telefonos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefono_e164 VARCHAR(25) NOT NULL UNIQUE,
  descripcion VARCHAR(120),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Seed the 4 official QA testing numbers
INSERT INTO whitelist_telefonos (telefono_e164, descripcion, activo)
VALUES
  ('+584245865617', 'Whitelist QA 1', TRUE),
  ('+584142420238', 'Whitelist QA 2', TRUE),
  ('+584149049594', 'Whitelist QA 3', TRUE),
  ('+584127168245', 'Whitelist QA 4', TRUE)
ON CONFLICT (telefono_e164) DO NOTHING;

-- 5. Helper function to normalize E.164 phone numbers
CREATE OR REPLACE FUNCTION normalizar_telefono_e164(tel TEXT)
RETURNS TEXT AS $$
DECLARE
  limpio TEXT;
BEGIN
  IF tel IS NULL THEN
    RETURN NULL;
  END IF;
  limpio := regexp_replace(tel, '[^0-9+]', '', 'g');
  IF NOT limpio LIKE '+%' THEN
    limpio := '+' || limpio;
  END IF;
  RETURN limpio;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 6. Trigger to validate active user phone uniqueness unless whitelisted
CREATE OR REPLACE FUNCTION validar_unicidad_telefono_usuario()
RETURNS TRIGGER AS $$
DECLARE
  tel_norm TEXT;
  en_whitelist BOOLEAN := FALSE;
  existe_duplicado BOOLEAN := FALSE;
BEGIN
  IF NEW.telefono_whatsapp IS NULL OR NEW.activo = FALSE THEN
    RETURN NEW;
  END IF;

  tel_norm := normalizar_telefono_e164(NEW.telefono_whatsapp);
  NEW.telefono_whatsapp := tel_norm;

  SELECT EXISTS(
    SELECT 1 FROM whitelist_telefonos
    WHERE telefono_e164 = tel_norm AND activo = TRUE
  ) INTO en_whitelist;

  IF en_whitelist THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM usuarios
    WHERE telefono_whatsapp = tel_norm
      AND activo = TRUE
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
  ) INTO existe_duplicado;

  IF existe_duplicado THEN
    RAISE EXCEPTION 'TELEFONO_DUPLICADO: El número % ya pertenece a otro usuario activo. Para usarlo en otra organización, debe darse de baja primero en la organización previa.', tel_norm
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_unicidad_telefono_usuario ON usuarios;
CREATE TRIGGER trg_validar_unicidad_telefono_usuario
  BEFORE INSERT OR UPDATE OF telefono_whatsapp, activo
  ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION validar_unicidad_telefono_usuario();

-- 7. Multi-profile active user pointer in sesiones_whatsapp
ALTER TABLE sesiones_whatsapp
  ADD COLUMN IF NOT EXISTS usuario_activo_id UUID REFERENCES usuarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_usuarios_telefono_activo
  ON usuarios (telefono_whatsapp)
  WHERE activo = TRUE;
