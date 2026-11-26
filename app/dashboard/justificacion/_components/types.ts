/**
 * @name JustificacionTypes
 * @description [Domain Model]: Shared TypeScript contracts and pure financial formatting helpers
 * for the Progreso de Justificación module. Ensures zero `any` usage and consistent currency displays.
 */

import type { Gasto } from '@/lib/types/gasto';

export type GastoJustificacion = {
  id: string;
  categoria: string;
  comercio: string;
  monto: number;
  moneda: string;
  tasa_cambio: number | null;
  monto_convertido: number | null;
  monto_efectivo: number;
  fecha_gasto: string;
  url_comprobante: string | null;
  concepto: string | null;
  estado: string;
  creado_en: string;

  // Fiscal Tax Breakdown & Dual-Currency
  moneda_original?: string | null;
  origen_tasa?: string | null;
  base_imponible_ves?: number | null;
  iva_ves?: number | null;
  exento_ves?: number | null;
  igtf_ves?: number | null;
  monto_ves?: number | null;
  monto_usd?: number | null;
  rif_comercio?: string | null;
  numero_factura?: string | null;
  requiere_revision_fiscal?: boolean | null;

  // Multi-Jurisdiction Adaptive E-Receipt Fields
  pais_gasto?: string | null;
  estado_region?: string | null;
  ciudad?: string | null;
  codigo_postal?: string | null;
  tiene_sales_tax?: boolean | null;
  subtotal_usd?: number | null;
  sales_tax_usd?: number | null;
  propina_usd?: number | null;
  nombre_impuesto_local?: string | null;
  tasa_impuesto_aplicada?: number | null;
  impuesto_local_monto?: number | null;
  subtotal_local?: number | null;
  folio_fiscal_uuid?: string | null;
  es_deducible_fiscal?: boolean | null;
  tiene_validez_fiscal?: boolean | null;
  tipo_documento?: string | null;
};

export type JustificacionItem = {
  id: string;
  empleado: string;
  empleadoEmail?: string;
  proyecto: string;
  monto_otorgado: number;
  monto_gastado: number;
  moneda: string;
  gastos_count: number;
  fecha_aprobacion: string;
  gastos: GastoJustificacion[];
};

export type JustificacionFilterStatus =
  | 'TODOS'
  | 'EN_PROGRESO'
  | 'COMPLETOS'
  | 'SIN_COMPROBANTES';

export type ProjectMonitoringSummary = {
  name: string;
  otorgado: number;
  justificado: number;
  pendiente: number;
  pct: number;
  count: number;
  currency: string;
};

export type ProgressMetrics = {
  pct: number;
  rawPct: number;
  remaining: number;
  isComplete: boolean;
  isEmpty: boolean;
  isInProgress: boolean;
};

/**
 * @name getCurrencyPrefix
 * @description [Formatter]: Returns a concise visual currency symbol for standard currencies.
 */
export function getCurrencyPrefix(currency?: string | null): string {
  const code = (currency || 'USD').toUpperCase();
  if (code === 'VES' || code === 'BS') return 'Bs.';
  if (code === 'EUR') return '€';
  return '$';
}

/**
 * @name formatMoney
 * @description [Formatter]: Formats numeric amounts consistently with two decimal precision.
 */
export function formatMoney(amount: number): string {
  return Number(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * @name formatCompactCurrency
 * @description [Formatter]: Produces abbreviated amounts for bar chart labels (e.g. $12.5k, $600).
 */
export function formatCompactCurrency(amount: number, currency?: string | null): string {
  const prefix = getCurrencyPrefix(currency);
  const abs = Math.abs(amount);
  if (abs >= 1000) {
    return `${prefix}${(amount / 1000).toFixed(abs >= 10000 ? 1 : 2).replace(/\.00$/, '')}k`;
  }
  return `${prefix}${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
}

/**
 * @name computeProgressMetrics
 * @description [Business Logic]: Evaluates justification completion percentage, remaining balance,
 * and lifecycle classification for an approved travel allowance record.
 */
export function computeProgressMetrics(item: JustificacionItem): ProgressMetrics {
  const otorgado = Number(item.monto_otorgado || 0);
  const gastado = Number(item.monto_gastado || 0);
  const rawPct = otorgado > 0 ? Math.round((gastado / otorgado) * 100) : 0;
  const pct = Math.min(rawPct, 100);
  const remaining = Math.max(0, Number((otorgado - gastado).toFixed(2)));
  const isComplete = gastado >= otorgado && otorgado > 0;
  const isEmpty = item.gastos_count === 0 && !isComplete;
  const isInProgress = !isComplete && !isEmpty;

  return {
    pct,
    rawPct,
    remaining,
    isComplete,
    isEmpty,
    isInProgress,
  };
}

/**
 * @name mapJustificacionGastoToGasto
 * @description [Adapter]: Maps a justification expense item into the canonical `Gasto` domain contract
 * consumed by the `DigitalInvoice` adaptive e-receipt viewer.
 */
export function mapJustificacionGastoToGasto(
  gasto: GastoJustificacion,
  parent: JustificacionItem
): Gasto {
  return {
    id: gasto.id,
    empleado: parent.empleado,
    categoria: gasto.categoria,
    comercio: gasto.comercio,
    monto: gasto.monto,
    moneda: gasto.moneda,
    tasa_cambio: gasto.tasa_cambio,
    monto_convertido: gasto.monto_convertido,
    moneda_viatico: parent.moneda,
    fecha_gasto: gasto.fecha_gasto,
    creado_en: gasto.creado_en,
    proyecto: parent.proyecto,
    metodo_pago: 'Rendición de Viáticos',
    estado: gasto.estado,
    url_comprobante: gasto.url_comprobante,
    concepto: gasto.concepto,
    moneda_original: gasto.moneda_original,
    origen_tasa: gasto.origen_tasa,
    base_imponible_ves: gasto.base_imponible_ves,
    iva_ves: gasto.iva_ves,
    exento_ves: gasto.exento_ves,
    igtf_ves: gasto.igtf_ves,
    monto_ves: gasto.monto_ves,
    monto_usd: gasto.monto_usd,
    rif_comercio: gasto.rif_comercio,
    numero_factura: gasto.numero_factura,
    requiere_revision_fiscal: gasto.requiere_revision_fiscal,
    pais_gasto: gasto.pais_gasto,
    estado_region: gasto.estado_region,
    ciudad: gasto.ciudad,
    codigo_postal: gasto.codigo_postal,
    tiene_sales_tax: gasto.tiene_sales_tax,
    subtotal_usd: gasto.subtotal_usd,
    sales_tax_usd: gasto.sales_tax_usd,
    propina_usd: gasto.propina_usd,
    nombre_impuesto_local: gasto.nombre_impuesto_local,
    tasa_impuesto_aplicada: gasto.tasa_impuesto_aplicada,
    impuesto_local_monto: gasto.impuesto_local_monto,
    subtotal_local: gasto.subtotal_local,
    folio_fiscal_uuid: gasto.folio_fiscal_uuid,
    es_deducible_fiscal: gasto.es_deducible_fiscal,
    tiene_validez_fiscal: gasto.tiene_validez_fiscal,
    tipo_documento: gasto.tipo_documento,
  };
}
