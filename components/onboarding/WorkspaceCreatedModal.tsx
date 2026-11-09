'use client';

import React from 'react';
import { Icon } from '@/components/landing/primitives';
import { OnboardingFormData } from './types';

interface WorkspaceCreatedModalProps {
  isOpen: boolean;
  formData: OnboardingFormData;
  onContinue: () => void;
}

/**
 * @name WorkspaceCreatedModal
 * @description [Business Logic]: Celebratory checkpoint dialog establishing the initialized
 * company ledger, cryptographic vault, and directing the creator to assume administrative custody.
 */
export function WorkspaceCreatedModal({
  isOpen,
  formData,
  onContinue,
}: WorkspaceCreatedModalProps) {
  if (!isOpen) return null;

  // Calculate initials from legal company name
  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'RD';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const initials = getInitials(formData.companyLegalName || 'Acme Solutions');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-container-lowest/80 backdrop-blur-md animate-fade-in">
      <div className="bg-surface-container-low max-w-lg w-full rounded-3xl p-6 sm:p-8 md:p-10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] border border-surface-container-high/60 flex flex-col gap-6 relative overflow-hidden transform transition-transform animate-in zoom-in-95">
        {/* Glow ambient circle */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-primary-container/20 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between">
          <div className="w-12 h-12 rounded-2xl bg-primary-container/20 text-primary-container flex items-center justify-center shadow-md">
            <Icon name="check_circle" className="text-[30px]" />
          </div>
          <span className="px-3 py-1 rounded-full bg-primary-container/15 text-primary-container border border-primary-container/30 font-mono text-[11px] font-semibold uppercase tracking-wider">
            Espacio Creado
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <h3 className="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight">
            ¡Tu empresa ya tiene su espacio en Rendy!
          </h3>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Hemos inicializado con éxito la bóveda y el ledger operativo para tu equipo con la infraestructura lista.
          </p>
        </div>

        {/* Workspace Summary Card */}
        <div className="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container-high/40 flex flex-col gap-3 shadow-inner">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center font-bold text-primary font-headline-sm border border-primary-container/30">
              <span>{initials}</span>
            </div>
            <div className="flex flex-col">
              <span className="font-headline-sm text-[16px] font-bold text-on-surface">
                {formData.companyLegalName || 'Acme Solutions C.A.'}
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-container" />
                ID: <span className="font-mono text-on-surface">{formData.companyTaxId || 'J-50493821-0'}</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 bg-surface-container-low/50 p-2.5 rounded-xl text-label-sm font-label-sm border border-surface-container-high/30">
            <div>
              <span className="text-on-surface-variant/70 block text-[11px]">Industria:</span>
              <span className="text-on-surface font-semibold">
                {formData.selectedIndustry || 'Tecnología & SaaS'}
              </span>
            </div>
            <div>
              <span className="text-on-surface-variant/70 block text-[11px]">Dimensión:</span>
              <span className="text-on-surface font-semibold">
                {formData.selectedCompanySize || 'STARTER (11-30)'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <p className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1.5">
            <Icon name="info" className="text-secondary text-[16px] flex-shrink-0" />
            <span>Ahora solo resta vincularte a ti como el Creador y Administrador Principal.</span>
          </p>

          <button
            type="button"
            onClick={onContinue}
            className="w-full py-3.5 rounded-full bg-primary-container text-black font-headline-sm text-[15px] font-bold shadow-[0_0_24px_rgba(0,229,153,0.35)] hover:shadow-[0_0_36px_rgba(0,229,153,0.5)] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Crear mi Perfil de Administrador</span>
            <Icon name="arrow_forward" className="text-[18px] text-black font-bold" />
          </button>
        </div>
      </div>
    </div>
  );
}

