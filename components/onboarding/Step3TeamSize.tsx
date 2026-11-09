'use client';

import React from 'react';
import { Icon } from '@/components/landing/primitives';
import { OnboardingFormData } from './types';

interface Step3Props {
  formData: OnboardingFormData;
  updateField: <K extends keyof OnboardingFormData>(key: K, value: OnboardingFormData[K]) => void;
  onSubmitCreateWorkspace: () => void;
  onBack: () => void;
}

interface TeamTier {
  tierNumber: string;
  name: string;
  range: string;
  description: string;
  recommended?: boolean;
}

const TEAM_TIERS: TeamTier[] = [
  {
    tierNumber: 'Tier 01',
    name: 'BABY',
    range: '2 - 10 personas',
    description: 'Equipos ágiles',
  },
  {
    tierNumber: 'Tier 02',
    name: 'STARTER',
    range: '11 - 30 personas',
    description: 'Recomendado para scaleups',
    recommended: true,
  },
  {
    tierNumber: 'Tier 03',
    name: 'GROWTH',
    range: '31 - 75 personas',
    description: 'Aceleración comercial',
  },
  {
    tierNumber: 'Tier 04',
    name: 'BUSINESS',
    range: '76 - 150 personas',
    description: 'Multi-departamento',
  },
  {
    tierNumber: 'Tier 05',
    name: 'ENTERPRISE',
    range: '151 - 300 personas',
    description: 'Control de centros de costo',
  },
  {
    tierNumber: 'Tier 06',
    name: 'CORPORATE',
    range: '> 300 personas',
    description: 'Gobernanza global',
  },
];

/**
 * @name Step3TeamSize
 * @description [Business Logic]: Evaluates organizational head count to scale corporate physical
 * & virtual card issuing quotas, automated approval ladders, and ERP ledger hierarchies.
 */
export function Step3TeamSize({
  formData,
  updateField,
  onSubmitCreateWorkspace,
  onBack,
}: Step3Props) {
  return (
    <section className="step-pane w-full transition-all duration-300">
      <div className="bg-surface-container-low rounded-2xl p-6 sm:p-8 md:p-10 shadow-2xl border border-surface-container-high/40 flex flex-col gap-6 relative overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm uppercase tracking-widest text-tertiary-fixed-dim font-semibold">
              Paso 3 • Dimensión de Equipo
            </span>
            <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight">
              ¿Cuántas personas forman tu equipo?
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Adecuamos la cantidad de tarjetas físicas, virtuales y flujos de aprobación multinivel.
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-tertiary shadow-inner flex-shrink-0">
            <Icon name="groups" className="text-[28px]" />
          </div>
        </div>

        {/* 6 Tier Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
          {TEAM_TIERS.map((tier) => {
            const tierValue = `${tier.name} ${tier.range.replace(' personas', '')}`;
            const isSelected =
              formData.selectedCompanySize === tierValue ||
              formData.selectedCompanySize.includes(tier.name);

            return (
              <button
                key={tier.name}
                type="button"
                onClick={() => updateField('selectedCompanySize', tierValue)}
                className={`p-4 rounded-xl bg-surface-container-lowest hover:bg-surface-container text-left transition-all group flex flex-col justify-between shadow-sm border border-surface-container-high/40 cursor-pointer min-h-[140px] ${
                  isSelected ? 'ring-2 ring-primary-container/80 bg-surface-container/70' : ''
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`font-label-sm text-label-sm tracking-widest uppercase font-mono ${
                      isSelected
                        ? 'text-primary-container font-semibold'
                        : 'text-on-surface-variant'
                    }`}
                  >
                    {tier.tierNumber}
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full transition-colors ${
                      isSelected
                        ? 'bg-primary-container'
                        : 'bg-surface-container-high group-hover:bg-primary-container'
                    }`}
                  />
                </div>

                <div className="my-2">
                  <div className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    {tier.name}
                  </div>
                  <div
                    className={`font-label-md text-label-md ${
                      isSelected ? 'text-primary font-semibold' : 'text-on-surface-variant'
                    }`}
                  >
                    {tier.range}
                  </div>
                </div>

                <span
                  className={`font-label-sm text-label-sm ${
                    isSelected ? 'text-on-surface-variant/90' : 'text-on-surface-variant/70'
                  }`}
                >
                  {tier.description}
                </span>
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
            onClick={onSubmitCreateWorkspace}
            className="px-6 py-3 rounded-full bg-primary-container text-black font-headline-sm text-[15px] font-bold shadow-[0_0_24px_rgba(0,229,153,0.35)] hover:shadow-[0_0_32px_rgba(0,229,153,0.5)] hover:-translate-y-0.5 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            <span>Crear espacio de empresa</span>
            <Icon name="rocket_launch" className="text-[18px] text-black font-bold" />
          </button>
        </div>
      </div>
    </section>
  );
}

