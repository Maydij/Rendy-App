'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { RendyLogo } from '@/components/rendy-logo';
import { Icon } from '@/components/landing/primitives';

/**
 * @name useAnimatedCounter
 * @description [Business Logic]: Animates a numeric metric from 0 to target value on page load
 * using an easeOutCubic curve for high-precision fintech dashboard telemetry.
 */
function useAnimatedCounter(
  target: number,
  duration: number = 1700,
  delay: number = 300,
  isCurrency: boolean = false,
): string {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let rafId: number;
    const timer = setTimeout(() => {
      const startTime = performance.now();
      const tick = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = target * eased;
        setValue(current);

        if (progress < 1) {
          rafId = requestAnimationFrame(tick);
        } else {
          setValue(target);
        }
      };
      rafId = requestAnimationFrame(tick);
    }, delay);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(rafId);
    };
  }, [target, duration, delay]);

  if (isCurrency) {
    const parts = value.toFixed(2).split('.');
    const integerWithDots = Number(parts[0]).toLocaleString('es-ES');
    return `$${integerWithDots},${parts[1]}`;
  }

  return String(Math.round(value));
}

/**
 * @name AuthVisuals
 * @description [Business Logic]: Renders the branded institutional left column for the login portal,
 * featuring real-time financial telemetry preview, active spending metrics with live count-up animations,
 * dynamic floating levitation, and enterprise compliance badges.
 */
