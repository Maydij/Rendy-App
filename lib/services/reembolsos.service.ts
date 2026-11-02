/**
 * @name ReembolsosService
 * @description [Business Logic]: Service managing corporate reimbursement tracking,
 * server-side filtering, pagination, aggregated financial KPIs, and status mutation for
 * personal out-of-pocket expenses submitted by company employees via WhatsApp OCR.
 */

import { supabaseServer, EMPRESA_ID } from '@/lib/supabase-server';
import { getExchangeRates, convertAmount, normalizeMoneda } from '@/lib/currency';

/* ─────────────────────────────────────────────────────────────
 * Types & Interfaces
 * ───────────────────────────────────────────────────────────── */

export type EstadoReembolso = 'PENDIENTE' | 'PROCESADO' | 'TRANSFERIDO' | 'RECHAZADO';

export interface FiltrosReembolso {
  empleadoId?: string;
  estado?: EstadoReembolso | 'TODOS';
  fechaDesde?: string;
  fechaHasta?: string;
  busqueda?: string;
  page?: number;
  pageSize?: number;
}

export interface ReembolsoUsuario {
  id: string;
  nombre: string;
  email: string | null;
  telefono_whatsapp: string;
}

export interface ReembolsoItem {
  id: string;
  fecha_gasto: string;
  creado_en?: string;
  comercio: string;
  rif_comercio: string | null;
  numero_factura: string | null;
  categoria: string;
  concepto: string | null;
  monto: number;
  moneda: string;
  monto_usd: number;
  monto_ves: number;
  tasa_cambio: number | null;
  origen_tasa: string | null;
  base_imponible_ves: number | null;
  iva_ves: number | null;
  exento_ves: number | null;
  igtf_ves: number | null;
  estado: EstadoReembolso | string;
  comentario_rechazo: string | null;
  url_comprobante: string | null;
  url_comprobante_pago?: string | null;
  fecha_transferencia?: string | null;
  transferido_por?: string | null;
  datos_ocr: Record<string, unknown> | null;
  requiere_revision_fiscal: boolean;
  usuario: ReembolsoUsuario;
}

