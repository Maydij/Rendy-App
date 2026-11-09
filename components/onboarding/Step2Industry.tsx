'use client';

import React from 'react';
import { Icon } from '@/components/landing/primitives';
import { OnboardingFormData } from './types';

interface Step2Props {
  formData: OnboardingFormData;
  updateField: <K extends keyof OnboardingFormData>(key: K, value: OnboardingFormData[K]) => void;
  onNext: () => void;
  onBack: () => void;
}

interface IndustryOption {
  id: string;
  name: string;
  subtitle: string;
  icon: string;
}

const INDUSTRIES: IndustryOption[] = [
  {
    id: 'Tecnología & SaaS',
    name: 'Tecnología & SaaS',
    subtitle: 'Software, Data, IA',
    icon: 'terminal',
  },
  {
    id: 'Comercio & Retail',
    name: 'Comercio & Retail',
    subtitle: 'Venta minorista y e-comm',
    icon: 'storefront',
  },
  {
    id: 'Servicios Profesionales',
    name: 'Servicios Prof.',
    subtitle: 'Consultoría, Legal, Fin',
    icon: 'business_center',
  },
  {
    id: 'Logística & Envíos',
    name: 'Logística',
    subtitle: 'Fletes, Flota y Distribución',
    icon: 'local_shipping',
  },
  {
    id: 'Manufactura',
    name: 'Manufactura',
    subtitle: 'Plantas y Bienes físicos',
    icon: 'factory',
  },
  {
    id: 'Salud & Medicina',
    name: 'Salud & Clínicas',
    subtitle: 'Farmacia, Atención médica',
    icon: 'health_and_safety',
  },
];

/**
 * @name Step2Industry
 * @description [Business Logic]: Categorizes the enterprise into operating industry domains
 * to dynamically optimize fiscal categorization, travel rules, and card spending limits.
 */
export function Step2Industry({ formData, updateField, onNext, onBack }: Step2Props) {
  return (
    <section className="step-pane w-full transition-all duration-300">
      <div className="bg-surface-container-low rounded-2xl p-6 sm:p-8 md:p-10 shadow-2xl border border-surface-container-high/40 flex flex-col gap-6 relative overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-semibold">
              Paso 2 • Clasificación Operativa
            </span>
            <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight">
              ¿En qué industria opera tu empresa?
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Personalizamos las políticas de gastos, categorías contables y límites de tarjetas según tu sector.
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-secondary shadow-inner flex-shrink-0">
            <Icon name="category" className="text-[28px]" />
          </div>
        </div>

        {/* 6 Industry Options Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
          {INDUSTRIES.map((ind) => {
            const isSelected = formData.selectedIndustry === ind.id;

            return (
              <button
                key={ind.id}
                type="button"
                onClick={() => updateField('selectedIndustry', ind.id)}
                className={`p-4 rounded-xl bg-surface-container-lowest hover:bg-surface-container flex flex-col items-start gap-3 text-left transition-all group shadow-sm border border-surface-container-high/40 cursor-pointer ${
                  isSelected ? 'ring-2 ring-primary-container/80 bg-surface-container/70' : ''
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform ${
                    isSelected
                      ? 'bg-primary-container/15 text-primary-container'
                      : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  <Icon name={ind.icon} className="text-[20px]" />
                </div>
                <div>
                  <div className="font-headline-sm text-[15px] font-bold text-on-surface">{ind.name}</div>
                  <div className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">
                    {ind.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-surface-container-high/30">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 rounded-full text-on-surface-variant hover:text-on-surface font-label-md text-label-md flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Icon name="arrow_back" className="text-[18px]" />
            <span>Volver</span>
          </button>

          <button
            type="button"
            onClick={onNext}
            className="px-6 py-3 rounded-full bg-primary-container text-black font-headline-sm text-[15px] font-bold shadow-[0_0_24px_rgba(0,229,153,0.35)] hover:shadow-[0_0_32px_rgba(0,229,153,0.5)] hover:-translate-y-0.5 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            <span>Continuar</span>
            <Icon name="arrow_forward" className="text-[18px] text-black font-bold" />
          </button>
        </div>
      </div>
    </section>
  );
}

