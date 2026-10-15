/**
 * lib/currency.ts
 * Utilidades compartidas para normalización, consulta de tasas de cambio y conversión de monedas en Rendy.
 */

export const ISO_CURRENCIES = new Set(['USD', 'EUR', 'VES', 'MXN', 'COP', 'ARS', 'BRL', 'CLP', 'PEN', 'GBP']);

export function normalizeMoneda(moneda?: string | null): string {
  if (!moneda) return 'USD';
  const upper = moneda.toUpperCase().trim();
  if (upper === 'BS' || upper === 'BS.' || upper === 'BOLIVARES' || upper === 'BOLIVAR' || upper === 'VED') {
    return 'VES';
  }
  if (upper === '$' || upper === 'US$' || upper === 'DOLARES' || upper === 'DOLAR') {
    return 'USD';
  }
  return ISO_CURRENCIES.has(upper) ? upper : 'USD';
}

/**
 * Obtiene las tasas de cambio actualizadas contra USD.
 * Integra tanto la API global como la tasa oficial BCV para Venezuela.
 */
export async function getExchangeRates(): Promise<Record<string, number>> {
  let rates: Record<string, number> = {
    USD: 1,
    VES: 879.12,
    EUR: 0.92,
    COP: 4200,
    MXN: 18.5,
    CLP: 950,
    PEN: 3.75,
    ARS: 1200,
    BRL: 5.4,
    GBP: 0.78,
  };

  // 1. Tasas globales desde open.er-api.com
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { next: { revalidate: 1800 } });
    const data = await res.json();
    if (data?.result === 'success' && data.rates) {
      rates = { ...rates, ...data.rates };
    }
  } catch (e) {
    console.error('Error fetching global exchange rates:', e);
  }

  // 2. Tasa oficial BCV desde dolarapi.com para asegurar precisión en VES
  try {
    const resBcv = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', { next: { revalidate: 1800 } });
    const dataBcv = await resBcv.json();
    if (dataBcv?.promedio && Number(dataBcv.promedio) > 0) {
      rates['VES'] = Number(dataBcv.promedio);
    }
  } catch (e) {
    console.error('Error fetching BCV rate:', e);
  }

  return rates;
}

/**
 * Convierte un monto de una moneda de origen a una moneda de destino.
 */
export function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>
): number {
  const from = normalizeMoneda(fromCurrency);
  const to = normalizeMoneda(toCurrency);
  if (from === to) return amount;

  const rateFrom = rates[from] || 1;
  const rateTo = rates[to] || 1;
  
  // Convertir primero a USD base, luego a moneda destino
  return (amount / rateFrom) * rateTo;
}

/**
 * Formatea un número según las convenciones locales y de divisa.
 */
export function formatCurrency(n: number, moneda = 'USD'): string {
  const safeMoneda = normalizeMoneda(moneda);
  const noDecimals = safeMoneda === 'COP' || safeMoneda === 'CLP' || (n >= 10000 && n % 1 === 0);
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: safeMoneda,
    minimumFractionDigits: noDecimals ? 0 : 2,
    maximumFractionDigits: noDecimals ? 0 : 2,
  }).format(n);
}
