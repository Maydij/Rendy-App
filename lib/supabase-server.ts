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
