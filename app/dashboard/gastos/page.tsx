import { supabaseServer, EMPRESA_ID } from '@/lib/supabase-server';
import GastosEmpresaClient from './gastos-client';

async function getGastosEmpresaData() {
  const [{ data: gastos }, { data: usuarios }, { data: proyectos }, { data: metodos }, { data: solicitudes }] = await Promise.all([
    supabaseServer
      .from('gastos')
      .select('id, usuario_id, categoria, comercio, monto, moneda, tasa_cambio, monto_convertido, fecha_gasto, proyecto_id, metodo_pago_id, estado, url_comprobante, concepto, datos_ocr, solicitud_id, creado_en, moneda_original, origen_tasa, base_imponible_ves, iva_ves, exento_ves, igtf_ves, monto_ves, monto_usd, rif_comercio, numero_factura, requiere_revision_fiscal')
      .eq('empresa_id', EMPRESA_ID)
      .or('metodo_pago_id.not.is.null,solicitud_id.not.is.null')
      .order('creado_en', { ascending: false }),
    supabaseServer.from('usuarios').select('id, nombre').eq('empresa_id', EMPRESA_ID),
    supabaseServer.from('proyectos').select('id, nombre').eq('empresa_id', EMPRESA_ID),
    supabaseServer.from('metodos_pago').select('id, nombre').eq('empresa_id', EMPRESA_ID),
    supabaseServer.from('solicitudes_viaticos').select('id, moneda').eq('empresa_id', EMPRESA_ID),
  ]);

  const usuMap = Object.fromEntries((usuarios ?? []).map((u) => [u.id, u.nombre]));
  const proyMap = Object.fromEntries((proyectos ?? []).map((p) => [p.id, p.nombre]));
  const metMap = Object.fromEntries((metodos ?? []).map((m) => [m.id, m.nombre]));
  const solMonedaMap = Object.fromEntries((solicitudes ?? []).map((s) => [s.id, s.moneda]));

  return (gastos ?? [])
    .filter((g) => g.monto != null || g.comercio != null || (g.datos_ocr as any)?.comercio)
    .map((g) => ({
      id: g.id,
      empleado: g.usuario_id ? (usuMap[g.usuario_id] ?? 'Usuario') : 'Sin asignar',
      categoria: g.categoria || 'Otros',
      comercio: g.comercio ?? (g.datos_ocr as any)?.comercio ?? '—',
      monto: g.monto || 0,
      moneda: g.moneda ?? (g.datos_ocr as any)?.moneda ?? 'VES',
      tasa_cambio: g.tasa_cambio ?? null,
      monto_convertido: g.monto_convertido ?? null,
      moneda_viatico: g.solicitud_id ? (solMonedaMap[g.solicitud_id] ?? 'USD') : 'USD',
      fecha_gasto: g.fecha_gasto || '—',
      creado_en: g.creado_en,
      proyecto: g.proyecto_id ? (proyMap[g.proyecto_id] ?? '—') : '—',
      metodo_pago: g.metodo_pago_id
        ? (metMap[g.metodo_pago_id] ?? '—')
        : g.solicitud_id
          ? 'Rendición de Viáticos'
          : 'Tarjeta Corporativa',
      estado: g.estado,
      url_comprobante: g.url_comprobante ?? null,
      concepto: g.concepto ?? (g.datos_ocr as any)?.concepto ?? null,
      datos_ocr: g.datos_ocr ?? null,
      moneda_original: g.moneda_original ?? null,
      origen_tasa: g.origen_tasa ?? null,
      base_imponible_ves: g.base_imponible_ves ?? null,
      iva_ves: g.iva_ves ?? null,
      exento_ves: g.exento_ves ?? null,
      igtf_ves: g.igtf_ves ?? null,
      monto_ves: g.monto_ves ?? null,
      monto_usd: g.monto_usd ?? null,
      rif_comercio: g.rif_comercio ?? null,
      numero_factura: g.numero_factura ?? null,
      requiere_revision_fiscal: g.requiere_revision_fiscal ?? false,
    }));
}

export default async function GastosEmpresaPage() {
  const gastos = await getGastosEmpresaData();
  return <GastosEmpresaClient gastos={gastos} />;
}