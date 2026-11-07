'use client';

import React from 'react';
import { Icon } from '@/components/landing/primitives';
import { OnboardingFormData } from './types';

interface Step1Props {
  formData: OnboardingFormData;
  updateField: <K extends keyof OnboardingFormData>(key: K, value: OnboardingFormData[K]) => void;
  onNext: () => void;
}

/**
 * @name Step1CompanyInfo
 * @description [Business Logic]: Captures verified corporate legal entity attributes,
 * commercial tax identifiers, and official headquarters for fiscal reporting compliance.
 */
export function Step1CompanyInfo({ formData, updateField, onNext }: Step1Props) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyLegalName.trim() || !formData.companyTaxId.trim()) {
      return;
    }
    onNext();
  };

  return (
    <section className="step-pane w-full transition-all duration-300">
      <div className="bg-surface-container-low rounded-2xl p-6 sm:p-8 md:p-10 shadow-2xl border border-surface-container-high/40 flex flex-col gap-6 relative overflow-hidden">
        {/* Step Header */}
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm uppercase tracking-widest text-primary-container font-semibold">
              Paso 1 • Identidad Legal
            </span>
            <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight">
              Información de la empresa
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Registra los datos fiscales con los que Rendy emitirá tus libros contables y tarjetas corporativas.
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary-container shadow-inner flex-shrink-0">
            <Icon name="apartment" className="text-[28px]" />
          </div>
        </div>

        {/* Legal Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Legal Business Name */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="company-legal-name"
              className="font-label-md text-label-md text-on-surface font-semibold flex items-center justify-between"
            >
              <span>Razón Social / Nombre Comercial</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant/70">Requerido</span>
            </label>
            <div className="relative">
              <input
                id="company-legal-name"
                type="text"
                required
                value={formData.companyLegalName}
                onChange={(e) => updateField('companyLegalName', e.target.value)}
                placeholder="Ej: Acme Global Technologies S.A."
                className="w-full bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/40 rounded-xl px-4 py-3 text-body-md font-body-md focus:outline-none focus:ring-2 focus:ring-primary-container/40 pl-11 shadow-inner border border-surface-container-high/40 transition-all"
              />
              <Icon
                name="domain"
                className="absolute left-3.5 top-3.5 text-on-surface-variant text-[20px]"
              />
            </div>
          </div>

          {/* Tax ID & Operating Country */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Tax ID */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="company-tax-id"
                className="font-label-md text-label-md text-on-surface font-semibold flex items-center justify-between"
              >
                <span>RIF / Tax ID / NIT</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant/70">Fiscal</span>
              </label>
              <div className="relative">
                <input
                  id="company-tax-id"
                  type="text"
                  required
                  value={formData.companyTaxId}
                  onChange={(e) => updateField('companyTaxId', e.target.value)}
                  placeholder="J-12345678-9"
                  className="w-full bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/40 rounded-xl px-4 py-3 text-body-md font-body-md focus:outline-none focus:ring-2 focus:ring-primary-container/40 pl-11 shadow-inner font-mono border border-surface-container-high/40 transition-all"
                />
                <Icon
                  name="badge"
                  className="absolute left-3.5 top-3.5 text-on-surface-variant text-[20px]"
                />
              </div>
            </div>

            {/* Operating Country */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="company-country" className="font-label-md text-label-md text-on-surface font-semibold">
                País de Operación Principal
              </label>
              <div className="relative">
                <select
                  id="company-country"
                  value={formData.companyCountry}
                  onChange={(e) => updateField('companyCountry', e.target.value)}
                  className="w-full bg-surface-container-lowest text-on-surface rounded-xl px-4 py-3 text-body-md font-body-md focus:outline-none focus:ring-2 focus:ring-primary-container/40 pl-11 appearance-none shadow-inner cursor-pointer border border-surface-container-high/40 transition-all"
                >
                  <option value="VE">Venezuela (USD / VES)</option>
                  <option value="US">Estados Unidos (USD / ACH)</option>
                  <option value="CO">Colombia (COP / ACH)</option>
                  <option value="MX">México (MXN / SPEI)</option>
                  <option value="PA">Panamá (USD)</option>
                </select>
                <Icon
                  name="public"
                  className="absolute left-3.5 top-3.5 text-on-surface-variant text-[20px]"
                />
                <Icon
                  name="expand_more"
                  className="absolute right-3.5 top-3.5 text-on-surface-variant text-[18px] pointer-events-none"
                />
              </div>
            </div>
          </div>

          {/* Sede Principal / Fiscal Address */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="company-address" className="font-label-md text-label-md text-on-surface font-semibold">
              Sede Principal
            </label>
            <div className="relative">
              <input
                id="company-address"
                type="text"
                value={formData.companyAddress}
                onChange={(e) => updateField('companyAddress', e.target.value)}
                placeholder="Calle, Edificio, Ciudad"
                className="w-full bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/40 rounded-xl px-4 py-3 text-body-md font-body-md focus:outline-none focus:ring-2 focus:ring-primary-container/40 pl-11 shadow-inner border border-surface-container-high/40 transition-all"
              />
              <Icon
                name="location_on"
                className="absolute left-3.5 top-3.5 text-on-surface-variant text-[20px]"
              />
            </div>
          </div>

          {/* Micro Trust Badge */}
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-container/60 border border-surface-container-high/50 mt-1">
            <Icon name="verified_user" className="text-primary text-[18px] flex-shrink-0" />
            <p className="font-label-sm text-label-sm text-on-surface-variant leading-relaxed">
              Datos cifrados mediante grado bancario AES-256. Rendy procesa y resguarda tu expediente contable de
              conformidad con estándares SOC-2.
            </p>
          </div>

          {/* Action CTA */}
          <div className="flex items-center justify-between pt-4 mt-1 border-t border-surface-container-high/30">
            <span className="text-on-surface-variant text-label-sm font-label-sm font-medium">
              Paso 1 de 7
            </span>
            <button
              type="submit"
              className="px-6 py-3 rounded-full bg-primary-container text-on-primary-container font-headline-sm text-[15px] font-bold shadow-[0_0_24px_rgba(0,229,153,0.35)] hover:shadow-[0_0_32px_rgba(0,229,153,0.5)] hover:-translate-y-0.5 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>Continuar</span>
              <Icon name="arrow_forward" className="text-[18px]" />
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

