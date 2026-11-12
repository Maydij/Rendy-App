// lib/analytics/tracking-plan.ts
import { z } from 'zod';

/**
 * @name TrackingPlanSchemas
 * @description [Business Logic]: Strict Zero-PII telemetry event dictionary for RudderStack and PostHog.
 * Prevents dirty analytics data and guarantees no customer emails, names, or financial secrets leave the app.
 */
export const TrackingPlanSchemas = {
  onboarding_step_viewed: z
    .object({
      step_number: z.number().int().min(1).max(5),
      step_name: z.enum(['ACCOUNT', 'FISCAL_PROFILE', 'PLAN_SELECTION', 'CHECKOUT', 'FTUX_DASHBOARD']),
    })
    .strict(),

  onboarding_step_completed: z
    .object({
      step_number: z.number().int().min(1).max(5),
      step_name: z.enum(['ACCOUNT', 'FISCAL_PROFILE', 'PLAN_SELECTION', 'CHECKOUT', 'FTUX_DASHBOARD']),
      duration_seconds: z.number().nonnegative(),
    })
    .strict(),

  plan_recommendation_interacted: z
    .object({
      recommended_plan_id: z.string().min(1).max(40),
      selected_plan_id: z.string().min(1).max(40),
      billing_cycle: z.enum(['MONTHLY', 'ANNUAL']),
      employee_bracket: z.string().min(1).max(40),
    })
    .strict(),

  trial_checkout_initiated: z
    .object({
      plan_id: z.string().min(1).max(40),
      billing_cycle: z.enum(['MONTHLY', 'ANNUAL']),
      trial_days: z.literal(7),
    })
    .strict(),

  ftux_checklist_completed: z
    .object({
      action_type: z.enum(['ACCOUNTING_TEMPLATE', 'SCHEDULE_SETUP_CALL', 'INVITE_EMPLOYEE']),
      total_completed_count: z.number().int().min(1).max(3),
    })
    .strict(),

  feature_dwell_heartbeat: z
    .object({
      feature_key: z.enum([
        'DASHBOARD_OVERVIEW',
        'VIATICOS_MANAGEMENT',
        'GASTOS_CORPORATIVOS',
        'JUSTIFICACION',
        'REEMBOLSOS',
        'REPORTES_CONTABLES',
        'CONFIGURACION_EQUIPO',
        'EMPLOYEE_PORTAL',
      ]),
      active_seconds_delta: z.number().int().min(1).max(60),
      user_role: z.enum(['ADMIN', 'EMPLOYEE']),
    })
    .strict(),
} as const;

export type TrackingEventName = keyof typeof TrackingPlanSchemas;
export type TrackingEventPayload<K extends TrackingEventName> = z.infer<
  (typeof TrackingPlanSchemas)[K]
>;

/**
 * @name trackProductEvent
 * @description [Business Logic]: Validates product telemetry against the canonical Zod Tracking Plan
 * and dispatches sanitized events to the first-party analytics proxy (/api/t) for RudderStack/PostHog.
 */
export async function trackProductEvent<K extends TrackingEventName>(
  eventName: K,
  payload: TrackingEventPayload<K>
): Promise<void> {
  const schema = TrackingPlanSchemas[eventName];
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`❌ [TrackingPlan] Invalid payload for "${eventName}":`, parsed.error.format());
    }
    return;
  }

  try {
    if (typeof window !== 'undefined') {
      void fetch('/api/t', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: eventName,
          properties: parsed.data,
          timestamp: new Date().toISOString(),
        }),
        keepalive: true,
      });
    }
  } catch {
    // Telemetry must never degrade user experience
  }
}