import { supabaseServer } from '@/lib/supabase-server';
import { requireAuthenticatedSession } from '@/lib/auth/session-context';
import GastosEmpresaClient from './gastos-client';

async function getGastosEmpresaData(empresaId: string, role: string, userId: string) {
  let gastosQuery = supabaseServer
    .from('gastos')
    .select(
      'id, usuario_id, categoria, comercio, monto, moneda, tasa_cambio, monto_convertido, fecha_gasto, proyecto_id, metodo_pago_id, estado, url_comprobante, concepto, datos_ocr, solicitud_id, creado_en, moneda_original, origen_tasa, base_imponible_ves, iva_ves, exento_ves, igtf_ves, monto_ves, monto_usd, rif_comercio, numero_factura, requiere_revision_fiscal, pais_gasto, estado_region, ciudad, codigo_postal, tiene_sales_tax, subtotal_usd, sales_tax_usd, propina_usd'
    )
    .eq('empresa_id', empresaId)
    .or('metodo_pago_id.not.is.null,solicitud_id.not.is.null')
    .order('creado_en', { ascending: false });

  if (role === 'EMPLOYEE') {
    gastosQuery = gastosQuery.eq('usuario_id', userId);
  }

  const [{ data: gastos }, { data: usuarios }, { data: proyectos }, { data: metodos }, { data: solicitudes }] = await Promise.all([
    gastosQuery,
    supabaseServer.from('usuarios').select('id, nombre').eq('empresa_id', empresaId),
    supabaseServer.from('proyectos').select('id, nombre').eq('empresa_id', empresaId),
    supabaseServer.from('metodos_pago').select('id, nombre').eq('empresa_id', empresaId),
    supabaseServer.from('solicitudes_viaticos').select('id, moneda').eq('empresa_id', empresaId),
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
      moneda_original:
        g.moneda && g.moneda !== 'VES'
          ? g.moneda
          : g.moneda_original && g.moneda_original !== 'VES'
            ? g.moneda_original
            : ((g.datos_ocr as any)?.moneda ?? g.moneda_original ?? null),
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
      pais_gasto: g.pais_gasto ?? null,
      estado_region: g.estado_region ?? null,
      ciudad: g.ciudad ?? null,
      codigo_postal: g.codigo_postal ?? null,
      tiene_sales_tax: g.tiene_sales_tax != null ? Boolean(g.tiene_sales_tax) : null,
      subtotal_usd: g.subtotal_usd != null ? Number(g.subtotal_usd) : null,
      sales_tax_usd: g.sales_tax_usd != null ? Number(g.sales_tax_usd) : null,
      propina_usd: g.propina_usd != null ? Number(g.propina_usd) : null,
      nombre_impuesto_local: (g as any).nombre_impuesto_local ?? (g.datos_ocr as any)?.nombre_impuesto_local ?? null,
      tasa_impuesto_aplicada: (g as any).tasa_impuesto_aplicada != null
        ? Number((g as any).tasa_impuesto_aplicada)
        : (g.datos_ocr as any)?.tasa_impuesto_aplicada != null
        ? Number((g.datos_ocr as any)?.tasa_impuesto_aplicada)
        : null,
      impuesto_local_monto: (g as any).impuesto_local_monto != null
        ? Number((g as any).impuesto_local_monto)
        : (g.datos_ocr as any)?.impuesto_local_monto != null
        ? Number((g.datos_ocr as any)?.impuesto_local_monto)
        : null,
      subtotal_local: (g as any).subtotal_local != null
        ? Number((g as any).subtotal_local)
        : (g.datos_ocr as any)?.subtotal_local != null
        ? Number((g.datos_ocr as any)?.subtotal_local)
        : null,
      folio_fiscal_uuid: (g as any).folio_fiscal_uuid ?? (g.datos_ocr as any)?.folio_fiscal_uuid ?? null,
      es_deducible_fiscal: (g as any).es_deducible_fiscal != null
        ? Boolean((g as any).es_deducible_fiscal)
        : true,
    }));
}

export default async function GastosEmpresaPage() {
  const session = await requireAuthenticatedSession();
  const gastos = await getGastosEmpresaData(session.empresaId, session.role, session.userId);
  return <GastosEmpresaClient gastos={gastos} />;
}