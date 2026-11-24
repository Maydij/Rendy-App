import {
  SUBSCRIPTION_PLANS,
  type PlanId as CanonicalPlanId,
  type BillingCycle as CanonicalBillingCycle,
} from '@/lib/billing/plans';

export type BillingCycle = 'monthly' | 'annual';

export type PlanId = 'starter' | 'growth' | 'enterprise';

export interface PlanFeature {
  text: string;
  emphasis?: 'strong' | 'highlight';
}

export interface Plan {
  id: PlanId;
  tier: string;
  name: string;
  description: string;
  prices: Record<BillingCycle, number>;
  featured?: boolean;
  trialDays: number;
  features: PlanFeature[];
}

export const TRIAL_DAYS = 7;
export const SETUP_FEE_USD = 0;
export const ANNUAL_DISCOUNT_LABEL = 'Ahorra 20%';

/**
 * @name COMMON_PLAN_FEATURES
 * @description [Business Logic]: Compact, single-line feature suite included identically
 * in ALL Rendy subscription tiers (Starter, Growth, Enterprise). All plans share 100% feature
 * parity without gating modules, withholding capabilities, or requiring tier upgrades for tooling.
 */
export const COMMON_PLAN_FEATURES: PlanFeature[] = [
  { text: 'Dashboard y KPIs en tiempo real' },
  { text: 'Ingesta de facturas vía WhatsApp con IA' },
  { text: 'Viáticos y progreso de justificación' },
  { text: 'Reembolsos con soporte de transferencia' },
  { text: 'Gastos de empresa y recibos digitales' },
  { text: 'Categorías personalizadas y límites diarios' },
  { text: 'Proyectos y métodos de pago a empleados' },
  { text: 'Exportación de reportes a Excel (.xlsx)' },
];

/**
 * @name PLANS
 * @description [Business Logic]: Marketing and onboarding presentation catalog synchronized
 * with the server-enforced Stripe pricing authority (`SUBSCRIPTION_PLANS`). The only distinction
 * between plans is active user capacity and monthly invoice ingestion quota.
 */
export const PLANS: Plan[] = [
  {
    id: 'starter',
    tier: SUBSCRIPTION_PLANS.STARTER.tier,
    name: SUBSCRIPTION_PLANS.STARTER.name,
    description: SUBSCRIPTION_PLANS.STARTER.tagline,
    prices: {
      monthly: SUBSCRIPTION_PLANS.STARTER.monthlyPriceUsd,
      annual: SUBSCRIPTION_PLANS.STARTER.annualMonthlyEquivalentUsd,
    },
    trialDays: SUBSCRIPTION_PLANS.STARTER.trialDays,
    features: [
      { text: 'Hasta 5 usuarios activos', emphasis: 'strong' },
      { text: '150 facturas / comprobantes al mes', emphasis: 'strong' },
      ...COMMON_PLAN_FEATURES,
    ],
  },
  {
    id: 'growth',
    tier: SUBSCRIPTION_PLANS.GROWTH.tier,
    name: SUBSCRIPTION_PLANS.GROWTH.name,
    description: SUBSCRIPTION_PLANS.GROWTH.tagline,
    prices: {
      monthly: SUBSCRIPTION_PLANS.GROWTH.monthlyPriceUsd,
      annual: SUBSCRIPTION_PLANS.GROWTH.annualMonthlyEquivalentUsd,
    },
    featured: SUBSCRIPTION_PLANS.GROWTH.isBestSeller,
    trialDays: SUBSCRIPTION_PLANS.GROWTH.trialDays,
    features: [
      { text: 'Hasta 15 usuarios activos', emphasis: 'strong' },
      { text: '500 facturas / comprobantes al mes', emphasis: 'strong' },
      ...COMMON_PLAN_FEATURES,
    ],
  },
  {
    id: 'enterprise',
    tier: SUBSCRIPTION_PLANS.ENTERPRISE.tier,
    name: SUBSCRIPTION_PLANS.ENTERPRISE.name,
    description: SUBSCRIPTION_PLANS.ENTERPRISE.tagline,
    prices: {
      monthly: SUBSCRIPTION_PLANS.ENTERPRISE.monthlyPriceUsd,
      annual: SUBSCRIPTION_PLANS.ENTERPRISE.annualMonthlyEquivalentUsd,
    },
    trialDays: SUBSCRIPTION_PLANS.ENTERPRISE.trialDays,
    features: [
      { text: 'Hasta 40 usuarios activos', emphasis: 'strong' },
      { text: '1,500 facturas / comprobantes al mes', emphasis: 'strong' },
      ...COMMON_PLAN_FEATURES,
    ],
  },
];

/**
 * @name planPrice
 * @description [Business Logic]: Formats the monthly USD equivalent price for UI display.
 */
export function planPrice(plan: Plan, cycle: BillingCycle): string {
  return `$${plan.prices[cycle]}`;
}

/**
 * @name billingNote
 * @description [Business Logic]: Displays transparent Netflix-style 7-day free trial terms
 * ($0.00 charged today, recurring billing begins on Day 8).
 */
export function billingNote(cycle: BillingCycle): string {
  const when = cycle === 'annual' ? 'anualmente' : 'mensualmente';
  return `$0.00 hoy • 7 días de prueba gratis\nLuego facturado ${when}`;
}

/**
 * @name toCanonicalPlanId
 * @description [Helper]: Maps lowercase UI plan identifiers to uppercase server/Stripe PlanIds.
 */
export function toCanonicalPlanId(id: PlanId): CanonicalPlanId {
  return id.toUpperCase() as CanonicalPlanId;
}

/**
 * @name toCanonicalBillingCycle
 * @description [Helper]: Maps lowercase UI billing cycles to uppercase server/Stripe BillingCycles.
 */
export function toCanonicalBillingCycle(cycle: BillingCycle): CanonicalBillingCycle {
  return cycle.toUpperCase() as CanonicalBillingCycle;
}