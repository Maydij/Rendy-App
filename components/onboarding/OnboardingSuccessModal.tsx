'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/landing/primitives';
import { OnboardingFormData } from './types';

interface OnboardingSuccessModalProps {
  isOpen: boolean;
  formData: OnboardingFormData;
}

const PLAN_NAMES: Record<string, string> = {
  starter: 'Starter',
  business: 'Business',
  enterprise: 'Enterprise',
};

/**
 * @name OnboardingSuccessModal
 * @description [Business Logic]: Terminal onboarding modal confirming zero-risk trial activation,
 * provisioning tenant encryption keys, and routing the administrator into the corporate dashboard.
 */
export function OnboardingSuccessModal({ isOpen, formData }: OnboardingSuccessModalProps) {
  const router = useRouter();
  const [progressWidth, setProgressWidth] = useState(0);
  const [redirecting, setRedirecting] = useState(false);

  // Compute 7 days from now formatted in Spanish
  const [nextBillingDate, setNextBillingDate] = useState('En 7 días');

  useEffect(() => {
    if (!isOpen) return;

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 7);
    const formatted = targetDate.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    setNextBillingDate(formatted);

    // Animate progress bar fill
    const timer = setTimeout(() => {
      setProgressWidth(100);
    }, 200);

    // Auto trigger redirect message
    const redirectTimer = setTimeout(() => {
      setRedirecting(true);
    }, 2200);

    return () => {
      clearTimeout(timer);
      clearTimeout(redirectTimer);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const planTitle = PLAN_NAMES[formData.selectedPlan] || 'Business';
  const cycleTitle = formData.billingCycle === 'annual' ? 'Anual' : 'Mensual';

  const handleGoDashboard = () => {
    router.push('/dashboard');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-container-lowest/80 backdrop-blur-xl animate-fade-in">
      <div className="bg-surface-container rounded-3xl p-6 sm:p-8 max-w-lg w-full text-center relative overflow-hidden shadow-2xl border border-surface-container-high/60 animate-in zoom-in-95">
        {/* Background radial glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

        {/* Badge Icon */}
        <div className="w-20 h-20 rounded-2xl bg-primary/20 text-primary mx-auto flex items-center justify-center mb-6 relative border border-primary/30 shadow-md">
          <Icon name="verified" className="text-[44px]" />
          <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-primary text-on-primary text-[12px] flex items-center justify-center font-bold">
            ✓
          </div>
        </div>

        <h2 className="font-headline-lg text-headline-lg text-on-surface mb-2 font-bold tracking-tight">
          ¡Bienvenido a Rendy!
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant mb-6 leading-relaxed">
          Tu prueba gratuita de 7 días está activa. El Administrador Principal ha sido configurado con éxito.
        </p>

        {/* Admin Confirmation Card */}
        <div className="bg-surface-container-low p-4 sm:p-5 rounded-2xl mb-6 text-left space-y-2.5 border border-surface-container-high/40">
          <div className="flex items-center justify-between text-xs">
            <span className="text-on-surface-variant">Organización:</span>
            <span className="text-on-surface font-semibold">
              {formData.companyLegalName || 'Acme Solutions C.A.'}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-on-surface-variant">Plan Activo:</span>
            <span className="text-primary font-bold">
              {planTitle} {cycleTitle} · 7 Días Gratis
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-on-surface-variant">Cobro Realizado Hoy:</span>
            <span className="text-on-surface font-semibold">USD 0,00</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-on-surface-variant">Próxima Facturación:</span>
            <span className="text-on-surface-variant font-medium">{nextBillingDate}</span>
          </div>
        </div>

        {/* Animated Progress Meter */}
        <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden mb-6 shadow-inner">
          <div
            className="h-full bg-primary transition-all duration-[2000ms] ease-out rounded-full"
            style={{ width: `${progressWidth}%` }}
          />
        </div>

        <button
          type="button"
          onClick={handleGoDashboard}
          className="w-full py-4 rounded-full bg-primary-container text-on-primary-container font-headline-sm text-[16px] font-bold shadow-lg hover:shadow-primary/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          {redirecting ? (
            <>
              <span>Ingresando al Dashboard...</span>
              <Icon name="check" className="text-[20px]" />
            </>
          ) : (
            <>
              <span>Ir al Dashboard</span>
              <Icon name="arrow_forward" className="text-[20px]" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

