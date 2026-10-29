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
 * Valid standard expense categories. Used to normalize AI-extracted categories
 * to the canonical set stored in `limites_gastos`.
 */
export const STANDARD_CATEGORIES: readonly ExpenseCategory[] = [
  'ALIMENTACION',
  'TRANSPORTE',
  'HOSPEDAJE',
  'REPRESENTACION',
  'OTROS',
] as const;

/* ─────────────────────────────────────────────────────────
 * UTILITY: CATEGORY NORMALIZATION
 * ───────────────────────────────────────────────────────── */

/**
 * @name normalizeCategory
 * @description [Business Logic]: Maps free-form category labels (from Gemini AI
 * extraction or legacy CATEGORIAS_GASTO) to the standard fiscal categories
 * used by the policy engine. Falls back to 'OTROS' for unmapped values.
 */
export function normalizeCategory(rawCategory: string): ExpenseCategory {
  const normalized = rawCategory
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Strip diacritics (á→a, ó→o, etc.)
    .trim();

  const categoryMap: Record<string, ExpenseCategory> = {
    ALIMENTACION: 'ALIMENTACION',
    'FOOD/BEVERAGE': 'ALIMENTACION',
    COMIDA: 'ALIMENTACION',
    ALIMENTOS: 'ALIMENTACION',
    TRANSPORTE: 'TRANSPORTE',
    GASOLINA: 'TRANSPORTE',
    'GAS (FUEL)': 'TRANSPORTE',
    'TRANSPORTE/GASOLINA': 'TRANSPORTE',
    TAXI: 'TRANSPORTE',
    'PARKING & TOLLS/TAXI': 'TRANSPORTE',
    'AIRFARE/TRAIN': 'TRANSPORTE',
    'CAR RENTAL': 'TRANSPORTE',
    HOSPEDAJE: 'HOSPEDAJE',
    HOTEL: 'HOSPEDAJE',
    ALOJAMIENTO: 'HOSPEDAJE',
    REPRESENTACION: 'REPRESENTACION',
    MATERIALES: 'OTROS',
    VARIOS: 'OTROS',
    MISCELLANEOUS: 'OTROS',
    OTROS: 'OTROS',
  };

  return categoryMap[normalized] ?? 'OTROS';
}

/* ─────────────────────────────────────────────────────────
 * CORE: POLICY VALIDATION ENGINE
 * ───────────────────────────────────────────────────────── */

/**
 * @name validateExpensePolicy
 * @description [Business Logic]: Evaluates a single expense against the spending
 * limits configured for the employee's category. Implements hierarchical resolution:
 *
 *   Priority 1: Employee-specific limit (empleado_id = employeeId)
 *   Priority 2: Global company limit (empleado_id IS NULL)
 *
 * For POR_TRANSACCION: Compares the single expense amount against the cap.
 * For DIARIO: Sums all non-rejected expenses in the same category for the day.
 * For MENSUAL: Sums all non-rejected expenses in the same category for the month.
 *
 * Returns a PolicyEvaluation that the caller uses to:
 *   - Set `excede_limite` and `detalle_exceso` on the expense record
 *   - Override the `estado` to 'REQUIERE_APROBACION_ESPECIAL' if needed
 *   - Append the policy warning to the WhatsApp confirmation message
 */
export async function validateExpensePolicy({
  supabase,
  employeeId,
  category,
  amountUsd,
  expenseDate = new Date().toISOString(),
}: {
  supabase: SupabaseClient;
  employeeId: string;
  category: string;
  amountUsd: number;
  expenseDate?: string;
}): Promise<PolicyEvaluation> {
  try {
    const normalizedCategory = normalizeCategory(category);

    // ── Step 1: Fetch applicable policies (employee-specific first, then global) ──
    const { data: limits, error } = await supabase
      .from('limites_gastos')
      .select('id, empleado_id, categoria, limite_monto_usd, periodo, activo')
      .eq('categoria', normalizedCategory)
      .eq('activo', true)
      .or(`empleado_id.eq.${employeeId},empleado_id.is.null`)
      .order('empleado_id', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('❌ Error fetching spending limits:', error);
      return NO_LIMIT_RESULT;
    }

    // The first result is the most specific (employee-level > global)
    const activePolicy = (limits as SpendingLimitRow[] | null)?.[0];

    if (!activePolicy) {
      return NO_LIMIT_RESULT;
    }

    const capUsd = Number(activePolicy.limite_monto_usd);
    const period = activePolicy.periodo as LimitPeriod;

    // ── Step 2: Evaluate based on period type ──
    if (period === 'POR_TRANSACCION') {
      return evaluatePerTransaction(amountUsd, capUsd, normalizedCategory);
    }

    if (period === 'DIARIO') {
      return evaluateAccumulated(
        supabase,
        employeeId,
        normalizedCategory,
        amountUsd,
        capUsd,
        'DIARIO',
        expenseDate
      );
    }

    if (period === 'MENSUAL') {
      return evaluateAccumulated(
        supabase,
        employeeId,
        normalizedCategory,
        amountUsd,
        capUsd,
        'MENSUAL',
        expenseDate
      );
    }

    return NO_LIMIT_RESULT;
  } catch (err) {
    console.error('❌ Unexpected error in policy validation:', err);
    return NO_LIMIT_RESULT;
  }
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

  const periodLabels: Record<LimitPeriod, string> = {
    POR_TRANSACCION: 'por transacción',
    DIARIO: 'diario',
    MENSUAL: 'mensual',
  };

  const categoryLabels: Record<string, string> = {
    ALIMENTACION: 'Alimentación',
    TRANSPORTE: 'Transporte',
    HOSPEDAJE: 'Hospedaje',
    REPRESENTACION: 'Representación',
    OTROS: 'Otros',
  };

  const periodLabel = periodLabels[detail.periodo] ?? detail.periodo;
  const categoryLabel = categoryLabels[detail.categoria] ?? detail.categoria;

  const acumuladoLine =
    detail.periodo !== 'POR_TRANSACCION' && detail.acumulado_previo_usd > 0
      ? ` (Acumulado: $${formatUsd(detail.monto_evaluado_usd)} USD)`
      : '';

  return [
    ``,
    `⚠️ *Nota de Política de Gastos:*`,
    `Este consumo excede tu límite ${periodLabel} asignado de $${formatUsd(detail.limite_monto_usd)} USD en ${categoryLabel}${acumuladoLine}.`,
    `_El gasto quedará sujeto a Aprobación Especial de tu supervisor._`,
  ].join('\n');
}

