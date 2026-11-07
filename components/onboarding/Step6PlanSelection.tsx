'use client';

import React from 'react';
import { Icon } from '@/components/landing/primitives';
import { BillingCycle, OnboardingFormData, PlanTier } from './types';

interface Step6Props {
  formData: OnboardingFormData;
  updateField: <K extends keyof OnboardingFormData>(key: K, value: OnboardingFormData[K]) => void;
  onNext: () => void;
  onBack: () => void;
}

interface PlanConfig {
  id: PlanTier;
  title: string;
  badge: string;
  badgeColor?: string;
  monthlyPrice: number;
  annualPrice: number;
  annualTotal: number;
  description: string;
  targetBadge?: string;
  featuresTitle: string;
  features: string[];
  isRecommended?: boolean;
}

const PLANS: PlanConfig[] = [
  {
    id: 'starter',
    title: 'Starter',
    badge: 'Equipos Ágiles',
    monthlyPrice: 19,
    annualPrice: 15,
    annualTotal: 180,
    description: 'Ideal para startups que inician la automatización de rendiciones básicas.',
    featuresTitle: 'Incluye:',
    features: [
      'Hasta 10 miembros activos',
      'Rendición de viáticos con OCR básico',
      'Flujo de aprobación simple (1 nivel)',
      'Exportación Excel y PDF',
    ],
  },
  {
    id: 'business',
    title: 'Business',
    badge: 'Más Vendido',
    badgeColor: 'bg-tertiary-container text-on-tertiary-container',
    monthlyPrice: 49,
    annualPrice: 39,
    annualTotal: 468,
    targetBadge: '11 - 30 empleados',
    description:
      'Gestión integral de viáticos, emisión de tarjetas corporativas virtuales y conciliación bancaria instantánea.',
    featuresTitle: 'Todo lo de Starter, más:',
    features: [
      'Hasta 50 colaboradores incluidos',
      'Tarjetas Rendy Visa Corporativas Virtuales',
      'Reglas y políticas de gastos automatizadas',
      'Aprobación multinivel por departamento',
      'Integración contable API & ERP',
    ],
    isRecommended: true,
  },
  {
    id: 'enterprise',
    title: 'Enterprise',
    badge: 'Corporativo',
    badgeColor: 'bg-secondary-container/20 text-secondary',
    monthlyPrice: 99,
    annualPrice: 79,
    annualTotal: 948,
    description: 'Grandes corporaciones con requerimientos de auditoría y soporte continuo.',
    featuresTitle: 'Todo lo de Business, más:',
    features: [
      'Usuarios ilimitados y multi-razón social',
      'Manejo multi-divisa automático y FOREX',
      'Auditoría de cumplimiento SOC-2 & SLA 99.9%',
      'Gerente de cuenta & soporte 24/7 VIP',
    ],
  },
];

/**
 * @name Step6PlanSelection
 * @description [Business Logic]: Presents tailored subscription tiers tailored to the team size,
 * transparently calculating monthly vs. 20% annual savings before entering zero-dollar trial checkout.
 */
