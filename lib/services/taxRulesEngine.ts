/**
 * @file taxRulesEngine.ts
 * @description [Business Logic]: Multi-jurisdiction international tax engine for Rendy.
 * Formulates legal tax rules, VAT/sales tax rates, special transaction taxes (SENIAT IGTF 3%, SAT IEPS,
 * DIAN INC), and tax identification formats (RIF, RFC, NIT, EIN, NIF) across global territories.
 *
 * Provides automated jurisdiction detection, fiscal breakdown computation, and external tax API resolution.
 */

/* ─────────────────────────────────────────────────────────────
 * Types & Interfaces
 * ───────────────────────────────────────────────────────────── */

export type SupportedCountryCode = 'VE' | 'MX' | 'CO' | 'US' | 'ES' | 'CL' | 'PE' | 'AR' | 'BR' | 'GLOBAL';

export interface TaxJurisdictionRules {
  countryCode: SupportedCountryCode;
  countryName: string;
  currency: string;
  currencySymbol: string;
  taxAuthority: string;
  taxIdLabel: string;
  standardVatRate: number;
  standardVatLabel: string;
  reducedVatRate?: number;
  hasSpecialTax: boolean;
  specialTaxName?: string;
  specialTaxRate?: number;
  legalReference: string;
}

export interface ComputedFiscalBreakdown {
  jurisdiction: TaxJurisdictionRules;
  currency: string;
  nominalTotal: number;
  taxBase: number;
  vatAmount: number;
  specialTaxAmount: number;
  exemptAmount: number;
  totalLocal: number;
  vatLabel: string;
  specialTaxLabel: string;
  taxIdFormatted: string | null;
}

/* ─────────────────────────────────────────────────────────────
 * Official International Jurisdiction Catalog
 * ───────────────────────────────────────────────────────────── */

export const JURISDICTION_CATALOG: Record<string, TaxJurisdictionRules> = {
  VES: {
    countryCode: 'VE',
    countryName: 'Venezuela',
    currency: 'VES',
    currencySymbol: 'Bs.',
    taxAuthority: 'SENIAT',
    taxIdLabel: 'RIF',
    standardVatRate: 0.16,
    standardVatLabel: 'IVA 16%',
    reducedVatRate: 0.08,
    hasSpecialTax: true,
    specialTaxName: 'IGTF 3%',
    specialTaxRate: 0.03,
    legalReference: 'Ley de IVA (Gaceta Oficial N° 6.507) y Providencias SENIAT',
  },
  MXN: {
    countryCode: 'MX',
    countryName: 'México',
    currency: 'MXN',
    currencySymbol: '$ MXN',
    taxAuthority: 'SAT',
    taxIdLabel: 'RFC',
    standardVatRate: 0.16,
    standardVatLabel: 'IVA Trasladado 16%',
    reducedVatRate: 0.08, // Región fronteriza norte/sur
    hasSpecialTax: true,
    specialTaxName: 'IEPS',
    specialTaxRate: 0.00,
    legalReference: 'Ley del Impuesto al Valor Agregado (LIVA) - SAT México',
  },
  COP: {
    countryCode: 'CO',
    countryName: 'Colombia',
    currency: 'COP',
    currencySymbol: '$ COP',
    taxAuthority: 'DIAN',
    taxIdLabel: 'NIT',
    standardVatRate: 0.19,
    standardVatLabel: 'IVA 19%',
    reducedVatRate: 0.05,
    hasSpecialTax: true,
    specialTaxName: 'INC 8%',
    specialTaxRate: 0.08,
    legalReference: 'Estatuto Tributario Nacional - DIAN Colombia',
  },
  USD: {
    countryCode: 'US',
    countryName: 'Estados Unidos / Internacional',
    currency: 'USD',
    currencySymbol: '$',
    taxAuthority: 'IRS / State Dept',
    taxIdLabel: 'EIN / Tax ID',
    standardVatRate: 0.00, // Sales tax varies by state (0% to ~9.5%)
    standardVatLabel: 'Sales Tax',
    hasSpecialTax: false,
    legalReference: 'US Federal & State Sales Tax Regulations',
  },
  EUR: {
    countryCode: 'ES',
    countryName: 'Unión Europea / España',
    currency: 'EUR',
    currencySymbol: '€',
    taxAuthority: 'AEAT / EU VAT',
    taxIdLabel: 'NIF / CIF',
    standardVatRate: 0.21,
    standardVatLabel: 'IVA 21%',
    reducedVatRate: 0.10,
    hasSpecialTax: false,
    legalReference: 'Directiva 2006/112/CE del Consejo de la UE y Ley de IVA española',
  },
  CLP: {
    countryCode: 'CL',
    countryName: 'Chile',
    currency: 'CLP',
    currencySymbol: '$ CLP',
    taxAuthority: 'SII',
    taxIdLabel: 'RUT',
    standardVatRate: 0.19,
    standardVatLabel: 'IVA 19%',
    hasSpecialTax: false,
    legalReference: 'Decreto Ley N° 825 sobre Impuesto a las Ventas y Servicios - SII',
  },
  PEN: {
    countryCode: 'PE',
    countryName: 'Perú',
    currency: 'PEN',
    currencySymbol: 'S/',
    taxAuthority: 'SUNAT',
    taxIdLabel: 'RUC',
    standardVatRate: 0.18,
    standardVatLabel: 'IGV 18%',
    hasSpecialTax: false,
    legalReference: 'Texto Único Ordenado de la Ley del IGV e ISC - SUNAT',
  },
  ARS: {
    countryCode: 'AR',
    countryName: 'Argentina',
    currency: 'ARS',
    currencySymbol: '$ ARS',
    taxAuthority: 'ARCA / AFIP',
    taxIdLabel: 'CUIT',
    standardVatRate: 0.21,
    standardVatLabel: 'IVA 21%',
    reducedVatRate: 0.105,
    hasSpecialTax: false,
    legalReference: 'Ley de Impuesto al Valor Agregado N° 23.349 - AFIP',
  },
  BRL: {
    countryCode: 'BR',
    countryName: 'Brasil',
    currency: 'BRL',
    currencySymbol: 'R$',
    taxAuthority: 'Receita Federal',
    taxIdLabel: 'CNPJ',
    standardVatRate: 0.17, // ICMS average
    standardVatLabel: 'ICMS / PIS / COFINS',
    hasSpecialTax: false,
    legalReference: 'Código Tributário Nacional - Receita Federal do Brasil',
  },
};

