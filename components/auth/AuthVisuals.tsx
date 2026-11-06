import React from 'react';
import Link from 'next/link';
import { RendyLogo } from '@/components/rendy-logo';
import { Icon } from '@/components/landing/primitives';

/**
 * @name AuthVisuals
 * @description [Business Logic]: Renders the branded institutional left column for the login portal,
 * featuring real-time financial telemetry preview, active spending metrics, and enterprise compliance badges
 * to build trust and authority before authentication.
 */
export function AuthVisuals() {
  return (
    <div className="hidden lg:flex lg:w-[45%] xl:w-[42%] 2xl:w-[40%] bg-surface-container-lowest relative flex-col justify-between p-10 xl:p-14 overflow-hidden border-r border-outline-variant/15 select-none">
      {/* Ambient background glow orbs */}
      <div
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary-container/10 blur-[120px] pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-secondary-fixed-dim/10 blur-[120px] pointer-events-none"
        aria-hidden="true"
      />

      {/* Top Header: Brand Logo */}
      <div className="relative z-10">
        <Link href="/" className="inline-block hover:opacity-90 transition-opacity">
          <RendyLogo className="h-8 w-auto" />
        </Link>
      </div>

      {/* Central Content: Value Proposition & Live Financial Telemetry */}
      <div className="relative z-10 my-auto py-10">
        {/* Pill Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-surface-container-high/80 backdrop-blur-xl mb-6 shadow-sm border border-outline-variant/20">
          <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse" />
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary font-bold">
            Gestión Inteligente de Gastos
          </span>
        </div>

        {/* Hero Title */}
        <h1 className="font-display text-[40px] xl:text-[46px] leading-[1.12] font-bold text-on-surface mb-4 tracking-tight">
          El control de los gastos de tu empresa, en un solo lugar.
        </h1>

        {/* Narrative Description */}
        <p className="text-body-lg text-on-surface-variant max-w-md mb-8 leading-relaxed">
          Gestiona viáticos, gastos corporativos y reembolsos desde una única plataforma. Simplifica
          los procesos administrativos, mejora la visibilidad financiera y mantén cada gasto bajo control.
        </p>

        {/* Live Corporate Spending Preview Card */}
        <div className="bg-surface-container-low/70 backdrop-blur-xl rounded-2xl p-6 border border-outline-variant/30 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)]">
          {/* Card Header */}
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-surface-container-high/60">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-primary-container">
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
            <span className="text-label-sm text-primary-container px-3 py-1 rounded-full bg-primary-container/15 font-semibold flex items-center gap-1.5 border border-primary-container/20">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse" />
              Activo en tiempo real
            </span>
          </div>

          {/* Metric Row */}
          <div className="mb-4">
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-1 font-medium">
              Total procesado este mes
            </p>
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-[34px] xl:text-[38px] font-bold text-on-surface tracking-tight">
                  $12.480,50
                </span>
                <span className="text-headline-md text-on-surface-variant font-medium">
                  USD
                </span>
              </div>
              <span className="text-label-md text-primary-container font-semibold flex items-center gap-1">
                <Icon name="trending_up" className="text-[16px]" />
                +18.4%
              </span>
            </div>
          </div>

          {/* 3-Column Breakdown */}
          <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-surface-container-high/40">
            <div className="bg-surface-container/60 rounded-xl p-2.5">
              <p className="text-label-sm text-on-surface-variant font-medium">Aprobados</p>
              <p className="font-headline-sm text-headline-sm font-bold text-on-surface mt-0.5">
                24
              </p>
            </div>
            <div className="bg-surface-container/60 rounded-xl p-2.5">
              <p className="text-label-sm text-on-surface-variant font-medium">Pendientes</p>
              <p className="font-headline-sm text-headline-sm font-bold text-tertiary-fixed-dim mt-0.5">
                08
              </p>
            </div>
            <div className="bg-surface-container/60 rounded-xl p-2.5">
              <p className="text-label-sm text-on-surface-variant font-medium">Reembolsos</p>
              <p className="font-headline-sm text-headline-sm font-bold text-secondary-fixed mt-0.5">
                12
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer: Security Certification & System Version */}
      <div className="relative z-10 flex items-center justify-between text-label-sm text-on-surface-variant font-medium">
        <div className="flex items-center gap-2">
          <Icon name="verified_user" className="text-primary-container text-[16px]" />
          <span>ISO 27001 &amp; SOC 2 Type II Verified</span>
        </div>
        <span>v2.14.0 Enterprise</span>
      </div>
    </div>
  );
}

