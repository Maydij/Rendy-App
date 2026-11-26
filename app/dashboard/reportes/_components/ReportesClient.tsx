'use client';

/**
 * @file ReportesClient.tsx
 * @description [UI Organism]: Client-side coordinator for the accounting reports module.
 * Connects the custom hook `useReportGenerator` with the Stitch dark executive KPI overview,
 * multi-jurisdiction fiscal filter configurator, and export audit log table.
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  ShieldCheck,
  ReceiptText,
  CheckCircle2,
  DollarSign,
  Wallet,
} from 'lucide-react';
import { useReportGenerator } from '../_hooks/useReportGenerator';
import { ReportFilterPanel } from './ReportFilterPanel';
import { ReportHistoryTable } from './ReportHistoryTable';
import type { ReportHistoryItem } from '../actions';
import type { ReportFilters } from '@/lib/services/excelReportGenerator';

interface OptionItem {
  id: string;
  name: string;
}

interface ReportesClientProps {
  projects: OptionItem[];
  employees: OptionItem[];
  currencies: string[];
  initialHistory: ReportHistoryItem[];
  totalExpensesInDb: number;
  totalUsdInDb: number;
  totalVesInDb: number;
  userRole?: 'ADMIN' | 'EMPLOYEE';
}

export function ReportesClient({
  projects,
  employees,
  currencies,
  initialHistory,
  totalExpensesInDb,
  totalUsdInDb,
  totalVesInDb,
  userRole = 'ADMIN',
}: ReportesClientProps) {
  const router = useRouter();
  const [historyList, setHistoryList] = useState<ReportHistoryItem[]>(initialHistory);

  // Proactively purge legacy localStorage key to eliminate cross-session residue
  useEffect(() => {
    try {
      localStorage.removeItem('rendy_accounting_reports_history');
    } catch {
      // Storage access may be restricted in sandboxed environments
    }
  }, []);

  // Synchronize component state strictly with server-side tenant & user isolated history
  useEffect(() => {
    setHistoryList(initialHistory);
  }, [initialHistory]);

  const {
    filters,
    format,
    isGenerating,
    errorMessage,
    lastResult,
    setFormat,
    updateFilter,
    resetFilters,
    handleExport,
  } = useReportGenerator();

  const onTriggerExport = async () => {
    const result = await handleExport();
    if (result && result.historyItem) {
      setHistoryList((prev) =>
        [
          result.historyItem!,
          ...prev.filter(
            (p) =>
              p.id !== result.historyItem!.id &&
              p.reportName !== result.historyItem!.reportName
          ),
        ].slice(0, 30)
      );
      router.refresh();
    }
  };

  const onReExportHistory = async (savedFilters: ReportFilters) => {
    const result = await handleExport(savedFilters);
    if (result && result.historyItem) {
      setHistoryList((prev) =>
        [
          result.historyItem!,
          ...prev.filter(
            (p) =>
              p.id !== result.historyItem!.id &&
              p.reportName !== result.historyItem!.reportName
          ),
        ].slice(0, 30)
      );
      router.refresh();
    }
  };

  const latestAuditDate = historyList[0]?.createdAt
    ? new Date(historyList[0].createdAt)
        .toLocaleString('es-VE', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
        .replace(/[\u202F\u00A0]/g, ' ')
    : 'SENIAT • SAT • DIAN';

  return (
    <div
      className="relative w-full max-w-[1400px] mx-auto flex flex-col gap-7 pb-12 text-on-surface select-text"
      suppressHydrationWarning
    >
      {/* Ambient Background Glows */}
      <div className="absolute -top-24 -right-16 w-96 h-96 rounded-full bg-primary-container/5 blur-3xl pointer-events-none" />
      <div className="absolute top-64 -left-20 w-80 h-80 rounded-full bg-secondary/5 blur-3xl pointer-events-none" />

      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2 relative z-10">
        <div className="flex items-start gap-4 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 via-surface-container to-surface-container-low flex items-center justify-center text-primary shadow-[0_0_24px_rgba(0,229,153,0.15)] shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-on-surface">
                Reportes Contables y Exportación
              </h1>
              <span className="text-[11px] text-primary uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 shrink-0">
                Bimonetario Fiscal
              </span>
            </div>
            <p className="text-xs sm:text-sm text-on-surface-variant max-w-3xl mt-1 leading-relaxed">
              Genera libros contables en Excel (.xlsx) con desglose fiscal bimonetario (USD / VES) multi-jurisdicción y enlaces directos a comprobantes validados.
            </p>
          </div>
        </div>

        {/* Last Audit / Compliance Sync Pill */}
        <div className="flex items-center gap-3 bg-surface-container-low px-4 py-2.5 rounded-xl self-start md:self-auto shrink-0 shadow-sm">
          <div className="flex flex-col text-left md:text-right">
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
              {historyList[0] ? 'Última Exportación' : 'Estándar Contable'}
            </span>
            <span
              className="text-xs text-on-surface font-semibold font-mono"
              suppressHydrationWarning
            >
              {latestAuditDate}
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 2. Calibrated 3-Column KPI Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5 relative z-10">
        {/* KPI 1: Comprobantes Auditados */}
        <div className="bg-surface-container-low rounded-2xl p-5 lg:p-6 flex flex-col justify-between hover:bg-surface-container shadow-md transition-all group">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[11px] text-on-surface-variant tracking-wider uppercase font-semibold truncate">
              Comprobantes Auditados
            </span>
            <div className="w-8 h-8 rounded-xl bg-surface-container-high flex items-center justify-center text-primary group-hover:scale-105 transition-transform shrink-0">
              <ReceiptText className="w-4 h-4" />
            </div>
          </div>

          <div className="flex flex-col gap-2 min-w-0">
            <div className="flex items-baseline gap-2 min-w-0">
              <span
                className="text-3xl sm:text-[36px] font-extrabold text-on-surface tracking-tight leading-none font-mono"
                suppressHydrationWarning
              >
                {totalExpensesInDb.toLocaleString('en-US')}
              </span>
              <span className="text-sm sm:text-base text-on-surface-variant font-medium truncate">
                {totalExpensesInDb === 1 ? 'registro' : 'registros'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-[11px] text-primary font-medium truncate">
                100% indexado para exportación
              </span>
            </div>
          </div>
        </div>

        {/* KPI 2: Volumen Consolidado (USD) */}
        <div className="bg-surface-container-low rounded-2xl p-5 lg:p-6 flex flex-col justify-between hover:bg-surface-container shadow-md transition-all group">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[11px] text-on-surface-variant tracking-wider uppercase font-semibold truncate">
              Volumen Consolidado
            </span>
            <div className="w-8 h-8 rounded-xl bg-surface-container-high flex items-center justify-center text-primary group-hover:scale-105 transition-transform shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>

          <div className="flex flex-col gap-2 min-w-0">
            <div className="flex items-baseline gap-2 overflow-hidden min-w-0">
              <span
                className="text-2xl sm:text-[32px] font-bold text-primary tracking-tight leading-none truncate font-mono"
                suppressHydrationWarning
              >
                ${totalUsdInDb.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span className="text-sm sm:text-base text-on-surface-variant font-semibold shrink-0">
                USD
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] text-on-surface-variant truncate">
                Conversión histórica y tasa oficial BCV
              </span>
            </div>
          </div>
        </div>

        {/* KPI 3: Volumen Fiscal Local (VES) */}
        <div className="bg-surface-container-low rounded-2xl p-5 lg:p-6 flex flex-col justify-between hover:bg-surface-container shadow-md transition-all group">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[11px] text-on-surface-variant tracking-wider uppercase font-semibold truncate">
              Volumen Fiscal Local
            </span>
            <div className="w-8 h-8 rounded-xl bg-surface-container-high flex items-center justify-center text-secondary group-hover:scale-105 transition-transform shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
          </div>

          <div className="flex flex-col gap-2 min-w-0">
            <div className="flex items-baseline gap-2 overflow-hidden min-w-0">
              <span
                className="text-2xl sm:text-[30px] text-on-surface tracking-tight leading-none font-bold truncate font-mono"
                suppressHydrationWarning
              >
                Bs.{' '}
                {totalVesInDb.toLocaleString('es-VE', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-secondary shrink-0" />
              <span className="text-[11px] text-secondary font-medium truncate">
                SENIAT (VE) • SAT (MX) • DIAN (CO)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Report Generator & Filter Panel */}
      <ReportFilterPanel
        filters={filters}
        format={format}
        isGenerating={isGenerating}
        errorMessage={errorMessage}
        lastResult={lastResult}
        projects={projects}
        employees={employees}
        currencies={currencies}
        totalAvailableExpenses={totalExpensesInDb}
        onFormatChange={setFormat}
        onFilterChange={updateFilter}
        onResetFilters={resetFilters}
        onGenerateReport={onTriggerExport}
        userRole={userRole}
      />

      {/* 4. Historical Export Audit Log Table */}
      <ReportHistoryTable
        history={historyList}
        isGenerating={isGenerating}
        onReExport={onReExportHistory}
        onRefresh={() => router.refresh()}
      />
    </div>
  );
}
