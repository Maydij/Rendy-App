'use client';

/**
 * @name JustificacionKpiGrid
 * @description [UI Component]: Displays the 3 top executive KPI cards for travel allowance
 * justification tracking (Active Viáticos, 100% Justified, Incomplete / Pending Balances)
 * with interactive status filter shortcuts.
 */

import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import {
  formatMoney,
  getCurrencyPrefix,
  type JustificacionFilterStatus,
  type JustificacionItem,
} from './types';

interface JustificacionKpiGridProps {
  totalItems: number;
  completadosCount: number;
  enProgresoCount: number;
  sinComprobantesCount: number;
  totalOtorgado: number;
  totalPendiente: number;
  primaryCurrency: string;
  topPendingItem: JustificacionItem | null;
  activeFilter: JustificacionFilterStatus;
  onSelectFilter: (filter: JustificacionFilterStatus) => void;
}

export function JustificacionKpiGrid({
  totalItems,
  completadosCount,
  enProgresoCount,
  sinComprobantesCount,
  totalOtorgado,
  totalPendiente,
  primaryCurrency,
  topPendingItem,
  activeFilter,
  onSelectFilter,
}: JustificacionKpiGridProps) {
  const prefix = getCurrencyPrefix(primaryCurrency);
  const closureRate =
    totalItems > 0 ? ((completadosCount / totalItems) * 100).toFixed(1) : '0.0';
  const pendingRecordsCount = enProgresoCount + sinComprobantesCount;

  const incompleteTargetFilter: JustificacionFilterStatus =
    enProgresoCount > 0 ? 'EN_PROGRESO' : 'SIN_COMPROBANTES';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 relative z-10">
      {/* KPI 1: Viáticos en Rendición */}
      <button
        type="button"
        onClick={() => onSelectFilter('TODOS')}
        className={`text-left relative overflow-hidden rounded-2xl bg-surface-container p-5 shadow-md hover:bg-surface-container-high transition-all cursor-pointer flex flex-col justify-between ${
          activeFilter === 'TODOS'
            ? 'ring-1 ring-primary/40'
            : 'border border-transparent hover:border-surface-container-highest'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold truncate">
            Viáticos en Rendición
          </span>
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            En seguimiento
          </span>
        </div>

        <div className="flex items-baseline gap-2 mb-2 min-w-0">
          <span className="text-3xl sm:text-[34px] text-on-surface font-extrabold tracking-tight leading-none">
            {totalItems}
          </span>
          <span className="text-xs text-on-surface-variant truncate">
            {totalItems === 1 ? 'expediente abierto' : 'expedientes abiertos'}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 text-[11px] text-on-surface-variant pt-2.5 border-t border-surface-container-high/60">
          <span className="truncate">Monto total otorgado:</span>
          <span className="text-primary font-bold font-mono shrink-0">
            {prefix}{formatMoney(totalOtorgado)} {primaryCurrency}
          </span>
        </div>
      </button>

      {/* KPI 2: 100% Justificados */}
      <button
        type="button"
        onClick={() => onSelectFilter('COMPLETOS')}
        className={`text-left relative overflow-hidden rounded-2xl bg-surface-container p-5 shadow-md hover:bg-surface-container-high transition-all cursor-pointer flex flex-col justify-between ${
          activeFilter === 'COMPLETOS'
            ? 'ring-1 ring-primary-fixed/50'
            : 'border border-transparent hover:border-surface-container-highest'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold truncate">
            100% Justificados
          </span>
          <span className="px-2 py-0.5 rounded-full bg-primary-container/20 text-primary-fixed text-[11px] font-bold flex items-center gap-1 shrink-0">
            <CheckCircle2 className="w-3 h-3" />
            Listos
          </span>
        </div>

        <div className="flex items-baseline gap-2 mb-2 min-w-0">
          <span className="text-3xl sm:text-[34px] text-primary-fixed font-extrabold tracking-tight leading-none">
            {completadosCount}
          </span>
          <span className="text-xs text-on-surface-variant truncate">
            cierre contable
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 text-[11px] text-on-surface-variant pt-2.5 border-t border-surface-container-high/60">
          <span className="truncate">Tasa de éxito / cierre:</span>
          <span className="text-secondary font-bold font-mono shrink-0">
            {closureRate}% total
          </span>
        </div>
      </button>

      {/* KPI 3: Rendición Incompleta */}
      <button
        type="button"
        onClick={() => onSelectFilter(incompleteTargetFilter)}
        className={`text-left relative overflow-hidden rounded-2xl bg-surface-container p-5 shadow-md hover:bg-surface-container-high transition-all cursor-pointer flex flex-col justify-between sm:col-span-2 md:col-span-1 ${
          activeFilter === 'EN_PROGRESO' || activeFilter === 'SIN_COMPROBANTES'
            ? 'ring-1 ring-tertiary-container/50'
            : 'border border-transparent hover:border-surface-container-highest'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold truncate">
            Rendición Incompleta
          </span>
          <span className="px-2 py-0.5 rounded-full bg-secondary/15 text-secondary text-[11px] font-bold flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
            {pendingRecordsCount} pendiente{pendingRecordsCount === 1 ? '' : 's'}
          </span>
        </div>

        <div className="flex items-baseline gap-1.5 mb-2 flex-wrap min-w-0">
          <span className="text-2xl sm:text-[28px] leading-none text-tertiary-container font-extrabold font-mono truncate">
            {prefix}{formatMoney(totalPendiente)}
          </span>
          <span className="text-[11px] font-semibold text-tertiary-container/80 uppercase tracking-wide shrink-0">
            {primaryCurrency} pend.
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 text-[11px] text-on-surface-variant pt-2.5 border-t border-surface-container-high/60">
          {topPendingItem ? (
            <>
              <span className="truncate">{topPendingItem.empleado}:</span>
              <span className="text-on-surface font-medium shrink-0">
                {topPendingItem.gastos_count} comp. ({getCurrencyPrefix(topPendingItem.moneda)}
                {formatMoney(topPendingItem.monto_gastado)})
              </span>
            </>
          ) : (
            <>
              <span className="truncate">Estado de rendición:</span>
              <span className="text-primary font-semibold shrink-0">Sin saldos pendientes</span>
            </>
          )}
        </div>
      </button>
    </div>
  );
}
