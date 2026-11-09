'use client';

import React, { useState } from 'react';
import { Icon } from '@/components/landing/primitives';
import { OnboardingFormData } from './types';

interface Step7Props {
  formData: OnboardingFormData;
  updateField: <K extends keyof OnboardingFormData>(key: K, value: OnboardingFormData[K]) => void;
  onSubmitCheckout: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}

const PLAN_META: Record<string, { name: string; monthly: number; annual: number; annualTotal: number }> = {
  starter: { name: 'Starter', monthly: 19, annual: 15, annualTotal: 180 },
  business: { name: 'Business', monthly: 49, annual: 39, annualTotal: 468 },
  enterprise: { name: 'Enterprise', monthly: 99, annual: 79, annualTotal: 948 },
};

/**
 * @name Step7Checkout
 * @description [Business Logic]: Zero-charge authorization gateway capturing tokenized payment
 * credentials, detailing the 7-day trial milestone timeline, and guaranteeing 1-click cancellation.
 */
export function Step7Checkout({
  formData,
  updateField,
  onSubmitCheckout,
  onBack,
  isSubmitting,
}: Step7Props) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isAnnual = formData.billingCycle === 'annual';
  const planInfo = PLAN_META[formData.selectedPlan] || PLAN_META.business;
  const price = isAnnual ? planInfo.annual : planInfo.monthly;
  const cycleName = isAnnual ? 'Anual' : 'Mensual';
  const regularTotalPrice = isAnnual
    ? `USD ${planInfo.annualTotal},00 / año`
    : `USD ${planInfo.monthly},00 / mes`;

  // Determine card brand from number
  const cleanCardNumber = formData.cardNumber.replace(/\D/g, '');
  const isVisa = cleanCardNumber.startsWith('4');
  const isMaster = cleanCardNumber.startsWith('5');
  const isAmex = cleanCardNumber.startsWith('3');

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    const formatted = rawVal.match(/.{1,4}/g)?.join(' ') || rawVal;
    updateField('cardNumber', formatted);
  };

  const handleExpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let rawVal = e.target.value.replace(/\D/g, '');
    if (rawVal.length >= 3) {
      rawVal = rawVal.substring(0, 2) + '/' + rawVal.substring(2, 4);
    }
    updateField('cardExp', rawVal);
  };

  const handleCvcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    updateField('cardCvc', rawVal);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.termsAccepted) {
      setErrorMsg('Por favor, acepta los Términos y Condiciones para activar tu prueba gratuita.');
      return;
    }
    setErrorMsg(null);
    onSubmitCheckout();
  };

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
          <span>Volver a cambiar de plan</span>
        </button>
      </div>

      {/* Headline & Subtitle */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-container/15 text-secondary border border-secondary/25 mb-3">
          <Icon name="lock" className="text-[16px]" />
          <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold">
            Procesamiento Bancario Cifrado
          </span>
        </div>
        <h1 className="font-headline-lg text-headline-lg sm:text-headline-xl text-on-surface mb-2 tracking-tight font-bold">
          Tu empresa está a un paso de comenzar
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">
          Configura tu método de pago y disfruta de siete días de acceso gratuito e ilimitado a Rendy.
        </p>
      </div>

      {/* Top Banner: Today you pay $0.00 */}
      <div className="w-full bg-gradient-to-r from-primary/10 via-surface-container to-secondary/10 border border-primary/25 p-4 sm:p-5 rounded-2xl mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary text-black flex items-center justify-center shrink-0 font-bold shadow-md">
            <Icon name="celebration" className="text-[26px] text-black font-bold" />
          </div>
          <div>
            <div className="font-headline-sm text-headline-sm text-on-surface font-extrabold flex items-center gap-2">
              Hoy pagas USD 0,00
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/20 text-primary uppercase border border-primary/30">
                Cero Cargos Inmediatos
              </span>
            </div>
            <p className="text-xs sm:text-sm text-on-surface-variant">
              Tu período de prueba gratuita de 7 días comienza inmediatamente al activar tu cuenta.
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-xs uppercase font-semibold text-on-surface-variant/80">Plan a activar</div>
          <div className="font-bold text-primary font-headline-sm text-[16px]">
            {planInfo.name} {cycleName}
          </div>
        </div>
      </div>

      {/* Two-column Checkout Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-8">
        {/* Column 1: Payment Form (7 Cols) */}
        <div className="lg:col-span-7 bg-surface-container rounded-2xl p-6 sm:p-8 shadow-xl border border-surface-container-high/60">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-surface-container-high/60">
            <div className="flex items-center gap-2.5">
              <Icon name="credit_card" className="text-primary text-[22px]" />
              <span className="font-headline-sm text-[18px] text-on-surface font-bold">
                Tarjeta de Débito o Crédito
              </span>
            </div>
            {/* Brand Indicators */}
            <div className="flex items-center gap-1.5 opacity-90">
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                  isVisa
                    ? 'bg-primary text-black shadow-sm'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                VISA
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                  isMaster
                    ? 'bg-tertiary-container text-on-tertiary-container shadow-sm'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                MC
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                  isAmex
                    ? 'bg-secondary-container text-on-secondary shadow-sm'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                AMEX
              </span>
            </div>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-4">
            {/* Cardholder Name */}
            <div>
              <label htmlFor="cardholder-name" className="block font-label-md text-label-md text-on-surface mb-1.5 font-semibold">
                Nombre del titular de la tarjeta
              </label>
              <div className="relative">
                <input
                  id="cardholder-name"
                  type="text"
                  required
                  value={formData.cardholderName}
                  onChange={(e) => updateField('cardholderName', e.target.value)}
                  placeholder="Carlos Mendoza"
                  className="w-full bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/40 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 font-body-md text-body-md transition-all border border-surface-container-high/40"
                />
                <Icon
                  name="person"
                  className="absolute right-3 top-3 text-on-surface-variant/40 text-[20px]"
                />
              </div>
            </div>

            {/* Card Number */}
            <div>
              <label htmlFor="card-number" className="block font-label-md text-label-md text-on-surface mb-1.5 font-semibold">
                Número de tarjeta
              </label>
              <div className="relative">
                <input
                  id="card-number"
                  type="text"
                  required
                  maxLength={19}
                  value={formData.cardNumber}
                  onChange={handleCardNumberChange}
                  placeholder="4532 •••• •••• 8892"
                  className="w-full bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/40 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 font-body-md text-body-md tracking-wider transition-all border border-surface-container-high/40"
                />
                <div className="absolute right-3 top-2.5 flex items-center gap-1 text-on-surface-variant/60">
                  <Icon name="credit_card" className="text-[22px]" />
                </div>
              </div>
            </div>

            {/* Exp & CVC */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="card-exp" className="block font-label-md text-label-md text-on-surface mb-1.5 font-semibold">
                  Vencimiento (MM/AA)
                </label>
                <input
                  id="card-exp"
                  type="text"
                  required
                  maxLength={5}
                  value={formData.cardExp}
                  onChange={handleExpChange}
                  placeholder="12/28"
                  className="w-full bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/40 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 font-body-md text-body-md transition-all text-center border border-surface-container-high/40"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="card-cvc" className="font-label-md text-label-md text-on-surface font-semibold">
                    CVC / CVV
                  </label>
                  <span className="text-[11px] text-on-surface-variant/60">3 dígitos al reverso</span>
                </div>
                <div className="relative">
                  <input
                    id="card-cvc"
                    type="password"
                    required
                    maxLength={4}
                    value={formData.cardCvc}
                    onChange={handleCvcChange}
                    placeholder="•••"
                    className="w-full bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/40 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 font-body-md text-body-md text-center transition-all border border-surface-container-high/40"
                  />
                  <Icon
                    name="lock"
                    className="absolute right-3 top-3 text-on-surface-variant/40 text-[18px]"
                  />
                </div>
              </div>
            </div>

            {/* Country & ZIP */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label htmlFor="card-country" className="block font-label-md text-label-md text-on-surface mb-1.5 font-semibold">
                  País de facturación
                </label>
                <select
                  id="card-country"
                  value={formData.cardCountry}
                  onChange={(e) => updateField('cardCountry', e.target.value)}
                  className="w-full bg-surface-container-lowest text-on-surface px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 font-body-md text-body-md transition-all border border-surface-container-high/40 cursor-pointer"
                >
                  <option value="VE">Venezuela</option>
                  <option value="CL">Chile</option>
                  <option value="MX">México</option>
                  <option value="CO">Colombia</option>
                  <option value="PE">Perú</option>
                  <option value="US">Estados Unidos</option>
                  <option value="ES">España</option>
                </select>
              </div>

              <div>
                <label htmlFor="card-postal" className="block font-label-md text-label-md text-on-surface mb-1.5 font-semibold">
                  Código Postal
                </label>
                <input
                  id="card-postal"
                  type="text"
                  value={formData.cardPostal}
                  onChange={(e) => updateField('cardPostal', e.target.value)}
                  placeholder="7550000"
                  className="w-full bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/40 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 font-body-md text-body-md transition-all border border-surface-container-high/40"
                />
              </div>
            </div>

            {/* Legal terms checkbox */}
            <div className="pt-3">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  id="legal-terms-checkbox"
                  type="checkbox"
                  checked={formData.termsAccepted}
                  onChange={(e) => updateField('termsAccepted', e.target.checked)}
                  className="mt-1 w-4 h-4 rounded text-primary focus:ring-primary/40 bg-surface-container-lowest border-surface-container-high cursor-pointer"
                />
                <span className="text-xs text-on-surface-variant group-hover:text-on-surface leading-relaxed transition-colors select-none">
                  He leído y acepto los <span className="text-primary underline">Términos y Condiciones</span> y la{' '}
                  <span className="text-primary underline">Política de Privacidad</span> de Rendy. Autorizo los
                  cobros recurrentes del plan seleccionado una vez finalice el periodo de prueba gratuito de 7 días.
                </span>
              </label>

              {errorMsg && (
                <div className="text-xs text-error mt-2 font-medium flex items-center gap-1.5">
                  <Icon name="error" className="text-[16px]" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>

            {/* Main Activation CTA */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 rounded-full bg-primary-container text-black font-headline-sm text-[16px] font-extrabold shadow-[0_0_28px_rgba(0,229,153,0.38)] hover:shadow-[0_0_36px_rgba(0,229,153,0.55)] transition-all flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <span>Cifrando datos y activando 7 días...</span>
                    <Icon name="sync" className="text-[20px] text-black animate-spin" />
                  </>
                ) : (
                  <>
                    <span>Activar mi cuenta y comenzar</span>
                    <Icon name="arrow_forward" className="text-[20px] text-black font-bold group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>

              <div className="text-center mt-3 text-xs text-on-surface-variant/80 flex items-center justify-center gap-2">
                <span>7 días gratis</span>
                <span>•</span>
                <span className="text-primary font-semibold">Sin cobros hoy (USD 0,00)</span>
                <span>•</span>
                <span>Cancela antes de finalizar tu prueba</span>
              </div>
            </div>
          </form>
        </div>

        {/* Column 2: Plan Summary & 7-Day Timeline (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Order Summary Box */}
          <div className="bg-surface-container rounded-2xl p-6 shadow-md border border-surface-container-high/60 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high/60">
              <span className="font-headline-sm text-[16px] text-on-surface font-bold">
                Resumen de Contratación
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                7 Días de Prueba Activa
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-on-surface-variant">Plan seleccionado:</span>
                <span className="text-on-surface font-bold">
                  Plan {planInfo.name} ({cycleName})
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-on-surface-variant">
                <span>Precio regular:</span>
                <span className="text-on-surface font-semibold">USD {price},00 / mes</span>
              </div>

              <div className="flex items-center justify-between text-xs text-on-surface-variant">
                <span>Modalidad:</span>
                <span className="text-on-surface font-medium">
                  {isAnnual ? 'Anual por adelantado (Ahorro 20%)' : 'Mensual sin compromiso'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-on-surface-variant">
                <span>Duración de prueba:</span>
                <span className="text-primary font-bold">7 días calendario</span>
              </div>

              <div className="flex items-center justify-between text-xs text-on-surface-variant">
                <span>Total regular post-prueba:</span>
                <span className="text-on-surface font-semibold">{regularTotalPrice}</span>
              </div>
            </div>

            {/* Zero Today Box */}
            <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high/60 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase font-bold text-primary">Importe a pagar hoy</div>
                <div className="text-[11px] text-on-surface-variant">Sin cargos sorpresa en tu tarjeta</div>
              </div>
              <div className="font-numeric-metric text-[28px] text-primary font-extrabold leading-none">
                $0.00
              </div>
            </div>
          </div>

          {/* 7-Day Free Trial Visual Timeline */}
          <div className="bg-surface-container rounded-2xl p-6 shadow-md border border-surface-container-high/60">
            <div className="flex items-center gap-2 mb-5">
              <Icon name="calendar_month" className="text-primary text-[20px]" />
              <h3 className="font-headline-sm text-[16px] text-on-surface font-bold">
                Línea de Tiempo de tus 7 Días Gratis
              </h3>
            </div>

            <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-container-high">
              {/* Node 1: Today */}
              <div className="relative group">
                <div className="absolute -left-[27px] top-0 w-4 h-4 rounded-full bg-primary flex items-center justify-center ring-4 ring-surface-container">
                  <div className="w-1.5 h-1.5 rounded-full bg-surface" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-label-sm text-label-sm uppercase font-extrabold text-primary">
                      Hoy
                    </span>
                    <span className="text-[11px] text-primary/80 bg-primary/10 px-2 py-0.5 rounded font-bold border border-primary/20">
                      USD 0,00 cobrados hoy
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                    Registras tu método de pago con token seguro. Activación inmediata de tu espacio empresarial.
                  </p>
                </div>
              </div>

              {/* Node 2: Days 1 to 7 */}
              <div className="relative group">
                <div className="absolute -left-[27px] top-0 w-4 h-4 rounded-full bg-secondary-container flex items-center justify-center ring-4 ring-surface-container">
                  <div className="w-1.5 h-1.5 rounded-full bg-surface" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-label-sm text-label-sm uppercase font-bold text-secondary">
                      Días 1 al 7
                    </span>
                    <span className="text-[11px] text-on-surface-variant">Prueba gratuita completa</span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                    Disfruta de Rendy sin cargos: invita a tu equipo, prueba las tarjetas virtuales y aprueba gastos.
                  </p>
                </div>
              </div>

              {/* Node 3: Before Day 8 */}
              <div className="relative group">
                <div className="absolute -left-[27px] top-0 w-4 h-4 rounded-full bg-tertiary-container flex items-center justify-center ring-4 ring-surface-container">
                  <div className="w-1.5 h-1.5 rounded-full bg-surface" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-label-sm text-label-sm uppercase font-bold text-tertiary">
                      Antes del Día 8
                    </span>
                    <span className="text-[11px] text-tertiary/90 bg-tertiary/10 px-2 py-0.5 rounded font-bold border border-tertiary/20">
                      Recordatorio por Email
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                    Te enviaremos una alerta en el día 5. Si cancelas antes de finalizar la prueba, no se realizará ningún cobro.
                  </p>
                </div>
              </div>

              {/* Node 4: Day 8 and beyond */}
              <div className="relative group">
                <div className="absolute -left-[27px] top-0 w-4 h-4 rounded-full bg-surface-container-high flex items-center justify-center ring-4 ring-surface-container">
                  <div className="w-1.5 h-1.5 rounded-full bg-on-surface-variant" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-label-sm text-label-sm uppercase font-semibold text-on-surface">
                      Día 8 en adelante
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                    Comienza la suscripción recurrente elegida. Puedes pausar o cambiar de plan cuando gustes.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick FAQ / Support pill */}
          <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high/40 flex items-center gap-3 text-xs text-on-surface-variant">
            <Icon name="contact_support" className="text-secondary text-[22px] shrink-0" />
            <div>
              ¿Dudas con la facturación de tu empresa? Nuestro equipo fiscal te atiende por chat en vivo.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

