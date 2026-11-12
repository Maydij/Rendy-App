import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { supabaseServer } from '@/lib/supabase-server';
import { getStripeClient, verifyAndConstructStripeEvent } from '@/lib/billing/stripe';
import { securityLogger } from '@/lib/security/logger';

export const runtime = 'nodejs';

/**
 * @name POST /api/webhooks/stripe
 * @description [Business Logic & PCI-DSS]: Verifies HMAC-SHA256 digital signatures on raw Stripe
 * webhook buffers (with 300s replay protection) and idempotently provisions enterprise tenants,
 * administrator accounts, 7-day trial subscriptions, Day-8 recurring captures, and append-only
 * financial audit logs.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let event: Stripe.Event;

  try {
    // 1. Read raw unparsed Buffer for strict HMAC-SHA256 signature verification
    const rawText = await request.text();
    const rawBuffer = Buffer.from(rawText, 'utf8');
    const signatureHeader = request.headers.get('stripe-signature');

    event = verifyAndConstructStripeEvent(rawBuffer, signatureHeader);
  } catch (err) {
    securityLogger.warn('webhook.stripe.signature_verification_failed', {
      reason: err instanceof Error ? err.message : 'Invalid signature',
    });
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 400 });
  }

  try {
    // 2. Idempotency Guard: Skip if this exact Stripe Event ID was already processed
    const { data: existingAudit } = await supabaseServer
      .from('payment_audit_logs')
      .select('id')
      .eq('psp_event_id', event.id)
      .maybeSingle();

    if (existingAudit) {
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
    }

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionStateChange(event.id, subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(event.id, subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentSucceeded(event.id, invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(event.id, invoice);
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    securityLogger.error('webhook.stripe.processing_error', error, { eventId: event.id });
    return NextResponse.json({ error: 'Webhook handler failure.' }, { status: 500 });
  }
}

/**
 * @name extractInvoiceSubscriptionId
 * @description [Helper]: Safely extracts the canonical subscription ID from Stripe Invoice
 * parent subscription details under API version 2026-10-28.endive.
 */
function extractInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const subRef = invoice.parent?.subscription_details?.subscription;
  if (!subRef) return null;
  return typeof subRef === 'string' ? subRef : subRef.id;
}

/**
 * @name resolveCardSummary
 * @description [PCI-DSS]: Retrieves only non-sensitive masked payment method metadata
 * (brand and last 4 digits) from Stripe's PaymentMethod object.
 */
async function resolveCardSummary(
  paymentMethodId: string | Stripe.PaymentMethod | null
): Promise<{ cardBrand: string | null; cardLast4: string | null }> {
  if (!paymentMethodId) return { cardBrand: null, cardLast4: null };

  if (typeof paymentMethodId === 'object' && paymentMethodId.card) {
    return {
      cardBrand: paymentMethodId.card.brand ?? null,
      cardLast4: paymentMethodId.card.last4 ?? null,
    };
  }

  if (typeof paymentMethodId === 'string') {
    const stripe = getStripeClient();
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    return {
      cardBrand: pm.card?.brand ?? null,
      cardLast4: pm.card?.last4 ?? null,
    };
  }

  return { cardBrand: null, cardLast4: null };
}

/**
 * @name handleSubscriptionStateChange
 * @description [Business Logic]: Provisions the organization (`empresas`) and Primary Admin
 * (`usuarios`) when a 7-day trial or active subscription is confirmed by Stripe.
 */
