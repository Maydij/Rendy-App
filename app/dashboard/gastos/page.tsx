import { supabaseServer, EMPRESA_ID } from '@/lib/supabase-server';
import GastosEmpresaClient from './gastos-client';

async function getGastosEmpresaData() {
  // Gastos realizados con fondos de la empresa (NO fondos personales)
  const [{ data: gastos }, { data: usuarios }, { data: proyectos }, { data: metodos }] = await Promise.all([
    supabaseServer
      .from('gastos')
      .select('*')
      .eq('empresa_id', EMPRESA_ID)
      .not('metodo_pago_id', 'is', null) // Filtro: Tienen método corporativo
      .order('creado_en', { ascending: false }),
    supabaseServer.from('usuarios').select('id, nombre').eq('empresa_id', EMPRESA_ID),
    supabaseServer.from('proyectos').select('id, nombre').eq('empresa_id', EMPRESA_ID),
    supabaseServer.from('metodos_pago').select('id, nombre').eq('empresa_id', EMPRESA_ID),
  ]);

  const usuMap = Object.fromEntries((usuarios ?? []).map((u) => [u.id, u.nombre]));
  const proyMap = Object.fromEntries((proyectos ?? []).map((p) => [p.id, p.nombre]));
  const metMap = Object.fromEntries((metodos ?? []).map((m) => [m.id, m.nombre]));

  return (gastos ?? []).map((g) => ({
    id: g.id,
    empleado: g.usuario_id ? (usuMap[g.usuario_id] ?? 'Usuario') : 'Sin asignar',
    categoria: g.categoria,
    comercio: g.comercio ?? (g.datos_ocr as any)?.comercio ?? '—',
    monto: g.monto,
    moneda: g.moneda ?? (g.datos_ocr as any)?.moneda ?? 'USD',
    fecha_gasto: g.fecha_gasto,
    proyecto: g.proyecto_id ? (proyMap[g.proyecto_id] ?? '—') : '—',
    metodo_pago: g.metodo_pago_id ? (metMap[g.metodo_pago_id] ?? '—') : 'Tarjeta Corporativa',
    estado: g.estado,
    url_comprobante: g.url_comprobante ?? null,
    concepto: g.concepto ?? (g.datos_ocr as any)?.concepto ?? null,
  }));
}

export default async function GastosEmpresaPage() {
  const gastos = await getGastosEmpresaData();
  return <GastosEmpresaClient gastos={gastos} />;
}