/**
 * @name ExpensePolicyValidationService
 * @description [Business Logic]: Validates expenses against company spending limits
 * configured in the `limites_gastos` table. Supports hierarchical policy evaluation
 * where employee-specific limits take priority over company-wide (global) limits.
 *
 * Evaluation modes:
 *   - POR_TRANSACCION: Single transaction cannot exceed the configured cap
 *   - DIARIO: Sum of all same-category expenses within the calendar day
 *   - MENSUAL: Sum of all same-category expenses within the calendar month
 *
 * When an expense exceeds its limit, the system does NOT block the submission —
 * instead it flags it for special managerial approval and notifies the employee.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/* ─────────────────────────────────────────────────────────
 * TYPES
 * ───────────────────────────────────────────────────────── */

/** Standard expense categories aligned with SENIAT fiscal classification */
export type ExpenseCategory =
  | 'ALIMENTACION'
  | 'TRANSPORTE'
  | 'HOSPEDAJE'
  | 'REPRESENTACION'
  | 'OTROS';

/** Supported evaluation periods for spending limits */
export type LimitPeriod = 'DIARIO' | 'POR_TRANSACCION' | 'MENSUAL';

/**
 * @name PolicyEvaluation
 * @description [Data Contract]: Result of evaluating an expense against the
 * configured spending policies. If the expense exceeds the limit, contains
 * the full breakdown of the violation for audit trail persistence.
 */
export interface PolicyEvaluation {
  exceedsLimit: boolean;
  suggestedStatus: 'PENDIENTE' | 'REQUIERE_APROBACION_ESPECIAL';
  excessDetail: ExcessDetail | null;
}

/**
 * @name ExcessDetail
 * @description [Data Contract]: Detailed breakdown of a policy violation,
 * persisted as JSONB in the `detalle_exceso` column for audit traceability.
 */
export interface ExcessDetail {
  limite_monto_usd: number;
  monto_evaluado_usd: number;
  acumulado_previo_usd: number;
  periodo: LimitPeriod;
  categoria: string;
  diferencia_excedida_usd: number;
}

/** Row shape returned from the `limites_gastos` table query */
interface SpendingLimitRow {
  id: string;
  empleado_id: string | null;
  categoria: string;
  limite_monto_usd: number;
  periodo: string;
  activo: boolean;
}

/* ─────────────────────────────────────────────────────────
 * CONSTANTS
 * ───────────────────────────────────────────────────────── */

/** Default evaluation result when no applicable policy is found */
const NO_LIMIT_RESULT: PolicyEvaluation = {
  exceedsLimit: false,
  suggestedStatus: 'PENDIENTE',
  excessDetail: null,
};

/**
 * Valid standard expense category codes aligned with Rendy's official catalog.
 */
export const STANDARD_CATEGORIES: readonly string[] = [
  'FOOD_BEVERAGE',
  'PARKING_TOLLS_TAXI',
  'HOTEL',
  'GAS_FUEL',
  'AIRFARE_TRAIN',
  'CAR_RENTAL',
  'MATERIALES',
  'MISCELLANEOUS',
] as const;

/* ─────────────────────────────────────────────────────────
 * UTILITY: CATEGORY NORMALIZATION
 * ───────────────────────────────────────────────────────── */

/**
 * @name normalizeCategory
 * @description [Business Logic]: Maps free-form category labels (from Gemini AI
 * extraction or legacy values) to Rendy's official categories.
 * Falls back to 'Miscellaneous' for unmapped values.
 */
