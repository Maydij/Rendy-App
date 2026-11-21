-- ==========================================================================
-- Migration 015: Temporary Passwords for Employee Activation
-- ==========================================================================
-- PURPOSE:
-- Store temporary alphanumeric codes (e.g. TMP-9831-KX) and their SHA-256 hashes
-- on employee_invitations, ensuring employees can verify their temporary credentials
-- during first-time password setup and account activation.
-- ==========================================================================

ALTER TABLE public.employee_invitations
  ADD COLUMN IF NOT EXISTS temp_password VARCHAR(50),
  ADD COLUMN IF NOT EXISTS temp_password_hash VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_employee_invitations_temp_hash
  ON public.employee_invitations (temp_password_hash);
