/**
 * lib/supabase-server.ts
 * Cliente Supabase con Service Role Key — solo para Server Components y API Routes.
 * NUNCA exponer al cliente.
 */
import { createClient } from '@supabase/supabase-js';

export type Database = {
  empresas: {
    id: string;
    nombre: string;
    moneda: string;
    creado_en: string;
  };
  usuarios: {
    id: string;
    empresa_id: string;
    nombre: string;
    email: string | null;
    telefono_whatsapp: string;
    rol: 'ADMIN' | 'EMPLEADO';
    creado_en: string;
  };
  proyectos: {
    id: string;
    empresa_id: string;
    nombre: string;
    activo: boolean;
    creado_en: string;
  };
  metodos_pago: {
    id: string;
    empresa_id: string;
    nombre: string;
    creado_en: string;
  };
  solicitudes_viaticos: {
    id: string;
    empresa_id: string;
    usuario_id: string;
    proyecto_id: string | null;
    monto_solicitado: number;
    monto_aprobado: number | null;
    estado: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
    motivo_rechazo: string | null;
    creado_en: string;
  };
  gastos: {
    id: string;
    empresa_id: string | null;
    usuario_id: string | null;
    proyecto_id: string | null;
    metodo_pago_id: string | null;
    solicitud_id: string | null;
    categoria: string;
    comercio: string | null;
    monto: number;
    moneda: string | null;
    fecha_gasto: string;
    url_comprobante: string | null;
    concepto: string | null;
    estado: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
    comentario_rechazo: string | null;
    datos_ocr: Record<string, unknown> | null;
    creado_en: string;
    // Anti-Fraud fiscal dedup fields (Sprint 2)
    rif_comercio: string | null;
    numero_factura: string | null;
    monto_total: number | null;
    hash_duplicado: string | null;
    es_duplicado: boolean;
    // Fiscal Tax Breakdown & Dual-Currency (Sprint 2 - Block 1)
    moneda_original: string | null;
    tasa_cambio: number | null;
    origen_tasa: string | null;
    base_imponible_ves: number | null;
    iva_ves: number | null;
    exento_ves: number | null;
    igtf_ves: number | null;
    monto_ves: number | null;
    monto_usd: number | null;
    requiere_revision_fiscal: boolean;
  };
  intentos_duplicados: {
    id: string;
    empleado_id: string | null;
    telefono_remitente: string;
    rif_comercio: string | null;
    numero_factura: string | null;
    monto_total: number | null;
    hash_duplicado: string;
    gasto_original_id: string | null;
    creado_en: string;
  };
  sesiones_whatsapp: {
    telefono: string;
    estado: string;
    datos_temporales: Record<string, unknown> | null;
    ultima_interaccion: string;
  };
};

function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Faltan variables de entorno de Supabase');
  return createClient(url, key);
}

export const supabaseServer = createServerClient();

/* ─── empresa activa (hardcoded para el MVP mono-tenant) ─── */
export const EMPRESA_ID = '11111111-1111-1111-1111-111111111111';