async function handleSubscriptionStateChange(
  stripeEventId: string,
  subscription: Stripe.Subscription
): Promise<void> {
  const leadId = subscription.metadata?.onboarding_lead_id;
  const planId = subscription.metadata?.plan_id || 'GROWTH';
  const billingCycle = subscription.metadata?.billing_cycle || 'MONTHLY';
  const idempotencyKey = subscription.metadata?.idempotency_key || null;
  const stripeCustomerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

  const normalizedStatus = subscription.status.toUpperCase() as
    | 'TRIALING'
    | 'ACTIVE'
    | 'PAST_DUE'
    | 'CANCELED'
    | 'INCOMPLETE'
    | 'UNPAID';

  // Only provision tenant once payment method is confirmed (trialing or active)
  if (normalizedStatus !== 'TRIALING' && normalizedStatus !== 'ACTIVE') {
    return;
  }

  const { cardBrand, cardLast4 } = await resolveCardSummary(subscription.default_payment_method);

  // Check if organization already exists for this Stripe customer
  let { data: company } = await supabaseServer
    .from('empresas')
    .select('id')
    .eq('stripe_customer_id', stripeCustomerId)
    .maybeSingle();

  let adminUserId: string | null = null;

  if (!company && leadId) {
    const { data: lead } = await supabaseServer
      .from('onboarding_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (lead && lead.status !== 'CONVERTED') {
      // 1. Create Organization (Tenant)
      const { data: createdCompany, error: compErr } = await supabaseServer
        .from('empresas')
        .insert({
          nombre: lead.company_name,
          moneda: 'USD',
          rif_encrypted: lead.rif_encrypted,
          rif_blind_index: lead.rif_blind_index,
          sector: lead.sector,
          employee_range: lead.employee_range,
          estimated_employees: lead.estimated_employees ?? 10,
          plan_id: planId,
          billing_cycle: billingCycle,
          stripe_customer_id: stripeCustomerId,
          onboarding_completed: true,
        })
        .select('id')
        .single();

      if (compErr || !createdCompany) {
        throw new Error(`Failed to provision empresa from lead ${leadId}: ${compErr?.message}`);
      }

      company = createdCompany;

      // 2. Create Primary Admin User
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
        throw new Error(`Failed to provision admin user for company ${company.id}`);
      }

      adminUserId = createdAdmin.id;

      // 3. Mark Lead as Converted
      await supabaseServer
        .from('onboarding_leads')
        .update({
          status: 'CONVERTED',
          current_step: 5,
          converted_empresa_id: company.id,
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', lead.id);
    }
  }

  if (!company) return;

  const priceItem = subscription.items.data[0];
  const stripePriceId = priceItem?.price?.id || 'unknown_price';
  const nowUnixSeconds = Math.floor(Date.now() / 1000);
  const periodStartUnix = priceItem?.current_period_start ?? nowUnixSeconds;
  const periodEndUnix = priceItem?.current_period_end ?? nowUnixSeconds + 7 * 24 * 60 * 60;

  const trialStartIso = subscription.trial_start
    ? new Date(subscription.trial_start * 1000).toISOString()
    : new Date().toISOString();
  const trialEndIso = subscription.trial_end
    ? new Date(subscription.trial_end * 1000).toISOString()
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // 4. Upsert Subscription Record
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

  // 5. Append Immutable Financial Audit Log
  await supabaseServer.from('payment_audit_logs').insert({
    empresa_id: company.id,
    user_id: adminUserId,
    psp_provider: 'STRIPE',
    psp_event_id: stripeEventId,
    psp_transaction_ref: subscription.id,
    event_state: normalizedStatus === 'TRIALING' ? 'TRIAL_STARTED' : 'AUTHORIZED',
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

/**
 * @name handleSubscriptionCanceled
 * @description [Business Logic]: Marks subscription as CANCELED when canceled before Day 7
 * (ensuring $0.00 charged) or at period end, logging an immutable CANCELED audit entry.
 */
async function handleSubscriptionCanceled(
  stripeEventId: string,
  subscription: Stripe.Subscription
): Promise<void> {
  const { data: subRecord } = await supabaseServer
    .from('subscriptions')
    .select('empresa_id, card_brand, card_last4')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle();

  if (!subRecord) return;

  await supabaseServer
    .from('subscriptions')
    .update({
      status: 'CANCELED',
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  await supabaseServer.from('payment_audit_logs').insert({
    empresa_id: subRecord.empresa_id,
    psp_provider: 'STRIPE',
    psp_event_id: stripeEventId,
    psp_transaction_ref: subscription.id,
    event_state: 'CANCELED',
    amount_cents: 0,
    currency: 'USD',
    card_brand: subRecord.card_brand,
    card_last4: subRecord.card_last4,
    metadata: { canceled_during_trial: subscription.status === 'trialing' },
  });
}

/**
 * @name handleInvoicePaymentSucceeded
 * @description [Business Logic]: Captures Day-8 recurring billing and subsequent renewals,
 * transitioning the subscription from TRIALING to ACTIVE and appending a CAPTURED audit record.
 */
async function handleInvoicePaymentSucceeded(
  stripeEventId: string,
  invoice: Stripe.Invoice
): Promise<void> {
  const subscriptionId = extractInvoiceSubscriptionId(invoice);

  if (!subscriptionId || invoice.amount_paid <= 0) return;

  const { data: subRecord } = await supabaseServer
    .from('subscriptions')
    .select('empresa_id, card_brand, card_last4')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();

  if (!subRecord) return;

  await supabaseServer
    .from('subscriptions')
    .update({
      status: 'ACTIVE',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscriptionId);

  await supabaseServer.from('payment_audit_logs').insert({
    empresa_id: subRecord.empresa_id,
    psp_provider: 'STRIPE',
    psp_event_id: stripeEventId,
    psp_transaction_ref: invoice.id ?? subscriptionId,
    event_state: 'CAPTURED',
    amount_cents: invoice.amount_paid,
    currency: (invoice.currency || 'usd').toUpperCase(),
    card_brand: subRecord.card_brand,
    card_last4: subRecord.card_last4,
    metadata: { billing_reason: invoice.billing_reason },
  });
}

/**
 * @name handleInvoicePaymentFailed
 * @description [Business Logic]: Flags subscription as PAST_DUE if Day-8 automatic charge fails
 * and appends an immutable FAILED record to `payment_audit_logs`.
 */
async function handleInvoicePaymentFailed(
  stripeEventId: string,
  invoice: Stripe.Invoice
): Promise<void> {
  const subscriptionId = extractInvoiceSubscriptionId(invoice);

  if (!subscriptionId) return;

  const { data: subRecord } = await supabaseServer
    .from('subscriptions')
    .select('empresa_id, card_brand, card_last4')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();

  if (!subRecord) return;

  await supabaseServer
    .from('subscriptions')
    .update({
      status: 'PAST_DUE',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscriptionId);

  await supabaseServer.from('payment_audit_logs').insert({
    empresa_id: subRecord.empresa_id,
    psp_provider: 'STRIPE',
    psp_event_id: stripeEventId,
    psp_transaction_ref: invoice.id ?? subscriptionId,
    event_state: 'FAILED',
    amount_cents: invoice.amount_due,
    currency: (invoice.currency || 'usd').toUpperCase(),
    card_brand: subRecord.card_brand,
    card_last4: subRecord.card_last4,
    metadata: { attempt_count: invoice.attempt_count },
  });
}