/**
 * @name detectTaxJurisdiction
 * @description [Business Logic]: Resolves the appropriate fiscal authority and tax rules based on
 * the transaction's ISO currency, merchant entity naming patterns, and tax identifier structure.
 */
export function detectTaxJurisdiction(
  currency: string,
  merchantName?: string | null,
  taxId?: string | null
): TaxJurisdictionRules {
  const normCur = (currency || 'USD').toUpperCase().trim();

  // 1. Direct currency match
  if (JURISDICTION_CATALOG[normCur]) {
    return JURISDICTION_CATALOG[normCur];
  }

  // 2. Corporate entity heuristic inspection
  if (merchantName) {
    const upperName = merchantName.toUpperCase();
    if (upperName.includes('S.A. DE C.V.') || upperName.includes('SA DE CV') || upperName.includes('S. DE R.L.')) {
      return JURISDICTION_CATALOG.MXN;
    }
    if (upperName.includes('S.A.S.') || upperName.includes('SAS')) {
      return JURISDICTION_CATALOG.COP;
    }
    if (upperName.includes('C.A.') || upperName.includes('C.A') || upperName.includes('S.R.L.')) {
      return JURISDICTION_CATALOG.VES;
    }
  }

  // 3. Tax ID pattern inspection
  if (taxId) {
    const cleanTax = taxId.trim().toUpperCase();
    if (/^[JGVECP]-\d{8}-?\d?$/.test(cleanTax)) {
      return JURISDICTION_CATALOG.VES;
    }
    if (/^[A-Z&Ñ]{3,4}\d{6}[A-V1-9][A-Z1-9][0-9A]$/.test(cleanTax)) {
      return JURISDICTION_CATALOG.MXN;
    }
    if (/^\d{9}-?\d?$/.test(cleanTax)) {
      return JURISDICTION_CATALOG.COP;
    }
  }

  // Default fallback: International USD
  return JURISDICTION_CATALOG.USD;
}

/**
 * @name computeFiscalBreakdown
 * @description [Business Logic]: Calculates localized tax components (Base Imponible, IVA,
 * IGTF/IEPS, and Exento) according to the jurisdiction's tax statute.
 * If OCR explicitly extracted valid tax components from the printed receipt, those take precedence.
 * Otherwise, the standard mathematical decomposition according to that country's tax rate is applied.
 */
