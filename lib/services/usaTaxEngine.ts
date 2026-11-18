/**
 * @file usaTaxEngine.ts
 * @description [Business Logic]: USA Sales Tax audit and tax-exemption verification engine.
 * Classifies US expenses into fiscal states (EXENTO_APLICADO, FUGA_FISCAL_RECUPERABLE,
 * ESTADO_SIN_SALES_TAX, NO_APLICA) and generates contextual WhatsApp prevention alerts
 * when sales tax was erroneously charged to a tax-exempt organization.
 */

export type EstadoTaxUSA =
  | 'EXENTO_APLICADO'
  | 'FUGA_FISCAL_RECUPERABLE'
  | 'ESTADO_SIN_SALES_TAX'
  | 'NO_APLICA';

export interface ResultadoAuditoriaUSA {
  estado_tax_usa: EstadoTaxUSA;
  alerta_whatsapp: string | null;
  explicacion: string;
}

/**
 * US states that do not impose a statewide general sales tax:
 * - AK: Alaska (has local taxes only)
 * - DE: Delaware
 * - MT: Montana
 * - NH: New Hampshire
 * - OR: Oregon
 */
export const US_STATES_WITHOUT_SALES_TAX: readonly string[] = [
  'AK',
  'DE',
  'MT',
  'NH',
  'OR',
];

/**
 * Standard 2-letter postal abbreviations for all 50 US States + DC and PR.
 */
export const US_STATE_NAMES_MAP: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
  DC: 'District of Columbia',
  PR: 'Puerto Rico',
};

/**
 * @name normalizeUSStateCode
 * @description [Business Logic]: Normalizes any free-form state name or abbreviation
 * into its canonical 2-letter uppercase ISO code.
 */
export function normalizeUSStateCode(stateInput?: string | null): string | null {
  if (!stateInput) return null;
  const cleaned = stateInput.trim().toUpperCase();

  if (cleaned.length === 2 && US_STATE_NAMES_MAP[cleaned]) {
    return cleaned;
  }

  // Lookup full name case-insensitively
  const lowerInput = stateInput.trim().toLowerCase();
  for (const [code, name] of Object.entries(US_STATE_NAMES_MAP)) {
    if (name.toLowerCase() === lowerInput) {
      return code;
    }
  }

  return cleaned.length === 2 ? cleaned : null;
}

export interface AuditarGastoUSAParams {
  esEmpresaTaxExempt: boolean;
  estadoUs?: string | null;
  salesTaxUsd?: number | null;
  paisGasto?: string | null;
}

/**
 * @name auditarGastoUSA
 * @description [Business Logic]: Core auditor for US commercial transactions.
 * Evaluates whether an expense incurred in the United States qualifies as a recoverable
 * sales tax leakage when paid by a tax-exempt entity, or if it occurred in a state with
 * no general sales tax.
 *
 * @param params Audit parameters including tax-exempt company status, state code, and tax amount.
 * @returns Classification and optional WhatsApp warning alert.
 */
export function auditarGastoUSA({
  esEmpresaTaxExempt,
  estadoUs,
  salesTaxUsd,
  paisGasto = 'US',
}: AuditarGastoUSAParams): ResultadoAuditoriaUSA {
  const normalizedCountry = (paisGasto || '').trim().toUpperCase();

  // If transaction was not in the United States, USA tax audit does not apply
  if (normalizedCountry !== 'US' && normalizedCountry !== 'USA') {
    return {
      estado_tax_usa: 'NO_APLICA',
      alerta_whatsapp: null,
      explicacion: 'Transacción realizada fuera de la jurisdicción de EE. UU.',
    };
  }

  const stateCode = normalizeUSStateCode(estadoUs) || (estadoUs || '').trim().toUpperCase();
  const tax = Number(salesTaxUsd || 0);

  // States with no state sales tax
  if (US_STATES_WITHOUT_SALES_TAX.includes(stateCode)) {
    return {
      estado_tax_usa: 'ESTADO_SIN_SALES_TAX',
      alerta_whatsapp: null,
      explicacion: `El estado ${stateCode} no aplica Sales Tax estatal general.`,
    };
  }

  // If the company is tax-exempt and tax was paid, flag as recoverable leakage
  if (esEmpresaTaxExempt && tax > 0) {
    const stateName = US_STATE_NAMES_MAP[stateCode] || stateCode || 'EE. UU.';
    return {
      estado_tax_usa: 'FUGA_FISCAL_RECUPERABLE',
      alerta_whatsapp:
        `⚠️ *Alerta Tax-Exempt (${stateCode || 'USA'}):* Este comprobante incluye *$${tax.toFixed(2)} USD* de Sales Tax.\n` +
        `Recuerda presentar el Certificado de Exención de la empresa en caja antes de pagar.\n` +
        `💡 _Escribe *"Certificado"* en este chat cuando estés en caja para recibirlo al instante._`,
      explicacion: `Fuga fiscal recuperable: Se cobraron $${tax.toFixed(2)} USD de Sales Tax en ${stateName} a una empresa exenta.`,
    };
  }

  // Tax-exempt applied (no tax paid) or regular non-exempt transaction
  return {
    estado_tax_usa: 'EXENTO_APLICADO',
    alerta_whatsapp: null,
    explicacion: tax === 0
      ? 'Exención aplicada exitosamente (no se cobró Sales Tax).'
      : 'Gasto regular con Sales Tax liquidado.',
  };
}
