import { supabaseServer, EMPRESA_ID } from '@/lib/supabase-server';
import ReembolsosClient from './reembolsos-client';

async function getReembolsosData() {
  // Gastos pagados con Fondos Personales que requieren reembolso
  const [{ data: gastos }, { data: usuarios }, { data: proyectos }] = await Promise.all([
    supabaseServer
      .from('gastos')
      .select('*')
      .eq('empresa_id', EMPRESA_ID)
      .is('metodo_pago_id', null) // Sin método corporativo = Fondos Personales
      .order('creado_en', { ascending: false }),
    supabaseServer.from('usuarios').select('id, nombre').eq('empresa_id', EMPRESA_ID),
    supabaseServer.from('proyectos').select('id, nombre').eq('empresa_id', EMPRESA_ID),
  ]);

  const usuMap = Object.fromEntries((usuarios ?? []).map((u) => [u.id, u.nombre]));
  const proyMap = Object.fromEntries((proyectos ?? []).map((p) => [p.id, p.nombre]));

  return (gastos ?? []).map((g) => ({
    id: g.id,
    empleado: g.usuario_id ? (usuMap[g.usuario_id] ?? 'Usuario') : 'Sin asignar',
    categoria: g.categoria,
    comercio: g.comercio ?? (g.datos_ocr as any)?.comercio ?? '—',
    monto: g.monto,
    moneda: g.moneda ?? (g.datos_ocr as any)?.moneda ?? 'USD',
    fecha_gasto: g.fecha_gasto,
    proyecto: g.proyecto_id ? (proyMap[g.proyecto_id] ?? '—') : '—',
    metodo_pago: 'Fondos Personales (Reembolso)',
    estado: g.estado,
    url_comprobante: g.url_comprobante ?? null,
    concepto: g.concepto ?? (g.datos_ocr as any)?.concepto ?? null,
  }));
}

export type Reembolso = Awaited<ReturnType<typeof getReembolsosData>>[0];

export default async function ReembolsosPage() {
  const reembolsos = await getReembolsosData();
  return <ReembolsosClient reembolsos={reembolsos} />;
}
