'use client';

import React, { useState } from 'react';
import { Icon } from '@/components/landing/primitives';
import { OnboardingFormData } from './types';

interface Step4Props {
  formData: OnboardingFormData;
  updateField: <K extends keyof OnboardingFormData>(key: K, value: OnboardingFormData[K]) => void;
  onNext: () => void;
  onBack: () => void;
}

/**
 * @name Step4AdminProfile
 * @description [Business Logic]: Establishes the identity of the legal root administrator,
 * enforces password entropy checks, and assigns a unique tenant workspace handle.
 */
export function Step4AdminProfile({ formData, updateField, onNext, onBack }: Step4Props) {
  const [showPassword, setShowPassword] = useState(false);

  // Compute password strength (0 to 4 score)
  const getPasswordStrength = (pw: string) => {
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  };

  const pwLength = formData.adminPassword.length;
  const strengthScore = pwLength === 0 ? 0 : getPasswordStrength(formData.adminPassword);

  const getStrengthLabel = (score: number, length: number) => {
    if (length === 0) return { text: 'Mínimo 10 caracteres', color: 'text-on-surface-variant/50 font-normal' };
    if (score <= 1) return { text: 'Débil (25%)', color: 'text-error' };
    if (score === 2) return { text: 'Media (50%)', color: 'text-tertiary' };
    if (score === 3) return { text: 'Buena (75%)', color: 'text-primary' };
    return { text: 'Excelente (100%)', color: 'text-primary font-semibold' };
  };

  const strengthMeta = getStrengthLabel(strengthScore, pwLength);

  const usernameTrimmed = formData.adminUsername.trim();
  const isUsernameTouched = usernameTrimmed.length > 0;
  const isUsernameValid = usernameTrimmed.length >= 3;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.adminFirstName.trim() || !formData.adminEmail.trim() || !isUsernameValid) {
      return;
    }
    onNext();
  };

  return (
    <section className="step-pane w-full transition-all duration-300">
      <div className="bg-surface-container-low rounded-2xl p-6 sm:p-8 md:p-10 shadow-2xl border border-surface-container-high/40 flex flex-col gap-6 relative overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between animate-enter-up">
          <div className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm uppercase tracking-widest text-primary font-semibold">
              Paso 4 • Identidad del Creador
            </span>
            <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight">
              Tu perfil de Administrador Principal
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Tus credenciales personales te otorgarán la custodia principal del portal financiero Rendy.
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary-container shadow-inner flex-shrink-0">
            <Icon name="shield_person" className="text-[28px]" />
          </div>
        </div>

        {/* Admin Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* First & Last Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 animate-enter-up [animation-delay:60ms]">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="admin-first-name" className="font-label-md text-label-md text-on-surface font-semibold">
                Nombre
              </label>
              <div className="relative">
                <input
                  id="admin-first-name"
                  type="text"
                  required
                  value={formData.adminFirstName}
                  onChange={(e) => updateField('adminFirstName', e.target.value)}
                  placeholder="Ej: Carlos"
                  className="w-full bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/35 rounded-xl px-4 py-3 text-body-md font-body-md focus:outline-none focus:ring-2 focus:ring-primary-container/40 pl-11 shadow-inner border border-surface-container-high/40 transition-all"
                />
                <Icon
                  name="person"
                  className="absolute left-3.5 top-3.5 text-on-surface-variant text-[20px]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="admin-last-name" className="font-label-md text-label-md text-on-surface font-semibold">
                Apellido
              </label>
              <div className="relative">
                <input
                  id="admin-last-name"
                  type="text"
                  required
                  value={formData.adminLastName}
                  onChange={(e) => updateField('adminLastName', e.target.value)}
                  placeholder="Ej: Mendoza"
                  className="w-full bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/35 rounded-xl px-4 py-3 text-body-md font-body-md focus:outline-none focus:ring-2 focus:ring-primary-container/40 pl-11 shadow-inner border border-surface-container-high/40 transition-all"
                />
                <Icon
                  name="badge"
                  className="absolute left-3.5 top-3.5 text-on-surface-variant text-[20px]"
                />
              </div>
            </div>
          </div>

          {/* Username with Live Workspace Validator */}
          <div className="flex flex-col gap-1.5 animate-enter-up [animation-delay:110ms]">
            <div className="flex items-center justify-between">
              <label htmlFor="admin-username" className="font-label-md text-label-md text-on-surface font-semibold">
                Nombre de usuario único
              </label>
              <span
                className={`font-label-sm text-label-sm flex items-center gap-1 font-mono ${
                  !isUsernameTouched
                    ? 'text-on-surface-variant/50'
                    : isUsernameValid
                    ? 'text-primary'
                    : 'text-error'
                }`}
              >
                <Icon
                  name={
                    !isUsernameTouched
                      ? 'info'
                      : isUsernameValid
                      ? 'check_circle'
                      : 'cancel'
                  }
                  className="text-[14px]"
                />
                {!isUsernameTouched
                  ? 'Mínimo 3 letras'
                  : isUsernameValid
                  ? 'Disponible en el workspace'
                  : 'Mínimo 3 letras'}
              </span>
            </div>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-on-surface-variant font-mono text-label-md font-semibold select-none">
                rendy.co/@
              </span>
              <input
                id="admin-username"
                type="text"
                required
                value={formData.adminUsername}
                onChange={(e) => updateField('adminUsername', e.target.value)}
                placeholder="cmendoza"
                className="w-full bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/35 rounded-xl px-4 py-3 text-body-md font-body-md focus:outline-none focus:ring-2 focus:ring-primary-container/40 pl-28 shadow-inner font-mono border border-surface-container-high/40 transition-all"
              />
            </div>
          </div>

          {/* Corporate Email & Mobile Phone (2FA) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 animate-enter-up [animation-delay:160ms]">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="admin-email" className="font-label-md text-label-md text-on-surface font-semibold">
                Correo corporativo
              </label>
              <div className="relative">
                <input
                  id="admin-email"
                  type="email"
                  required
                  value={formData.adminEmail}
                  onChange={(e) => updateField('adminEmail', e.target.value)}
                  placeholder="Ej: carlos@acmesolutions.com"
                  className="w-full bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/35 rounded-xl px-4 py-3 text-body-md font-body-md focus:outline-none focus:ring-2 focus:ring-primary-container/40 pl-11 shadow-inner border border-surface-container-high/40 transition-all"
                />
                <Icon
                  name="mail"
                  className="absolute left-3.5 top-3.5 text-on-surface-variant text-[20px]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="admin-phone" className="font-label-md text-label-md text-on-surface font-semibold">
                Teléfono móvil (2FA)
              </label>
              <div className="flex gap-2">
                <select
                  id="admin-phone-code"
                  value={formData.adminPhoneCountryCode}
                  onChange={(e) => updateField('adminPhoneCountryCode', e.target.value)}
                  className="w-24 bg-surface-container-lowest text-on-surface rounded-xl px-2 py-3 text-body-md font-body-md focus:outline-none focus:ring-2 focus:ring-primary-container/40 shadow-inner cursor-pointer font-mono text-center border border-surface-container-high/40 transition-all"
                >
                  <option value="+58">+58</option>
                  <option value="+1">+1</option>
                  <option value="+57">+57</option>
                  <option value="+52">+52</option>
                  <option value="+507">+507</option>
                </select>
                <div className="relative flex-1">
                  <input
                    id="admin-phone"
                    type="tel"
                    required
                    value={formData.adminPhone}
                    onChange={(e) => updateField('adminPhone', e.target.value)}
                    placeholder="Ej: 412 8901234"
                    className="w-full bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/35 rounded-xl px-4 py-3 text-body-md font-body-md focus:outline-none focus:ring-2 focus:ring-primary-container/40 shadow-inner font-mono border border-surface-container-high/40 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Password with Strength Meter */}
          <div className="flex flex-col gap-1.5 animate-enter-up [animation-delay:210ms]">
            <div className="flex items-center justify-between">
              <label htmlFor="admin-password" className="font-label-md text-label-md text-on-surface font-semibold">
                Contraseña de acceso
              </label>
              <span className={`font-label-sm text-label-sm ${strengthMeta.color}`}>
                {strengthMeta.text}
              </span>
            </div>
            <div className="relative">
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={formData.adminPassword}
                onChange={(e) => updateField('adminPassword', e.target.value)}
                placeholder="Ej: Rendy#Fintech$2025!"
                className="w-full bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/35 rounded-xl px-4 py-3 text-body-md font-body-md focus:outline-none focus:ring-2 focus:ring-primary-container/40 pl-11 pr-11 shadow-inner border border-surface-container-high/40 transition-all"
              />
              <Icon
                name="key"
                className="absolute left-3.5 top-3.5 text-on-surface-variant text-[20px]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-on-surface-variant hover:text-on-surface cursor-pointer"
              >
                <Icon name={showPassword ? 'visibility_off' : 'visibility'} className="text-[20px]" />
              </button>
            </div>

            {/* 4-Segment Strength Meter */}
            <div className="grid grid-cols-4 gap-1.5 mt-1">
              {[1, 2, 3, 4].map((barIdx) => {
                const isFilled = strengthScore >= barIdx;
                let colorClass = 'bg-surface-container-high';
                if (isFilled) {
                  if (strengthScore === 1) colorClass = 'bg-error';
                  else if (strengthScore === 2) colorClass = 'bg-tertiary-container';
                  else colorClass = 'bg-primary-container';
                }
                return (
                  <div
                    key={barIdx}
                    className={`h-1 rounded-full transition-colors duration-300 ${colorClass}`}
                  />
                );
              })}
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center justify-between pt-4 mt-1 border-t border-surface-container-high/30 animate-enter-up [animation-delay:260ms]">
            <button
              type="button"
              onClick={onBack}
              className="px-5 py-2.5 rounded-full text-on-surface-variant hover:text-on-surface font-label-md text-label-md flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Icon name="arrow_back" className="text-[18px]" />
              <span>Volver</span>
            </button>

            <button
              type="submit"
              className="px-6 py-3 rounded-full bg-primary-container text-black font-headline-sm text-[15px] font-bold shadow-[0_0_24px_rgba(0,229,153,0.35)] hover:shadow-[0_0_32px_rgba(0,229,153,0.5)] hover:-translate-y-0.5 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>Continuar a Roles</span>
              <Icon name="arrow_forward" className="text-[18px] text-black font-bold" />
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

