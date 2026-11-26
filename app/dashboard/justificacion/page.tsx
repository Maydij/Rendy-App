/**
 * @name JustificacionPage
 * @description [Business Logic]: Multi-tenant server component for tracking travel allowance
 * expense justification progress. Strictly isolates records by `session.empresaId`.
 * If accessed by an `EMPLOYEE`, further restricts display to their own assigned viáticos.
 */

import { supabaseServer } from '@/lib/supabase-server';
import { requireAuthenticatedSession } from '@/lib/auth/session-context';
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

/**
 * @name getJustificacionData
 * @description [Data Fetching]: Fetches approved travel allowances and associated expense receipts
 * strictly scoped to the active tenant (`empresaId`). Enforces role-based isolation for collaborators.
 */
async function getJustificacionData(
  empresaId: string,
  userId: string,
  role: string
): Promise<JustificacionItem[]> {
  let solQuery = supabaseServer
    .from('solicitudes_viaticos')
    .select('id, usuario_id, proyecto_id, monto_aprobado, monto_solicitado, moneda, estado, creado_en')
    .eq('empresa_id', empresaId)
    .eq('estado', 'APROBADO')
    .order('creado_en', { ascending: false });

  let gastosQuery = supabaseServer
    .from('gastos')
    .select('id, solicitud_id, viatico_id, categoria, comercio, monto, moneda, tasa_cambio, monto_convertido, fecha_gasto, url_comprobante, concepto, datos_ocr, estado, creado_en, moneda_original, origen_tasa, base_imponible_ves, iva_ves, exento_ves, igtf_ves, monto_ves, monto_usd, rif_comercio, numero_factura, requiere_revision_fiscal, pais_gasto, estado_region, ciudad, codigo_postal, tiene_sales_tax, subtotal_usd, sales_tax_usd, propina_usd, nombre_impuesto_local, tasa_impuesto_aplicada, impuesto_local_monto, subtotal_local, folio_fiscal_uuid')
    .eq('empresa_id', empresaId)
    .or('solicitud_id.not.is.null,viatico_id.not.is.null')
    .order('creado_en', { ascending: false });

  // Role isolation: Employees only see their own assigned travel allowances
  if (role === 'EMPLOYEE') {
    solQuery = solQuery.eq('usuario_id', userId);
    gastosQuery = gastosQuery.eq('usuario_id', userId);
  }

  const [{ data: solicitudes }, { data: gastos }, { data: usuarios }, { data: proyectos }] = await Promise.all([
    solQuery,
    gastosQuery,
    supabaseServer
      .from('usuarios')
      .select('id, nombre, email')
      .eq('empresa_id', empresaId),
    supabaseServer
      .from('proyectos')
      .select('id, nombre')
      .eq('empresa_id', empresaId),
  ]);

  const usuMap = Object.fromEntries((usuarios ?? []).map((u) => [u.id, u.nombre]));
  const usuEmailMap = Object.fromEntries((usuarios ?? []).map((u) => [u.id, u.email ?? '']));
  const proyMap = Object.fromEntries((proyectos ?? []).map((p) => [p.id, p.nombre]));

  // Agrupar gastos por solicitud_id o viatico_id
  const gastosPorSol: Record<string, GastoJustificacion[]> = {};

  for (const g of gastos ?? []) {
    const rawG = g as unknown as Record<string, unknown>;
    const targetSolId = (g.solicitud_id || rawG.viatico_id) as string | undefined;
    if (!targetSolId) continue;

    // Excluir registros totalmente vacíos o inconsistentes
    if (g.monto == null && g.comercio == null && !(rawG.datos_ocr as Record<string, unknown> | undefined)?.comercio) {
      continue;
    }

    const ocrMap = (rawG.datos_ocr as Record<string, unknown> | undefined) || {};
    const montoEfectivo = g.monto_convertido ?? g.monto ?? 0;

    const gastoItem: GastoJustificacion = {
      id: g.id,
      categoria: g.categoria || 'Otros',
      comercio: g.comercio ?? (ocrMap.comercio as string | undefined) ?? 'Comercio no especificado',
      monto: g.monto ?? 0,
      moneda: g.moneda ?? (ocrMap.moneda as string | undefined) ?? 'USD',
      tasa_cambio: g.tasa_cambio ?? null,
      monto_convertido: g.monto_convertido ?? null,
      monto_efectivo: Number(montoEfectivo.toFixed(2)),
      fecha_gasto: formatFecha(g.fecha_gasto, g.creado_en),
      url_comprobante: g.url_comprobante ?? (ocrMap.url_comprobante as string | undefined) ?? null,
      concepto: g.concepto ?? (ocrMap.concepto as string | undefined) ?? null,
      estado: g.estado || 'APROBADO',
      creado_en: g.creado_en,
      moneda_original:
        g.moneda && g.moneda !== 'VES'
          ? g.moneda
          : g.moneda_original && g.moneda_original !== 'VES'
            ? g.moneda_original
            : ((ocrMap.moneda as string | undefined) ?? g.moneda_original ?? null),
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
      nombre_impuesto_local: (rawG.nombre_impuesto_local as string | undefined) ?? (ocrMap.nombre_impuesto_local as string | undefined) ?? null,
      tasa_impuesto_aplicada: rawG.tasa_impuesto_aplicada != null
        ? Number(rawG.tasa_impuesto_aplicada)
        : ocrMap.tasa_impuesto_aplicada != null
        ? Number(ocrMap.tasa_impuesto_aplicada)
        : null,
      impuesto_local_monto: rawG.impuesto_local_monto != null
        ? Number(rawG.impuesto_local_monto)
        : ocrMap.impuesto_local_monto != null
        ? Number(ocrMap.impuesto_local_monto)
        : null,
      subtotal_local: rawG.subtotal_local != null
        ? Number(rawG.subtotal_local)
        : ocrMap.subtotal_local != null
        ? Number(ocrMap.subtotal_local)
        : null,
      folio_fiscal_uuid: (rawG.folio_fiscal_uuid as string | undefined) ?? (ocrMap.folio_fiscal_uuid as string | undefined) ?? null,
      tiene_validez_fiscal: rawG.tiene_validez_fiscal != null
        ? Boolean(rawG.tiene_validez_fiscal)
        : ocrMap.tiene_validez_fiscal != null
        ? Boolean(ocrMap.tiene_validez_fiscal)
        : true,
      tipo_documento: (rawG.tipo_documento as string | undefined) ?? (ocrMap.tipo_documento as string | undefined) ?? 'FACTURA_FISCAL',
      es_deducible_fiscal: rawG.es_deducible_fiscal != null
        ? Boolean(rawG.es_deducible_fiscal)
        : true,
    };

    if (!gastosPorSol[targetSolId]) {
      gastosPorSol[targetSolId] = [];
    }
    gastosPorSol[targetSolId].push(gastoItem);
  }

  return (solicitudes ?? []).map((s) => {
    const listGastos = gastosPorSol[s.id] ?? [];
    const totalGastado = listGastos.reduce((acc, g) => acc + g.monto_efectivo, 0);

    return {
      id: s.id,
      empleado: usuMap[s.usuario_id] ?? 'Usuario',
      empleadoEmail: usuEmailMap[s.usuario_id] ?? '',
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
  const session = await requireAuthenticatedSession();
  const items = await getJustificacionData(session.empresaId, session.userId, session.role);
  return <JustificacionClient items={items} />;
}
