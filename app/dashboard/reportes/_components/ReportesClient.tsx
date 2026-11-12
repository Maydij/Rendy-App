'use client';

/**
 * @file ReportesClient.tsx
 * @description [UI Organism]: Client-side coordinator for the accounting reports module.
 * Bridges state between custom hook `useReportGenerator`, the filter panel, and the
 * historical export audit log table.
 */

import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Layers,
  DollarSign,
  TrendingUp,
  FileCheck2,
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
}

const LOCAL_STORAGE_KEY = 'rendy_accounting_reports_history';

export function ReportesClient({
  projects,
  employees,
  currencies,
  initialHistory,
  totalExpensesInDb,
  totalUsdInDb,
  totalVesInDb,
}: ReportesClientProps) {
  const [historyList, setHistoryList] = useState<ReportHistoryItem[]>(initialHistory);

  // Sync and hydrate with client-side persistent storage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed: ReportHistoryItem[] = JSON.parse(stored);
        // Merge initial server history with locally cached history
        const mergedMap = new Map<string, ReportHistoryItem>();
        [...parsed, ...initialHistory].forEach((item) => {
          if (!mergedMap.has(item.reportName)) {
            mergedMap.set(item.reportName, item);
          }
        });
        const mergedList = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setHistoryList(mergedList);
      }
    } catch (e) {
      console.warn('⚠️ [ReportesClient] Error hydrating report history from localStorage:', e);
    }
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

  // Helper to persist updated history
  const persistHistory = (newItem: ReportHistoryItem) => {
    setHistoryList((prev) => {
      const filtered = prev.filter((p) => p.reportName !== newItem.reportName);
      const updated = [newItem, ...filtered].slice(0, 30);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('⚠️ [ReportesClient] Error saving report history to localStorage:', e);
      }
      return updated;
    });
  };

  // Trigger export from filter panel
  const onTriggerExport = async () => {
    const result = await handleExport();
    if (result && result.historyItem) {
      persistHistory(result.historyItem);
    }
  };

  // Re-export using historical filter parameters
  const onReExportHistory = async (savedFilters: ReportFilters) => {
    const result = await handleExport(savedFilters);
    if (result && result.historyItem) {
      persistHistory(result.historyItem);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        width: '100%',
        maxWidth: '1440px',
        margin: '0 auto',
      }}
    >
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'color-mix(in oklab, var(--rendy-primary) 15%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--rendy-primary-light)',
            }}
          >
            <FileSpreadsheet size={22} strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>
              Reportes Contables y Exportación
            </h1>
            <p className="page-subtitle" style={{ margin: '4px 0 0 0' }}>
              Genera libros contables en Excel (.xlsx) con desglose fiscal legal venezolano (SENIAT) y enlaces a comprobantes.
            </p>
          </div>
        </div>
      </div>

      {/* Database Overview Metric Banner */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        {/* KPI 1: Total Invoices in DB */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--bg-border)',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'color-mix(in oklab, var(--rendy-primary) 15%, transparent)',
              color: 'var(--rendy-primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Layers size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Comprobantes Registrados
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {totalExpensesInDb.toLocaleString('en-US')}
            </div>
          </div>
        </div>

        {/* KPI 2: Total USD Processed */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--bg-border)',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'color-mix(in oklab, var(--rendy-primary) 15%, transparent)',
              color: 'var(--rendy-primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <DollarSign size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Volumen Consolidado (USD)
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--rendy-primary-light)' }}>
              ${totalUsdInDb.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* KPI 3: Total VES Processed */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--bg-border)',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'color-mix(in oklab, var(--rendy-primary) 15%, transparent)',
              color: 'var(--rendy-primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <TrendingUp size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Volumen Fiscal (VES)
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Bs. {totalVesInDb.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* KPI 4: Compliance Standard */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--bg-border)',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'color-mix(in oklab, var(--rendy-primary) 15%, transparent)',
              color: 'var(--rendy-primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <FileCheck2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Estándar Contable
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              SENIAT (VE) • SAT (MX) • DIAN (CO)
            </div>
          </div>
        </div>
      </div>

      {/* Main Generator & Filter Component */}
      <ReportFilterPanel
        filters={filters}
        format={format}
        isGenerating={isGenerating}
        errorMessage={errorMessage}
        lastResult={lastResult}
        projects={projects}
        employees={employees}
        currencies={currencies}
        onFormatChange={setFormat}
        onFilterChange={updateFilter}
        onResetFilters={resetFilters}
        onGenerateReport={onTriggerExport}
      />

      {/* Historical Audit Trail Table */}
      <ReportHistoryTable
        history={historyList}
        isGenerating={isGenerating}
        onReExport={onReExportHistory}
      />
    </div>
  );
}

