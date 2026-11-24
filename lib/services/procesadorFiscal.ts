/**
 * @name FiscalProcessorService
 * @description [Business Logic]: Orchestrates the fiscal normalization pipeline for
 * Venezuelan invoices. Takes the raw Gemini AI extraction (GeminiFiscalExtraction),
 * resolves the exchange rate (prioritizing the invoice-printed rate over the system's
 * BCV rate), validates mathematical consistency of tax breakdown components, and
 * produces a dual-currency (VES + USD) result ready for persistence in the `gastos` table.
 *
 * This service ensures every expense is stored with:
 *   - All four tax components in Bolívares (base_imponible, iva, exento, igtf)
 *   - Total in both VES and USD
 *   - Audit flag `requiere_revision_fiscal` when the breakdown doesn't add up
 */

import { obtenerTasaOficialDelDia } from '@/lib/services/tasaCambio';
import { getExchangeRates, normalizeMoneda } from '@/lib/currency';
import { normalizeUSStateCode } from '@/lib/services/usaTaxEngine';

/* ─────────────────────────────────────────────────────────
 * TYPES
 * ───────────────────────────────────────────────────────── */

/**
 * @name GeminiFiscalExtraction
 * @description [Data Contract]: Structure returned by the Gemini AI fiscal extraction
 * prompt. Represents the raw OCR output from a Venezuelan invoice/fiscal ticket.
 */
export interface GeminiFiscalExtraction {
  nombre_comercio: string;
  rif_comercio: string;
  numero_factura: string;
  fecha_emision: string;
  moneda: string;
  tasa_impresa: number | null;
  base_imponible: number;
  iva: number;
  exento: number;
  igtf: number;
  total: number;
  /** AI-classified expense category for policy validation */
  categoria_gasto?: string;

  // ── USA & Geographic Fields ──
  pais_detectado?: 'US' | 'VE' | 'MX' | 'OTRO' | string;
  estado_region?: string | null;
  ciudad?: string | null;
  codigo_postal?: string | null;
  subtotal_usd?: number | null;
  sales_tax_usd?: number | null;
  propina_usd?: number | null;

  // ── Universal Multi-Jurisdiction Tax Fields ──
  nombre_impuesto_local?: string | null;
  tasa_impuesto_aplicada?: number | null;
  impuesto_local_monto?: number | null;
  subtotal_local?: number | null;
  folio_fiscal_uuid?: string | null;

  // ── Fiscal Validity & Delivery Notes (Venezuela & Global) ──
  tipo_documento?: 'FACTURA_FISCAL' | 'NOTA_ENTREGA' | 'RECIBO_NO_FISCAL' | string;
  tiene_validez_fiscal?: boolean;
  motivo_no_fiscal?: string | null;
}

/**
 * @name ResultadoContable
 * @description [Data Contract]: Normalized accounting result for dual-currency
 * persistence. Each field maps directly to a column in the `gastos` table.
 */
export interface ResultadoContable {
  moneda_original: string;
  tasa_cambio: number;
  origen_tasa: 'factura' | 'sistema';
  base_imponible_ves: number;
  iva_ves: number;
  exento_ves: number;
  igtf_ves: number;
  monto_ves: number;
  monto_usd: number;
  requiere_revision_fiscal: boolean;

  // ── USA Tax Breakdown & Geography ──
  pais_gasto: 'US' | 'VE' | 'MX' | 'OTRO';
  estado_region: string | null;
  ciudad: string | null;
  codigo_postal: string | null;
  tiene_sales_tax: boolean;
  subtotal_usd: number;
  sales_tax_usd: number;
  propina_usd: number;

  // ── Universal Multi-Jurisdiction Tax Fields ──
  nombre_impuesto_local: string | null;
  tasa_impuesto_aplicada: number;
  impuesto_local_monto: number;
  subtotal_local: number;
  folio_fiscal_uuid: string | null;

  // ── Fiscal Validity & Delivery Notes ──
  tipo_documento: 'FACTURA_FISCAL' | 'NOTA_ENTREGA' | 'RECIBO_NO_FISCAL' | string;
  tiene_validez_fiscal: boolean;
  motivo_no_fiscal: string | null;
}

