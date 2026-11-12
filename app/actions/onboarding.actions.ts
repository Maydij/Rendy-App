'use server';

import crypto from 'node:crypto';
import { headers } from 'next/headers';
import { z } from 'zod';
import type Stripe from 'stripe';
import { supabaseServer } from '@/lib/supabase-server';
import {
  encryptPII,
  computeBlindIndex,
  hashPassword,
  hashSha256,
} from '@/lib/security/crypto';
import {
  enforceRateLimit,
  RATE_LIMIT_POLICIES,
} from '@/lib/security/redis-guard';
import { securityLogger } from '@/lib/security/logger';
import { getStripeClient } from '@/lib/billing/stripe';
import { createAuthenticatedSession } from '@/lib/security/session';
import {
  PlanIdSchema,
  BillingCycleSchema,
  recommendPlanByEmployeeCount,
  type PlanRecommendationResult,
} from '@/lib/billing/plans';

/* ─────────────────────────────────────────────────────────────
 * Strict Zod Validation Schemas (.strict() prevents Mass Assignment)
 * ───────────────────────────────────────────────────────────── */

const StrongPasswordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(128, 'La contraseña no puede exceder 128 caracteres.')
  .regex(/[A-Z]/, 'Debe incluir al menos una letra mayúscula.')
  .regex(/[a-z]/, 'Debe incluir al menos una letra minúscula.')
  .regex(/[0-9]/, 'Debe incluir al menos un número.')
  .regex(/[^A-Za-z0-9]/, 'Debe incluir al menos un carácter especial.');

const WizardCompanyLeadSchema = z
  .object({
    leadId: z.string().uuid().optional(),
    companyLegalName: z.string().trim().min(2, 'Ingresa el nombre legal o comercial de la empresa.').max(180),
    companyTaxId: z
      .string()
      .trim()
      .min(5, 'Ingresa un RIF o ID fiscal válido.')
      .max(30)
      .regex(/^[A-Za-z0-9\-]+$/, 'El RIF/ID fiscal solo admite letras, números y guiones.'),
    selectedIndustry: z.string().trim().max(100).optional(),
    selectedCompanySize: z.string().trim().max(50).optional(),
  })
  .strict();

const WizardAdminCredentialsSchema = z
  .object({
    leadId: z.string().uuid('Identificador de registro inválido.'),
    adminFirstName: z.string().trim().min(2, 'Ingresa tu nombre.').max(100),
    adminLastName: z.string().trim().min(2, 'Ingresa tu apellido.').max(100),
    adminEmail: z.string().trim().toLowerCase().email('Correo corporativo inválido.').max(255),
    adminPassword: StrongPasswordSchema,
  })
  .strict();

const Step3PlanSelectionSchema = z
  .object({
    leadId: z.string().uuid('Identificador de registro inválido.'),
    planId: PlanIdSchema,
    billingCycle: BillingCycleSchema,
  })
  .strict();

const CompleteTrialOnboardingSchema = z
  .object({
    leadId: z.string().uuid('Identificador de registro inválido.'),
    subscriptionId: z
      .string()
      .startsWith('sub_', 'Identificador de suscripción inválido.')
      .max(120),
  })
  .strict();

export interface OnboardingActionResponse<T = undefined> {
  success: boolean;
  error?: string;
  data?: T;
}

/**
 * @name parseHeadcountFromLabel
 * @description [Business Logic]: Normalizes free-form UI company size labels (e.g. "1-5", "6-15", "16-40")
 * into a canonical integer estimate for the intelligent plan recommendation engine.
 */
function parseHeadcountFromLabel(sizeLabel?: string): number {
  if (!sizeLabel) return 10;
  if (sizeLabel.includes('1-5') || sizeLabel.includes('1 a 5')) return 4;
  if (sizeLabel.includes('6-15') || sizeLabel.includes('6 a 15')) return 12;
  if (sizeLabel.includes('16-40') || sizeLabel.includes('16 a 40')) return 30;
  const numericMatch = sizeLabel.match(/\d+/);
  return numericMatch ? Math.max(1, Number(numericMatch[0])) : 12;
}

