-- ==========================================================================
-- Migration 017: Multi-Tenant & Per-User Index for Generated Reports
-- ==========================================================================
-- PURPOSE:
-- Accelerates audit history queries in /dashboard/reportes strictly scoped
-- by both tenant (empresa_id) AND exporting user (usuario_id).
-- ==========================================================================

CREATE INDEX IF NOT EXISTS idx_reportes_generados_tenant_user
  ON public.reportes_generados (empresa_id, usuario_id, creado_en DESC);