export function normalizeCategory(rawCategory: string): string {
  const normalized = rawCategory
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Strip diacritics (á→a, ó→o, etc.)
    .trim();

  const categoryMap: Record<string, string> = {
    FOOD_BEVERAGE: 'Food/Beverage',
    'FOOD/BEVERAGE': 'Food/Beverage',
    ALIMENTACION: 'Food/Beverage',
    COMIDA: 'Food/Beverage',
    ALIMENTOS: 'Food/Beverage',
    RESTAURANTE: 'Food/Beverage',
    BEBIDAS: 'Food/Beverage',

    PARKING_TOLLS_TAXI: 'Parking & Tolls/Taxi',
    'PARKING & TOLLS/TAXI': 'Parking & Tolls/Taxi',
    TRANSPORTE: 'Parking & Tolls/Taxi',
    ESTACIONAMIENTO: 'Parking & Tolls/Taxi',
    PARKING: 'Parking & Tolls/Taxi',
    PEAJE: 'Parking & Tolls/Taxi',
    PEAJES: 'Parking & Tolls/Taxi',
    TOLLS: 'Parking & Tolls/Taxi',
    TAXI: 'Parking & Tolls/Taxi',
    UBER: 'Parking & Tolls/Taxi',

    HOTEL: 'Hotel',
    HOSPEDAJE: 'Hotel',
    ALOJAMIENTO: 'Hotel',
    POSADA: 'Hotel',

    GAS_FUEL: 'Gas (Fuel)',
    'GAS (FUEL)': 'Gas (Fuel)',
    GASOLINA: 'Gas (Fuel)',
    COMBUSTIBLE: 'Gas (Fuel)',
    DIESEL: 'Gas (Fuel)',

    AIRFARE_TRAIN: 'Airfare/train',
    'AIRFARE/TRAIN': 'Airfare/train',
    VUELO: 'Airfare/train',
    BOLETO: 'Airfare/train',
    AVION: 'Airfare/train',
    TREN: 'Airfare/train',

    CAR_RENTAL: 'Car Rental',
    'CAR RENTAL': 'Car Rental',
    ALQUILER_VEHICULO: 'Car Rental',

    MATERIALES: 'Materiales',
    INSUMOS: 'Materiales',
    FERRETERIA: 'Materiales',
    REPUESTOS: 'Materiales',
    HERRAMIENTAS: 'Materiales',

    MISCELLANEOUS: 'Miscellaneous',
    VARIOS: 'Miscellaneous',
    OTROS: 'Miscellaneous',
    REPRESENTACION: 'Miscellaneous',
  };

  return categoryMap[normalized] || 'Miscellaneous';
}

/* ─────────────────────────────────────────────────────────
 * CORE: POLICY VALIDATION ENGINE (LEGACY STUB)
 * ───────────────────────────────────────────────────────── */

/**
 * @name validateExpensePolicy
 * @description [Deprecated]: Legacy policy validation against `limites_gastos`.
 * All spending policies and daily limits are now governed exclusively by
 * `categorias_gastos` and evaluated via `evaluarLimiteDiarioCategoria`.
 */
export async function validateExpensePolicy({
  supabase: _supabase,
  employeeId: _employeeId,
  category: _category,
  amountUsd: _amountUsd,
  expenseDate: _expenseDate = new Date().toISOString(),
}: {
  supabase: SupabaseClient;
  employeeId: string;
  category: string;
  amountUsd: number;
  expenseDate?: string;
}): Promise<PolicyEvaluation> {
  // Always return no limit violation from legacy engine; limits are now strictly per-category in categorias_gastos
  return NO_LIMIT_RESULT;
}

/* ─────────────────────────────────────────────────────────
 * EVALUATORS (Private Helpers)
 * ───────────────────────────────────────────────────────── */

/**
 * @name evaluatePerTransaction
 * @description Checks if a single expense amount exceeds the per-transaction cap.
 */
function evaluatePerTransaction(
  amountUsd: number,
  capUsd: number,
  category: string
): PolicyEvaluation {
  if (amountUsd > capUsd) {
    return {
      exceedsLimit: true,
      suggestedStatus: 'REQUIERE_APROBACION_ESPECIAL',
      excessDetail: {
        limite_monto_usd: capUsd,
        monto_evaluado_usd: Number(amountUsd.toFixed(2)),
        acumulado_previo_usd: 0,
        periodo: 'POR_TRANSACCION',
        categoria: category,
        diferencia_excedida_usd: Number((amountUsd - capUsd).toFixed(2)),
      },
    };
  }

  return NO_LIMIT_RESULT;
}

/**
 * @name evaluateAccumulated
 * @description Sums all non-rejected expenses in the same category for the given
 * period (day or month) and checks if adding the new expense would exceed the cap.
 */
async function evaluateAccumulated(
  supabase: SupabaseClient,
  employeeId: string,
  category: string,
  amountUsd: number,
  capUsd: number,
  period: 'DIARIO' | 'MENSUAL',
  expenseDate: string
): Promise<PolicyEvaluation> {
  const { start, end } = computeDateRange(expenseDate, period);

  const { data: existingExpenses, error } = await supabase
    .from('gastos')
    .select('monto_usd')
    .eq('usuario_id', employeeId)
    .eq('categoria', category)
    .neq('estado', 'RECHAZADO')
    .gte('creado_en', start)
    .lte('creado_en', end);

  if (error) {
    console.error(`❌ Error fetching ${period} accumulated expenses:`, error);
    return NO_LIMIT_RESULT;
  }

  const previousAccumulated = (existingExpenses ?? []).reduce(
    (sum, expense) => sum + Number(expense.monto_usd ?? 0),
    0
  );

  const totalWithNewExpense = previousAccumulated + amountUsd;

  if (totalWithNewExpense > capUsd) {
    return {
      exceedsLimit: true,
      suggestedStatus: 'REQUIERE_APROBACION_ESPECIAL',
      excessDetail: {
        limite_monto_usd: capUsd,
        monto_evaluado_usd: Number(totalWithNewExpense.toFixed(2)),
        acumulado_previo_usd: Number(previousAccumulated.toFixed(2)),
        periodo: period,
        categoria: category,
        diferencia_excedida_usd: Number(
          (totalWithNewExpense - capUsd).toFixed(2)
        ),
      },
    };
  }

  return NO_LIMIT_RESULT;
}

