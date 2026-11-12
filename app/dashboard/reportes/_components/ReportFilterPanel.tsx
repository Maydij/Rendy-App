'use client';

/**
 * @file ReportFilterPanel.tsx
 * @description [UI Molecule]: Primary filter and configuration panel for the accounting reports engine.
 * Allows administrative staff and accountants to fine-tune date ranges, project allocations,
 * employee submitters, and expense categories before triggering asynchronous Excel workbook generation.
 */

import React from 'react';
import {
  FileSpreadsheet,
  Calendar,
  Briefcase,
  Users,
  RotateCcw,
  Sparkles,
  FileText,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Coins,
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
  onFormatChange: (fmt: 'XLSX' | 'PDF') => void;
  onFilterChange: <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => void;
  onResetFilters: () => void;
  onGenerateReport: () => void;
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
  onFormatChange,
  onFilterChange,
  onResetFilters,
  onGenerateReport,
}: ReportFilterPanelProps) {
  // Preset helpers for common date ranges
  const handleApplyPreset = (preset: 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_30' | 'YEAR_TO_DATE') => {
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

    onFilterChange('dateFrom', from);
    onFilterChange('dateTo', to);
  };

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--bg-border)',
        borderRadius: '16px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Header & Subtitle */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: '1px solid var(--bg-border)',
          paddingBottom: '16px',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              margin: 0,
            }}
          >
            <FileSpreadsheet size={20} style={{ color: 'var(--rendy-primary)' }} />
            Generador de Reportes Contables y Fiscales
          </h2>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--text-secondary)',
              margin: '4px 0 0 0',
            }}
          >
            Exporta datos analíticos bimonetarios con desglose fiscal legal venezolano (SENIAT) y enlaces directos a comprobantes digitales.
          </p>
        </div>

        {/* Format Selector Pills */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--bg-base)',
            padding: '4px',
            borderRadius: '10px',
            border: '1px solid var(--bg-border)',
          }}
        >
          <button
            type="button"
            onClick={() => onFormatChange('XLSX')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: format === 'XLSX' ? 'var(--rendy-primary)' : 'transparent',
              color: format === 'XLSX' ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '7px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'var(--transition-fast)',
            }}
          >
            <FileSpreadsheet size={14} />
            Excel (.xlsx)
          </button>

          <button
            type="button"
            disabled
            title="Exportación PDF en desarrollo"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'transparent',
              color: 'var(--text-muted)',
              border: 'none',
              borderRadius: '7px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'not-allowed',
              opacity: 0.6,
            }}
          >
            <FileText size={14} />
            PDF (Próximamente)
          </button>
        </div>
      </div>

      {/* Filter Form Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Date From */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label
            htmlFor="filter-date-from"
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Calendar size={13} style={{ color: 'var(--rendy-primary)' }} />
            Fecha Desde
          </label>
          <input
            id="filter-date-from"
            type="date"
            value={filters.dateFrom || ''}
            onChange={(e) => onFilterChange('dateFrom', e.target.value)}
            style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--bg-border)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: 'var(--text-primary)',
              fontSize: '13px',
              outline: 'none',
            }}
          />
        </div>

        {/* Date To */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label
            htmlFor="filter-date-to"
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Calendar size={13} style={{ color: 'var(--rendy-primary)' }} />
            Fecha Hasta
          </label>
          <input
            id="filter-date-to"
            type="date"
            value={filters.dateTo || ''}
            onChange={(e) => onFilterChange('dateTo', e.target.value)}
            style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--bg-border)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: 'var(--text-primary)',
              fontSize: '13px',
              outline: 'none',
            }}
          />
        </div>

        {/* Project Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label
            htmlFor="filter-project"
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Briefcase size={13} style={{ color: 'var(--rendy-primary)' }} />
            Proyecto o Viático
          </label>
          <select
            id="filter-project"
            value={filters.projectId || 'ALL'}
            onChange={(e) => onFilterChange('projectId', e.target.value)}
            style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--bg-border)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: 'var(--text-primary)',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">Todos los proyectos</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Employee Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label
            htmlFor="filter-employee"
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Users size={13} style={{ color: 'var(--rendy-primary)' }} />
            Empleado Solicitante
          </label>
          <select
            id="filter-employee"
            value={filters.employeeId || 'ALL'}
            onChange={(e) => onFilterChange('employeeId', e.target.value)}
            style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--bg-border)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: 'var(--text-primary)',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">Todos los colaboradores</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>

        {/* Currency / Jurisdiction Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label
            htmlFor="filter-currency"
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Coins size={13} style={{ color: 'var(--rendy-primary)' }} />
            Moneda / Jurisdicción
          </label>
          <select
            id="filter-currency"
            value={filters.currency || 'ALL'}
            onChange={(e) => onFilterChange('currency', e.target.value)}
            style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--bg-border)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: 'var(--text-primary)',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">Todas las monedas (Multidivisa)</option>
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
        </div>
      </div>

      {/* Second Row: Date Presets & Expense Type Segmented Control */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          paddingTop: '8px',
        }}
      >
        {/* Quick Date Presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
            Rango rápido:
          </span>
          {[
            { id: 'THIS_MONTH' as const, label: 'Este Mes' },
            { id: 'LAST_MONTH' as const, label: 'Mes Anterior' },
            { id: 'LAST_30' as const, label: 'Últimos 30 días' },
            { id: 'YEAR_TO_DATE' as const, label: 'Año en Curso' },
          ].map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleApplyPreset(preset.id)}
              style={{
                background: 'var(--bg-base)',
                border: '1px solid var(--bg-border)',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '11px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'var(--transition-fast)',
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Expense Type Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
            Tipo de Flujo:
          </span>
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-base)',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid var(--bg-border)',
              gap: '4px',
            }}
          >
            {[
              { id: 'ALL', label: 'Todos' },
              { id: 'VIATICOS', label: 'Viáticos' },
              { id: 'REEMBOLSOS', label: 'Reembolsos' },
            ].map((t) => {
              const isSelected = (filters.expenseType || 'ALL') === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onFilterChange('expenseType', t.id as ReportFilters['expenseType'])}
                  style={{
                    background: isSelected ? 'var(--rendy-primary)' : 'transparent',
                    color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: '5px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'var(--transition-fast)',
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Feedback Messages */}
      {errorMessage && (
        <div
          style={{
            background: 'color-mix(in oklab, var(--rendy-danger) 12%, transparent)',
            border: '1px solid color-mix(in oklab, var(--rendy-danger) 30%, transparent)',
            borderRadius: '10px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: 'var(--rendy-danger)',
            fontSize: '13px',
          }}
        >
          <AlertTriangle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      {lastResult && lastResult.success && (
        <div
          style={{
            background: 'color-mix(in oklab, var(--rendy-primary) 12%, transparent)',
            border: '1px solid color-mix(in oklab, var(--rendy-primary) 30%, transparent)',
            borderRadius: '10px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: 'var(--rendy-primary-light)',
            fontSize: '13px',
          }}
        >
          <CheckCircle2 size={18} />
          <span>
            ¡Reporte generado exitosamente! Se procesaron <strong>{lastResult.totalCount}</strong> comprobantes (
            Total Consolidado: <strong>${(lastResult.totalUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</strong>
            {lastResult.detectedCurrencies && lastResult.detectedCurrencies.length > 0 && (
              <> • Monedas procesadas: <strong>{lastResult.detectedCurrencies.join(', ')}</strong></>
            )}).
          </span>
        </div>
      )}

      {/* Action Footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          borderTop: '1px solid var(--bg-border)',
          paddingTop: '16px',
        }}
      >
        <button
          type="button"
          onClick={onResetFilters}
          style={{
            background: 'transparent',
            border: '1px solid var(--bg-border)',
            borderRadius: '8px',
            padding: '8px 16px',
            color: 'var(--text-secondary)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'var(--transition-fast)',
          }}
        >
          <RotateCcw size={14} />
          Restablecer Filtros
        </button>

        <button
          type="button"
          disabled={isGenerating}
          onClick={onGenerateReport}
          style={{
            background: isGenerating ? 'var(--bg-overlay)' : 'var(--rendy-primary)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 24px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: isGenerating ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: isGenerating ? 'none' : '0 4px 14px color-mix(in oklab, var(--rendy-primary) 35%, transparent)',
            transition: 'var(--transition-fast)',
          }}
        >
          {isGenerating ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Generando Libro Contable...
            </>
          ) : (
            <>
              <FileSpreadsheet size={18} />
              Generar y Descargar Excel (.xlsx)
            </>
          )}
        </button>
      </div>
    </div>
  );
}