export function Step6PlanSelection({ formData, updateField, onNext, onBack }: Step6Props) {
  const isAnnual = formData.billingCycle === 'annual';

  const handleSelectPlan = (planId: PlanTier) => {
    updateField('selectedPlan', planId);
  };

  const currentPlan = PLANS.find((p) => p.id === formData.selectedPlan) || PLANS[1];
  const currentPrice = isAnnual ? currentPlan.annualPrice : currentPlan.monthlyPrice;
  const cycleLabel = isAnnual ? 'Anual' : 'Mensual';

  return (
    <div className="w-full max-w-5xl mx-auto transition-opacity duration-300">
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
      <div className="text-center max-w-2xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container border border-surface-container-high/60 mb-4 text-on-surface-variant">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary font-bold">
            Recomendación Personalizada
          </span>
        </div>
        <h1 className="font-headline-lg text-headline-lg sm:text-headline-xl text-on-surface mb-3 tracking-tight font-bold">
          Elige cómo quieres gestionar tu empresa
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">
          Encontramos algunas opciones para ti. Según el tamaño de tu equipo ({formData.selectedCompanySize || '11-30 colaboradores'}), esta es nuestra recomendación.
        </p>
      </div>

      {/* Segmented Billing Period Toggle */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
        <div className="bg-surface-container p-1 rounded-full flex items-center shadow-inner border border-surface-container-high/60">
          <button
            type="button"
            onClick={() => updateField('billingCycle', 'monthly')}
            className={`px-5 py-2 rounded-full font-label-md text-label-md transition-all cursor-pointer ${
              !isAnnual
                ? 'bg-surface-bright text-on-surface shadow-md font-bold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Facturación mensual
          </button>
          <button
            type="button"
            onClick={() => updateField('billingCycle', 'annual')}
            className={`px-5 py-2 rounded-full font-label-md text-label-md transition-all flex items-center gap-2 cursor-pointer ${
              isAnnual
                ? 'bg-surface-bright text-on-surface shadow-md font-bold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span>Facturación anual</span>
            <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary font-label-sm text-label-sm uppercase tracking-wide font-bold">
              Ahorra 20%
            </span>
          </button>
        </div>
      </div>

      {/* 3 Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch mb-8">
        {PLANS.map((plan) => {
          const isSelected = formData.selectedPlan === plan.id;
          const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;
          const billingSubtext = isAnnual
            ? `Facturado anualmente (USD ${plan.annualTotal}/año)`
            : 'Facturado mensualmente';

          if (plan.isRecommended) {
            return (
              <div
                key={plan.id}
                onClick={() => handleSelectPlan(plan.id)}
                className={`plan-card relative cursor-pointer rounded-2xl bg-surface-container-low p-6 sm:p-7 flex flex-col justify-between border transition-all duration-300 ${
                  isSelected
                    ? 'border-primary-container shadow-[0_0_35px_rgba(0,229,153,0.22)] -translate-y-2'
                    : 'border-surface-container-high/80 hover:-translate-y-1 shadow-md'
                }`}
              >
                {/* Ambient Glow Pin */}
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20">
                  <span className="px-3 py-1 rounded-full bg-primary-container text-on-primary-container font-label-sm text-label-sm uppercase tracking-wider font-extrabold shadow-md flex items-center gap-1 border border-primary-container/30">
                    <Icon name="auto_awesome" className="text-[14px]" /> Recomendado para tu empresa
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4 mt-2">
                    <div className="flex items-center gap-2">
                      <span className="font-label-sm text-label-sm tracking-wider uppercase text-primary font-bold">
                        {plan.title}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-tertiary-container text-on-tertiary-container font-label-sm text-label-sm font-bold uppercase tracking-wider">
                        {plan.badge}
                      </span>
                    </div>
                    {plan.targetBadge && (
                      <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-md font-semibold border border-primary/20">
                        {plan.targetBadge}
                      </span>
                    )}
                  </div>

                  <div className="mb-4">
                    <div className="flex items-baseline gap-1">
                      <span className="font-headline-sm text-headline-sm text-on-surface font-normal">USD</span>
                      <span className="font-numeric-metric text-numeric-metric text-primary font-extrabold text-4xl">
                        {price}
                      </span>
                      <span className="text-on-surface-variant text-body-md font-body-md">/mes</span>
                    </div>
                    <p className="text-xs text-primary/80 mt-0.5">{billingSubtext}</p>
                  </div>

                  <p className="font-body-md text-body-md text-on-surface mb-6 leading-relaxed">
                    {plan.description}
                  </p>

                  <div className="space-y-3 pt-4 bg-surface-container/60 -mx-6 sm:-mx-7 px-6 sm:px-7 pb-6 rounded-b-xl border-t border-surface-container-high/40">
                    <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
                      {plan.featuresTitle}
                    </div>
                    {plan.features.map((feat) => (
                      <div key={feat} className="flex items-start gap-2.5 text-sm text-on-surface">
                        <Icon name="verified" className="text-primary text-[18px] shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 pt-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectPlan(plan.id);
                      onNext();
                    }}
                    className="w-full py-3.5 rounded-full bg-primary-container text-on-primary-container font-headline-sm text-[15px] font-bold shadow-[0_0_24px_rgba(0,229,153,0.35)] hover:shadow-[0_0_32px_rgba(0,229,153,0.5)] transition-all flex items-center justify-center gap-2 group cursor-pointer"
                  >
                    <span>Continuar con Business</span>
                    <Icon name="arrow_forward" className="text-[18px] group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            );
          }

          // Regular Starter or Enterprise Card
          return (
            <div
              key={plan.id}
              onClick={() => handleSelectPlan(plan.id)}
              className={`plan-card cursor-pointer rounded-2xl bg-surface-container p-6 sm:p-7 flex flex-col justify-between transition-all duration-200 border ${
                isSelected
                  ? 'border-primary-container shadow-[0_0_30px_rgba(0,229,153,0.18)] -translate-y-2'
                  : 'border-surface-container-high/60 hover:-translate-y-1 shadow-md'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-label-sm text-label-sm tracking-wider uppercase text-on-surface-variant font-bold">
                    {plan.title}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${
                      plan.badgeColor || 'bg-surface-container-high text-on-surface-variant'
                    }`}
                  >
                    {plan.badge}
                  </span>
                </div>

                <div className="mb-4">
                  <div className="flex items-baseline gap-1">
                    <span className="font-headline-sm text-headline-sm text-on-surface font-normal">USD</span>
                    <span className="font-numeric-metric text-numeric-metric text-on-surface font-extrabold text-4xl">
                      {price}
                    </span>
                    <span className="text-on-surface-variant text-body-md font-body-md">/mes</span>
                  </div>
                  <p className="text-xs text-on-surface-variant/70 mt-0.5">{billingSubtext}</p>
                </div>

                <p className="font-body-md text-body-md text-on-surface-variant mb-6 leading-relaxed">
                  {plan.description}
                </p>

                <div className="space-y-3 pt-4 bg-surface-container-lowest/30 -mx-6 sm:-mx-7 px-6 sm:px-7 pb-6 rounded-b-xl border-t border-surface-container-high/30">
                  <div className="text-xs font-semibold text-on-surface uppercase tracking-wider mb-2">
                    {plan.featuresTitle}
                  </div>
                  {plan.features.map((feat) => (
                    <div key={feat} className="flex items-start gap-2.5 text-sm text-on-surface">
                      <Icon
                        name="check"
                        className={`text-[18px] shrink-0 mt-0.5 ${
                          plan.id === 'enterprise' ? 'text-secondary' : 'text-primary'
                        }`}
                      />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-4">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectPlan(plan.id);
                  }}
                  className={`w-full py-3 rounded-full font-label-md text-label-md transition-all font-semibold flex items-center justify-center gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-primary-container text-on-primary-container font-bold shadow-md'
                      : 'bg-surface-container-high hover:bg-surface-bright text-on-surface'
                  }`}
                >
                  <span>{isSelected ? `Plan ${plan.title} seleccionado` : `Elegir ${plan.title}`}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trust & Free Trial Banner */}
      <div className="w-full bg-surface-container border border-surface-container-high/60 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 shadow-sm">
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
        <div className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant shrink-0 bg-surface-container-low border border-surface-container-high/40 px-3 py-1.5 rounded-full">
          <Icon name="lock" className="text-primary text-[16px]" />
          <span>Cancelación en 1-clic</span>
        </div>
      </div>

      {/* Footer Action CTA */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-surface-container-high/40">
        <div className="text-xs text-on-surface-variant text-center sm:text-left">
          Plan seleccionado actualmente:{' '}
          <span className="font-bold text-primary">
            {currentPlan.title} {cycleLabel} (USD {currentPrice}/mes)
          </span>
        </div>

        <button
          type="button"
          onClick={onNext}
          className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-primary-container text-on-primary-container font-headline-sm text-[16px] font-bold shadow-[0_0_24px_rgba(0,229,153,0.3)] hover:shadow-[0_0_32px_rgba(0,229,153,0.45)] transition-all flex items-center justify-center gap-2 group cursor-pointer"
        >
          <span>Continuar con este plan</span>
          <Icon name="arrow_forward" className="text-[20px] group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}