/* ─────────────────────────────────────────────────────────
 * DATE RANGE HELPERS
 * ───────────────────────────────────────────────────────── */

/**
 * @name computeDateRange
 * @description Computes ISO-8601 start/end boundaries for a given date
 * and period type. Uses UTC-4 (Venezuela timezone) day boundaries.
 */
function computeDateRange(
  dateStr: string,
  period: 'DIARIO' | 'MENSUAL'
): { start: string; end: string } {
  const baseDate = new Date(dateStr);

  if (period === 'DIARIO') {
    const dayStart = new Date(baseDate);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(baseDate);
    dayEnd.setHours(23, 59, 59, 999);

    return { start: dayStart.toISOString(), end: dayEnd.toISOString() };
  }

  // MENSUAL: First day of month to last day of month
  const monthStart = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    1,
    0,
    0,
    0,
    0
  );

  const monthEnd = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );

  return { start: monthStart.toISOString(), end: monthEnd.toISOString() };
}

/* ─────────────────────────────────────────────────────────
 * WHATSAPP MESSAGE FORMATTER
 * ───────────────────────────────────────────────────────── */

/**
 * @name formatPolicyWarningWhatsApp
 * @description [WhatsApp UX]: Builds the policy violation warning appended
 * to the expense confirmation message when the limit is exceeded. Designed
 * to be transparent and non-blocking — the employee can still choose to submit.
 */
export function formatPolicyWarningWhatsApp(detail: ExcessDetail): string {
  const formatUsd = (n: number): string =>
    n.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return [
    ``,
    `⚠️ *Alerta de Límite Diario Excedido:*`,
    `Este gasto supera tu tope diario asignado de $${formatUsd(detail.limite_monto_usd)} USD en ${detail.categoria}.`,
    `• Total acumulado hoy: $${formatUsd(detail.monto_evaluado_usd)} USD`,
    `_El comprobante pasará a Aprobación Especial de un administrador._`,
  ].join('\n');
}

/* ─────────────────────────────────────────────────────────
 * DYNAMIC CATEGORY DAILY LIMIT EVALUATOR
 * ───────────────────────────────────────────────────────── */

export interface EvaluacionLimiteDiario {
  excede_limite: boolean;
  limite_diario_usd: number;
  monto_evaluado_usd: number;
  acumulado_previo_usd: number;
  total_con_actual_usd: number;
  codigo_categoria: string;
  nombre_categoria: string;
  alerta_whatsapp: string | null;
  excess_detail: ExcessDetail | null;
}

/**
 * @name evaluarLimiteDiarioCategoria
 * @description [Business Logic]: Evaluates if a given expense exceeds the daily spending
 * limit configured for its category in `categorias_gastos`.
 * - If `limite_diario_usd === 0`: unrestricted spending; returns `{ excede_limite: false }`.
 * - If `limite_diario_usd > 0`: sums all existing expenses from the same employee on the same
 *   calendar date in that category (excluding RECHAZADO and BOCETO) + current amount.
 * - Flags `excede_limite: true` if the daily total exceeds the configured threshold.
 */
