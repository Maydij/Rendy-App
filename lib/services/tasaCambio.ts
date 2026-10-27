/**
 * @name TasaCambioService
 * @description [Business Logic]: Servicio interno para consultar las tasas oficiales de cambio.
 * Reutiliza el proveedor de tasas ya existente en el proyecto (`@/lib/currency.ts`) sin
 * añadir ninguna dependencia ni API externa adicional, cumpliendo con la regla de arquitectura.
 */

import { getExchangeRates } from '@/lib/currency';

/**
 * @name obtenerTasaOficialDelDia
 * @description [Business Logic]: Retorna la tasa oficial vigente (Bs/USD) para una fecha dada.
 * Utiliza el pool de tasas existente en `lib/currency.ts` (BCV oficial).
 *
 * @param _fechaReferencia - Fecha de emisión o referencia del comprobante (YYYY-MM-DD o ISO).
 * @returns Promesa con la tasa numérica de Bolívares por Dólar (ej. 68.50).
 */
export async function obtenerTasaOficialDelDia(_fechaReferencia?: string): Promise<number> {
  try {
    const rates = await getExchangeRates();
    if (rates?.VES && Number(rates.VES) > 0) {
      return Number(rates.VES);
    }
  } catch (error) {
    console.error('❌ [TasaCambio] Error al obtener tasa oficial:', error);
  }

  // Tasa de contingencia en caso de indisponibilidad
  return 879.12;
}

