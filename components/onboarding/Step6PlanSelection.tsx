'use client';

import React, { useState } from 'react';
import { Icon } from '@/components/landing/primitives';
import { cn } from '@/lib/utils';
import {
  ANNUAL_DISCOUNT_LABEL,
  PLANS,
  billingNote,
  planPrice,
} from '@/lib/pricing';
import { BillingCycle, OnboardingFormData, PlanTier } from './types';

interface Step6Props {
  formData: OnboardingFormData;
  updateField: <K extends keyof OnboardingFormData>(key: K, value: OnboardingFormData[K]) => void;
  onNext: () => void;
  onBack: () => void;
}

/**
 * @name Step6PlanSelection
 * @description [Business Logic]: Presents transparent commercial tiers (Starter, Growth, Enterprise)
 * mirroring the official landing page pricing catalog and interaction design. Supports instantaneous
 * monthly vs. 20% annual discount calculations and micro-interactions before starting the 7-day free trial.
 */
export function Step6PlanSelection({ formData, updateField, onNext, onBack }: Step6Props) {
  const [hasToggled, setHasToggled] = useState(false);

  const isAnnual = formData.billingCycle === 'annual';

  const handleCycleChange = (nextCycle: BillingCycle) => {
    if (nextCycle === formData.billingCycle) return;
    setHasToggled(true);
    updateField('billingCycle', nextCycle);
  };

  const handleSelectPlan = (planId: PlanTier) => {
    updateField('selectedPlan', planId);
  };

  const currentPlan = PLANS.find((p) => p.id === formData.selectedPlan) || PLANS[1];
  const currentPrice = planPrice(currentPlan, formData.billingCycle);
  const cycleLabel = isAnnual ? 'Anual' : 'Mensual';

  const toggleClass = (active: boolean) =>
    cn(
      'group relative px-5 py-2 rounded-xl text-label-md font-semibold flex items-center gap-2 cursor-pointer select-none border origin-center',
      'transition-all duration-200 ease-out will-change-transform',
      active
        ? 'text-on-surface bg-surface-bright border-outline-variant/30 shadow-sm z-10'
        : 'text-on-surface-variant border-transparent z-0 hover:text-on-surface hover:bg-surface-bright/70 hover:border-outline-variant/40 hover:shadow-md hover:scale-[1.035] hover:z-20 active:scale-[0.98]',
    );

  return (
    <div className="w-full max-w-[1360px] mx-auto transition-opacity duration-300">
      {/* Back button */}
      <div className="mb-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-on-surface-variant hover:text-on-surface text-label-md font-label-md transition-colors cursor-pointer"
        >
          <Icon name="arrow_back" className="text-[18px]" />
          <span>Volver a Permisos y Roles</span>
        </button>
      </div>

      {/* Headline & Subtitle */}
      <div className="text-center max-w-3xl mx-auto mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container border border-outline-variant/30 mb-3 text-on-surface-variant">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary font-bold">
            Planes Transparentes
          </span>
        </div>
        <h1 className="font-headline-lg text-headline-lg sm:text-headline-xl text-on-surface mb-2.5 tracking-tight font-bold">
          Elige cómo quieres gestionar tu empresa
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto">
          Automatiza la rendición de viáticos y reembolsos por WhatsApp con IA contable. 7 días
          de prueba gratis en todos los planes, cancela cuando quieras.
        </p>

        {/* Animated Segmented Billing Cycle Toggle (identical to Landing Page) */}
        <div
          role="group"
          aria-label="Ciclo de facturación"
          className="mt-6 inline-flex flex-wrap justify-center items-center p-2 rounded-2xl bg-surface-container-high/60 backdrop-blur-md shadow-inner gap-2 border border-outline-variant/20"
        >
          <button
            type="button"
            aria-pressed={formData.billingCycle === 'monthly'}
            onClick={() => handleCycleChange('monthly')}
            className={toggleClass(formData.billingCycle === 'monthly')}
          >
            Facturación Mensual
          </button>
          <button
            type="button"
            aria-pressed={formData.billingCycle === 'annual'}
            onClick={() => handleCycleChange('annual')}
            className={toggleClass(formData.billingCycle === 'annual')}
          >
            <span>Facturación Anual</span>
            <span className="px-2 py-0.5 rounded-full text-label-sm font-bold bg-primary-container text-black transition-transform duration-200 group-hover:scale-105">
              {ANNUAL_DISCOUNT_LABEL}
            </span>
          </button>
        </div>
      </div>

      {/* 3 Pricing Cards Grid (wider cards with optimal reading density) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 xl:gap-8 items-stretch mb-8">
        {PLANS.map((plan, index) => {
          const isSelected = formData.selectedPlan === plan.id;
          const isFeatured = plan.featured;

          return (
            <div
              key={plan.id}
              className={cn(
                'flex flex-col h-full animate-card-enter',
                isFeatured ? 'mt-3 lg:mt-0' : '',
              )}
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <div
                key={hasToggled ? `${plan.id}-${formData.billingCycle}` : undefined}
                onClick={() => handleSelectPlan(plan.id)}
                className={cn(
                  'p-6 sm:p-7 xl:p-8 rounded-3xl flex flex-col justify-between relative flex-1 transition-all duration-300 cursor-pointer',
                  isSelected
                    ? 'bg-surface-container-low shadow-glow-plan border-2 border-primary-container -translate-y-2 ring-2 ring-primary-container/40'
                    : isFeatured
                    ? 'bg-surface-container shadow-sm border border-primary-container/30 hover:border-primary-container/60 hover:-translate-y-1'
                    : 'bg-surface-container shadow-sm border border-outline-variant/30 hover:border-outline-variant/60 hover:-translate-y-1',
                  hasToggled && 'animate-pricing-card',
                  formData.billingCycle === 'annual' && isSelected && 'ring-1 ring-primary-container/40',
                )}
                style={
                  hasToggled
                    ? {
                        animationDelay: `${index * 65}ms`,
                        animationFillMode: 'both',
                      }
                    : undefined
                }
              >
                {/* Subtle luminous gleam sweeping across the selected card when passing to annual */}
                {formData.billingCycle === 'annual' && isSelected && (
                  <div
                    className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none z-10"
                    aria-hidden="true"
                  >
                    <div
                      className="w-1/2 h-full bg-gradient-to-r from-transparent via-primary-container/15 to-transparent skew-x-[-20deg] animate-pricing-shine"
                      style={{
                        animationDelay: `${index * 80}ms`,
                      }}
                    />
                  </div>
                )}

                <div>
                  {/* Distinct Top Badges: Clear separation between Featured vs User Selected */}
                  {isSelected && isFeatured && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary-container text-black text-label-sm font-bold uppercase tracking-wider shadow-md whitespace-nowrap z-20 flex items-center gap-1.5">
                      <Icon name="auto_awesome" className="text-[14px] text-black font-extrabold" />
                      <span>RECOMENDADO • SELECCIONADO</span>
                    </div>
                  )}

                  {isSelected && !isFeatured && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary-container text-black text-label-sm font-bold uppercase tracking-wider shadow-md whitespace-nowrap z-20 flex items-center gap-1.5">
                      <Icon name="check_circle" className="text-[14px] text-black font-extrabold" />
                      <span>PLAN SELECCIONADO</span>
                    </div>
                  )}

                  {!isSelected && isFeatured && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-0.5 rounded-full bg-surface-container-high/90 text-primary text-label-sm font-bold uppercase tracking-wider border border-primary/30 shadow-sm whitespace-nowrap z-20 flex items-center gap-1">
                      <Icon name="auto_awesome" className="text-[13px] text-primary" />
                      <span>Recomendado por Rendy</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={cn(
                        'text-label-sm uppercase font-bold tracking-wider',
                        isSelected ? 'text-primary' : isFeatured ? 'text-primary/70' : 'text-on-surface-variant',
                      )}
                    >
                      {plan.tier}
                    </span>

                    {isSelected ? (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-primary-container text-black flex items-center gap-1 shadow-sm">
                        <Icon name="check" className="text-[13px] text-black font-extrabold" />
                        <span>Seleccionado</span>
                      </span>
                    ) : (
                      <span className="text-xs text-on-surface-variant/50 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-outline-variant/60" />
                        <span>Clic para elegir</span>
                      </span>
                    )}
                  </div>

                  <h3 className="font-display text-headline-md font-bold text-on-surface mt-1.5">
                    {plan.name}
                  </h3>
                  <p className="text-body-md text-on-surface-variant mt-2 mb-5 leading-relaxed">
                    {plan.description}
                  </p>

                  <div className="mb-5">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span
                        key={`price-${formData.billingCycle}`}
                        className="font-display text-headline-xl font-extrabold text-on-surface inline-block animate-price-tick"
                      >
                        {planPrice(plan, formData.billingCycle)}
                      </span>
                      <span className="text-body-md text-on-surface-variant">/mes</span>
                      {formData.billingCycle === 'annual' && (
                        <span className="ml-1.5 px-2 py-0.5 rounded-full text-label-sm font-bold bg-primary-container/20 text-primary-container border border-primary-container/30 animate-annual-badge whitespace-nowrap">
                          {ANNUAL_DISCOUNT_LABEL}
                        </span>
                      )}
                    </div>
                    <span
                      key={`note-${formData.billingCycle}`}
                      className="text-label-sm text-on-surface-variant block mt-1 animate-price-tick"
                    >
                      {billingNote(formData.billingCycle)}
                    </span>
                  </div>

                  <ul className="flex flex-col gap-2.5 text-body-md text-on-surface-variant">
                    {plan.features.map((f) => (
                      <li key={f.text} className="flex items-start gap-2.5 leading-snug">
                        <Icon
                          name="check"
                          className="text-primary-container text-[20px] shrink-0 mt-0.5"
                        />
                        <span
                          className={cn(
                            f.emphasis === 'strong' && 'text-on-surface font-medium',
                            f.emphasis === 'highlight' && 'text-primary font-semibold',
                          )}
                        >
                          {f.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-7 pt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectPlan(plan.id);
                      onNext();
                    }}
                    className={cn(
                      'w-full py-3.5 rounded-xl text-center text-label-md transition-all active:scale-95 flex items-center justify-center gap-2 group cursor-pointer',
                      isSelected
                        ? 'font-bold bg-primary-container text-black shadow-glow-md hover:shadow-glow-lg hover:-translate-y-0.5'
                        : 'font-semibold border border-outline-variant/60 text-on-surface hover:bg-surface-bright hover:border-outline-variant/80',
                    )}
                  >
                    <span>
                      {isSelected
                        ? `Continuar con ${plan.tier}`
                        : `Elegir ${plan.tier}`}
                    </span>
                    <Icon
                      name="arrow_forward"
                      className={cn(
                        'text-[18px] group-hover:translate-x-1 transition-transform',
                        isSelected ? 'text-black font-bold' : 'text-on-surface',
                      )}
                    />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trust & Free Trial Banner */}
      <div className="w-full bg-surface-container border border-outline-variant/30 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 shadow-sm animate-enter-up [animation-delay:220ms]">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 border border-primary/20">
            <Icon name="verified_user" className="text-[24px]" />
          </div>
          <div>
            <div className="font-headline-sm text-[16px] text-on-surface font-bold">
              Todos nuestros planes incluyen 7 días de prueba gratuita completa.
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Sin compromisos obligatorios. Podrás cancelar en cualquier momento desde tu panel sin costo.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant shrink-0 bg-surface-container-low border border-outline-variant/40 px-3 py-1.5 rounded-full">
          <Icon name="lock" className="text-primary text-[16px]" />
          <span>Cancelación en 1-clic</span>
        </div>
      </div>

      {/* Footer Action CTA */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-outline-variant/20 animate-enter-up [animation-delay:260ms]">
        <div className="text-xs text-on-surface-variant text-center sm:text-left">
          Plan seleccionado actualmente:{' '}
          <span className="font-bold text-primary">
            {currentPlan.tier} ({currentPlan.name}) - {cycleLabel} ({currentPrice}/mes)
          </span>
        </div>

        <button
          type="button"
          onClick={onNext}
          className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-primary-container text-black font-headline-sm text-[16px] font-bold shadow-[0_0_24px_rgba(0,229,153,0.3)] hover:shadow-[0_0_32px_rgba(0,229,153,0.45)] transition-all flex items-center justify-center gap-2 group cursor-pointer"
        >
          <span>Continuar con este plan</span>
          <Icon name="arrow_forward" className="text-[20px] text-black font-bold group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}