export async function evaluarLimiteDiarioCategoria({
  supabase,
  empresaId,
  employeeId,
  codigoCategoria,
  nombreCategoria,
  montoUsd,
  fechaGasto,
  gastoActualId,
}: {
  supabase: SupabaseClient;
  empresaId: string;
  employeeId: string;
  codigoCategoria: string;
  nombreCategoria?: string;
  montoUsd: number;
  fechaGasto?: string;
  gastoActualId?: string | null;
}): Promise<EvaluacionLimiteDiario> {
  const resolvedNombre = nombreCategoria || codigoCategoria;
  const targetDateStr = fechaGasto ? fechaGasto.split('T')[0] : new Date().toISOString().split('T')[0];

  try {
    // 1. Fetch category definition and daily limit from categorias_gastos
    let limiteDiario = 0;
    let categoryRecordNombre = resolvedNombre;

    // Query primarily by unique code
    let { data: catData } = await supabase
      .from('categorias_gastos')
      .select('nombre, codigo, limite_diario_usd, activa')
      .eq('empresa_id', empresaId)
      .eq('codigo', codigoCategoria)
      .maybeSingle();

    // Fallback: search by exact or case-insensitive name
    if (!catData && resolvedNombre) {
      const { data: fallbackByName } = await supabase
        .from('categorias_gastos')
        .select('nombre, codigo, limite_diario_usd, activa')
        .eq('empresa_id', empresaId)
        .ilike('nombre', resolvedNombre)
        .maybeSingle();
      if (fallbackByName) {
        catData = fallbackByName;
      }
    }

    if (catData) {
      limiteDiario = Number(catData.limite_diario_usd || 0);
      categoryRecordNombre = catData.nombre || resolvedNombre;
    }

    // 2. If daily limit is 0 (unrestricted), no alerts or violations
    if (limiteDiario <= 0) {
      return {
        excede_limite: false,
        limite_diario_usd: 0,
        monto_evaluado_usd: Number(montoUsd.toFixed(2)),
        acumulado_previo_usd: 0,
        total_con_actual_usd: Number(montoUsd.toFixed(2)),
        codigo_categoria: codigoCategoria,
        nombre_categoria: categoryRecordNombre,
        alerta_whatsapp: null,
        excess_detail: null,
      };
    }

    // 3. Compute accumulated expenses for this employee, category, and date
    const { start, end } = computeDateRange(targetDateStr, 'DIARIO');

    let query = supabase
      .from('gastos')
      .select('id, monto_usd')
      .eq('usuario_id', employeeId)
      .neq('estado', 'RECHAZADO')
      .neq('estado', 'BOCETO')
      .or(`categoria.eq.${codigoCategoria},categoria.ilike.${categoryRecordNombre}`)
      .gte('fecha_gasto', targetDateStr)
      .lte('fecha_gasto', targetDateStr);

    if (gastoActualId) {
      query = query.neq('id', gastoActualId);
    }

    let { data: existingExpenses, error: expError } = await query;

    if (expError) {
      console.warn('⚠️ Error querying daily category accumulated expenses, fallback by created_at:', expError.message);
      const fallbackQuery = await supabase
        .from('gastos')
        .select('id, monto_usd')
        .eq('usuario_id', employeeId)
        .neq('estado', 'RECHAZADO')
        .neq('estado', 'BOCETO')
        .or(`categoria.eq.${codigoCategoria},categoria.ilike.${categoryRecordNombre}`)
        .gte('creado_en', start)
        .lte('creado_en', end);

      if (!fallbackQuery.error && fallbackQuery.data) {
        existingExpenses = fallbackQuery.data;
      }
    }

    const acumuladoPrevio = (existingExpenses ?? []).reduce(
      (sum, e) => sum + Number(e.monto_usd ?? 0),
      0
    );

    const totalConActual = Number((acumuladoPrevio + montoUsd).toFixed(2));
    const excede = totalConActual > limiteDiario;

    let alertaWhatsApp: string | null = null;
    let excessDetail: ExcessDetail | null = null;

    if (excede) {
      const formatUsd = (n: number) =>
        n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      alertaWhatsApp = [
        `⚠️ *Alerta de Límite Diario Excedido:*`,
        `Este gasto supera tu tope diario asignado de *$${formatUsd(limiteDiario)} USD* en *${categoryRecordNombre}*.`,
        `• Gasto actual: *$${formatUsd(montoUsd)} USD*`,
        `• Total acumulado hoy: *$${formatUsd(totalConActual)} USD*`,
        `_El comprobante pasará a Aprobación Especial de un administrador._`,
      ].join('\n');

      excessDetail = {
        limite_monto_usd: limiteDiario,
        monto_evaluado_usd: totalConActual,
        acumulado_previo_usd: Number(acumuladoPrevio.toFixed(2)),
        periodo: 'DIARIO',
        categoria: categoryRecordNombre,
        diferencia_excedida_usd: Number((totalConActual - limiteDiario).toFixed(2)),
      };
    }

    return {
      excede_limite: excede,
      limite_diario_usd: limiteDiario,
      monto_evaluado_usd: Number(montoUsd.toFixed(2)),
      acumulado_previo_usd: Number(acumuladoPrevio.toFixed(2)),
      total_con_actual_usd: totalConActual,
      codigo_categoria: codigoCategoria,
      nombre_categoria: categoryRecordNombre,
      alerta_whatsapp: alertaWhatsApp,
      excess_detail: excessDetail,
    };
  } catch (err) {
    console.error('❌ Error evaluating category daily limit:', err);
    return {
      excede_limite: false,
      limite_diario_usd: 0,
      monto_evaluado_usd: Number(montoUsd.toFixed(2)),
      acumulado_previo_usd: 0,
      total_con_actual_usd: Number(montoUsd.toFixed(2)),
      codigo_categoria: codigoCategoria,
      nombre_categoria: resolvedNombre,
      alerta_whatsapp: null,
      excess_detail: null,
    };
  }
}