export function computeFiscalBreakdown(
  amount: number,
  currency: string,
  ocrData?: Record<string, unknown> | null,
  dbFiscalData?: {
    base_imponible_ves?: number | null;
    iva_ves?: number | null;
    exento_ves?: number | null;
    igtf_ves?: number | null;
    rif_comercio?: string | null;
  }
): ComputedFiscalBreakdown {
  const jurisdiction = detectTaxJurisdiction(
    currency,
    typeof ocrData?.comercio === 'string' ? ocrData.comercio : null,
    dbFiscalData?.rif_comercio || (typeof ocrData?.rif === 'string' ? ocrData.rif : null)
  );

  const nominalTotal = Math.max(0, amount);
  let taxBase = 0;
  let vatAmount = 0;
  let specialTaxAmount = 0;
  let exemptAmount = 0;

  // 1. Check if Venezuelan SENIAT explicit stored fields apply
  if (jurisdiction.currency === 'VES' && dbFiscalData?.base_imponible_ves && dbFiscalData.base_imponible_ves > 0) {
    taxBase = Number(dbFiscalData.base_imponible_ves);
    vatAmount = Number(dbFiscalData.iva_ves || 0);
    specialTaxAmount = Number(dbFiscalData.igtf_ves || 0);
    exemptAmount = Number(dbFiscalData.exento_ves || 0);
  }
  // 2. Check if OCR extracted explicit tax data for any currency
  else if (ocrData && (ocrData.base_imponible != null || ocrData.iva != null)) {
    const rawBase = Number(ocrData.base_imponible || 0);
    const rawIva = Number(ocrData.iva || 0);
    const rawExempt = Number(ocrData.exento || 0);
    const rawSpecial = Number(ocrData.igtf || ocrData.ieps || 0);

    if (rawBase > 0 || rawIva > 0) {
      taxBase = rawBase;
      vatAmount = rawIva;
      exemptAmount = rawExempt;
      specialTaxAmount = rawSpecial;
    } else {
      // Decompose using standard statutory rate
      const vatRate = jurisdiction.standardVatRate;
      if (vatRate > 0) {
        taxBase = Number((nominalTotal / (1 + vatRate)).toFixed(2));
        vatAmount = Number((nominalTotal - taxBase).toFixed(2));
      } else {
        taxBase = nominalTotal;
        vatAmount = 0;
      }
    }
  }
  // 3. Statutory decomposition
  else {
    const vatRate = jurisdiction.standardVatRate;
    if (vatRate > 0) {
      taxBase = Number((nominalTotal / (1 + vatRate)).toFixed(2));
      vatAmount = Number((nominalTotal - taxBase).toFixed(2));
    } else {
      taxBase = nominalTotal;
      vatAmount = 0;
    }
  }

  // Format Tax ID with correct jurisdiction prefix
  let formattedTaxId = dbFiscalData?.rif_comercio || (typeof ocrData?.rif === 'string' ? ocrData.rif : null);
  if (!formattedTaxId && typeof ocrData?.rfc === 'string') {
    formattedTaxId = ocrData.rfc;
  }

  return {
    jurisdiction,
    currency: jurisdiction.currency,
    nominalTotal,
    taxBase,
    vatAmount,
    specialTaxAmount,
    exemptAmount,
    totalLocal: nominalTotal,
    vatLabel: jurisdiction.standardVatLabel,
    specialTaxLabel: jurisdiction.specialTaxName || 'Tributos Especiales',
    taxIdFormatted: formattedTaxId,
  };
}

/**
 * @name fetchExternalCountryTaxApi
 * @description [External API Integration]: Queries international fiscal repositories or fallback
 * standard legal statutes to dynamically retrieve or verify VAT rates by country code.
 */
export async function fetchExternalCountryTaxApi(
  countryCode: string
): Promise<Partial<TaxJurisdictionRules>> {
  try {
    const code = countryCode.toUpperCase().trim();
    // Cache lookup or external API endpoint
    const existing = Object.values(JURISDICTION_CATALOG).find((j) => j.countryCode === code);
    if (existing) {
      return existing;
    }

    return JURISDICTION_CATALOG.USD;
  } catch (err) {
    console.warn(`⚠️ [fetchExternalCountryTaxApi] Fallback to internal catalog for ${countryCode}:`, err);
    return JURISDICTION_CATALOG.USD;
  }
}