/* ─────────────────────────────────────────────────────────
 * CONSTANTS
 * ───────────────────────────────────────────────────────── */

/**
 * @description Maximum acceptable discrepancy (in the invoice's original currency)
 * between the stated total and the sum of tax components. Venezuelan fiscal printers
 * may introduce rounding of up to 0.05 units.
 */
const TOLERANCE_FISCAL_ROUNDING = 0.05;

/* ─────────────────────────────────────────────────────────
 * CORE: FISCAL NORMALIZATION PIPELINE
 * ───────────────────────────────────────────────────────── */

/**
 * @name normalizarGastoFiscal
 * @description [Business Logic]: Takes the raw Gemini AI extraction from a Venezuelan
 * invoice and produces a fully normalized, dual-currency accounting result.
 *
 * Steps:
 *   1. Resolve exchange rate (invoice-printed has priority over BCV system rate)
 *   2. Validate mathematical consistency: Total ≈ Base + IVA + Exento + IGTF
 *   3. Convert all tax components to VES (legal fiscal currency)
 *   4. Calculate USD consolidation amount (internal control currency)
 *   5. Flag for manual review if discrepancy exceeds tolerance
 */
export async function normalizarGastoFiscal(
  datosGemini: GeminiFiscalExtraction
): Promise<ResultadoContable> {
  const {
    moneda,
    tasa_impresa,
    base_imponible,
    iva,
    exento,
    igtf,
    total,
    fecha_emision,
  } = datosGemini;

  const monedaNorm = normalizeMoneda(moneda);
  const tieneValidezFiscal = datosGemini.tiene_validez_fiscal !== false;
  const tipoDocumento = datosGemini.tipo_documento || (tieneValidezFiscal ? 'FACTURA_FISCAL' : 'NOTA_ENTREGA');
  const motivoNoFiscal = !tieneValidezFiscal
    ? (datosGemini.motivo_no_fiscal || 'Comprobante sin validez fiscal (Nota de Entrega / Recibo)')
    : null;

  // ── Step 1: Exchange Rates & Conversion ──
  let tasaFinal = tasa_impresa && tasa_impresa > 0 ? tasa_impresa : 0;
  let origenTasa: 'factura' | 'sistema' = tasaFinal > 0 ? 'factura' : 'sistema';

  let montoVes = 0;
  let montoUsd = 0;
  let baseVes = 0;
  let ivaVes = 0;
  let exentoVes = 0;
  let igtfVes = 0;
  let toleranciaCalculada = TOLERANCE_FISCAL_ROUNDING;

  if (monedaNorm === 'VES') {
    if (tasaFinal <= 0) {
      tasaFinal = await obtenerTasaOficialDelDia(
        fecha_emision || new Date().toISOString()
      );
    }
    montoVes = total;
    if (!tieneValidezFiscal) {
      // Delivery notes / non-fiscal receipts in Venezuela generate zero deductible VAT credit
      baseVes = total;
      ivaVes = 0;
      exentoVes = total;
      igtfVes = 0;
    } else {
      baseVes = base_imponible;
      ivaVes = iva;
      exentoVes = exento;
      igtfVes = igtf;
    }
    montoUsd = Number((total / tasaFinal).toFixed(2));
  } else if (monedaNorm === 'USD') {
    // Universal baseline currency: parity with VES is completely omitted
    tasaFinal = 1;
    origenTasa = 'factura';
    montoUsd = total;
    montoVes = 0;
    baseVes = 0;
    ivaVes = 0;
    exentoVes = 0;
    igtfVes = 0;
  } else {
    // International currencies (MXN, COP, EUR, ARS, CLP, PEN, BRL, GBP, etc.):
    // Pair ONLY with USD based on live exchange rates. Parity with VES is completely omitted.
    const rates = await getExchangeRates();
    const rateAgainstUsd = rates[monedaNorm] || 1;

    tasaFinal = tasa_impresa && tasa_impresa > 0 ? tasa_impresa : rateAgainstUsd;
    origenTasa = tasa_impresa && tasa_impresa > 0 ? 'factura' : 'sistema';
    toleranciaCalculada = TOLERANCE_FISCAL_ROUNDING * tasaFinal;

    montoUsd = Number((total / tasaFinal).toFixed(2));
    montoVes = 0;
    baseVes = 0;
    ivaVes = 0;
    exentoVes = 0;
    igtfVes = 0;
  }

  // ── Step 2: Mathematical Consistency Validation ──
  const sumaDesglose = base_imponible + iva + exento + igtf;
  const discrepancia = sumaDesglose > 0 ? Math.abs(total - sumaDesglose) : 0;
  const requiereRevision = discrepancia > toleranciaCalculada;

  // ── Step 3: Multi-Jurisdiction Tax Breakdown & Geography Resolution ──
  let paisGasto: 'US' | 'VE' | 'MX' | 'OTRO' = 'VE';
  if (datosGemini.pais_detectado === 'US' || monedaNorm === 'USD') {
    paisGasto = 'US';
  } else if (datosGemini.pais_detectado === 'MX' || monedaNorm === 'MXN') {
    paisGasto = 'MX';
  } else if (datosGemini.pais_detectado === 'VE' || monedaNorm === 'VES') {
    paisGasto = 'VE';
  } else {
    paisGasto = (datosGemini.pais_detectado as 'US' | 'VE' | 'MX' | 'OTRO') || 'OTRO';
  }

  const estadoRegion = normalizeUSStateCode(datosGemini.estado_region);
  const ciudad = datosGemini.ciudad ? datosGemini.ciudad.trim() : null;
  const codigoPostal = datosGemini.codigo_postal ? datosGemini.codigo_postal.trim() : null;

  let salesTaxUsd = 0;
  let propinaUsd = 0;
  let subtotalUsd = 0;
  let nombreImpuestoLocal: string | null = null;
  let tasaImpuestoAplicada = 0;
  let impuestoLocalMonto = 0;
  let subtotalLocal = 0;
  let folioFiscalUuid: string | null = datosGemini.folio_fiscal_uuid || null;

  if (paisGasto === 'US') {
    salesTaxUsd = Number(datosGemini.sales_tax_usd || (datosGemini.iva > 0 ? datosGemini.iva : 0));
    propinaUsd = Number(datosGemini.propina_usd || 0);
    subtotalUsd = Number(
      datosGemini.subtotal_usd ||
      (datosGemini.base_imponible > 0
        ? datosGemini.base_imponible
        : Math.max(0, total - salesTaxUsd - propinaUsd))
    );
    nombreImpuestoLocal = 'Sales Tax';
    tasaImpuestoAplicada = 0;
    impuestoLocalMonto = salesTaxUsd;
    subtotalLocal = subtotalUsd;
    folioFiscalUuid = datosGemini.numero_factura || null;
  } else if (paisGasto === 'MX') {
    nombreImpuestoLocal = datosGemini.nombre_impuesto_local || 'IVA Trasladado';
    impuestoLocalMonto = Number(datosGemini.impuesto_local_monto ?? (datosGemini.iva > 0 ? datosGemini.iva : 0));
    subtotalLocal = Number(
      datosGemini.subtotal_local ??
      (datosGemini.base_imponible > 0
        ? datosGemini.base_imponible
        : Math.max(0, total - impuestoLocalMonto - (datosGemini.propina_usd || 0)))
    );
    tasaImpuestoAplicada = Number(
      datosGemini.tasa_impuesto_aplicada ??
      (subtotalLocal > 0 && impuestoLocalMonto > 0
        ? Math.round((impuestoLocalMonto / subtotalLocal) * 100)
        : 16)
    );
    propinaUsd = Number(datosGemini.propina_usd || 0);
    subtotalUsd = Number((subtotalLocal / (tasaFinal || 1)).toFixed(2));
    folioFiscalUuid = datosGemini.folio_fiscal_uuid || datosGemini.numero_factura || null;
  } else if (paisGasto === 'VE') {
    nombreImpuestoLocal = 'IVA';
    tasaImpuestoAplicada = 16.0;
    impuestoLocalMonto = ivaVes;
    subtotalLocal = baseVes;
    folioFiscalUuid = datosGemini.numero_factura || null;
  } else {
    // OTRO
    nombreImpuestoLocal = datosGemini.nombre_impuesto_local || 'Impuesto Local';
    impuestoLocalMonto = Number(datosGemini.impuesto_local_monto ?? (datosGemini.iva > 0 ? datosGemini.iva : 0));
    subtotalLocal = Number(
      datosGemini.subtotal_local ??
      (datosGemini.base_imponible > 0
        ? datosGemini.base_imponible
        : Math.max(0, total - impuestoLocalMonto - (datosGemini.propina_usd || 0)))
    );
    tasaImpuestoAplicada = Number(datosGemini.tasa_impuesto_aplicada ?? 0);
    propinaUsd = Number(datosGemini.propina_usd || 0);
    subtotalUsd = Number((subtotalLocal / (tasaFinal || 1)).toFixed(2));
    folioFiscalUuid = datosGemini.folio_fiscal_uuid || datosGemini.numero_factura || null;
  }

  return {
    moneda_original: monedaNorm,
    tasa_cambio: tasaFinal,
    origen_tasa: origenTasa,
    base_imponible_ves: baseVes,
    iva_ves: ivaVes,
    exento_ves: exentoVes,
    igtf_ves: igtfVes,
    monto_ves: montoVes,
    monto_usd: montoUsd,
    requiere_revision_fiscal: requiereRevision,
    pais_gasto: paisGasto,
    estado_region: estadoRegion,
    ciudad,
    codigo_postal: codigoPostal,
    tiene_sales_tax: salesTaxUsd > 0,
    subtotal_usd: subtotalUsd,
    sales_tax_usd: salesTaxUsd,
    propina_usd: propinaUsd,
    nombre_impuesto_local: nombreImpuestoLocal,
    tasa_impuesto_aplicada: tasaImpuestoAplicada,
    impuesto_local_monto: impuestoLocalMonto,
    subtotal_local: subtotalLocal,
    folio_fiscal_uuid: folioFiscalUuid,
    tipo_documento: tipoDocumento,
    tiene_validez_fiscal: tieneValidezFiscal,
    motivo_no_fiscal: motivoNoFiscal,
  };
}

