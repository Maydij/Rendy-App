'use client';

import React from 'react';
import { Icon } from '@/components/landing/primitives';

interface OnboardingProgressProps {
  currentStep: number;
  onGoToStep: (step: number) => void;
  onOpenWorkspaceModal?: () => void;
}

const STEP_PERCENTAGES: Record<number, number> = {
  1: 14,
  2: 28,
  3: 42,
  4: 57,
  5: 71,
  6: 86,
  7: 100,
};

const STAGE_ONE_PILLS = [
  { step: 1, label: 'Empresa' },
  { step: 2, label: 'Industria' },
  { step: 3, label: 'Tamaño' },
  { step: 4, label: 'Admin' },
  { step: 5, label: 'Permisos' },
];

/**
 * @name OnboardingProgress
 * @description [Business Logic]: Multi-segment progress visualizer that transparently displays
 * completion metrics, stage categorization, and interactive checkpoints for the customer.
 */
export function OnboardingProgress({
  currentStep,
  onGoToStep,
  onOpenWorkspaceModal,
}: OnboardingProgressProps) {
  const isStageOne = currentStep <= 5;
  const progressPercent = STEP_PERCENTAGES[currentStep] || 14;

  if (isStageOne) {
    return (
      <div className="w-full max-w-4xl mx-auto flex flex-col gap-3 mb-8 sm:mb-10 animate-fade-in">
        {/* Top Breadcrumb & Metadata */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-container/10 border border-primary-container/20 text-primary-container font-label-sm text-label-sm tracking-wider uppercase font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse" />
              Etapa 1 de 2
            </span>
            <span className="font-label-md text-label-md text-on-surface-variant font-medium">
              Configuración de Organización y Administrador
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-label-md text-label-md text-primary font-semibold">
              Paso {currentStep} de 7
            </span>
            <span className="text-on-surface-variant/40 text-label-sm font-label-sm">•</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              {progressPercent}% completado
            </span>
          </div>
        </div>

        {/* Dynamic Multi-Color Progress Fill */}
        <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden relative shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-primary-container via-secondary to-primary transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Step Navigation Pills */}
        <div className="flex items-center justify-between pt-1 overflow-x-auto no-scrollbar gap-2 text-center">
          {STAGE_ONE_PILLS.map((item, index) => {
            const isActive = item.step === currentStep;
            const isCompleted = item.step < currentStep;

            return (
              <React.Fragment key={item.step}>
                <button
                  type="button"
                  onClick={() => onGoToStep(item.step)}
                  className={`step-nav-pill px-3 py-1 rounded-full font-label-sm text-label-sm transition-all flex items-center gap-1.5 flex-shrink-0 ${
                    isActive
                      ? 'text-on-surface bg-surface-container-high shadow-sm font-bold border border-primary-container/30'
                      : isCompleted
                      ? 'text-on-surface/80 bg-surface-container/60 hover:bg-surface-container'
                      : 'text-on-surface-variant hover:text-on-surface bg-surface-container/40'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isActive
                        ? 'bg-primary-container text-black'
                        : isCompleted
                        ? 'bg-primary/20 text-primary'
                        : 'bg-surface-container-high text-on-surface-variant'
                    }`}
                  >
                    {isCompleted ? '✓' : item.step}
                  </span>
                  <span>{item.label}</span>
                </button>

                {/* Optional checkpoint modal button between step 3 and 4 */}
                {item.step === 3 && onOpenWorkspaceModal && (
                  <>
                    <div className="w-3 h-[1px] bg-surface-container-high flex-shrink-0 hidden sm:block" />
                    <button
                      type="button"
                      onClick={onOpenWorkspaceModal}
                      className="step-nav-pill px-3 py-1 rounded-full font-label-sm text-label-sm text-secondary hover:text-secondary-fixed bg-secondary-container/10 border border-secondary/20 transition-all flex items-center gap-1.5 flex-shrink-0"
                    >
                      <Icon name="hub" className="text-[13px]" />
                      <span>Espacio Listo</span>
                    </button>
                  </>
                )}

                {index < STAGE_ONE_PILLS.length - 1 && item.step !== 3 && (
                  <div className="w-3 h-[1px] bg-surface-container-high flex-shrink-0 hidden sm:block" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  }

  // Stage 2 (Steps 6 & 7)
  return (
    <div className="w-full max-w-5xl mx-auto mb-8 sm:mb-10 animate-fade-in">
      {/* Breadcrumb meta */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-secondary-container/20 border border-secondary/30 text-secondary-fixed-dim font-label-sm text-label-sm tracking-widest uppercase font-semibold">
            Etapa 2 · Contratación del Plan
          </span>
          <span className="text-on-surface-variant/40 text-xs">/</span>
          <span className="text-on-surface-variant font-label-md text-label-md font-semibold">
            Paso {currentStep} de 7
          </span>
        </div>

        <div className="flex items-center gap-2 font-label-sm text-label-sm tracking-wider uppercase text-on-surface-variant/70">
          <button
            type="button"
            onClick={() => onGoToStep(1)}
            className="text-primary hover:underline flex items-center gap-1 font-semibold"
          >
            <Icon name="check_circle" className="text-[16px]" /> Configuración Empresa
          </button>
          <span className="text-on-surface-variant/30">━━━━━━━━━</span>
          <span className="text-primary font-bold">
            {currentStep === 6 ? 'Selección de Plan' : 'Checkout & Activación'}
          </span>
        </div>
      </div>

      {/* Multi-segment Progress Bar */}
      <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden flex shadow-inner">
        <div
          className="h-full bg-gradient-to-r from-secondary to-primary-container rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Direct Step Switcher */}
      <div className="flex items-center justify-between mt-3 text-on-surface-variant font-label-sm text-label-sm">
        <button
          type="button"
          onClick={() => onGoToStep(6)}
          className={`flex items-center gap-1.5 transition-colors font-semibold py-1 ${
            currentStep === 6 ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              currentStep === 6
                ? 'bg-primary/20 text-primary'
                : 'bg-primary-container text-black'
            }`}
          >
            {currentStep > 6 ? '✓' : '6'}
          </span>
          <span>Paso 6: Selección de Plan</span>
        </button>

        <div className="h-px bg-surface-container-high flex-1 mx-4" />

        <button
          type="button"
          onClick={() => onGoToStep(7)}
          className={`flex items-center gap-1.5 transition-colors py-1 ${
            currentStep === 7
              ? 'text-primary font-semibold'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              currentStep === 7
                ? 'bg-primary/20 text-primary'
                : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            7
          </span>
          <span>Paso 7: Checkout & Activación 7 Días</span>
        </button>
      </div>
    </div>
  );
}

