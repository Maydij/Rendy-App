import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase-server';
import { getStripeClient } from '@/lib/billing/stripe';
import {
  PlanIdSchema,
  BillingCycleSchema,
  resolveStripePriceId,
  SUBSCRIPTION_PLANS,
} from '@/lib/billing/plans';
import {
  enforceRateLimit,
  acquireIdempotencyLock,
  storeIdempotencyResult,
  releaseIdempotencyLock,
  RATE_LIMIT_POLICIES,
} from '@/lib/security/redis-guard';
import { hashSha256 } from '@/lib/security/crypto';
import { securityLogger } from '@/lib/security/logger';

const CreateTrialPayloadSchema = z
  .object({
    leadId: z.string().uuid('Invalid onboarding lead identifier.'),
    planId: PlanIdSchema,
    billingCycle: BillingCycleSchema,
  })
  .strict();

const IdempotencyHeaderSchema = z
  .string()
  .uuid('Idempotency-Key header must be a valid UUIDv4.');

/**
 * @name POST /api/billing/create-trial-subscription
 * @description [Business Logic]: Initiates a Netflix-style 7-day free trial subscription in Stripe.
 * Charges $0.00 today, collects and validates the payment card via Stripe SetupIntent/PaymentElement
 * (PCI-DSS Level 1 out-of-scope), and schedules automatic recurring billing starting on Day 8.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let acquiredKey: string | null = null;

  try {
    // 1. Strict Rate Limiting (3 requests / minute)
    const forwardedFor = request.headers.get('x-forwarded-for');
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';
    const ipHash = hashSha256(clientIp);

    const rateVerdict = await enforceRateLimit(ipHash, RATE_LIMIT_POLICIES.PAYMENT_STRICT);
    if (!rateVerdict.allowed) {
      return NextResponse.json(
        { error: 'Too many payment initialization requests. Please wait before retrying.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateVerdict.retryAfterSeconds) },
        }
      );
    }

    // 2. Mandatory UUIDv4 Idempotency-Key Lock in Redis
    const rawIdempotencyKey = request.headers.get('idempotency-key');
    const parsedKey = IdempotencyHeaderSchema.safeParse(rawIdempotencyKey);
    if (!parsedKey.success) {
      return NextResponse.json(
        { error: 'Missing or invalid UUIDv4 Idempotency-Key header.' },
        { status: 400 }
      );
    }
    const idempotencyKey = parsedKey.data;

    const lock = await acquireIdempotencyLock(idempotencyKey);
    if (!lock.acquired) {
      if (lock.cachedResponse) {
        return NextResponse.json(JSON.parse(lock.cachedResponse), { status: 200 });
      }
      return NextResponse.json(
        { error: 'A concurrent subscription request with this Idempotency-Key is in progress.' },
        { status: 409 }
      );
    }
    acquiredKey = idempotencyKey;

    // 3. Strict Input Validation
    const rawJson: unknown = await request.json();
    const parsedBody = CreateTrialPayloadSchema.safeParse(rawJson);
    if (!parsedBody.success) {
      await releaseIdempotencyLock(idempotencyKey);
      acquiredKey = null;
      return NextResponse.json(
        { error: parsedBody.error.issues[0]?.message || 'Invalid checkout payload.' },
        { status: 400 }
      );
    }

    const { leadId, planId, billingCycle } = parsedBody.data;

    // 4. Load Lead Record from Database
    const { data: lead, error: leadError } = await supabaseServer
      .from('onboarding_leads')
      .select('id, email, company_name, status')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      await releaseIdempotencyLock(idempotencyKey);
      acquiredKey = null;
      return NextResponse.json({ error: 'Onboarding session not found.' }, { status: 404 });
    }

    if (lead.status === 'CONVERTED') {
      await releaseIdempotencyLock(idempotencyKey);
      acquiredKey = null;
      return NextResponse.json(
        { error: 'This organization has already completed registration.' },
        { status: 409 }
      );
    }

    // 5. Server-Side Price Authority
    const stripePriceId = resolveStripePriceId(planId, billingCycle);
    const planDetails = SUBSCRIPTION_PLANS[planId];
    const stripe = getStripeClient();

    // 6. Create Stripe Customer (Zero cardholder data touches our server)
    const customer = await stripe.customers.create(
      {
        email: lead.email,
        name: lead.company_name,
        metadata: {
          onboarding_lead_id: lead.id,
          plan_id: planId,
          billing_cycle: billingCycle,
        },
      },
      { idempotencyKey: `cust_${idempotencyKey}` }
    );

    // 7. Create 7-Day Free Trial Subscription ($0.00 charged today, automatic charge Day 8)
    const subscription = await stripe.subscriptions.create(
      {
        customer: customer.id,
        items: [{ price: stripePriceId }],
        trial_period_days: planDetails.trialDays,
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription',
        },
        trial_settings: {
          end_behavior: {
            missing_payment_method: 'cancel',
          },
        },
        metadata: {
          onboarding_lead_id: lead.id,
          plan_id: planId,
          billing_cycle: billingCycle,
          idempotency_key: idempotencyKey,
        },
        expand: ['pending_setup_intent'],
      },
      { idempotencyKey: `sub_${idempotencyKey}` }
    );

    let clientSecret: string | null = null;

    if (
      subscription.pending_setup_intent &&
      typeof subscription.pending_setup_intent === 'object' &&
      subscription.pending_setup_intent.client_secret
    ) {
      clientSecret = subscription.pending_setup_intent.client_secret;
    } else if (typeof subscription.pending_setup_intent === 'string') {
      const retrievedSetupIntent = await stripe.setupIntents.retrieve(
        subscription.pending_setup_intent
      );
      clientSecret = retrievedSetupIntent.client_secret;
    } else {
      const fallbackSetupIntent = await stripe.setupIntents.create(
        {
          customer: customer.id,
          usage: 'off_session',
          metadata: {
            onboarding_lead_id: lead.id,
            subscription_id: subscription.id,
          },
        },
        { idempotencyKey: `setup_${idempotencyKey}` }
      );
      clientSecret = fallbackSetupIntent.client_secret;
    }

    if (!clientSecret) {
      throw new Error('Stripe did not return a valid SetupIntent client_secret.');
    }

    // 8. Update Lead Progress to Step 4 (Checkout Initiated)
    await supabaseServer
      .from('onboarding_leads')
      .update({
        selected_plan_id: planId,
        billing_cycle: billingCycle,
        current_step: 4,
        status: 'STEP_4_CHECKOUT',
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', lead.id);

    const responsePayload = {
      clientSecret,
      intentType: 'setup' as const,
      subscriptionId: subscription.id,
      trialDays: planDetails.trialDays,
      billedTodayUsd: 0,
      recurringAmountUsd:
        billingCycle === 'ANNUAL' ? planDetails.annualTotalUsd : planDetails.monthlyPriceUsd,
      billingCycle,
    };

    await storeIdempotencyResult(idempotencyKey, JSON.stringify(responsePayload));
    acquiredKey = null;

    securityLogger.info('billing.trial_subscription.initiated', {
      leadId: lead.id,
      planId,
      billingCycle,
      subscriptionId: subscription.id,
    });

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (error) {
    if (acquiredKey) {
      await releaseIdempotencyLock(acquiredKey);
    }
    securityLogger.error('billing.trial_subscription.error', error);
    return NextResponse.json(
      { error: 'Unable to initialize secure payment checkout. Please try again.' },
      { status: 500 }
    );
  }
}