export function AuthVisuals() {
  const animatedCurrency = useAnimatedCounter(12480.5, 1800, 350, true);
  const animatedApproved = useAnimatedCounter(24, 1400, 450, false);
  const animatedPending = useAnimatedCounter(8, 1400, 500, false);
  const animatedReimbursed = useAnimatedCounter(12, 1400, 550, false);

  return (
    <div className="hidden lg:flex lg:w-[45%] xl:w-[42%] 2xl:w-[40%] bg-surface-container-lowest relative flex-col justify-between p-10 xl:p-14 overflow-hidden border-r border-outline-variant/15 select-text">
      {/* Ambient background glow orbs with breathing motion */}
      <div
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary-container/15 blur-[120px] pointer-events-none animate-glow-ambient"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-secondary-fixed-dim/15 blur-[120px] pointer-events-none animate-glow-ambient"
        style={{ animationDelay: '3.5s' }}
        aria-hidden="true"
      />

      {/* Top Header: Brand Logo */}
      <div className="relative z-10 animate-enter-down">
        <Link href="/" className="inline-block hover:opacity-90 transition-opacity">
          <RendyLogo className="h-8 w-auto" />
        </Link>
      </div>

      {/* Central Content: Value Proposition & Live Financial Telemetry */}
      <div className="relative z-10 my-auto py-8">
        {/* Pill Badge */}
        <div
          className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-surface-container-high/80 backdrop-blur-xl mb-6 shadow-sm border border-outline-variant/20 animate-enter-down"
          style={{ animationDelay: '80ms' }}
        >
          <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse" />
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary font-bold">
            Gestión Inteligente de Gastos
          </span>
        </div>

        {/* Hero Title (Fully Selectable & Animated) */}
        <h1
          className="font-display text-[40px] xl:text-[46px] leading-[1.12] font-bold text-on-surface mb-4 tracking-tight select-text cursor-text animate-enter-up"
          style={{ animationDelay: '130ms' }}
        >
          El control de los gastos de tu empresa, en un solo lugar.
        </h1>

        {/* Narrative Description (Fully Selectable & Animated) */}
        <p
          className="text-body-lg text-on-surface-variant max-w-md mb-8 leading-relaxed select-text cursor-text animate-enter-up"
          style={{ animationDelay: '180ms' }}
        >
          Gestiona viáticos, gastos corporativos y reembolsos desde una única plataforma. Simplifica
          los procesos administrativos, mejora la visibilidad financiera y mantén cada gasto bajo control.
        </p>

        {/* Live Corporate Spending Preview Card (Animated Floating & Interactive HUD) */}
        <div
          className="relative group animate-enter-card"
          style={{ animationDelay: '240ms' }}
        >
          <div className="bg-surface-container-low/75 backdrop-blur-xl rounded-2xl p-6 border border-outline-variant/30 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] animate-float-gentle hover:shadow-[0_25px_60px_-12px_rgba(0,229,153,0.22)] hover:border-primary-container/40 transition-all duration-300 relative overflow-hidden">
            {/* Ambient light sweep reflection */}
            <div
              className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none"
              aria-hidden="true"
            >
              <div className="w-1/2 h-full bg-gradient-to-r from-transparent via-primary-container/10 to-transparent skew-x-[-20deg] animate-pricing-shine" />
            </div>

            {/* Card Header */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-surface-container-high/60 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-primary-container shadow-sm">
                  <Icon name="payments" className="text-[20px]" />
                </div>
                <div>
                  <p className="text-label-md text-on-surface font-semibold leading-tight">
                    Resumen de gastos corporativos
                  </p>
                  <p className="text-label-sm text-on-surface-variant mt-0.5">
                    Control financiero empresarial
                  </p>
                </div>
              </div>

              {/* Active Realtime Status Badge */}
              <span className="text-label-sm text-primary-container px-3 py-1 rounded-full bg-primary-container/15 font-semibold flex items-center gap-1.5 border border-primary-container/20 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-container opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-container" />
                </span>
                Activo en tiempo real
              </span>
            </div>

            {/* Metric Row with Live Animated Numbers */}
            <div className="mb-4 relative z-10">
              <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-1 font-medium">
                Total procesado este mes
              </p>
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-[34px] xl:text-[38px] font-bold text-on-surface tracking-tight tabular-nums">
                    {animatedCurrency}
                  </span>
                  <span className="text-headline-md text-on-surface-variant font-medium">
                    USD
                  </span>
                </div>
                <span className="text-label-md text-primary-container font-semibold flex items-center gap-1 bg-primary-container/10 px-2 py-0.5 rounded-md border border-primary-container/20">
                  <Icon name="trending_up" className="text-[16px]" />
                  +18.4%
                </span>
              </div>
            </div>

            {/* 3-Column Breakdown with Animated Values */}
            <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-surface-container-high/40 relative z-10">
              <div className="bg-surface-container/60 rounded-xl p-2.5 hover:bg-surface-container transition-colors">
                <p className="text-label-sm text-on-surface-variant font-medium">Aprobados</p>
                <p className="font-headline-sm text-headline-sm font-bold text-on-surface mt-0.5 tabular-nums">
                  {animatedApproved}
                </p>
              </div>
              <div className="bg-surface-container/60 rounded-xl p-2.5 hover:bg-surface-container transition-colors">
                <p className="text-label-sm text-on-surface-variant font-medium">Pendientes</p>
                <p className="font-headline-sm text-headline-sm font-bold text-tertiary-fixed-dim mt-0.5 tabular-nums">
                  {animatedPending.padStart(2, '0')}
                </p>
              </div>
              <div className="bg-surface-container/60 rounded-xl p-2.5 hover:bg-surface-container transition-colors">
                <p className="text-label-sm text-on-surface-variant font-medium">Reembolsos</p>
                <p className="font-headline-sm text-headline-sm font-bold text-secondary-fixed mt-0.5 tabular-nums">
                  {animatedReimbursed}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer: Security Certification & System Version */}
      <div
        className="relative z-10 flex items-center justify-between text-label-sm text-on-surface-variant font-medium animate-enter-up"
        style={{ animationDelay: '320ms' }}
      >
        <div className="flex items-center gap-2">
          <Icon name="verified_user" className="text-primary-container text-[16px]" />
          <span>ISO 27001 &amp; SOC 2 Type II Verified</span>
        </div>
        <span>v2.14.0 Enterprise</span>
      </div>
    </div>
  );
}
