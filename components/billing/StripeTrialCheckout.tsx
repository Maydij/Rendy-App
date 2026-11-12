'use client';

import React, { useEffect, useState, useRef } from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { ShieldCheck, Lock, Loader2, AlertCircle } from 'lucide-react';
import type { PlanId, BillingCycle } from '@/lib/billing/plans';
import { trackProductEvent } from '@/lib/analytics/tracking-plan';
import { completeTrialOnboardingAction } from '@/app/actions/onboarding.actions';

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
const stripePromise: Promise<Stripe | null> | null = PUBLISHABLE_KEY.startsWith('pk_')
  ? loadStripe(PUBLISHABLE_KEY)
  : null;

interface StripeTrialCheckoutProps {
  leadId: string;
  planId: PlanId;
  billingCycle: BillingCycle;
  onTrialActivated: () => void;
}

interface TrialSessionData {
  clientSecret: string;
  intentType: 'setup' | 'payment';
  subscriptionId: string;
  trialDays: number;
  billedTodayUsd: number;
  recurringAmountUsd: number;
}

/**
 * @name StripeTrialCheckout
 * @description [Business Logic]: PCI-DSS Level 1 compliant out-of-scope payment wrapper.
 * Initializes an idempotent 7-day free trial session ($0.00 charged today) and renders
 * Stripe's hosted PaymentElement iframe so cardholder data never touches Rendy servers.
 */
export function StripeTrialCheckout({
  leadId,
  planId,
  billingCycle,
  onTrialActivated,
}: StripeTrialCheckoutProps) {
  const [sessionData, setSessionData] = useState<TrialSessionData | null>(null);
  const [initError, setInitError] = useState<string | null>(
    stripePromise
      ? null
      : 'Falta configurar NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (pk_test_...) en .env.local.'
  );
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());
  const startedRequestKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!stripePromise) return;

    const requestKey = `${leadId}:${planId}:${billingCycle}`;
    if (startedRequestKeyRef.current === requestKey) return;
    startedRequestKeyRef.current = requestKey;

    async function initializeTrialSession() {
      try {
        setInitError(null);
        void trackProductEvent('trial_checkout_initiated', {
          plan_id: planId,
          billing_cycle: billingCycle,
          trial_days: 7,
        });

        const response = await fetch('/api/billing/create-trial-subscription', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKeyRef.current,
          },
          body: JSON.stringify({ leadId, planId, billingCycle }),
        });

        const payload = (await response.json()) as TrialSessionData & { error?: string };

        if (!response.ok || !payload.clientSecret) {
          startedRequestKeyRef.current = null;
          throw new Error(payload.error || 'No se pudo iniciar la pasarela segura de pago.');
        }

        setSessionData(payload);
      } catch (err) {
        startedRequestKeyRef.current = null;
        setInitError(
          err instanceof Error ? err.message : 'Error de conexión con la pasarela de pagos.'
        );
      }
    }

    void initializeTrialSession();
  }, [leadId, planId, billingCycle]);

  if (initError || !stripePromise) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 flex items-center gap-3">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <span>{initError || 'Configuración de pasarela Stripe incompleta.'}</span>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-500" />
        <p className="text-sm font-medium">Conectando con bóveda cifrada PCI-DSS Level 1...</p>
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: sessionData.clientSecret,
        appearance: {
          theme: 'night',
          variables: {
            colorPrimary: '#10b981',
            colorBackground: '#0f172a',
            colorText: '#f8fafc',
            borderRadius: '10px',
          },
        },
      }}
    >
      <CheckoutInnerForm
        leadId={leadId}
        sessionData={sessionData}
        onTrialActivated={onTrialActivated}
      />
    </Elements>
  );
}

function CheckoutInnerForm({
  leadId,
  sessionData,
  onTrialActivated,
}: {
  leadId: string;
  sessionData: TrialSessionData;
  onTrialActivated: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  const handleConfirmTrial = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stripe || !elements || isSubmitting) return;

    setIsSubmitting(true);
    setCardError(null);

    const returnUrl = `${window.location.origin}/dashboard`;

    const result =
      sessionData.intentType === 'setup'
        ? await stripe.confirmSetup({
            elements,
            confirmParams: { return_url: returnUrl },
            redirect: 'if_required',
          })
        : await stripe.confirmPayment({
            elements,
            confirmParams: { return_url: returnUrl },
            redirect: 'if_required',
          });

    if (result.error) {
      const alreadySucceeded =
        result.error.code === 'setup_intent_unexpected_state' ||
        result.error.code === 'payment_intent_unexpected_state' ||
        result.error.setup_intent?.status === 'succeeded' ||
        result.error.payment_intent?.status === 'succeeded';

      if (!alreadySucceeded) {
        setCardError(result.error.message || 'No se pudo verificar el método de pago.');
        setIsSubmitting(false);
        return;
      }
    }

    const activation = await completeTrialOnboardingAction({
      leadId,
      subscriptionId: sessionData.subscriptionId,
    });

    if (!activation.success) {
      setCardError(activation.error || 'No se pudo activar el espacio de trabajo.');
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    onTrialActivated();
  };

  return (
    <form onSubmit={handleConfirmTrial} className="space-y-5">
      {/* Transparent Netflix-Style Billing Summary */}
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-300 font-medium">Total a pagar hoy:</span>
          <span className="text-lg font-bold text-emerald-400">$0.00 USD</span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Disfruta <strong>{sessionData.trialDays} días gratis</strong> con acceso completo. Si cancelas
          antes del día 8 desde Configuración, no se realizará ningún cargo. A partir del día 8 se
          cobrarán automáticamente <strong>${sessionData.recurringAmountUsd.toFixed(2)} USD</strong>{' '}
          ({sessionData.intentType === 'setup' ? 'suscripción recurrente' : 'plan seleccionado'}).
        </p>
      </div>

      {/* PCI-DSS Hosted Payment Element */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>

      {cardError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{cardError}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || isSubmitting}
        className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 py-3.5 px-5 text-sm font-bold text-white transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Activando cuenta cifrada...</span>
          </>
        ) : (
          <>
            <Lock className="h-4 w-4" />
            <span>Iniciar Prueba Gratuita de 7 Días ($0.00 hoy)</span>
          </>
        )}
      </button>

      <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
        <ShieldCheck className="h-4 w-4 text-emerald-400" />
        <span>Cifrado TLS 1.3 • Cumplimiento PCI-DSS Level 1 • Cancela en 1 clic</span>
      </div>
    </form>
  );
}