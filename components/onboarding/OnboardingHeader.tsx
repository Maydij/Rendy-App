'use client';

import React from 'react';
import Link from 'next/link';
import { RendyLogo } from '@/components/rendy-logo';
import { Icon } from '@/components/landing/primitives';

interface OnboardingHeaderProps {
  currentStep: number;
  onNavigateStage: (targetStage: 1 | 2) => void;
}

/**
 * @name OnboardingHeader
 * @description [Business Logic]: Renders the sticky top brand header with cryptographic
 * security validation badges and multi-stage workflow status indicators.
 */
export function OnboardingHeader({ currentStep, onNavigateStage }: OnboardingHeaderProps) {
  const isStageOne = currentStep <= 5;

  return (
    <header className="relative z-20 w-full bg-surface-container-lowest/80 backdrop-blur-xl border-b border-surface-container-high/40 shadow-[0_1px_8px_rgba(0,0,0,0.4)]">
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-20 flex items-center justify-between">
        {/* Brand Lockup */}
        <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-90">
          <RendyLogo variant="full" theme="dark" className="h-8 w-auto" />
        </Link>

        {/* Stepper Stage Tabs */}
        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-1 bg-surface-container-low/60 p-1 rounded-full border border-surface-container-high/60 backdrop-blur-md">
            {/* Stage 1 Pill */}
            <button
              type="button"
              onClick={() => onNavigateStage(1)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full font-label-md transition-all ${
                isStageOne
                  ? 'bg-primary-container text-black font-bold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span
                className={`flex items-center justify-center w-5 h-5 rounded-full font-label-sm text-label-sm ${
                  isStageOne
                    ? 'bg-black/15 text-black font-bold'
                    : 'bg-primary/20 text-primary font-bold'
                }`}
              >
                {!isStageOne ? <Icon name="check" className="text-[12px]" /> : '1'}
              </span>
              <span className="hidden lg:inline">Organización & Administrador</span>
              <span className="lg:hidden">Etapa 1</span>
            </button>

            <div className="w-3 h-[1px] bg-surface-container-high" />

            {/* Stage 2 Pill */}
            <button
              type="button"
              onClick={() => onNavigateStage(2)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full font-label-md transition-all ${
                !isStageOne
                  ? 'bg-primary-container text-black font-bold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span
                className={`flex items-center justify-center w-5 h-5 rounded-full font-label-sm text-label-sm ${
                  !isStageOne
                    ? 'bg-black/15 text-black font-bold'
                    : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                2
              </span>
              <span className="hidden lg:inline">Plan & Checkout</span>
              <span className="lg:hidden">Etapa 2</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}

