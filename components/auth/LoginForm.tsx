'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/landing/primitives';
import { RendyLogo } from '@/components/rendy-logo';

/**
 * @name LoginForm
 * @description [Business Logic]: Manages corporate user authentication, credential validation,
 * interactive password visibility toggling, error state previewing for enterprise compliance,
 * and SSO identity federation (Google Workspace & Microsoft 365).
 */
export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isErrorActive, setIsErrorActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * @name handleToggleErrorState
   * @description Toggles between normal state and simulated validation error
   * for enterprise compliance and security audit reviews.
   */
  const handleToggleErrorState = () => {
    setIsErrorActive((prev) => {
      const next = !prev;
      if (next) {
        setEmail('usuario.invalido@rendy-test.io');
      } else {
        setEmail('');
      }
      return next;
    });
  };

  /**
   * @name handleSubmit
   * @description Handles form submission, simulates verification, and redirects to dashboard.
   */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate verification delay for realistic UX
    setTimeout(() => {
      setIsLoading(false);
      router.push('/dashboard');
    }, 700);
  };

  /**
   * @name handleSSOLogin
   * @description Handles federated single sign-on redirect for corporate identities.
   */
  const handleSSOLogin = (provider: 'google' | 'microsoft') => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      router.push('/dashboard');
    }, 600);
  };

  return (
    <div className="w-full lg:w-[55%] xl:w-[58%] 2xl:w-[60%] bg-surface flex flex-col justify-between min-h-screen relative p-6 sm:p-10 lg:p-12">
      {/* Header bar: Telemetry & Gateway Status */}
      <header className="w-full flex items-center justify-between z-20 pb-4">
        {/* Mobile Brand Logo */}
        <div className="flex items-center gap-2 lg:hidden">
          <Link href="/">
            <RendyLogo className="h-7 w-auto" />
          </Link>
        </div>

        {/* Desktop Secure Gateway Indicator */}
        <div className="hidden lg:flex items-center gap-2 text-on-surface-variant font-label-md text-label-md">
          <Icon name="terminal" className="text-primary-container text-[20px]" />
          <span>Secure FinTech Gateway</span>
        </div>

        {/* System Telemetry Link / Indicator */}
        <div className="font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1.5 cursor-default select-none">
          <span>System Telemetry</span>
          <span className="relative flex h-2 w-2 ml-0.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-container opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-container" />
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full flex-1 flex flex-col justify-center max-w-md mx-auto py-8 relative z-10">
        <div className="w-full flex flex-col">
          {/* Top Environment Bar & Simulated Audit Toggle */}
          <div className="flex items-center justify-between mb-4 bg-surface-container-low px-4 py-2 rounded-xl border border-outline-variant/20 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-container opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-container" />
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                Entorno Producción v2.14
              </span>
            </div>

            <button
              type="button"
              onClick={handleToggleErrorState}
              className="font-label-sm text-label-sm px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-primary-container transition-all flex items-center gap-1 cursor-pointer border border-outline-variant/20"
              title="Alternar previsualización de error de autenticación"
            >
              <Icon name="bug_report" className="text-[14px]" />
              <span>{isErrorActive ? 'Restablecer estado normal' : 'Ver estado con error'}</span>
            </button>
          </div>

          {/* Main Auth Card */}
          <div className="bg-surface-container-lowest/85 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-outline-variant/30 shadow-2xl relative overflow-hidden">
            {/* Ambient glow accent */}
            <div
              className="absolute -top-24 -right-24 w-64 h-64 bg-primary-container/10 rounded-full blur-[80px] pointer-events-none"
              aria-hidden="true"
            />

            {/* Header Section */}
            <div className="relative z-10 mb-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container mb-3 border border-outline-variant/20">
                <Icon name="shield" className="text-primary-container text-[14px]" />
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wide font-bold">
                  Acceso Seguro Corporativo
                </span>
              </div>
              <h2 className="font-display text-[30px] sm:text-[34px] font-bold text-on-surface tracking-tight leading-tight">
                ¡Bienvenido de nuevo!
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-1.5">
                Ingresa a tu cuenta para continuar gestionando tus finanzas corporativas.
              </p>
            </div>

            {/* Dynamic Feedback Banner (Simulated validation error) */}
            {isErrorActive && (
              <div
                className="relative z-10 mb-5 p-4 rounded-xl bg-error-container/40 border border-error/40 text-on-error-container animate-in fade-in slide-in-from-top-2 duration-300"
                role="alert"
              >
                <div className="flex items-start gap-3">
                  <Icon name="error" className="text-error text-[22px] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-label-md text-label-md font-bold text-white">
                      Credenciales no coincidentes
                    </p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant mt-0.5 leading-relaxed">
                      El correo institucional o la clave ingresada no son válidos en el directorio SSO.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Authentication Form */}
            <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
              {/* Field 1: Correo electrónico */}
              <div>
                <label
                  htmlFor="email-field"
                  className="font-label-md text-label-md text-on-surface mb-1.5 flex items-center justify-between"
                >
                  <span className="font-semibold">Correo electrónico</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                    SSO habilitado
                  </span>
                </label>
                <div className="relative rounded-xl bg-surface-container-high border border-outline-variant/30 focus-within:border-primary-container focus-within:ring-2 focus-within:ring-primary-container/20 transition-all">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-on-surface-variant">
                    <Icon name="alternate_email" className="text-[20px]" />
                  </div>
                  <input
                    id="email-field"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nombre@empresa.com"
                    required
                    className="w-full pl-11 pr-4 py-3 bg-transparent rounded-xl text-on-surface font-body-md text-body-md placeholder-on-surface-variant/40 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Field 2: Contraseña */}
              <div>
                <label
                  htmlFor="password-field"
                  className="block font-label-md text-label-md text-on-surface mb-1.5 font-semibold"
                >
                  Contraseña
                </label>
                <div className="relative rounded-xl bg-surface-container-high border border-outline-variant/30 focus-within:border-primary-container focus-within:ring-2 focus-within:ring-primary-container/20 transition-all">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-on-surface-variant">
                    <Icon name="lock" className="text-[20px]" />
                  </div>
                  <input
                    id="password-field"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ingresa tu contraseña"
                    required
                    className="w-full pl-11 pr-11 py-3 bg-transparent rounded-xl text-on-surface font-body-md text-body-md placeholder-on-surface-variant/40 focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    <Icon
                      name={showPassword ? 'visibility_off' : 'visibility'}
                      className="text-[20px]"
                    />
                  </button>
                </div>
              </div>

              {/* Utilities Row: Remember Me & Forgot Password */}
              <div className="flex items-center justify-between pt-1 font-label-md text-label-md">
                <label className="flex items-center gap-2 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-outline-variant bg-surface-container-high accent-[#00e599] cursor-pointer"
                  />
                  <span className="text-on-surface-variant group-hover:text-on-surface transition-colors">
                    Recordarme en este equipo
                  </span>
                </label>
                <Link
                  href="#recuperar"
                  onClick={(e) => {
                    e.preventDefault();
                    alert('Por favor contacta al administrador de TI de tu empresa para restablecer tus credenciales SSO.');
                  }}
                  className="text-primary-container hover:underline transition-colors font-medium"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-6 rounded-xl bg-primary-container text-on-primary-fixed font-headline-sm text-[16px] font-bold shadow-glow hover:shadow-glow-lg hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:pointer-events-none mt-2"
              >
                {isLoading ? (
                  <span>Verificando credenciales...</span>
                ) : (
                  <>
                    <span>Iniciar sesión</span>
                    <Icon name="arrow_forward" className="text-[20px] font-bold" />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-6 flex items-center justify-center">
              <div className="w-full bg-surface-container-high h-[1px]" />
              <span className="absolute bg-surface-container-lowest px-3 font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                O continúa con
              </span>
            </div>

            {/* SSO Corporate Providers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {/* Google Workspace */}
              <button
                type="button"
                onClick={() => handleSSOLogin('google')}
                className="flex items-center justify-center gap-2.5 py-3 px-4 bg-surface-container hover:bg-surface-container-high rounded-xl text-on-surface font-label-md text-label-md font-semibold transition-all group border border-outline-variant/20 hover:border-outline-variant/40 cursor-pointer shadow-sm"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.14z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.97 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    fill="#EA4335"
                  />
                </svg>
                <span className="group-hover:text-on-surface transition-colors">Google Workspace</span>
              </button>

              {/* Microsoft 365 */}
              <button
                type="button"
                onClick={() => handleSSOLogin('microsoft')}
                className="flex items-center justify-center gap-2.5 py-3 px-4 bg-surface-container hover:bg-surface-container-high rounded-xl text-on-surface font-label-md text-label-md font-semibold transition-all group border border-outline-variant/20 hover:border-outline-variant/40 cursor-pointer shadow-sm"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 23 23" aria-hidden="true">
                  <path d="M1 1h10v10H1z" fill="#f35325" />
                  <path d="M12 1h10v10H12z" fill="#81bc06" />
                  <path d="M1 12h10v10H1z" fill="#05a6f0" />
                  <path d="M12 12h10v10H12z" fill="#ffba08" />
                </svg>
                <span className="group-hover:text-on-surface transition-colors">Microsoft 365</span>
              </button>
            </div>

            {/* Footer switch view & trust badge */}
            <div className="text-center pt-1">
              <p className="font-body-md text-body-md text-on-surface-variant mb-4">
                ¿Todavía no tienes una cuenta?{' '}
                <Link
                  href="/#solicitar-demo"
                  className="text-primary-container font-semibold hover:underline transition-colors ml-1"
                >
                  Regístrate
                </Link>
              </p>

              <div className="inline-flex items-center gap-2 text-on-surface-variant font-label-sm text-label-sm py-1.5 px-4 rounded-full bg-surface-container/60 border border-outline-variant/20">
                <Icon name="lock" className="text-primary-container text-[14px]" />
                <span>Conexión cifrada con certificación SOC 2 y TLS 1.3</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer bar: SSL Encryption & Legal Compliance */}
      <footer className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 text-label-sm font-label-sm text-on-surface-variant pt-4 z-20">
        <div className="flex items-center gap-2">
          <Icon name="lock" className="text-primary-container text-[15px]" />
          <span>256-bit SSL Encryption • Rendy FinTech Security</span>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/privacy" className="hover:text-on-surface transition-colors">
            Privacy Policy
          </Link>
          <span className="text-outline-variant">•</span>
          <Link href="/terms" className="hover:text-on-surface transition-colors">
            Terms of Service
          </Link>
          <span className="text-outline-variant">•</span>
          <Link href="/compliance" className="hover:text-on-surface transition-colors">
            Compliance
          </Link>
        </div>
      </footer>
    </div>
  );
}

