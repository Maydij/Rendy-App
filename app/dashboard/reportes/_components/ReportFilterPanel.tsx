'use client';

/**
 * @file ReportFilterPanel.tsx
 * @description [UI Molecule]: Stitch dark configurator card for the accounting reports engine.
 * Supports date range selectors, quick presets, project/employee/currency filters, flow type segmented
 * controls, and triggers multi-sheet Excel (.xlsx) generation with bimonetary & multi-jurisdiction taxes.
 */

import React, { useMemo } from 'react';
import {
  FileSpreadsheet,
  Calendar,
  Briefcase,
  Users,
  RotateCcw,
  FileText,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Coins,
  ChevronDown,
  Download,
  Table2,
} from 'lucide-react';
import type { ReportFilters } from '@/lib/services/excelReportGenerator';
import type { ExportReportResult } from '../actions';

interface OptionItem {
  id: string;
  name: string;
}

interface ReportFilterPanelProps {
  filters: ReportFilters;
  format: 'XLSX' | 'PDF';
  isGenerating: boolean;
  errorMessage: string | null;
  lastResult: ExportReportResult | null;
  projects: OptionItem[];
  employees: OptionItem[];
  currencies: string[];
  totalAvailableExpenses: number;
  onFormatChange: (fmt: 'XLSX' | 'PDF') => void;
  onFilterChange: <K extends keyof ReportFilters>(
    key: K,
    value: ReportFilters[K]
  ) => void;
  onResetFilters: () => void;
  onGenerateReport: () => void;
  userRole?: 'ADMIN' | 'EMPLOYEE';
}

type DatePresetKey = 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_30' | 'YEAR_TO_DATE';

function computePresetDates(preset: DatePresetKey): { from: string; to: string } {
  const today = new Date();
  let from = '';
  let to = today.toISOString().slice(0, 10);

  if (preset === 'THIS_MONTH') {
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    from = firstDay.toISOString().slice(0, 10);
  } else if (preset === 'LAST_MONTH') {
    const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
    from = firstDay.toISOString().slice(0, 10);
    to = lastDay.toISOString().slice(0, 10);
  } else if (preset === 'LAST_30') {
    const past30 = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    from = past30.toISOString().slice(0, 10);
  } else if (preset === 'YEAR_TO_DATE') {
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    from = startOfYear.toISOString().slice(0, 10);
  }

  return { from, to };
}