/* ─────────────────────────────────────────────────────────
 * WHATSAPP MESSAGE FORMATTER
 * ───────────────────────────────────────────────────────── */

/**
 * @name formatearConfirmacionFiscalWhatsApp
 * @description [WhatsApp UX]: Builds the fiscal confirmation message sent to the
 * employee via WhatsApp after processing an invoice. Adapts strictly by jurisdiction:
 * US (no RIF, isolated Sales Tax & Tip), VE (SENIAT breakdown), MX (RFC/SAT), OTRO.
 */
export function formatearConfirmacionFiscalWhatsApp(
  datosGemini: GeminiFiscalExtraction,
  resultado: ResultadoContable
): string {
  const formatNum = (n: number): string =>
    n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const origenTasaLabel =
    resultado.origen_tasa === 'factura'
      ? 'Tasa de la Factura'
      : 'Tasa oficial del día';

  // Primary amount display depends on original currency
  let montoPrincipal = '';
  let tasaLabel = '';

  if (resultado.moneda_original === 'VES') {
    montoPrincipal = `${formatNum(resultado.monto_ves)} Bs _(equiv. $${formatNum(resultado.monto_usd)} USD)_`;
    tasaLabel = `💱 *Tasa aplicada:* ${formatNum(resultado.tasa_cambio)} Bs/USD (${origenTasaLabel})`;
  } else if (resultado.moneda_original === 'USD') {
    montoPrincipal = `$${formatNum(resultado.monto_usd)} USD`;
    tasaLabel = '';
  } else {
    // International currencies (MXN, COP, EUR, etc.): compare ONLY with USD
    montoPrincipal = `${formatNum(datosGemini.total)} ${resultado.moneda_original} _(equiv. $${formatNum(resultado.monto_usd)} USD)_`;
    tasaLabel = `💱 *Tasa aplicada:* 1 USD = ${formatNum(resultado.tasa_cambio)} ${resultado.moneda_original} (${origenTasaLabel})`;
  }

  const revisionFlag = resultado.requiere_revision_fiscal
    ? '\n⚠️ _Nota: El desglose fiscal tiene una discrepancia matemática respecto al total. Se registrará para revisión contable._'
    : '';

  const lineas = [
    `📄 *Comprobante Procesado*`,
    ``,
    `🏢 *Comercio:* ${datosGemini.nombre_comercio || 'No detectado'}`,
  ];

  if (resultado.pais_gasto === 'VE' && !resultado.tiene_validez_fiscal) {
    lineas.unshift(
      `⚠️ *AVISO DE VALIDEZ FISCAL (VENEZUELA)*\n` +
      `Este documento fue detectado como *Nota de Entrega / Recibo sin validez fiscal* (no cumple requisitos SENIAT).\n` +
      `• No genera crédito fiscal de IVA.\n` +
      `• Será enviado a *revisión y aprobación* del administrador.\n`
    );
  }

  if (resultado.pais_gasto === 'US') {
    if (datosGemini.numero_factura) {
      lineas.push(`📄 *Factura / Doc:* #${datosGemini.numero_factura}`);
    }
    const ubicacion = [resultado.ciudad, resultado.estado_region, resultado.codigo_postal ? `ZIP ${resultado.codigo_postal}` : null].filter(Boolean).join(', ');
    if (ubicacion) {
      lineas.push(`📍 *Ubicación:* ${ubicacion}`);
    }
  } else if (resultado.pais_gasto === 'MX') {
    lineas.push(`🔢 *RFC:* ${datosGemini.rif_comercio || 'N/A'} | *Folio:* #${datosGemini.numero_factura || 'N/A'}`);
  } else if (resultado.pais_gasto === 'VE') {
    lineas.push(`🔢 *RIF:* ${datosGemini.rif_comercio || 'N/A'} | *Factura:* #${datosGemini.numero_factura || 'N/A'}`);
  } else {
    if (datosGemini.numero_factura) {
      lineas.push(`📄 *Doc #:* ${datosGemini.numero_factura}`);
    }
  }

  lineas.push(
    `📅 *Fecha:* ${datosGemini.fecha_emision || 'No detectada'}`,
    ``,
    `💵 *Total:* ${montoPrincipal}`
  );

  if (tasaLabel) {
    lineas.push(tasaLabel);
  }

  // Tax breakdown: Strictly jurisdiction-specific
  if (resultado.pais_gasto === 'US') {
    lineas.push(
      ``,
      `📊 *Desglose (USD):*`,
      `• Subtotal: $${formatNum(resultado.subtotal_usd)} USD`,
      `• Sales Tax: $${formatNum(resultado.sales_tax_usd)} USD (${resultado.tiene_sales_tax ? 'Con Tax' : 'Sin Tax'})`
    );
    if (resultado.propina_usd > 0) {
      lineas.push(`• Propina: $${formatNum(resultado.propina_usd)} USD`);
    }
  } else if (resultado.moneda_original === 'VES') {
    lineas.push(
      ``,
      `📊 *Desglose Contable (VES):*`,
      `• Base Imponible: ${formatNum(resultado.base_imponible_ves)} Bs`,
      `• IVA: ${formatNum(resultado.iva_ves)} Bs`,
      `• Exento: ${formatNum(resultado.exento_ves)} Bs`,
      `• IGTF: ${formatNum(resultado.igtf_ves)} Bs`
    );
  } else if (resultado.pais_gasto === 'MX' || resultado.subtotal_local > 0 || resultado.impuesto_local_monto > 0) {
    const taxName = resultado.nombre_impuesto_local || 'Impuestos';
    const rateStr = resultado.tasa_impuesto_aplicada > 0 ? ` (${resultado.tasa_impuesto_aplicada}%)` : '';
    lineas.push(
      ``,
      `📊 *Desglose de Impuestos (${resultado.moneda_original}):*`,
      `• Subtotal: ${formatNum(resultado.subtotal_local)} ${resultado.moneda_original}`,
      `• ${taxName}${rateStr}: ${formatNum(resultado.impuesto_local_monto)} ${resultado.moneda_original}`
    );
    if (resultado.propina_usd > 0) {
      lineas.push(`• Propina: ${formatNum(resultado.propina_usd)} ${resultado.moneda_original}`);
    }
  }

  if (revisionFlag) {
    lineas.push(revisionFlag);
  }

  lineas.push(
    ``,
    `¿Confirmas que los datos son correctos?`,
    `*(Responde SI para guardar o escribe VOLVER para cancelar)*`
  );

  return lineas.join('\n');
}

