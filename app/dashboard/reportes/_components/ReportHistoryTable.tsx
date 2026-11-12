'use client';

/**
 * @file ReportHistoryTable.tsx
 * @description [UI Molecule]: Data table displaying historical report export audit events.
 * Provides compliance traceability by logging generation timestamp, administrative user,
 * applied filter criteria, aggregate monetary values, and one-click re-generation.
 */

import React from 'react';
import {
  History,
  FileSpreadsheet,
  Download,
  Calendar,
  User,
  FolderKanban,
  Receipt,
  RotateCcw,
} from 'lucide-react';
import type { ReportHistoryItem } from '../actions';
import type { ReportFilters } from '@/lib/services/excelReportGenerator';

interface ReportHistoryTableProps {
  history: ReportHistoryItem[];
  isGenerating: boolean;
  onReExport: (filters: ReportFilters) => void;
}

export function ReportHistoryTable({
  history,
  isGenerating,
  onReExport,
}: ReportHistoryTableProps) {
  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--bg-border)',
        borderRadius: '16px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Table Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <History size={18} style={{ color: 'var(--rendy-primary)' }} />
          <h3
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Historial de Exportaciones y Auditoría
          </h3>
        </div>
        <span
          style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            fontWeight: 500,
          }}
        >
          Últimos {history.length} reportes auditados
        </span>
      </div>

      {/* Table / Empty State */}
      {history.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 24px',
            textAlign: 'center',
            background: 'var(--bg-base)',
            borderRadius: '12px',
            border: '1px dashed var(--bg-border)',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'color-mix(in oklab, var(--rendy-primary) 15%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--rendy-primary-light)',
            }}
          >
            <FileSpreadsheet size={24} />
          </div>
          <div>
            <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Sin reportes registrados aún
            </h4>
            <p
              style={{
                fontSize: '13px',
                color: 'var(--text-secondary)',
                margin: '4px 0 0 0',
                maxWidth: '440px',
              }}
            >
              Configura los filtros en el generador superior y presiona &quot;Generar y Descargar Excel&quot; para crear tu primer reporte contable consolidado.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px',
              textAlign: 'left',
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--bg-border)',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Fecha / Hora</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Nombre del Reporte</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Formato</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Filtros Aplicados</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'center' }}>Gastos</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>Total Consolidado</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Generado Por</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'center' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => {
                const dateObj = new Date(item.createdAt);
                const formattedDate = dateObj.toLocaleDateString('es-VE', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                });
                const formattedTime = dateObj.toLocaleTimeString('es-VE', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid var(--bg-border)',
                      transition: 'background var(--transition-fast)',
                    }}
                  >
                    {/* Timestamp */}
                    <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formattedDate}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formattedTime}</div>
                    </td>

                    {/* Report Name */}
                    <td style={{ padding: '12px' }}>
                      <div
                        style={{
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <FileSpreadsheet size={15} style={{ color: 'var(--rendy-primary)' }} />
                        <span style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.reportName}
                        </span>
                      </div>
                    </td>

                    {/* Format Badge */}
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          background: 'color-mix(in oklab, var(--rendy-primary) 15%, transparent)',
                          color: 'var(--rendy-primary-light)',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        .XLSX
                      </span>
                    </td>

                    {/* Filters Applied */}
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '280px' }}>
                        {item.filters.dateFrom && item.filters.dateTo ? (
                          <span
                            style={{
                              background: 'var(--bg-base)',
                              border: '1px solid var(--bg-border)',
                              borderRadius: '4px',
                              padding: '2px 6px',
                              fontSize: '10px',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            📅 {item.filters.dateFrom} al {item.filters.dateTo}
                          </span>
                        ) : (
                          <span
                            style={{
                              background: 'var(--bg-base)',
                              border: '1px solid var(--bg-border)',
                              borderRadius: '4px',
                              padding: '2px 6px',
                              fontSize: '10px',
                              color: 'var(--text-muted)',
                            }}
                          >
                            📅 Todo el histórico
                          </span>
                        )}

                        {item.filters.currency && item.filters.currency !== 'ALL' && (
                          <span
                            style={{
                              background: 'color-mix(in oklab, var(--rendy-primary) 15%, transparent)',
                              border: '1px solid var(--bg-border)',
                              borderRadius: '4px',
                              padding: '2px 6px',
                              fontSize: '10px',
                              color: 'var(--rendy-primary-light)',
                              fontWeight: 700,
                            }}
                          >
                            💰 {item.filters.currency}
                          </span>
                        )}

                        {item.filters.expenseType && item.filters.expenseType !== 'ALL' && (
                          <span
                            style={{
                              background: 'var(--bg-base)',
                              border: '1px solid var(--bg-border)',
                              borderRadius: '4px',
                              padding: '2px 6px',
                              fontSize: '10px',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            🏷️ {item.filters.expenseType}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Expense Count */}
                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {item.totalExpenses}
                    </td>

                    {/* Totals */}
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: 'var(--rendy-primary-light)' }}>
                        ${item.totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Bs. {item.totalVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </td>

                    {/* User */}
                    <td style={{ padding: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={13} style={{ color: 'var(--text-muted)' }} />
                        <span>{item.userName}</span>
                      </div>
                    </td>

                    {/* Re-Export Action Button */}
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <button
                        type="button"
                        disabled={isGenerating}
                        onClick={() => onReExport(item.filters)}
                        title="Re-descargar con estos filtros"
                        style={{
                          background: 'var(--bg-base)',
                          border: '1px solid var(--bg-border)',
                          borderRadius: '8px',
                          padding: '6px 12px',
                          color: 'var(--rendy-primary-light)',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: isGenerating ? 'wait' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'var(--transition-fast)',
                        }}
                      >
                        <Download size={13} />
                        Re-descargar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

