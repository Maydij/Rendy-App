import { supabaseServer, EMPRESA_ID } from '@/lib/supabase-server';
import JustificacionClient, { JustificacionItem, GastoJustificacion } from './justificacion-client';

function formatFecha(fechaStr?: string | null, fallbackIso?: string | null): string {
  const target = fechaStr || fallbackIso;
  if (!target) return '—';
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(target)) {
      const [y, m, d] = target.split('-');
      return `${d}/${m}/${y}`;
    }
    const d = new Date(target);
    if (isNaN(d.getTime())) return target;
    return d.toLocaleDateString('es-VE');
  } catch {
    return target;
  }
}

async function getJustificacionData(): Promise<JustificacionItem[]> {
  const [{ data: solicitudes }, { data: gastos }, { data: usuarios }, { data: proyectos }] = await Promise.all([
    supabaseServer
      .from('solicitudes_viaticos')
      .select('id, usuario_id, proyecto_id, monto_aprobado, monto_solicitado, moneda, estado, creado_en')
      .eq('empresa_id', EMPRESA_ID)
      .eq('estado', 'APROBADO')
      .order('creado_en', { ascending: false }),

    supabaseServer
      .from('gastos')
      .select('id, solicitud_id, categoria, comercio, monto, moneda, tasa_cambio, monto_convertido, fecha_gasto, url_comprobante, concepto, datos_ocr, estado, creado_en')
      .eq('empresa_id', EMPRESA_ID)
      .not('solicitud_id', 'is', null)
      .order('creado_en', { ascending: false }),

    supabaseServer
      .from('usuarios')
      .select('id, nombre')
      .eq('empresa_id', EMPRESA_ID),

    supabaseServer
      .from('proyectos')
      .select('id, nombre')
      .eq('empresa_id', EMPRESA_ID),
  ]);

  const usuMap = Object.fromEntries((usuarios ?? []).map((u) => [u.id, u.nombre]));
  const proyMap = Object.fromEntries((proyectos ?? []).map((p) => [p.id, p.nombre]));

  // Agrupar gastos por solicitud_id
  const gastosPorSol: Record<string, GastoJustificacion[]> = {};

  for (const g of gastos ?? []) {
    if (!g.solicitud_id) continue;
    // Excluir registros totalmente vacíos o inconsistentes
    if (g.monto == null && g.comercio == null && !(g.datos_ocr as any)?.comercio) continue;

    const montoEfectivo = g.monto_convertido ?? g.monto ?? 0;
    const gastoItem: GastoJustificacion = {
      id: g.id,
      categoria: g.categoria || 'Otros',
      comercio: g.comercio ?? (g.datos_ocr as any)?.comercio ?? 'Comercio no especificado',
      monto: g.monto ?? 0,
      moneda: g.moneda ?? (g.datos_ocr as any)?.moneda ?? 'USD',
      tasa_cambio: g.tasa_cambio ?? null,
      monto_convertido: g.monto_convertido ?? null,
      monto_efectivo: Number(montoEfectivo.toFixed(2)),
      fecha_gasto: formatFecha(g.fecha_gasto, g.creado_en),
      url_comprobante: g.url_comprobante ?? null,
      concepto: g.concepto ?? (g.datos_ocr as any)?.concepto ?? null,
      estado: g.estado || 'APROBADO',
      creado_en: g.creado_en,
    };

    if (!gastosPorSol[g.solicitud_id]) {
      gastosPorSol[g.solicitud_id] = [];
    }
    gastosPorSol[g.solicitud_id].push(gastoItem);
  }

  return (solicitudes ?? []).map((s) => {
    const listGastos = gastosPorSol[s.id] ?? [];
    const totalGastado = listGastos.reduce((acc, g) => acc + g.monto_efectivo, 0);

    return {
      id: s.id,
      empleado: usuMap[s.usuario_id] ?? 'Usuario',
      proyecto: s.proyecto_id ? (proyMap[s.proyecto_id] ?? 'Sin proyecto') : 'Sin proyecto',
      monto_otorgado: s.monto_aprobado ?? s.monto_solicitado ?? 0,
      monto_gastado: Number(totalGastado.toFixed(2)),
      moneda: s.moneda || 'USD',
      gastos_count: listGastos.length,
      fecha_aprobacion: formatFecha(s.creado_en),
      gastos: listGastos,
    };
  });
}

export default async function JustificacionPage() {
  const items = await getJustificacionData();
  return <JustificacionClient items={items} />;
}
