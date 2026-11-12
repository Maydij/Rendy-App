// app/actions/subscription.actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase-server';
import { requireAdminSession } from '@/lib/auth/session-context';
import { getStripeClient } from '@/lib/billing/stripe';
import { securityLogger } from '@/lib/security/logger';

/**
 * @name cancelTrialOrSubscriptionAction
 * @description [Business Logic & PCI-DSS]: Cancels the organization's Stripe subscription.
 * If canceled during the 7-day free trial (`TRIALING`), cancels immediately with $0.00 charged;
 * otherwise schedules cancellation at the end of the current billing period and appends an
 * immutable CANCELED audit entry.
 */
export async function cancelTrialOrSubscriptionAction(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await requireAdminSession();

    const { data: sub, error: fetchErr } = await supabaseServer
      .from('subscriptions')
      .select('id, stripe_subscription_id, status, card_brand, card_last4')
      .eq('empresa_id', session.empresaId)
      .single();

    if (fetchErr || !sub) {
      return { success: false, error: 'No se encontró una suscripción activa.' };
    }

    const stripe = getStripeClient();

    if (sub.status === 'TRIALING') {
      await stripe.subscriptions.cancel(sub.stripe_subscription_id);
    } else {
      await stripe.subscriptions.update(sub.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
    }

    await supabaseServer
      .from('subscriptions')
      .update({
        status: sub.status === 'TRIALING' ? 'CANCELED' : sub.status,
        cancel_at_period_end: true,
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sub.id);

    await supabaseServer.from('payment_audit_logs').insert({
      empresa_id: session.empresaId,
      user_id: session.userId,
      psp_provider: 'STRIPE',
      psp_transaction_ref: sub.stripe_subscription_id,
      event_state: 'CANCELED',
      amount_cents: 0,
      currency: 'USD',
      card_brand: sub.card_brand,
      card_last4: sub.card_last4,
      metadata: { canceled_by_admin: true, was_trialing: sub.status === 'TRIALING' },
    });

    securityLogger.info('subscription.canceled_by_admin', {
      empresaId: session.empresaId,
      userId: session.userId,
    });

    revalidatePath('/dashboard/configuracion');
    return { success: true };
  } catch (error) {
    securityLogger.error('subscription.cancel_failed', error);
    return { success: false, error: 'No se pudo procesar la cancelación en la pasarela.' };
  }
}