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
  moneda: 'VES' | 'USD';
  tasa_impresa: number | null;
  base_imponible: number;
  iva: number;
  exento: number;
  igtf: number;
  total: number;
}

/**
 * @name ResultadoContable
 * @description [Data Contract]: Normalized accounting result for dual-currency
 * persistence. Each field maps directly to a column in the `gastos` table.
 */
export interface ResultadoContable {
  moneda_original: 'VES' | 'USD';
  tasa_cambio: number;
  origen_tasa: 'factura' | 'sistema';
  base_imponible_ves: number;
  iva_ves: number;
  exento_ves: number;
  igtf_ves: number;
  monto_ves: number;
  monto_usd: number;
  requiere_revision_fiscal: boolean;
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

  // ── Step 1: Resolve Exchange Rate ──
  // Priority 1: Invoice-printed rate | Priority 2: BCV official system rate
  let tasaFinal = tasa_impresa;
  let origenTasa: 'factura' | 'sistema' = 'factura';

  if (!tasaFinal || tasaFinal <= 0) {
    tasaFinal = await obtenerTasaOficialDelDia(
      fecha_emision || new Date().toISOString()
    );
    origenTasa = 'sistema';
  }

  // ── Step 2: Mathematical Consistency Validation ──
  // Total should equal the sum of all fiscal components
  const sumaDesglose = base_imponible + iva + exento + igtf;
  const discrepancia = Math.abs(total - sumaDesglose);
  const requiereRevision = discrepancia > TOLERANCE_FISCAL_ROUNDING;

  // ── Step 3 & 4: Dual-Currency Conversion ──
  let montoVes = 0;
  let montoUsd = 0;
  let baseVes = 0;
  let ivaVes = 0;
  let exentoVes = 0;
  let igtfVes = 0;

  if (moneda === 'VES') {
    // Invoice is already in Bolívares — direct assignment
    montoVes = total;
    baseVes = base_imponible;
    ivaVes = iva;
    exentoVes = exento;
    igtfVes = igtf;
    montoUsd = Number((total / tasaFinal).toFixed(2));
  } else {
    // Invoice is in USD — convert all components to VES
    montoUsd = total;
    montoVes = Number((total * tasaFinal).toFixed(2));
    baseVes = Number((base_imponible * tasaFinal).toFixed(2));
    ivaVes = Number((iva * tasaFinal).toFixed(2));
    exentoVes = Number((exento * tasaFinal).toFixed(2));
    igtfVes = Number((igtf * tasaFinal).toFixed(2));
  }

  return {
    moneda_original: moneda,
    tasa_cambio: tasaFinal,
    origen_tasa: origenTasa,
    base_imponible_ves: baseVes,
    iva_ves: ivaVes,
    exento_ves: exentoVes,
    igtf_ves: igtfVes,
    monto_ves: montoVes,
    monto_usd: montoUsd,
    requiere_revision_fiscal: requiereRevision,
  };
}

/* ─────────────────────────────────────────────────────────
 * WHATSAPP MESSAGE FORMATTER
 * ───────────────────────────────────────────────────────── */

/**
 * @name formatearConfirmacionFiscalWhatsApp
 * @description [WhatsApp UX]: Builds the fiscal confirmation message sent to the
 * employee via WhatsApp after processing an invoice. Shows the primary amount,
 * exchange rate source, and full tax breakdown in VES for accounting transparency.
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
  const montoPrincipal =
    resultado.moneda_original === 'USD'
      ? `$${formatNum(resultado.monto_usd)} USD _(equiv. ${formatNum(resultado.monto_ves)} Bs)_`
      : `${formatNum(resultado.monto_ves)} Bs _(equiv. $${formatNum(resultado.monto_usd)} USD)_`;

  const revisionFlag = resultado.requiere_revision_fiscal
    ? '\n⚠️ _Nota: El desglose fiscal tiene una discrepancia matemática respecto al total. Se registrará para revisión contable._'
    : '';

  const lineas = [
    `📄 *Comprobante Procesado*`,
    ``,
    `🏢 *Comercio:* ${datosGemini.nombre_comercio || 'No detectado'}`,
    `🔢 *RIF:* ${datosGemini.rif_comercio || 'N/A'} | *Factura:* #${datosGemini.numero_factura || 'N/A'}`,
    `📅 *Fecha:* ${datosGemini.fecha_emision || 'No detectada'}`,
    ``,
    `💵 *Total:* ${montoPrincipal}`,
    `💱 *Tasa aplicada:* ${formatNum(resultado.tasa_cambio)} Bs/USD (${origenTasaLabel})`,
    ``,
    `📊 *Desglose Contable (VES):*`,
    `• Base Imponible: ${formatNum(resultado.base_imponible_ves)} Bs`,
    `• IVA (16%): ${formatNum(resultado.iva_ves)} Bs`,
    `• Exento: ${formatNum(resultado.exento_ves)} Bs`,
    `• IGTF (3%): ${formatNum(resultado.igtf_ves)} Bs`,
  ];

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

