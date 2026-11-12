import Stripe from 'stripe';
import { serverEnv } from '@/lib/security/env';

const REPLAY_WINDOW_SECONDS = 300; // 5-minute strict replay attack tolerance

let stripeSingleton: Stripe | null = null;

/**
 * @name getStripeClient
 * @description [Infrastructure]: Initializes and returns a singleton server-side Stripe SDK
 * instance bound to the validated environment secret key (Test Mode in staging, Live Mode in production).
 */
export function getStripeClient(): Stripe {
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(serverEnv.STRIPE_SECRET_KEY, {
      apiVersion: '2026-10-28.endive',
      typescript: true,
      appInfo: {
        name: 'Rendy Enterprise Expense Platform',
        version: '1.0.0',
      },
    });
  }
  return stripeSingleton;
}

/**
 * @name verifyAndConstructStripeEvent
 * @description [Security & PCI-DSS]: Verifies the HMAC-SHA256 `stripe-signature` header against
 * the raw unparsed request Buffer and rejects any webhook event older than 300 seconds to prevent
 * replay and spoofing attacks.
 */
export function verifyAndConstructStripeEvent(
  rawBodyBuffer: Buffer,
  signatureHeader: string | null
): Stripe.Event {
  if (!signatureHeader) {
    throw new Error('Missing stripe-signature header.');
  }

  const stripe = getStripeClient();
  const event = stripe.webhooks.constructEvent(
    rawBodyBuffer,
    signatureHeader,
    serverEnv.STRIPE_WEBHOOK_SECRET,
    REPLAY_WINDOW_SECONDS
  );

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - event.created) > REPLAY_WINDOW_SECONDS) {
    throw new Error('Stripe webhook event timestamp exceeded 300-second replay tolerance.');
  }

  return event;
}