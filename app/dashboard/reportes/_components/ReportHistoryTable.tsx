'use client';

/**
 * @file ReportHistoryTable.tsx
 * @description [UI Molecule]: Stitch audit log table & responsive mobile cards displaying historical
 * accounting report exports with filter metadata, consolidated bimonetary totals, user attribution,
 * client-side pagination, and one-click re-export actions.
 */

import React, { useState } from 'react';
import {
  History,
  FileSpreadsheet,
  Download,
  RefreshCw,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { ReportHistoryItem } from '../actions';
import type { ReportFilters } from '@/lib/services/excelReportGenerator';

interface ReportHistoryTableProps {
  history: ReportHistoryItem[];
  isGenerating: boolean;
  onReExport: (filters: ReportFilters) => void;
  onRefresh?: () => void;
}

const ITEMS_PER_PAGE = 6;

function getInitials(name: string): string {
  const parts = (name || 'US').trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0] ? parts[0].substring(0, 2) : 'US').toUpperCase();
}

function formatDateTimeParts(iso: string): { date: string; time: string } {
  const dateObj = new Date(iso);
  if (Number.isNaN(dateObj.getTime())) {
    return { date: iso, time: '' };
  }
  const date = dateObj
    .toLocaleDateString('es-VE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    .replace(/[\u202F\u00A0]/g, ' ');
  const time = dateObj
    .toLocaleTimeString('es-VE', {
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(/[\u202F\u00A0]/g, ' ');
  return { date, time };
}

export function ReportHistoryTable({
  history,
  isGenerating,
  onReExport,
  onRefresh,
}: ReportHistoryTableProps) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(history.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginatedHistory = history.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  );

  return (
    <div className="bg-surface-container-low border border-outline-variant/25 rounded-2xl p-5 sm:p-8 flex flex-col gap-5 shadow-[0_4px_24px_rgba(0,0,0,0.35)] relative z-10">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-secondary shrink-0" />
            <h2 className="text-lg sm:text-xl font-bold text-on-surface tracking-tight">
              Historial de Exportaciones y Auditoría Contable
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
            Registro trazable de libros contables descargados, filtros aplicados y totales consolidados para auditoría fiscal.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start lg:self-auto shrink-0">
          <span className="text-xs text-on-surface-variant font-medium px-3 py-1.5 rounded-full bg-surface-container border border-outline-variant/20">
            Últimos {history.length} {history.length === 1 ? 'reporte' : 'reportes'}
          </span>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="p-2 rounded-xl bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
              title="Actualizar historial"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-10 sm:p-12 text-center bg-surface-container-lowest/60 rounded-xl border border-dashed border-outline-variant/40 gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/15 text-primary flex items-center justify-center">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <h3 className="text-sm sm:text-base font-bold text-on-surface">
            Sin reportes registrados aún
          </h3>
          <p className="text-xs sm:text-sm text-on-surface-variant max-w-md">
            Configura los filtros en el generador superior y presiona &quot;Generar y Descargar Excel (.xlsx)&quot; para crear tu primer libro contable consolidado.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop / Tablet High-Density Table */}
          <div className="hidden md:block w-full overflow-x-auto rounded-xl">
            <table className="w-full text-left border-collapse min-w-[920px]">
              <thead>
                <tr className="bg-surface-container text-on-surface-variant text-[11px] uppercase tracking-wider font-semibold">
                  <th className="py-3.5 px-4 rounded-l-xl">Fecha / Hora</th>
                  <th className="py-3.5 px-4">Nombre del Reporte</th>
                  <th className="py-3.5 px-3 text-center">Formato</th>
                  <th className="py-3.5 px-4">Filtros Aplicados</th>
                  <th className="py-3.5 px-3 text-center">Registros</th>
                  <th className="py-3.5 px-4 text-right">Total Consolidado</th>
                  <th className="py-3.5 px-4">Generado Por</th>
                  <th className="py-3.5 px-4 rounded-r-xl text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high/40 text-on-surface text-xs sm:text-sm">
                {paginatedHistory.map((item) => {
                  const { date, time } = formatDateTimeParts(item.createdAt);
                  const initials = getInitials(item.userName);

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-surface-container/60 transition-colors group"
                    >
                      {/* Timestamp */}
                      <td className="py-4 px-4 whitespace-nowrap" suppressHydrationWarning>
                        <div className="flex flex-col">
                          <span className="font-semibold text-on-surface">{date}</span>
                          <span className="text-[11px] text-on-surface-variant">{time}</span>
                        </div>
                      </td>

                      {/* Report Name */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <FileSpreadsheet className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col truncate max-w-[230px]">
                            <span
                              className="font-semibold text-on-surface truncate group-hover:text-primary transition-colors"
                              title={item.reportName}
                            >
                              {item.reportName}
                            </span>
                            <span className="text-[11px] text-on-surface-variant truncate">
                              Libro Bimonetario Fiscal
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Format */}
                      <td className="py-4 px-3 text-center">
                        <span className="px-2.5 py-1 rounded-md bg-primary-container/15 text-primary text-[11px] font-bold tracking-wider">
                          .XLSX
                        </span>
                      </td>

                      {/* Applied Filters */}
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1.5 max-w-[240px]">
                          <span className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface text-[11px] font-medium">
                            {item.filters.dateFrom && item.filters.dateTo
                              ? `${item.filters.dateFrom} al ${item.filters.dateTo}`
                              : 'Todo el histórico'}
                          </span>
                          {item.filters.currency && item.filters.currency !== 'ALL' && (
                            <span className="px-2 py-0.5 rounded-md bg-primary/15 text-primary text-[11px] font-bold">
                              {item.filters.currency}
                            </span>
                          )}
                          {item.filters.expenseType && item.filters.expenseType !== 'ALL' && (
                            <span className="px-2 py-0.5 rounded-md bg-secondary/15 text-secondary text-[11px] font-semibold">
                              {item.filters.expenseType}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Count */}
                      <td className="py-4 px-3 text-center font-semibold text-on-surface whitespace-nowrap">
                        {item.totalExpenses}{' '}
                        <span className="text-on-surface-variant font-normal text-xs">
                          {item.totalExpenses === 1 ? 'gasto' : 'gastos'}
                        </span>
                      </td>

                      {/* Consolidated Totals */}
                      <td className="py-4 px-4 text-right whitespace-nowrap" suppressHydrationWarning>
                        <div className="flex flex-col items-end">
                          <span className="font-semibold text-primary font-mono">
                            ${item.totalUsd.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{' '}
                            USD
                          </span>
                          <span className="text-[11px] text-on-surface-variant font-mono">
                            Bs.{' '}
                            {item.totalVes.toLocaleString('es-VE', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      </td>

                      {/* Author */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-surface-container-highest text-secondary font-bold text-[11px] flex items-center justify-center ring-1 ring-secondary/30 shrink-0">
                            {initials}
                          </div>
                          <span className="text-xs text-on-surface font-medium truncate max-w-[140px]">
                            {item.userName}
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          disabled={isGenerating}
                          onClick={() => onReExport(item.filters)}
                          title="Re-descargar con estos filtros"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container text-on-surface text-xs font-semibold hover:bg-primary hover:text-on-primary transition-all shadow-sm group/btn disabled:opacity-50 disabled:cursor-wait cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 text-primary group-hover/btn:text-on-primary transition-colors" />
                          <span>Re-descargar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout (< md) */}
          <div className="md:hidden flex flex-col gap-3">
            {paginatedHistory.map((item) => {
              const { date, time } = formatDateTimeParts(item.createdAt);
              const initials = getInitials(item.userName);

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-surface-container border border-outline-variant/25 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-on-surface truncate">
                          {item.reportName}
                        </span>
                        <span className="text-[11px] text-on-surface-variant" suppressHydrationWarning>
                          {date} · {time}
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-primary-container/15 text-primary text-[10px] font-bold shrink-0">
                      .XLSX
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-surface-container-lowest text-on-surface-variant text-[10px]">
                      {item.filters.dateFrom && item.filters.dateTo
                        ? `${item.filters.dateFrom} al ${item.filters.dateTo}`
                        : 'Todo el histórico'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-surface-container-lowest text-on-surface text-[10px] font-semibold">
                      {item.totalExpenses} gastos
                    </span>
                    {item.filters.currency && item.filters.currency !== 'ALL' && (
                      <span className="px-2 py-0.5 rounded bg-primary/15 text-primary text-[10px] font-bold">
                        {item.filters.currency}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-surface-container-high/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-surface-container-highest text-secondary font-bold text-[10px] flex items-center justify-center shrink-0">
                        {initials}
                      </div>
                      <span className="text-[11px] text-on-surface-variant truncate">
                        {item.userName}
                      </span>
                    </div>
                    <div className="text-right shrink-0" suppressHydrationWarning>
                      <div className="text-xs font-bold text-primary font-mono">
                        ${item.totalUsd.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        USD
                      </div>
                      <div className="text-[10px] text-on-surface-variant font-mono">
                        Bs.{' '}
                        {item.totalVes.toLocaleString('es-VE', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isGenerating}
                    onClick={() => onReExport(item.filters)}
                    className="w-full py-2 px-3 rounded-xl bg-surface-container-high hover:bg-primary hover:text-on-primary text-on-surface text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Re-descargar Reporte</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Security Attribution Footer & Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-on-surface-variant text-xs">
            <span className="flex items-center gap-2 text-center sm:text-left">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
              <span>
                Reportes generados con aislamiento multi-tenant y trazabilidad fiscal automatizada.
              </span>
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </button>
                <span className="px-3 py-1 rounded-lg bg-primary-container text-on-primary-container font-bold font-mono">
                  {safePage}
                </span>
                <span className="px-1 text-on-surface-variant">/ {totalPages}</span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <span>Siguiente</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