export interface ReembolsosPaginadosResponse {
  reembolsos: ReembolsoItem[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export interface ReembolsosKpisResponse {
  totalCount: number;
  totalMontoUsd: number;
  pendientesCount: number;
  pendientesMontoUsd: number;
  procesadosCount: number;
  procesadosMontoUsd: number;
  transferidosCount: number;
  transferidosMontoUsd: number;
  rechazadosCount: number;
  rechazadosMontoUsd: number;
}

export interface EmpleadoOption {
  id: string;
  nombre: string;
  email: string | null;
}

/* ─────────────────────────────────────────────────────────────
 * Query Methods
 * ───────────────────────────────────────────────────────────── */

/**
 * @name obtenerReembolsosPaginados
 * @description [Business Logic]: Retrieves a paginated list of personal reimbursement expenses
 * for the given organization, filtered by employee, status, date range, and merchant search term.
 */
export async function obtenerReembolsosPaginados(
  empresaId: string = EMPRESA_ID,
  filtros: FiltrosReembolso = {}
): Promise<ReembolsosPaginadosResponse> {
  const page = Math.max(1, filtros.page || 1);
  const pageSize = Math.max(1, Math.min(100, filtros.pageSize || 15));
  const offset = (page - 1) * pageSize;

  let query = supabaseServer
    .from('gastos')
    .select(
      `
      id,
      usuario_id,
      comercio,
      rif_comercio,
      numero_factura,
      monto,
      moneda,
      monto_usd,
      monto_ves,
      tasa_cambio,
      origen_tasa,
      base_imponible_ves,
      iva_ves,
      exento_ves,
      igtf_ves,
      fecha_gasto,
      categoria,
      concepto,
      estado,
      comentario_rechazo,
      url_comprobante,
      url_comprobante_pago,
      fecha_transferencia,
      transferido_por,
      datos_ocr,
      requiere_revision_fiscal,
      creado_en,
      usuarios!usuario_id (
        id,
        nombre,
        email,
        telefono_whatsapp
      )
    `,
      { count: 'exact' }
    )
    .eq('empresa_id', empresaId)
    .eq('es_reembolso', true);

  if (filtros.empleadoId && filtros.empleadoId !== 'TODOS') {
    query = query.eq('usuario_id', filtros.empleadoId);
  }

  if (filtros.estado && filtros.estado !== 'TODOS') {
    query = query.eq('estado', filtros.estado);
  }

  if (filtros.fechaDesde) {
    query = query.gte('fecha_gasto', filtros.fechaDesde);
  }

  if (filtros.fechaHasta) {
    query = query.lte('fecha_gasto', filtros.fechaHasta);
  }

  if (filtros.busqueda && filtros.busqueda.trim()) {
    const term = filtros.busqueda.trim();
    query = query.or(
      `comercio.ilike.%${term}%,numero_factura.ilike.%${term}%,rif_comercio.ilike.%${term}%`
    );
  }

  query = query
    .order('fecha_gasto', { ascending: false })
    .order('creado_en', { ascending: false })
    .range(offset, offset + pageSize - 1);

  // Parallel fetch: data and live exchange rates for accurate USD parity
  const [queryResult, rates] = await Promise.all([
    query,
    getExchangeRates(),
  ]);

  const { data, count, error } = queryResult;

  if (error) {
    console.error('❌ [ReembolsosService] Error fetching reembolsos:', error);
    throw new Error(`No se pudieron cargar los reembolsos: ${error.message}`);
  }

  type RawJoinRow = {
    id: string;
    usuario_id: string | null;
    comercio: string | null;
    rif_comercio: string | null;
    numero_factura: string | null;
    monto: number | null;
    moneda: string | null;
    monto_usd: number | null;
    monto_ves: number | null;
    tasa_cambio: number | null;
    origen_tasa: string | null;
    base_imponible_ves: number | null;
    iva_ves: number | null;
    exento_ves: number | null;
    igtf_ves: number | null;
    fecha_gasto: string | null;
    categoria: string | null;
    concepto: string | null;
    estado: string;
    comentario_rechazo: string | null;
    url_comprobante: string | null;
    url_comprobante_pago: string | null;
    fecha_transferencia: string | null;
    transferido_por: string | null;
    datos_ocr: Record<string, unknown> | null;
    requiere_revision_fiscal: boolean | null;
    creado_en: string | null;
    usuarios: {
      id: string;
      nombre: string;
      email: string | null;
      telefono_whatsapp: string;
    } | null;
  };

  const rows = (data as unknown as RawJoinRow[]) || [];

  const reembolsos: ReembolsoItem[] = rows.map((r) => {
    const rawMoneda = (r.moneda || (r.datos_ocr as Record<string, unknown>)?.moneda || 'VES').toString();
    const normalizedMoneda = normalizeMoneda(rawMoneda);
    const nominalAmount = Number(
      r.monto ??
      (r.datos_ocr as Record<string, unknown>)?.total ??
      (r.datos_ocr as Record<string, unknown>)?.monto_total ??
      0
    );

    // Resolve exchange rate against USD
    const effectiveTasa =
      r.tasa_cambio && Number(r.tasa_cambio) > 0
        ? Number(r.tasa_cambio)
        : Number(rates[normalizedMoneda] || (normalizedMoneda === 'USD' ? 1 : rates['VES']));

    // Compute USD parity strictly
    let computedMontoUsd: number;
    if (r.monto_usd && Number(r.monto_usd) > 0) {
      computedMontoUsd = Number(r.monto_usd);
    } else if (normalizedMoneda === 'USD') {
      computedMontoUsd = nominalAmount;
    } else if (effectiveTasa > 0) {
      computedMontoUsd = Number((nominalAmount / effectiveTasa).toFixed(2));
    } else {
      computedMontoUsd = Number(convertAmount(nominalAmount, normalizedMoneda, 'USD', rates).toFixed(2));
    }

    // Determine VES amount: only applicable to Venezuelan Bolivars (VES).
    // Omit VES comparison for international currencies (MXN, COP, EUR, USD).
    const computedMontoVes =
      normalizedMoneda === 'VES'
        ? Number(r.monto_ves && Number(r.monto_ves) > 0 ? r.monto_ves : nominalAmount)
        : 0;

    return {
      id: r.id,
      fecha_gasto: r.fecha_gasto || (r.creado_en ? r.creado_en.split('T')[0] : '—'),
      creado_en: r.creado_en || undefined,
      comercio: r.comercio || '—',
      rif_comercio: r.rif_comercio || null,
      numero_factura: r.numero_factura || null,
      categoria: r.categoria || 'Otros',
      concepto: r.concepto || null,
      monto: nominalAmount,
      moneda: normalizedMoneda,
      monto_usd: computedMontoUsd,
      monto_ves: computedMontoVes,
      tasa_cambio: effectiveTasa,
      origen_tasa: r.origen_tasa || null,
      base_imponible_ves: r.base_imponible_ves != null ? Number(r.base_imponible_ves) : null,
      iva_ves: r.iva_ves != null ? Number(r.iva_ves) : null,
      exento_ves: r.exento_ves != null ? Number(r.exento_ves) : null,
      igtf_ves: r.igtf_ves != null ? Number(r.igtf_ves) : null,
      estado: r.estado,
      comentario_rechazo: r.comentario_rechazo || null,
      url_comprobante: r.url_comprobante || null,
      url_comprobante_pago: r.url_comprobante_pago || null,
      fecha_transferencia: r.fecha_transferencia || null,
      transferido_por: r.transferido_por || null,
      datos_ocr: r.datos_ocr || null,
      requiere_revision_fiscal: Boolean(r.requiere_revision_fiscal),
      usuario: {
        id: r.usuarios?.id || r.usuario_id || 'unknown',
        nombre: r.usuarios?.nombre || 'Usuario Desconocido',
        email: r.usuarios?.email || null,
        telefono_whatsapp: r.usuarios?.telefono_whatsapp || '—',
      },
    };
  });

  const totalCount = count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    reembolsos,
    totalCount,
    totalPages,
    currentPage: page,
    pageSize,
  };
}

/**
 * @name obtenerKpisReembolsos
 * @description [Business Logic]: Calculates aggregated financial metrics for all employee
 * personal refunds (total count, pending settlement amount, processed ready to pay, and transferred).
 */
export async function obtenerKpisReembolsos(
  empresaId: string = EMPRESA_ID
): Promise<ReembolsosKpisResponse> {
  const [dataResult, rates] = await Promise.all([
    supabaseServer
      .from('gastos')
      .select('id, estado, monto, moneda, monto_usd, tasa_cambio, datos_ocr')
      .eq('empresa_id', empresaId)
      .eq('es_reembolso', true),
    getExchangeRates(),
  ]);

  const { data, error } = dataResult;

  if (error) {
    console.error('❌ [ReembolsosService] Error computing KPIs:', error);
    return {
      totalCount: 0,
      totalMontoUsd: 0,
      pendientesCount: 0,
      pendientesMontoUsd: 0,
      procesadosCount: 0,
      procesadosMontoUsd: 0,
      transferidosCount: 0,
      transferidosMontoUsd: 0,
      rechazadosCount: 0,
      rechazadosMontoUsd: 0,
    };
  }

  let totalMontoUsd = 0;
  let pendientesCount = 0;
  let pendientesMontoUsd = 0;
  let procesadosCount = 0;
  let procesadosMontoUsd = 0;
  let transferidosCount = 0;
  let transferidosMontoUsd = 0;
  let rechazadosCount = 0;
  let rechazadosMontoUsd = 0;

  for (const item of data || []) {
    const rawMoneda = (item.moneda || (item.datos_ocr as Record<string, unknown>)?.moneda || 'VES').toString();
    const normalizedMoneda = normalizeMoneda(rawMoneda);
    const nominalAmount = Number(
      item.monto ??
      (item.datos_ocr as Record<string, unknown>)?.total ??
      (item.datos_ocr as Record<string, unknown>)?.monto_total ??
      0
    );

    const effectiveTasa =
      item.tasa_cambio && Number(item.tasa_cambio) > 0
        ? Number(item.tasa_cambio)
        : Number(rates[normalizedMoneda] || (normalizedMoneda === 'USD' ? 1 : rates['VES']));

    let usd: number;
    if (item.monto_usd && Number(item.monto_usd) > 0) {
      usd = Number(item.monto_usd);
    } else if (normalizedMoneda === 'USD') {
      usd = nominalAmount;
    } else if (effectiveTasa > 0) {
      usd = Number((nominalAmount / effectiveTasa).toFixed(2));
    } else {
      usd = Number(convertAmount(nominalAmount, normalizedMoneda, 'USD', rates).toFixed(2));
    }

    totalMontoUsd += usd;

    switch (item.estado) {
      case 'PENDIENTE':
      case 'REQUIERE_APROBACION_ESPECIAL':
      case 'REVISION_DUPLICADO':
        pendientesCount++;
        pendientesMontoUsd += usd;
        break;
      case 'PROCESADO':
      case 'APROBADO':
        procesadosCount++;
        procesadosMontoUsd += usd;
        break;
      case 'TRANSFERIDO':
        transferidosCount++;
        transferidosMontoUsd += usd;
        break;
      case 'RECHAZADO':
        rechazadosCount++;
        rechazadosMontoUsd += usd;
        break;
      default:
        pendientesCount++;
        pendientesMontoUsd += usd;
        break;
    }
  }

  return {
    totalCount: (data || []).length,
    totalMontoUsd: Number(totalMontoUsd.toFixed(2)),
    pendientesCount,
    pendientesMontoUsd: Number(pendientesMontoUsd.toFixed(2)),
    procesadosCount,
    procesadosMontoUsd: Number(procesadosMontoUsd.toFixed(2)),
    transferidosCount,
    transferidosMontoUsd: Number(transferidosMontoUsd.toFixed(2)),
    rechazadosCount,
    rechazadosMontoUsd: Number(rechazadosMontoUsd.toFixed(2)),
  };
}

/**
 * @name obtenerEmpleadosEmpresa
 * @description [Business Logic]: Retrieves the list of active employees belonging to the company
 * for population of the filter dropdown selector.
 */
export async function obtenerEmpleadosEmpresa(
  empresaId: string = EMPRESA_ID
): Promise<EmpleadoOption[]> {
  const { data, error } = await supabaseServer
    .from('usuarios')
    .select('id, nombre, email')
    .eq('empresa_id', empresaId)
    .order('nombre', { ascending: true });

  if (error) {
    console.error('❌ [ReembolsosService] Error fetching employees:', error);
    return [];
  }

  return (data || []).map((u) => ({
    id: u.id,
    nombre: u.nombre,
    email: u.email,
  }));
}