export function ReportFilterPanel({
  filters,
  format,
  isGenerating,
  errorMessage,
  lastResult,
  projects,
  employees,
  currencies,
  totalAvailableExpenses,
  onFormatChange,
  onFilterChange,
  onResetFilters,
  onGenerateReport,
  userRole = 'ADMIN',
}: ReportFilterPanelProps) {
  const isEmployee = userRole === 'EMPLOYEE';

  const activePreset = useMemo<DatePresetKey | null>(() => {
    if (!filters.dateFrom || !filters.dateTo) return null;
    const keys: DatePresetKey[] = ['THIS_MONTH', 'LAST_MONTH', 'LAST_30', 'YEAR_TO_DATE'];
    for (const k of keys) {
      const range = computePresetDates(k);
      if (range.from === filters.dateFrom && range.to === filters.dateTo) {
        return k;
      }
    }
    return null;
  }, [filters.dateFrom, filters.dateTo]);

  const handleApplyPreset = (preset: DatePresetKey) => {
    const { from, to } = computePresetDates(preset);
    onFilterChange('dateFrom', from);
    onFilterChange('dateTo', to);
  };

  return (
    <div className="bg-surface-container-low rounded-2xl p-5 sm:p-8 flex flex-col gap-6 shadow-[0_4px_24px_rgba(0,0,0,0.35)] relative overflow-hidden z-10">
      {/* Decorative Glow Corner */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      {/* Generator Header & Format Toggles */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-surface-container-highest/20 pb-5 relative z-10">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2.5">
            <Table2 className="w-5 h-5 text-primary shrink-0" />
            <h2 className="text-lg sm:text-xl font-bold text-on-surface tracking-tight">
              Generador de Reportes Contables y Fiscales
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-1 max-w-3xl">
            Exporta libros analíticos bimonetarios con desglose fiscal legal (SENIAT, SAT, DIAN, Sales Tax) y enlaces directos a comprobantes digitales.
          </p>
        </div>

        {/* Format Selector Pills */}
        <div className="flex items-center p-1 bg-surface-container rounded-full self-start lg:self-auto gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onFormatChange('XLSX')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              format === 'XLSX'
                ? 'bg-primary text-on-primary shadow-[0_0_16px_rgba(0,229,153,0.3)]'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            disabled
            title="Exportación ejecutiva en PDF próximamente"
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium text-on-surface-variant/60 cursor-not-allowed opacity-60"
          >
            <FileText className="w-4 h-4" />
            <span>PDF (Próximamente)</span>
          </button>
        </div>
      </div>

      {/* Filter Controls Matrix (Responsive 5-col grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-end relative z-10">
        {/* Date From */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <label
            htmlFor="filter-date-from"
            className="text-[11px] text-on-surface-variant font-semibold uppercase tracking-wider flex items-center gap-1.5 truncate"
          >
            <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="truncate">Fecha Desde</span>
          </label>
          <input
            id="filter-date-from"
            type="date"
            value={filters.dateFrom || ''}
            onChange={(e) => onFilterChange('dateFrom', e.target.value)}
            className="w-full h-10 px-3 py-2 rounded-xl bg-surface-container text-on-surface text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary/60 transition-all cursor-pointer [color-scheme:dark]"
          />
        </div>

        {/* Date To */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <label
            htmlFor="filter-date-to"
            className="text-[11px] text-on-surface-variant font-semibold uppercase tracking-wider flex items-center gap-1.5 truncate"
          >
            <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="truncate">Fecha Hasta</span>
          </label>
          <input
            id="filter-date-to"
            type="date"
            value={filters.dateTo || ''}
            onChange={(e) => onFilterChange('dateTo', e.target.value)}
            className="w-full h-10 px-3 py-2 rounded-xl bg-surface-container text-on-surface text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary/60 transition-all cursor-pointer [color-scheme:dark]"
          />
        </div>

        {/* Project Selector */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <label
            htmlFor="filter-project"
            className="text-[11px] text-on-surface-variant font-semibold uppercase tracking-wider flex items-center gap-1.5 truncate"
          >
            <Briefcase className="w-3.5 h-3.5 text-secondary shrink-0" />
            <span className="truncate">Proyecto o Viático</span>
          </label>
          <div className="relative">
            <select
              id="filter-project"
              value={filters.projectId || 'ALL'}
              onChange={(e) => onFilterChange('projectId', e.target.value)}
              className="w-full h-10 appearance-none px-3 py-2 pr-8 rounded-xl bg-surface-container text-on-surface text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary/60 transition-all cursor-pointer truncate [color-scheme:dark]"
            >
              <option value="ALL">Todos los proyectos</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
          </div>
        </div>

        {/* Employee Selector (Isolated for Employees) */}
        {isEmployee ? (
          <div className="flex flex-col gap-1.5 min-w-0">
            <label className="text-[11px] text-on-surface-variant font-semibold uppercase tracking-wider flex items-center gap-1.5 truncate">
              <Users className="w-3.5 h-3.5 text-tertiary shrink-0" />
              <span className="truncate">Colaborador</span>
            </label>
            <div className="h-10 px-3 rounded-xl bg-primary/10 text-primary text-xs font-semibold flex items-center truncate">
              Mis gastos personales
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 min-w-0">
            <label
              htmlFor="filter-employee"
              className="text-[11px] text-on-surface-variant font-semibold uppercase tracking-wider flex items-center gap-1.5 truncate"
            >
              <Users className="w-3.5 h-3.5 text-tertiary shrink-0" />
              <span className="truncate">Colaborador</span>
            </label>
            <div className="relative">
              <select
                id="filter-employee"
                value={filters.employeeId || 'ALL'}
                onChange={(e) => onFilterChange('employeeId', e.target.value)}
                className="w-full h-10 appearance-none px-3 py-2 pr-8 rounded-xl bg-surface-container text-on-surface text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary/60 transition-all cursor-pointer truncate [color-scheme:dark]"
              >
                <option value="ALL">Todos los colaboradores</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
            </div>
          </div>
        )}

        {/* Currency Selector */}
        <div className="flex flex-col gap-1.5 min-w-0 sm:col-span-2 lg:col-span-1">
          <label
            htmlFor="filter-currency"
            className="text-[11px] text-on-surface-variant font-semibold uppercase tracking-wider flex items-center gap-1.5 truncate"
          >
            <Coins className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="truncate">Moneda / Jurisdicción</span>
          </label>
          <div className="relative">
            <select
              id="filter-currency"
              value={filters.currency || 'ALL'}
              onChange={(e) => onFilterChange('currency', e.target.value)}
              className="w-full h-10 appearance-none px-3 py-2 pr-8 rounded-xl bg-surface-container text-on-surface text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary/60 transition-all cursor-pointer truncate [color-scheme:dark]"
            >
              <option value="ALL">Multidivisa (Todas)</option>
              {currencies.map((cur) => (
                <option key={cur} value={cur}>
                  {cur === 'MXN' && 'MXN - Pesos Mexicanos (SAT)'}
                  {cur === 'VES' && 'VES - Bolívares (SENIAT)'}
                  {cur === 'USD' && 'USD - Dólares Americanos'}
                  {cur === 'COP' && 'COP - Pesos Colombianos (DIAN)'}
                  {cur === 'EUR' && 'EUR - Euros (EU VAT)'}
                  {!['MXN', 'VES', 'USD', 'COP', 'EUR'].includes(cur) && cur}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Quick Presets & Flow Type Pills */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1 relative z-10">
        {/* Quick Range Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold whitespace-nowrap mr-1">
            Rango:
          </span>
          {(
            [
              { id: 'THIS_MONTH', label: 'Este Mes' },
              { id: 'LAST_MONTH', label: 'Mes Anterior' },
              { id: 'LAST_30', label: 'Últimos 30 días' },
              { id: 'YEAR_TO_DATE', label: 'Año en Curso' },
            ] as const
          ).map((preset) => {
            const isSelected = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleApplyPreset(preset.id)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-surface-container-high text-primary font-semibold'
                    : 'bg-surface-container text-on-surface hover:bg-surface-container-high font-medium'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Flow Type Segmented Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold whitespace-nowrap mr-1">
            Tipo de Flujo:
          </span>
          <div className="flex items-center p-1 bg-surface-container rounded-xl gap-1">
            {(
              [
                { id: 'ALL', label: 'Todos' },
                { id: 'VIATICOS', label: 'Viáticos' },
                { id: 'REEMBOLSOS', label: 'Reembolsos' },
              ] as const
            ).map((t) => {
              const isSelected = (filters.expenseType || 'ALL') === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onFilterChange('expenseType', t.id)}
                  className={`px-3 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-primary-container text-on-primary-container font-bold shadow-[0_0_10px_rgba(0,229,153,0.25)]'
                      : 'text-on-surface-variant font-medium hover:text-on-surface hover:bg-surface-container-high'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Feedback Alerts */}
      {errorMessage && (
        <div className="bg-error-container/20 rounded-xl p-3.5 flex items-center gap-2.5 text-error text-xs sm:text-sm relative z-10">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {lastResult && lastResult.success && (
        <div className="bg-primary-container/15 rounded-xl p-3.5 flex items-center gap-2.5 text-primary text-xs sm:text-sm relative z-10">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>
            ¡Reporte generado con éxito! Se procesaron{' '}
            <strong>{lastResult.totalCount}</strong> comprobantes (Total Consolidado:{' '}
            <strong>
              ${(lastResult.totalUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
            </strong>
            {lastResult.detectedCurrencies && lastResult.detectedCurrencies.length > 0 && (
              <>
                {' '}
                · Divisas procesadas: <strong>{lastResult.detectedCurrencies.join(', ')}</strong>
              </>
            )}
            ).
          </span>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-4 border-t border-surface-container-highest/20 relative z-10">
        <button
          type="button"
          onClick={onResetFilters}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-surface-container text-on-surface text-xs font-semibold hover:bg-surface-container-high transition-all cursor-pointer"
        >
          <RotateCcw className="w-4 h-4 text-on-surface-variant" />
          <span>Restablecer Filtros</span>
        </button>

        <div className="flex items-center justify-end gap-4">
          <div className="hidden md:flex flex-col text-right">
            <span className="text-[11px] text-on-surface-variant">Base de datos disponible</span>
            <span className="text-xs text-primary font-semibold">
              {totalAvailableExpenses} transacciones · 2 hojas contables
            </span>
          </div>

          <button
            type="button"
            disabled={isGenerating}
            onClick={onGenerateReport}
            className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-7 py-3 rounded-full bg-primary-container hover:bg-primary text-on-primary-container text-xs sm:text-sm font-bold shadow-[0_0_24px_rgba(0,229,153,0.3)] hover:shadow-[0_0_32px_rgba(0,229,153,0.45)] hover:-translate-y-0.5 active:scale-98 transition-all disabled:opacity-60 disabled:cursor-wait cursor-pointer"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generando Libro Contable...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Generar y Descargar Excel (.xlsx)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
