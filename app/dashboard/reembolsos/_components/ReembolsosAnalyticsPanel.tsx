'use client';

/**
 * @name ReembolsosAnalyticsPanel
 * @description [UI Component]: Two-column Treasury & Multi-Currency analytics panel showing
 * real currency/category breakdowns and live BCV parity metrics for active corporate reimbursements.
 */

import React from 'react';
import {
  PieChart,
  Landmark,
  ArrowLeftRight,
  Utensils,
  Car,
  Receipt,
  Tag,
} from 'lucide-react';
import type { ReembolsosKpisResponse } from '@/lib/services/reembolsos.service';

interface ReembolsosAnalyticsPanelProps {
  kpis: ReembolsosKpisResponse;
}

function formatNum(value: number, locale: string = 'en-US'): string {
  return value.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCurrencyNominal(currency: string, nominalTotal: number): string {
  if (currency === 'VES') return `Bs. ${formatNum(nominalTotal, 'es-VE')}`;
  if (currency === 'EUR') return `€${formatNum(nominalTotal)}`;
  if (currency === 'MXN') return `$${formatNum(nominalTotal)} MXN`;
  if (currency === 'USD') return `$${formatNum(nominalTotal)} USD`;
  return `${formatNum(nominalTotal)} ${currency}`;
}

function getCurrencyLabel(currency: string): string {
  const labels: Record<string, string> = {
    VES: 'VES (Bolívares)',
    USD: 'USD (Dólares Directos)',
    MXN: 'MXN (Pesos Mexicanos)',
    EUR: 'EUR (Euros)',
    COP: 'COP (Pesos Colombianos)',
  };
  return labels[currency] || currency;
}

function getCategoryIcon(category: string) {
  const lower = category.toLowerCase();
  if (lower.includes('food') || lower.includes('alim') || lower.includes('comida')) {
    return Utensils;
  }
  if (lower.includes('transp') || lower.includes('uber') || lower.includes('taxi')) {
    return Car;
  }
  if (lower.includes('otros') || lower.includes('misc')) {
    return Tag;
  }
  return Receipt;
}

export function ReembolsosAnalyticsPanel({ kpis }: ReembolsosAnalyticsPanelProps) {
  const pendingLiabilityUsd = Number(
    (kpis.pendientesMontoUsd + kpis.procesadosMontoUsd).toFixed(2)
  );
  const bcvRate = kpis.bcvRate > 0 ? kpis.bcvRate : 1;
  const pendingLiabilityVes = pendingLiabilityUsd * bcvRate;

  const settleableCount = Math.max(kpis.totalCount - kpis.rechazadosCount, 0);
  const settlementRate =
    settleableCount > 0
      ? Math.round((kpis.transferidosCount / settleableCount) * 100)
      : 0;

  const currencyColors = [
    { dot: 'bg-secondary', bar: 'bg-secondary', text: 'text-secondary' },
    { dot: 'bg-primary-container', bar: 'bg-primary-container', text: 'text-primary' },
    { dot: 'bg-tertiary-fixed-dim', bar: 'bg-tertiary-fixed-dim', text: 'text-tertiary-fixed-dim' },
    { dot: 'bg-primary-fixed', bar: 'bg-primary-fixed', text: 'text-primary-fixed' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 relative z-10">
      {/* Left Column: Multi-Currency & Category Distribution */}
      <div className="rounded-2xl bg-surface-container-low p-5 flex flex-col justify-between shadow-md gap-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <PieChart className="w-5 h-5 text-secondary shrink-0" />
            <h2 className="text-sm sm:text-base text-on-surface font-semibold truncate">
              Distribución de Reembolsos por Moneda &amp; Categoría
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-on-surface-variant bg-surface-container-highest px-2.5 py-0.5 rounded-md shrink-0">
            {kpis.totalCount} {kpis.totalCount === 1 ? 'Ítem' : 'Ítems'}
          </span>
        </div>

        {/* Currency Progress Bars */}
        <div className="flex flex-col gap-3">
          {kpis.currencyBreakdown.length === 0 ? (
            <div className="p-4 rounded-xl bg-surface-container-lowest text-center text-xs text-on-surface-variant">
              Aún no hay reembolsos registrados para desglosar por moneda.
            </div>
          ) : (
            kpis.currencyBreakdown.slice(0, 4).map((item, idx) => {
              const palette = currencyColors[idx % currencyColors.length];
              return (
                <div key={item.currency}>
                  <div className="flex items-center justify-between gap-2 text-[11px] mb-1">
                    <span className="text-on-surface font-semibold flex items-center gap-1.5 truncate">
                      <span className={`w-2 h-2 rounded-full ${palette.dot} shrink-0`} />
                      <span className="truncate">{getCurrencyLabel(item.currency)}</span>
                    </span>
                    <span className="text-on-surface-variant shrink-0 font-mono">
                      {formatCurrencyNominal(item.currency, item.nominalTotal)}{' '}
                      <span className={`${palette.text} font-semibold`}>
                        ({item.currency !== 'USD' ? `~$${formatNum(item.usdTotal)} USD · ` : ''}
                        {item.percent}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-surface-container-highest overflow-hidden">
                    <div
                      className={`h-full ${palette.bar} rounded-full transition-all duration-500`}
                      style={{ width: `${Math.max(item.percent, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Category Pills Breakdown */}
        {kpis.categoryBreakdown.length > 0 && (
          <div className="pt-3 border-t border-surface-container-highest/20 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-on-surface-variant mr-1">
              Categorías:
            </span>
            {kpis.categoryBreakdown.slice(0, 4).map((cat, idx) => {
              const CatIcon = getCategoryIcon(cat.category);
              const badgeStyle =
                idx === 0
                  ? 'text-primary'
                  : idx === 1
                  ? 'text-secondary'
                  : 'text-on-surface-variant';
              return (
                <span
                  key={cat.category}
                  className={`px-2.5 py-1 rounded-lg bg-surface-container-high ${badgeStyle} text-[11px] font-semibold flex items-center gap-1.5`}
                >
                  <CatIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {cat.category} {cat.percent}%
                  </span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Column: Treasury Settlement Control & Exchange Rate */}
      <div className="rounded-2xl bg-surface-container-low p-5 flex flex-col justify-between shadow-md gap-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Landmark className="w-5 h-5 text-primary-container shrink-0" />
            <h2 className="text-sm sm:text-base text-on-surface font-semibold truncate">
              Control de Tesorería &amp; Dispersión
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] bg-primary-container/20 text-primary font-semibold shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-container" />
            Operativa
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Pending Liability Card */}
          <div className="p-3.5 rounded-xl bg-surface-container-lowest flex flex-col gap-1 min-w-0">
            <span className="text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold truncate">
              Compromiso por Liquidar
            </span>
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-xl sm:text-[22px] text-tertiary-fixed-dim font-bold tracking-tight font-mono truncate">
                ${formatNum(pendingLiabilityUsd)}
              </span>
              <span className="text-xs text-on-surface-variant font-normal shrink-0">
                USD
              </span>
            </div>
            <span className="text-[11px] text-on-surface-variant/80 truncate">
              {pendingLiabilityUsd > 0 && kpis.bcvRate > 0
                ? `Equiv. Bs. ${formatNum(pendingLiabilityVes, 'es-VE')} a tasa actual`
                : 'Sin pagos pendientes acumulados'}
            </span>
          </div>

          {/* Settlement Progress Card */}
          <div className="p-3.5 rounded-xl bg-surface-container-lowest flex flex-col gap-1 min-w-0">
            <span className="text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold truncate">
              Tasa de Liquidación
            </span>
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-xl sm:text-[22px] text-primary font-bold tracking-tight font-mono">
                {settlementRate}%
              </span>
              <span className="text-xs text-on-surface-variant truncate">
                ({kpis.transferidosCount}/{settleableCount})
              </span>
            </div>
            <span className="text-[11px] text-primary/90 font-medium truncate">
              ${formatNum(kpis.transferidosMontoUsd)} USD desembolsados
            </span>
          </div>
        </div>

        {/* Live BCV Parity Strip */}
        <div className="p-3 rounded-xl bg-surface-container-high/60 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <ArrowLeftRight className="w-4 h-4 text-secondary shrink-0" />
            <span className="text-xs text-on-surface font-medium truncate">
              Tasa oficial BCV aplicada en tiempo real:
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold text-secondary font-mono">
              Bs. {formatNum(bcvRate, 'es-VE')} / USD
            </span>
            <span className="text-[10px] font-semibold text-on-surface-variant bg-surface-container-lowest px-2 py-0.5 rounded">
              Auto-Sync
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
