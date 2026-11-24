'use client';

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RendyLogo } from '@/components/rendy-logo';
import {
  Lock,
  Unlock,
  Key,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  Circle,
  AlertTriangle,
  XCircle,
  Clock,
  ArrowRight,
  Headphones,
  Check,
  Loader2,
  Shield,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { acceptEmployeeInvitationAction } from '@/app/actions/invitations.actions';

export type ScreenState = 'active' | 'err-temp' | 'err-match' | 'expired' | 'already-active' | 'success';

export interface ConfigurarContrasenaClientProps {
  token: string;
  initialCode?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  department?: string;
  companyName?: string;
  initialStatusReason?: 'ACTIVE' | 'EXPIRED' | 'ALREADY_ACTIVATED' | 'INVALID';
  initialError?: string;
  tempPasswordSample?: string;
}

/**
 * @name ConfigurarContrasenaClient
 * @description [Business Logic]: Modern, high-trust account activation and password setup screen
 * designed for invited corporate employees. Features fluid view transitions, staggered entrances,
 * live strength metering, tactile micro-interactions, and instant session establishment.
 */
export function ConfigurarContrasenaClient({
  token,
  initialCode = '',
  firstName = '',
  lastName = '',
  email = '',
  department = 'Colaborador',
  companyName = 'tu empresa',
  initialStatusReason = 'ACTIVE',
  initialError,
  tempPasswordSample,
}: ConfigurarContrasenaClientProps) {
  const router = useRouter();

  // Determine initial screen view state based on server verification
  const resolveInitialState = (): ScreenState => {
    if (initialStatusReason === 'EXPIRED') return 'expired';
    if (initialStatusReason === 'ALREADY_ACTIVATED') return 'already-active';
    return 'active';
  };

  const [screenState, setScreenState] = useState<ScreenState>(resolveInitialState);
  const [isViewTransitioning, setIsViewTransitioning] = useState(false);

  // Form field states
  const effectiveDefaultTemp = initialCode || tempPasswordSample || '';
  const [tempPassword, setTempPassword] = useState(effectiveDefaultTemp);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Password visibility toggles
  const [showTempPassword, setShowTempPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Micro-interaction states
  const [focusedField, setFocusedField] = useState<'temp' | 'new' | 'confirm' | null>(null);
  const [justAutocompleted, setJustAutocompleted] = useState(false);
  const [shakeCard, setShakeCard] = useState(false);

  // Error banners
  const [tempPasswordError, setTempPasswordError] = useState(false);
  const [passwordMismatchError, setPasswordMismatchError] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(initialError || null);

  // Success countdown state
  const [countdown, setCountdown] = useState(3);
  const [isPending, startTransition] = useTransition();

  // Compute initials for company avatar
  const companyInitials = companyName
    ? companyName
        .split(' ')
        .map((w) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'RC';

  // Password checklist calculations
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecialOrExtra = /[^A-Za-z0-9]/.test(newPassword) && newPassword.length >= 10;

  // Real-time strength score (0 to 4)
  let strengthScore = 0;
  if (hasMinLength) strengthScore++;
  if (hasUppercase) strengthScore++;
  if (hasNumber) strengthScore++;
  if (hasSpecialOrExtra) strengthScore++;

  const getStrengthLabel = () => {
    if (newPassword.length === 0) return { text: 'Seguridad: Pendiente', colorClass: 'text-slate-400' };
    if (strengthScore <= 1) return { text: 'Seguridad: Débil', colorClass: 'text-rose-400' };
    if (strengthScore === 2) return { text: 'Seguridad: Media', colorClass: 'text-amber-400' };
    if (strengthScore === 3) return { text: 'Seguridad: Alta', colorClass: 'text-cyan-400' };
    return { text: 'Seguridad: Muy Alta', colorClass: 'text-emerald-400' };
  };

  const strengthMeta = getStrengthLabel();
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;

  // Trigger tactile shake on errors
  const triggerShake = () => {
    setShakeCard(true);
    setTimeout(() => setShakeCard(false), 450);
  };

  // Fluid transition between views
  const transitionToState = (nextState: ScreenState) => {
    if (nextState === screenState) return;
    setIsViewTransitioning(true);
    setTimeout(() => {
      setScreenState(nextState);
      setIsViewTransitioning(false);
    }, 160);
  };

  // Autocomplete temporary password handler with micro-interaction
  const handleAutocomplete = () => {
    const candidate = initialCode || tempPasswordSample || 'TMP-9831-KX';
    setTempPassword(candidate);
    setTempPasswordError(false);
    setJustAutocompleted(true);
    setTimeout(() => setJustAutocompleted(false), 1200);
  };

  // Form submission handler
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTempPasswordError(false);
    setPasswordMismatchError(false);
    setGeneralError(null);

    if (!tempPassword.trim()) {
      setTempPasswordError(true);
      triggerShake();
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMismatchError(true);
      triggerShake();
      return;
    }

    if (!hasMinLength || !hasUppercase || !hasNumber) {
      setGeneralError('La contraseña no cumple con los requisitos mínimos de seguridad.');
      triggerShake();
      return;
    }

    startTransition(async () => {
      const result = await acceptEmployeeInvitationAction({
        token,
        tempPassword,
        password: newPassword,
        confirmPassword,
      });

      if (!result.success) {
        triggerShake();
        if (result.errorType === 'INVALID_TEMP_PASSWORD') {
          setTempPasswordError(true);
          setGeneralError(result.error || 'Contraseña temporal inválida.');
        } else {
          setGeneralError(result.error || 'No se pudo completar la activación de tu perfil.');
        }
        return;
      }

      // Smooth transition into success view
      transitionToState('success');
    });
  };

  // Redirect countdown timer when success view triggers
  useEffect(() => {
    if (screenState !== 'success') return;

    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          router.push('/dashboard');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [screenState, router]);

  // UX Simulator switch helper
  const handleSimulatorSwitch = (stateKey: ScreenState) => {
    setTempPasswordError(false);
    setPasswordMismatchError(false);
    setGeneralError(null);

    if (stateKey === 'active') {
      setTempPassword(effectiveDefaultTemp || 'TMP-9831-KX');
    } else if (stateKey === 'err-temp') {
      setTempPassword('TMP-INVALID-99');
      setTempPasswordError(true);
      triggerShake();
    } else if (stateKey === 'err-match') {
      setNewPassword('RendyCorp2025!');
      setConfirmPassword('DifferentPassword123');
      setPasswordMismatchError(true);
      triggerShake();
    }

    transitionToState(stateKey);
  };

  return (
    <div className="min-h-screen w-full bg-[#0b0e17] text-slate-100 flex flex-col relative selection:bg-emerald-500 selection:text-slate-950 font-sans overflow-x-hidden">
      {/* Dynamic Background Glow with Ambient Breathing Pulse */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,229,153,0.14),rgba(11,14,23,0))] animate-glow-ambient" />

      {/* Top Header */}
      <header className="relative z-10 w-full bg-[#0b0e17]/80 backdrop-blur-xl border-b border-slate-800/80 shadow-[0_1px_8px_rgba(0,0,0,0.4)] animate-enter-down">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo & Brand in Top-Left Corner */}
          <Link href="/" scroll={true} className="flex items-center gap-2 transition-all duration-300 hover:opacity-90 hover:scale-[1.02]">
            <RendyLogo variant="full" theme="dark" className="h-8 w-auto" />
          </Link>

          {/* Support Link */}
          <a
            href="mailto:soporte@rendy.app"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 text-xs font-semibold transition-all duration-200 hover:shadow-sm active:scale-95"
          >
            <HelpCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Soporte</span>
          </a>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 flex flex-col justify-center items-center">
        {/* Interactive State Switcher Ribbon */}
        <div className="w-full max-w-4xl mx-auto mb-6 px-2 animate-enter-down" style={{ animationDelay: '60ms' }}>
          <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md rounded-xl p-2.5 shadow-lg flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 pl-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
              </span>
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                Simulador de Estados UX
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {[
                { key: 'active', label: '1. Formulario Activo' },
                { key: 'err-temp', label: '2. Err: Temp Inválida' },
                { key: 'err-match', label: '3. Err: No Coinciden' },
                { key: 'expired', label: '4. Expirada' },
                { key: 'already-active', label: '5. Ya Activada' },
                { key: 'success', label: '6. Éxito' },
              ].map((item) => {
                const isActive = screenState === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleSimulatorSwitch(item.key as ScreenState)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer active:scale-95 ${
                      isActive
                        ? 'bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(0,229,153,0.3)] font-bold scale-[1.02]'
                        : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Ambient Light Glow Container */}
        <div className="relative w-full max-w-xl mx-auto">
          {/* Subtle Dynamic Emerald Glow Halo Wrapped directly around the entire Card */}
          <div className="pointer-events-none absolute -inset-1 sm:-inset-1.5 rounded-[22px] bg-gradient-to-r from-emerald-500/25 via-[#00e599]/40 to-emerald-400/25 blur-xl animate-emerald-glow-breathe -z-10" />

          {/* Central Glassmorphic Card with Perimeter Glow Pulse & Smooth Entrance */}
          <div
            className={`relative bg-[#1c1f29]/95 border backdrop-blur-2xl rounded-2xl overflow-hidden transition-all duration-300 animate-enter-card animate-emerald-perimeter ${
              shakeCard ? 'animate-form-shake' : ''
            }`}
          >
            {/* Smooth View Wrapper with Cross-Fade Transitions */}
            <div
              className={`transition-all duration-200 ease-out ${
                isViewTransitioning
                  ? 'opacity-0 scale-[0.985] -translate-y-2 blur-[1px]'
                  : 'opacity-100 scale-100 translate-y-0 blur-0'
              }`}
            >
              {/* ─────────────────────────────────────────────────────────────
               * SUB-VIEW 1: FORM VIEW (Active / Err Temp / Err Match)
               * ───────────────────────────────────────────────────────────── */}
              {(screenState === 'active' || screenState === 'err-temp' || screenState === 'err-match') && (
                <div className="p-6 sm:p-8 flex flex-col gap-6">
                  {/* Header Info */}
                  <div className="flex flex-col items-center text-center animate-enter-down">
                    <div className="relative mb-3 flex items-center justify-center">
                      <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-emerald-400 shadow-[0_0_24px_rgba(0,229,153,0.25)] transition-all duration-300 hover:scale-105 hover:shadow-[0_0_32px_rgba(0,229,153,0.4)]">
                        <Unlock className="h-7 w-7 text-emerald-400 transition-transform duration-300 hover:rotate-6" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#0b0e17] flex items-center justify-center">
                        <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                      </div>
                    </div>

                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-emerald-400 text-[11px] font-semibold tracking-wider uppercase mb-2 shadow-sm">
                      <Shield className="h-3.5 w-3.5" />
                      <span>Activación de Cuenta</span>
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                      ¡Ya casi formas parte del equipo!
                    </h1>
                    <p className="text-sm text-slate-400 max-w-md mt-1.5 leading-relaxed">
                      Has recibido una invitación para unirte a tu organización en Rendy. Configura tu contraseña personal para activar tu acceso seguro.
                    </p>
                  </div>

                  {/* Readonly Invitation Summary Panel */}
                  <div
                    className="bg-[#0b0e17]/85 border border-slate-800/90 rounded-xl p-4 flex flex-col gap-3 shadow-inner transition-all duration-300 hover:border-slate-700 hover:bg-[#0b0e17] animate-card-enter"
                    style={{ animationDelay: '80ms' }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-800 to-slate-700 flex items-center justify-center text-base font-bold text-emerald-400 shrink-0 shadow-sm border border-slate-700 transition-transform duration-300 hover:scale-105">
                          {companyInitials}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-white truncate">{companyName}</span>
                            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          </div>
                          <span className="text-xs text-slate-400 truncate">{email || 'colaborador@empresa.com'}</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end shrink-0">
                        <span className="px-2.5 py-1 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-[11px] font-bold tracking-wide uppercase shadow-sm">
                          Colaborador
                        </span>
                        <span className="text-[11px] text-slate-400 mt-1 hidden sm:inline">Viáticos y rendición</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                        <span>Datos verificados por tu administrador</span>
                      </div>
                      <span className="text-emerald-400 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Permisos activos
                      </span>
                    </div>
                  </div>

                  {/* Animated Error Banners */}
                  {tempPasswordError && (
                    <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300 shadow-md">
                      <XCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5 animate-pop-bounce" />
                      <div className="flex flex-col text-xs">
                        <span className="font-bold text-rose-200">Contraseña temporal inválida</span>
                        <span className="text-rose-300/90">
                          Verifica los datos del correo de invitación e inténtalo nuevamente.
                        </span>
                      </div>
                    </div>
                  )}

                  {passwordMismatchError && (
                    <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300 shadow-md">
                      <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5 animate-pop-bounce" />
                      <div className="flex flex-col text-xs">
                        <span className="font-bold text-rose-200">Las contraseñas no coinciden</span>
                        <span className="text-rose-300/90">
                          Comprueba que ambas contraseñas ingresadas sean exactamente iguales.
                        </span>
                      </div>
                    </div>
                  )}

                  {generalError && !tempPasswordError && !passwordMismatchError && (
                    <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300 shadow-md">
                      <XCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5 animate-pop-bounce" />
                      <span className="text-xs">{generalError}</span>
                    </div>
                  )}

                  {/* Form Setup with Micro-Interactions */}
                  <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                    {/* FIELD 1: Temporary Password */}
                    <div
                      className="flex flex-col gap-1.5 animate-card-enter"
                      style={{ animationDelay: '120ms' }}
                    >
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="temp-password"
                          className={`text-xs font-semibold flex items-center gap-1 transition-colors duration-200 ${
                            focusedField === 'temp' ? 'text-white' : 'text-slate-300'
                          }`}
                        >
                          <span>Contraseña temporal</span>
                          <span className="text-emerald-400">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={handleAutocomplete}
                          className="text-xs text-cyan-400 hover:text-cyan-300 transition-all duration-200 underline decoration-dotted cursor-pointer flex items-center gap-1 active:scale-95"
                        >
                          {justAutocompleted ? (
                            <>
                              <Check className="h-3 w-3 text-cyan-300 animate-pop-bounce" />
                              <span className="text-cyan-300 font-bold">¡Autocompletado!</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-3 w-3 opacity-80" />
                              <span>Autocompletar</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="relative flex items-center group">
                        <Key
                          className={`h-4 w-4 absolute left-3.5 pointer-events-none transition-all duration-200 ${
                            focusedField === 'temp' ? 'text-emerald-400 scale-110' : 'text-slate-400'
                          }`}
                        />
                        <input
                          id="temp-password"
                          type={showTempPassword ? 'text' : 'password'}
                          value={tempPassword}
                          onFocus={() => setFocusedField('temp')}
                          onBlur={() => setFocusedField(null)}
                          onChange={(e) => {
                            setTempPassword(e.target.value);
                            setTempPasswordError(false);
                          }}
                          placeholder="Ingresa la clave enviada a tu correo"
                          className={`w-full pl-10 pr-10 py-3 bg-[#0b0e17] rounded-xl text-sm text-white placeholder:text-slate-500 border transition-all duration-200 font-mono ${
                            justAutocompleted
                              ? 'ring-2 ring-cyan-400/80 border-cyan-400 bg-cyan-950/20 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                              : tempPasswordError
                              ? 'border-rose-500 ring-2 ring-rose-500/30'
                              : focusedField === 'temp'
                              ? 'border-emerald-500 ring-2 ring-emerald-500/30 shadow-[0_0_18px_rgba(0,229,153,0.15)] scale-[1.008]'
                              : 'border-slate-800 hover:border-slate-700'
                          } outline-none`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowTempPassword((prev) => !prev)}
                          className="absolute right-3.5 text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer active:scale-90"
                          title={showTempPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                        >
                          {showTempPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>

                      <p className="text-[11px] text-slate-400">
                        Encontrarás esta clave alfanumérica en el correo de invitación enviado por tu organización.
                      </p>
                    </div>

                    <div className="w-full h-px bg-slate-800/80 my-1" />

                    {/* FIELD 2: New Password */}
                    <div
                      className="flex flex-col gap-2 animate-card-enter"
                      style={{ animationDelay: '160ms' }}
                    >
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="new-password"
                          className={`text-xs font-semibold flex items-center gap-1 transition-colors duration-200 ${
                            focusedField === 'new' ? 'text-white' : 'text-slate-300'
                          }`}
                        >
                          <span>Nueva contraseña</span>
                          <span className="text-emerald-400">*</span>
                        </label>
                        <span className={`text-[11px] font-bold transition-all duration-300 ${strengthMeta.colorClass}`}>
                          {strengthMeta.text}
                        </span>
                      </div>

                      <div className="relative flex items-center group">
                        <Lock
                          className={`h-4 w-4 absolute left-3.5 pointer-events-none transition-all duration-200 ${
                            focusedField === 'new' ? 'text-emerald-400 scale-110' : 'text-slate-400'
                          }`}
                        />
                        <input
                          id="new-password"
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onFocus={() => setFocusedField('new')}
                          onBlur={() => setFocusedField(null)}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Crea una contraseña segura"
                          className={`w-full pl-10 pr-10 py-3 bg-[#0b0e17] rounded-xl text-sm text-white placeholder:text-slate-500 border transition-all duration-200 outline-none ${
                            focusedField === 'new'
                              ? 'border-emerald-500 ring-2 ring-emerald-500/30 shadow-[0_0_18px_rgba(0,229,153,0.15)] scale-[1.008]'
                              : 'border-slate-800 hover:border-slate-700'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword((prev) => !prev)}
                          className="absolute right-3.5 text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer active:scale-90"
                          title={showNewPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                        >
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>

                      {/* Segmented Strength Meter with Dynamic Smooth Transitions & Glow */}
                      <div className="grid grid-cols-4 gap-1.5 pt-1">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-500 ease-out ${
                            strengthScore >= 1
                              ? strengthScore === 1
                                ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                                : strengthScore === 2
                                ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                                : strengthScore === 3
                                ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]'
                                : 'bg-emerald-400 shadow-[0_0_10px_rgba(0,229,153,0.7)]'
                              : 'bg-slate-800'
                          }`}
                        />
                        <div
                          className={`h-1.5 rounded-full transition-all duration-500 ease-out ${
                            strengthScore >= 2
                              ? strengthScore === 2
                                ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                                : strengthScore === 3
                                ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]'
                                : 'bg-emerald-400 shadow-[0_0_10px_rgba(0,229,153,0.7)]'
                              : 'bg-slate-800'
                          }`}
                        />
                        <div
                          className={`h-1.5 rounded-full transition-all duration-500 ease-out ${
                            strengthScore >= 3
                              ? strengthScore === 3
                                ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]'
                                : 'bg-emerald-400 shadow-[0_0_10px_rgba(0,229,153,0.7)]'
                              : 'bg-slate-800'
                          }`}
                        />
                        <div
                          className={`h-1.5 rounded-full transition-all duration-500 ease-out ${
                            strengthScore >= 4
                              ? 'bg-emerald-400 shadow-[0_0_12px_rgba(0,229,153,0.8)]'
                              : 'bg-slate-800'
                          }`}
                        />
                      </div>

                      {/* Dynamic Checklist Validation with Pop Micro-Interactions */}
                      <div className="p-3 bg-[#0b0e17]/60 border border-slate-800/80 rounded-xl flex flex-col gap-2 mt-1 transition-colors duration-200">
                        <span className="text-[11px] text-slate-400 font-semibold">
                          Requisitos mínimos de seguridad:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div
                            className={`flex items-center gap-1.5 text-xs transition-all duration-200 ${
                              hasMinLength ? 'text-emerald-400 font-medium' : 'text-slate-400'
                            }`}
                          >
                            {hasMinLength ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 animate-pop-bounce" />
                            ) : (
                              <Circle className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                            )}
                            <span>Mín. 8 caracteres</span>
                          </div>

                          <div
                            className={`flex items-center gap-1.5 text-xs transition-all duration-200 ${
                              hasUppercase ? 'text-emerald-400 font-medium' : 'text-slate-400'
                            }`}
                          >
                            {hasUppercase ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 animate-pop-bounce" />
                            ) : (
                              <Circle className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                            )}
                            <span>1 Mayúscula</span>
                          </div>

                          <div
                            className={`flex items-center gap-1.5 text-xs transition-all duration-200 ${
                              hasNumber ? 'text-emerald-400 font-medium' : 'text-slate-400'
                            }`}
                          >
                            {hasNumber ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 animate-pop-bounce" />
                            ) : (
                              <Circle className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                            )}
                            <span>1 Número</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* FIELD 3: Confirm New Password */}
                    <div
                      className="flex flex-col gap-1.5 animate-card-enter"
                      style={{ animationDelay: '200ms' }}
                    >
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="confirm-password"
                          className={`text-xs font-semibold flex items-center gap-1 transition-colors duration-200 ${
                            focusedField === 'confirm' ? 'text-white' : 'text-slate-300'
                          }`}
                        >
                          <span>Confirmar nueva contraseña</span>
                          <span className="text-emerald-400">*</span>
                        </label>
                        {passwordsMatch && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-bold bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full animate-pop-bounce shadow-[0_0_10px_rgba(0,229,153,0.25)]">
                            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                            <span>Coinciden</span>
                          </span>
                        )}
                      </div>

                      <div className="relative flex items-center group">
                        <Shield
                          className={`h-4 w-4 absolute left-3.5 pointer-events-none transition-all duration-200 ${
                            focusedField === 'confirm' ? 'text-emerald-400 scale-110' : 'text-slate-400'
                          }`}
                        />
                        <input
                          id="confirm-password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onFocus={() => setFocusedField('confirm')}
                          onBlur={() => setFocusedField(null)}
                          onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            setPasswordMismatchError(false);
                          }}
                          placeholder="Repite tu nueva contraseña"
                          className={`w-full pl-10 pr-10 py-3 bg-[#0b0e17] rounded-xl text-sm text-white placeholder:text-slate-500 border transition-all duration-200 outline-none ${
                            passwordMismatchError
                              ? 'border-rose-500 ring-2 ring-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.2)]'
                              : focusedField === 'confirm'
                              ? 'border-emerald-500 ring-2 ring-emerald-500/30 shadow-[0_0_18px_rgba(0,229,153,0.15)] scale-[1.008]'
                              : 'border-slate-800 hover:border-slate-700'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          className="absolute right-3.5 text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer active:scale-90"
                          title={showConfirmPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Primary Action Button with Dynamic Glow & Click Physics */}
                    <button
                      type="submit"
                      disabled={isPending}
                      className="group relative mt-2 w-full py-3.5 px-6 rounded-full bg-emerald-500 hover:bg-emerald-400 font-bold text-slate-950 flex items-center justify-center gap-2 transition-all duration-300 shadow-[0_0_24px_rgba(0,229,153,0.3)] hover:shadow-[0_0_36px_rgba(0,229,153,0.55)] hover:scale-[1.01] hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed animate-card-enter"
                      style={{ animationDelay: '240ms' }}
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span>Guardando credenciales...</span>
                        </>
                      ) : (
                        <>
                          <span>Guardar y acceder a Rendy</span>
                          <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1.5" />
                        </>
                      )}
                    </button>
                  </form>

                  {/* Bottom Security Note */}
                  <div className="pt-2 flex items-center justify-center gap-2 text-center text-slate-400 text-xs animate-enter-up" style={{ animationDelay: '280ms' }}>
                    <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Tu cuenta está protegida mediante una conexión TLS 256-bit cifrada.</span>
                  </div>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
               * SUB-VIEW 2: INVITACIÓN EXPIRADA
               * ───────────────────────────────────────────────────────────── */}
              {screenState === 'expired' && (
                <div className="p-8 sm:p-10 flex flex-col items-center text-center gap-6 animate-enter-card">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-[0_0_30px_rgba(251,191,36,0.25)] animate-pulse">
                    <Clock className="h-8 w-8 text-amber-400" />
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-amber-400 text-[11px] font-semibold tracking-wider uppercase shadow-sm">
                      <span>Acceso caducado</span>
                    </div>
                    <h2 className="text-2xl font-bold text-white">Tu invitación ha expirado</h2>
                    <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
                      Por motivos de seguridad, los enlaces temporales de activación son válidos por 72 horas. Solicita a un administrador de <strong className="text-white">{companyName}</strong> que te reenvíe una nueva invitación.
                    </p>
                  </div>

                  <div className="w-full bg-[#0b0e17]/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between text-left shadow-sm">
                    <div className="flex items-center gap-3">
                      <Shield className="h-6 w-6 text-amber-400" />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-white">Invitación enviada a</span>
                        <span className="text-xs text-slate-400">{email || 'colaborador@empresa.com'}</span>
                      </div>
                    </div>
                    <span className="text-[11px] text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2.5 py-1 rounded-md font-bold">
                      Caducado
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full pt-2">
                    <button
                      type="button"
                      onClick={() => handleSimulatorSwitch('active')}
                      className="w-full py-3 px-5 rounded-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all duration-200 cursor-pointer active:scale-95"
                    >
                      Probar otro enlace
                    </button>
                    <a
                      href="mailto:soporte@rendy.app"
                      className="w-full py-3 px-5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-all duration-200 shadow-[0_0_20px_rgba(0,229,153,0.25)] hover:shadow-[0_0_30px_rgba(0,229,153,0.4)] active:scale-95"
                    >
                      <Headphones className="h-4 w-4" />
                      <span>Contactar a Soporte</span>
                    </a>
                  </div>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
               * SUB-VIEW 3: YA ACTIVADA
               * ───────────────────────────────────────────────────────────── */}
              {screenState === 'already-active' && (
                <div className="p-8 sm:p-10 flex flex-col items-center text-center gap-6 animate-enter-card">
                  <div className="w-16 h-16 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shadow-[0_0_30px_rgba(76,215,246,0.25)]">
                    <CheckCircle2 className="h-8 w-8 text-cyan-400" />
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-cyan-400 text-[11px] font-semibold tracking-wider uppercase shadow-sm">
                      <span>Cuenta ya configurada</span>
                    </div>
                    <h2 className="text-2xl font-bold text-white">Tu cuenta ya está activada</h2>
                    <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
                      Tu acceso a Rendy para <strong className="text-white">{email || 'tu cuenta'}</strong> ya fue configurado exitosamente con anterioridad. Puedes ingresar directamente al sistema.
                    </p>
                  </div>

                  <div className="w-full bg-[#0b0e17]/80 border border-slate-800 rounded-xl p-4 flex items-center gap-3 text-left shadow-sm">
                    <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                      {companyInitials}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-white">Organización vinculada</span>
                      <span className="text-xs text-slate-400 truncate">{companyName} • Rol Colaborador</span>
                    </div>
                  </div>

                  <Link
                    href="/login"
                    className="w-full py-3.5 px-6 rounded-full bg-emerald-500 hover:bg-emerald-400 font-bold text-slate-950 flex items-center justify-center gap-2 transition-all duration-200 shadow-[0_0_24px_rgba(0,229,153,0.3)] hover:shadow-[0_0_35px_rgba(0,229,153,0.5)] active:scale-95 cursor-pointer"
                  >
                    <span>Iniciar sesión ahora</span>
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
               * SUB-VIEW 4: ACTIVACIÓN EXITOSA
               * ───────────────────────────────────────────────────────────── */}
              {screenState === 'success' && (
                <div className="p-8 sm:p-10 flex flex-col items-center text-center gap-6 animate-enter-card">
                  {/* Animated bouncing check icon with pulsing ring */}
                  <div className="relative flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-[0_0_40px_rgba(0,229,153,0.4)] animate-bounce border border-emerald-500/30">
                      <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                    </div>
                    <div className="absolute inset-0 rounded-full border-2 border-emerald-500/30 animate-ping opacity-60" />
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold tracking-wider uppercase shadow-sm">
                      <span>Acceso configurado</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white">¡Tu cuenta está lista!</h2>
                    <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
                      Tu nueva contraseña personal se ha registrado con cifrado seguro. Te estamos redireccionando a tu espacio de trabajo...
                    </p>
                  </div>

                  {/* Profile Summary Card */}
                  <div className="w-full bg-[#0b0e17]/90 border border-slate-800 rounded-xl p-4 flex items-center justify-between text-left shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-emerald-400/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
                        {companyInitials}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-white truncate">{companyName}</span>
                        <span className="text-xs text-slate-400 truncate">{email || 'colaborador@empresa.com'}</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold uppercase">
                      Colaborador Activo
                    </span>
                  </div>

                  {/* Animated Redirection Progress Bar with Smooth Filling */}
                  <div className="w-full flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Redirigiendo a tu panel...</span>
                      <span className="text-emerald-400 font-bold animate-price-tick">{countdown}s</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden shadow-inner">
                      <div
                        className="h-full bg-emerald-400 rounded-full transition-all ease-linear shadow-[0_0_12px_rgba(0,229,153,0.8)]"
                        style={{
                          width: `${((3 - countdown) / 3) * 100}%`,
                          transitionDuration: '1000ms',
                        }}
                      />
                    </div>
                  </div>

                  {/* Direct CTA */}
                  <Link
                    href="/dashboard"
                    className="w-full py-3.5 px-6 rounded-full bg-emerald-500 hover:bg-emerald-400 font-bold text-slate-950 flex items-center justify-center gap-2 transition-all duration-300 shadow-[0_0_24px_rgba(0,229,153,0.3)] hover:shadow-[0_0_36px_rgba(0,229,153,0.55)] hover:scale-[1.01] active:scale-95 cursor-pointer"
                  >
                    <span>Ir a mi panel ahora</span>
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full border-t border-slate-900 bg-[#0b0e17]/90 py-6 text-center text-xs text-slate-400 animate-enter-up" style={{ animationDelay: '360ms' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Rendy by SWORC. Todos los derechos reservados.</p>
          <div className="flex items-center gap-6">
            <Link href="#" className="hover:text-slate-300 transition-colors">
              Privacidad
            </Link>
            <Link href="#" className="hover:text-slate-300 transition-colors">
              Términos de Servicio
            </Link>
            <Link href="#" className="hover:text-slate-300 transition-colors">
              Cumplimiento Normativo
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