/**
 * @name getClientIpHash
 * @description [Security]: Extracts and hashes the client IP address for rate-limiting without storing raw IPs.
 */
async function getClientIpHash(): Promise<string> {
  const headerStore = await headers();
  const forwarded = headerStore.get('x-forwarded-for');
  const rawIp = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
  return hashSha256(rawIp);
}

/**
 * @name persistWizardCompanyStepAction
 * @description [Business Logic]: Persists company legal details, AES-256-GCM encrypted RIF,
 * industry sector, and headcount estimate from Steps 1–3 of OnboardingWizard into `onboarding_leads`
 * so abandoned signups are captured immediately for commercial follow-up.
 */
export async function persistWizardCompanyStepAction(
  rawInput: unknown
): Promise<OnboardingActionResponse<{ leadId: string; recommendation: PlanRecommendationResult }>> {
  try {
    const ipHash = await getClientIpHash();
    const rateVerdict = await enforceRateLimit(ipHash, RATE_LIMIT_POLICIES.ONBOARDING_STEP);
    if (!rateVerdict.allowed) {
      return {
        success: false,
        error: `Demasiados intentos. Por favor espera ${rateVerdict.retryAfterSeconds} segundos.`,
      };
    }

    const parsed = WizardCompanyLeadSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || 'Datos de la empresa inválidos.',
      };
    }

    const { leadId, companyLegalName, companyTaxId, selectedIndustry, selectedCompanySize } = parsed.data;
    const normalizedRif = companyTaxId.toUpperCase();
    const rifBlindIndex = computeBlindIndex(normalizedRif);

    // Ensure Tax ID is not already registered by an active organization
    const { data: existingCompany } = await supabaseServer
      .from('empresas')
      .select('id')
      .eq('rif_blind_index', rifBlindIndex)
      .maybeSingle();

    if (existingCompany) {
      return {
        success: false,
        error: 'Ya existe una organización registrada con este RIF / ID fiscal en Rendy.',
      };
    }

    const rifEncrypted = encryptPII(normalizedRif);
    const estimatedEmployees = parseHeadcountFromLabel(selectedCompanySize);
    const recommendation = recommendPlanByEmployeeCount(estimatedEmployees, 'ANNUAL');

    if (leadId) {
      const { error: updateErr } = await supabaseServer
        .from('onboarding_leads')
        .update({
          company_name: companyLegalName,
          rif_encrypted: rifEncrypted,
          rif_blind_index: rifBlindIndex,
          sector: selectedIndustry || null,
          employee_range: selectedCompanySize || null,
          estimated_employees: estimatedEmployees,
          current_step: 2,
          status: 'STEP_2_FISCAL',
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', leadId)
        .neq('status', 'CONVERTED');

      if (!updateErr) {
        return { success: true, data: { leadId, recommendation } };
      }
    }

    // Create initial partial lead with placeholder email until Step 4 captures admin email
    const placeholderEmail = `lead-${crypto.randomUUID()}@pending.rendy.local`;
    const placeholderHash = hashSha256(crypto.randomBytes(32).toString('hex'));

    const { data: createdLead, error: insertErr } = await supabaseServer
      .from('onboarding_leads')
      .insert({
        email: placeholderEmail,
        company_name: companyLegalName,
        password_hash: placeholderHash,
        rif_encrypted: rifEncrypted,
        rif_blind_index: rifBlindIndex,
        sector: selectedIndustry || null,
        employee_range: selectedCompanySize || null,
        estimated_employees: estimatedEmployees,
        current_step: 1,
        status: 'STEP_1_ACCOUNT',
        last_activity_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertErr || !createdLead) {
      securityLogger.error('onboarding.wizard_company.insert_failed', insertErr);
      return { success: false, error: 'No se pudo guardar el progreso de tu empresa.' };
    }

    securityLogger.info('onboarding.wizard_company.persisted', { leadId: createdLead.id });
    return {
      success: true,
      data: { leadId: createdLead.id, recommendation },
    };
  } catch (error) {
    securityLogger.error('onboarding.wizard_company.unexpected_error', error);
    return { success: false, error: 'Error interno al registrar los datos de la empresa.' };
  }
}

/**
 * @name persistWizardAdminStepAction
 * @description [Business Logic]: Updates the partial lead with the Primary Administrator's
 * corporate email and Argon2id-hashed password at Step 4 of OnboardingWizard.
 */
export async function persistWizardAdminStepAction(
  rawInput: unknown
): Promise<OnboardingActionResponse<{ leadId: string }>> {
  try {
    const ipHash = await getClientIpHash();
    const rateVerdict = await enforceRateLimit(ipHash, RATE_LIMIT_POLICIES.ONBOARDING_STEP);
    if (!rateVerdict.allowed) {
      return {
        success: false,
        error: `Demasiados intentos. Espera ${rateVerdict.retryAfterSeconds} segundos.`,
      };
    }

    const parsed = WizardAdminCredentialsSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || 'Credenciales del administrador inválidas.',
      };
    }

    const { leadId, adminEmail, adminPassword } = parsed.data;

    // Prevent registering an email already bound to an active user
    const { data: existingUser } = await supabaseServer
      .from('usuarios')
      .select('id')
      .eq('email', adminEmail)
      .maybeSingle();

    if (existingUser) {
      return {
        success: false,
        error: 'Este correo ya pertenece a una cuenta activa. Inicia sesión.',
      };
    }

    const passwordHash = await hashPassword(adminPassword);

    // Remove any stale unconverted duplicate lead with the same email before updating
    await supabaseServer
      .from('onboarding_leads')
      .delete()
      .eq('email', adminEmail)
      .neq('id', leadId)
      .neq('status', 'CONVERTED');

    const { error: updateErr } = await supabaseServer
      .from('onboarding_leads')
      .update({
        email: adminEmail,
        password_hash: passwordHash,
        current_step: 2,
        status: 'STEP_2_FISCAL',
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', leadId)
      .neq('status', 'CONVERTED');

    if (updateErr) {
      securityLogger.error('onboarding.wizard_admin.update_failed', updateErr, { leadId });
      return { success: false, error: 'No se pudo guardar el perfil del administrador.' };
    }

    securityLogger.info('onboarding.wizard_admin.persisted', { leadId });
    return { success: true, data: { leadId } };
  } catch (error) {
    securityLogger.error('onboarding.wizard_admin.unexpected_error', error);
    return { success: false, error: 'Error interno al guardar credenciales.' };
  }
}

/**
 * @name saveOnboardingStep3PlanAction
 * @description [Business Logic]: Records the selected subscription tier and billing cycle
 * (Monthly vs. Annual) on the lead before transitioning into the PCI-DSS Stripe Trial Checkout.
 */
export async function saveOnboardingStep3PlanAction(
  rawInput: unknown
): Promise<OnboardingActionResponse<{ planId: string; billingCycle: string }>> {
  try {
    const parsed = Step3PlanSelectionSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || 'Selección de plan inválida.',
      };
    }

    const { leadId, planId, billingCycle } = parsed.data;

    const { error } = await supabaseServer
      .from('onboarding_leads')
      .update({
        selected_plan_id: planId,
        billing_cycle: billingCycle,
        current_step: 3,
        status: 'STEP_3_PLAN',
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', leadId)
      .neq('status', 'CONVERTED');

    if (error) {
      securityLogger.error('onboarding.step3.update_failed', error, { leadId });
      return { success: false, error: 'No se pudo guardar el plan seleccionado.' };
    }

    return {
      success: true,
      data: { planId, billingCycle },
    };
  } catch (error) {
    securityLogger.error('onboarding.step3.unexpected_error', error);
    return { success: false, error: 'Error interno al registrar el plan.' };
  }
}

/**
 * @name completeTrialOnboardingAction
 * @description [Business Logic & PCI-DSS]: Verifies the newly confirmed 7-day trial subscription
 * directly with Stripe's API, idempotently provisions the organization (`empresas`), Primary Admin
 * (`usuarios`), subscription record, and immutable financial audit log, and establishes an
 * authenticated Ed25519 + RTR HttpOnly browser session so the user enters /dashboard immediately.
 */
export async function completeTrialOnboardingAction(
  rawInput: unknown
): Promise<OnboardingActionResponse<{ redirectTo: string }>> {
  try {
    const parsed = CompleteTrialOnboardingSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: 'Parámetros de activación inválidos.' };
    }

    const { leadId, subscriptionId } = parsed.data;
    const stripe = getStripeClient();

    // 1. Server-to-server verification against Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['default_payment_method'],
    });

    if (subscription.metadata?.onboarding_lead_id !== leadId) {
      return { success: false, error: 'La suscripción no corresponde a esta solicitud de registro.' };
    }

    const normalizedStatus = subscription.status.toUpperCase();
    if (normalizedStatus !== 'TRIALING' && normalizedStatus !== 'ACTIVE') {
      return {
        success: false,
        error: 'El método de pago aún no ha sido confirmado por la pasarela.',
      };
    }

    const stripeCustomerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;
    const planId = subscription.metadata?.plan_id || 'GROWTH';
    const billingCycle = subscription.metadata?.billing_cycle || 'ANNUAL';
    const idempotencyKey = subscription.metadata?.idempotency_key || null;

    let cardBrand: string | null = null;
    let cardLast4: string | null = null;
    const pm = subscription.default_payment_method as Stripe.PaymentMethod | string | null;
    if (pm && typeof pm === 'object' && pm.card) {
      cardBrand = pm.card.brand ?? null;
      cardLast4 = pm.card.last4 ?? null;
    }

    // 2. Load onboarding lead
    const { data: lead, error: leadErr } = await supabaseServer
      .from('onboarding_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadErr || !lead) {
      return { success: false, error: 'No se encontró el registro de la organización.' };
    }

    // 3. Idempotently find or create Organization (`empresas`)
    let { data: company } = await supabaseServer
      .from('empresas')
      .select('id')
      .eq('stripe_customer_id', stripeCustomerId)
      .maybeSingle();

    if (!company && lead.converted_empresa_id) {
      company = { id: lead.converted_empresa_id };
    }

    if (!company) {
      const { data: createdCompany, error: compErr } = await supabaseServer
        .from('empresas')
        .insert({
          nombre: lead.company_name,
          moneda: 'USD',
          rif_encrypted: lead.rif_encrypted,
          rif_blind_index: lead.rif_blind_index,
          sector: lead.sector,
          employee_range: lead.employee_range,
          estimated_employees: lead.estimated_employees ?? 5,
          plan_id: planId,
          billing_cycle: billingCycle,
          stripe_customer_id: stripeCustomerId,
          onboarding_completed: true,
        })
        .select('id')
        .single();

      if (compErr || !createdCompany) {
        securityLogger.error('onboarding.complete.company_insert_failed', compErr, { leadId });
        return { success: false, error: 'No se pudo crear la organización en la base de datos.' };
      }

      company = createdCompany;
    }

    // 4. Idempotently find or create Primary Admin (`usuarios`)
    let { data: adminUser } = await supabaseServer
      .from('usuarios')
      .select('id')
      .eq('email', lead.email)
      .maybeSingle();

    if (!adminUser) {
      const { data: createdAdmin, error: userErr } = await supabaseServer
        .from('usuarios')
        .insert({
          empresa_id: company.id,
          nombre: `Admin ${lead.company_name}`,
          email: lead.email,
          telefono_whatsapp: '',
          rol: 'ADMIN',
          role: 'ADMIN',
          status: 'ACTIVE',
          password_hash: lead.password_hash,
        })
        .select('id')
        .single();

      if (userErr || !createdAdmin) {
        securityLogger.error('onboarding.complete.admin_insert_failed', userErr, { leadId });
        return { success: false, error: 'No se pudo configurar el usuario administrador.' };
      }

      adminUser = createdAdmin;
    }

    // 5. Mark Lead as CONVERTED
    await supabaseServer
      .from('onboarding_leads')
      .update({
        status: 'CONVERTED',
        current_step: 5,
        converted_empresa_id: company.id,
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', lead.id);

    // 6. Upsert Subscription Record
    const priceItem = subscription.items.data[0];
    const stripePriceId = priceItem?.price?.id || 'unknown_price';
    const nowUnix = Math.floor(Date.now() / 1000);
    const periodStartUnix = priceItem?.current_period_start ?? nowUnix;
    const periodEndUnix = priceItem?.current_period_end ?? nowUnix + 7 * 24 * 60 * 60;

    const trialStartIso = subscription.trial_start
      ? new Date(subscription.trial_start * 1000).toISOString()
      : new Date().toISOString();
    const trialEndIso = subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await supabaseServer.from('subscriptions').upsert(
      {
        empresa_id: company.id,
        stripe_subscription_id: subscription.id,
        stripe_price_id: stripePriceId,
        plan_id: planId,
        billing_cycle: billingCycle,
        status: normalizedStatus,
        trial_start: trialStartIso,
        trial_end: trialEndIso,
        current_period_start: new Date(periodStartUnix * 1000).toISOString(),
        current_period_end: new Date(periodEndUnix * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
        card_brand: cardBrand,
        card_last4: cardLast4,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'empresa_id' }
    );

    // 7. Append Immutable Financial Audit Log
    const auditEventId = `trial_init_${subscription.id}`;
    const { data: existingAudit } = await supabaseServer
      .from('payment_audit_logs')
      .select('id')
      .eq('psp_event_id', auditEventId)
      .maybeSingle();

    if (!existingAudit) {
      await supabaseServer.from('payment_audit_logs').insert({
        empresa_id: company.id,
        user_id: adminUser.id,
        psp_provider: 'STRIPE',
        psp_event_id: auditEventId,
        psp_transaction_ref: subscription.id,
        event_state: 'TRIAL_STARTED',
        amount_cents: 0,
        currency: 'USD',
        card_brand: cardBrand,
        card_last4: cardLast4,
        idempotency_key: idempotencyKey,
        metadata: {
          plan_id: planId,
          billing_cycle: billingCycle,
          trial_end: trialEndIso,
        },
      });
    }

    // 8. Establish Authenticated Ed25519 + RTR Session Cookies in Browser
    const headerStore = await headers();
    const forwarded = headerStore.get('x-forwarded-for');
    const rawIp = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
    const userAgent = headerStore.get('user-agent') || 'unknown';

    await createAuthenticatedSession({
      userId: adminUser.id,
      empresaId: company.id,
      role: 'ADMIN',
      ipHash: hashSha256(rawIp),
      userAgentHash: hashSha256(userAgent),
    });

    securityLogger.info('onboarding.complete.succeeded', {
      empresaId: company.id,
      userId: adminUser.id,
      subscriptionId: subscription.id,
    });

    return {
      success: true,
      data: { redirectTo: '/dashboard' },
    };
  } catch (error) {
    securityLogger.error('onboarding.complete.unexpected_error', error);
    return {
      success: false,
      error: 'No se pudo finalizar la activación de tu cuenta. Intenta iniciar sesión.',
    };
  }
}