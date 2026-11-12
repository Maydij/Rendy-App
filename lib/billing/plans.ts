import { z } from 'zod';

export const PlanIdSchema = z.enum(['STARTER', 'GROWTH', 'ENTERPRISE']);
export type PlanId = z.infer<typeof PlanIdSchema>;

export const BillingCycleSchema = z.enum(['MONTHLY', 'ANNUAL']);
export type BillingCycle = z.infer<typeof BillingCycleSchema>;

export interface SubscriptionPlanDefinition {
  id: PlanId;
  tier: string;
  name: string;
  tagline: string;
  minEmployees: number;
  maxEmployees: number | null;
  monthlyPriceUsd: number;
  annualMonthlyEquivalentUsd: number;
  annualTotalUsd: number;
  annualDiscountPercent: number;
  isBestSeller: boolean;
  trialDays: number;
}

/**
 * @name SUBSCRIPTION_PLANS
 * @description [Business Logic]: Canonical server-side pricing authority for Rendy B2B plans.
 * Aligned with commercial tiers (Starter up to 5 users, Growth up to 15 users, Enterprise up to 40+ users)
 * and 7-day Netflix-style free trial ($0.00 due today, automatic billing on Day 8).
 */
export const SUBSCRIPTION_PLANS: Record<PlanId, SubscriptionPlanDefinition> = {
  STARTER: {
    id: 'STARTER',
    tier: 'STARTER',
    name: 'Equipos en Inicio',
    tagline: 'Para pequeños negocios y equipos de calle que necesitan centralizar facturas sin papeleos.',
    minEmployees: 1,
    maxEmployees: 5,
    monthlyPriceUsd: 49,
    annualMonthlyEquivalentUsd: 39,
    annualTotalUsd: 468, // $39 * 12
    annualDiscountPercent: 20,
    isBestSeller: false,
    trialDays: 7,
  },
  GROWTH: {
    id: 'GROWTH',
    tier: 'GROWTH',
    name: 'Empresas en Expansión',
    tagline: 'Para organizaciones con fuerza de ventas, logística o proyectos que requieren control financiero estricto.',
    minEmployees: 6,
    maxEmployees: 15,
    monthlyPriceUsd: 119,
    annualMonthlyEquivalentUsd: 95,
    annualTotalUsd: 1140, // $95 * 12
    annualDiscountPercent: 20,
    isBestSeller: true,
    trialDays: 7,
  },
  ENTERPRISE: {
    id: 'ENTERPRISE',
    tier: 'ENTERPRISE',
    name: 'Corporativo & Auditoría',
    tagline: 'Para medianas empresas con alto volumen de gastos, múltiples departamentos y supervisión gerencial.',
    minEmployees: 16,
    maxEmployees: null,
    monthlyPriceUsd: 249,
    annualMonthlyEquivalentUsd: 199,
    annualTotalUsd: 2388, // $199 * 12
    annualDiscountPercent: 20,
    isBestSeller: false,
    trialDays: 7,
  },
};

export interface PlanRecommendationResult {
  recommendedPlanId: PlanId;
  bestSellerPlanId: PlanId;
  plans: Array<
    SubscriptionPlanDefinition & {
      isRecommended: boolean;
      displayMonthlyPriceUsd: number;
      billedTodayUsd: number;
      billedAfterTrialUsd: number;
    }
  >;
}

/**
 * @name recommendPlanByEmployeeCount
 * @description [Business Logic]: Evaluates the company's estimated headcount entered during
 * onboarding Step 2 and highlights the optimal plan ("Recommended for you") alongside the
 * "Best Seller" badge, calculating exact $0.00 due today and Day-8 recurring charges.
 */
export function recommendPlanByEmployeeCount(
  estimatedEmployees: number,
  billingCycle: BillingCycle
): PlanRecommendationResult {
  let recommendedPlanId: PlanId = 'GROWTH';

  if (estimatedEmployees <= 5) {
    recommendedPlanId = 'STARTER';
  } else if (estimatedEmployees <= 15) {
    recommendedPlanId = 'GROWTH';
  } else {
    recommendedPlanId = 'ENTERPRISE';
  }

  const orderedIds: PlanId[] = ['STARTER', 'GROWTH', 'ENTERPRISE'];

  const plans = orderedIds.map((id) => {
    const plan = SUBSCRIPTION_PLANS[id];
    const displayMonthlyPriceUsd =
      billingCycle === 'ANNUAL' ? plan.annualMonthlyEquivalentUsd : plan.monthlyPriceUsd;
    const billedAfterTrialUsd =
      billingCycle === 'ANNUAL' ? plan.annualTotalUsd : plan.monthlyPriceUsd;

    return {
      ...plan,
      isRecommended: id === recommendedPlanId,
      displayMonthlyPriceUsd,
      billedTodayUsd: 0,
      billedAfterTrialUsd,
    };
  });

  return {
    recommendedPlanId,
    bestSellerPlanId: 'GROWTH',
    plans,
  };
}

/**
 * @name resolveStripePriceId
 * @description [Security & Billing]: Resolves the authoritative Stripe Price ID from server
 * environment variables for the requested plan and billing cycle. Prevents client-side price tampering.
 */
export function resolveStripePriceId(planId: PlanId, billingCycle: BillingCycle): string {
  const envMap: Record<`${PlanId}_${BillingCycle}`, string | undefined> = {
    STARTER_MONTHLY: process.env.STRIPE_PRICE_STARTER_MONTHLY,
    STARTER_ANNUAL: process.env.STRIPE_PRICE_STARTER_ANNUAL,
    GROWTH_MONTHLY: process.env.STRIPE_PRICE_GROWTH_MONTHLY,
    GROWTH_ANNUAL: process.env.STRIPE_PRICE_GROWTH_ANNUAL,
    ENTERPRISE_MONTHLY: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
    ENTERPRISE_ANNUAL: process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL,
  };

  const priceId = envMap[`${planId}_${billingCycle}`];
  if (!priceId || !priceId.startsWith('price_')) {
    throw new Error(`Missing or invalid Stripe Price ID configuration for ${planId}_${billingCycle}`);
  }

  return priceId;
}