'use client';

/**
 * @name JustificacionClient
 * @description [UI Component]: Interactive executive dashboard for tracking travel allowance
 * justification progress, cost-center distribution monitoring, WhatsApp OCR receipt inspection,
 * and adaptive digital e-receipt auditing (`DigitalInvoice`) in real time.
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  FolderKanban,
  ReceiptText,
  RefreshCw,
  Search,
  AlertTriangle,
  X,
} from 'lucide-react';
import { useEscapeClose } from '@/lib/hooks/use-escape-close';
import type { Gasto } from '@/lib/types/gasto';
import DigitalInvoice from '../gastos/digital-invoice';
import { JustificacionKpiGrid } from './_components/JustificacionKpiGrid';
import { ProjectMonitoringPanel } from './_components/ProjectMonitoringPanel';
import { ExpedienteInspectorPanel } from './_components/ExpedienteInspectorPanel';
import {
  computeProgressMetrics,
  formatMoney,
  getCurrencyPrefix,
  type GastoJustificacion,
  type JustificacionFilterStatus,
  type JustificacionItem,
  type ProjectMonitoringSummary,
} from './_components/types';

export type { GastoJustificacion, JustificacionItem };

export default function JustificacionClient({ items }: { items: JustificacionItem[] }) {
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState<JustificacionFilterStatus>('TODOS');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedGastoInvoice, setSelectedGastoInvoice] = useState<Gasto | null>(null);
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCloseInvoice = useCallback(() => setSelectedGastoInvoice(null), []);
  useEscapeClose(handleCloseInvoice, selectedGastoInvoice !== null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = useCallback((msg: string, ok = true) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setFeedback({ msg, ok });
    toastTimerRef.current = setTimeout(() => setFeedback(null), 3200);
  }, []);

  const handleCopyText = useCallback(
    (text: string, label: string) => {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
        showToast(`${label} copiado al portapapeles.`, true);
      }
    },
    [showToast]
  );

  // Aggregate executive KPIs & project breakdown
  const stats = useMemo(() => {
    let completados = 0;
    let enProgreso = 0;
    let sinComprobantes = 0;
    let totalOtorgado = 0;
    let totalPendiente = 0;
    let topPendingItem: JustificacionItem | null = null;

    const projectMap: Record<
      string,
      { otorgado: number; justificado: number; count: number; currency: string }
    > = {};

    for (const item of items) {
      const m = computeProgressMetrics(item);
      totalOtorgado += Number(item.monto_otorgado || 0);
      totalPendiente += m.remaining;

      if (m.isComplete) {
        completados += 1;
      } else if (m.isEmpty) {
        sinComprobantes += 1;
      } else {
        enProgreso += 1;
      }

      if (!m.isComplete && !topPendingItem) {
        topPendingItem = item;
      }

      const projName = item.proyecto || 'Sin proyecto';
      if (!projectMap[projName]) {
        projectMap[projName] = {
          otorgado: 0,
          justificado: 0,
          count: 0,
          currency: item.moneda || 'USD',
        };
      }
      projectMap[projName].otorgado += Number(item.monto_otorgado || 0);
      projectMap[projName].justificado += Number(item.monto_gastado || 0);
      projectMap[projName].count += 1;
    }

    const projectSummaries: ProjectMonitoringSummary[] = Object.entries(projectMap)
      .map(([name, d]) => {
        const pendiente = Math.max(0, Number((d.otorgado - d.justificado).toFixed(2)));
        const pct = d.otorgado > 0 ? Math.min(Math.round((d.justificado / d.otorgado) * 100), 100) : 0;
        return {
          name,
          otorgado: Number(d.otorgado.toFixed(2)),
          justificado: Number(d.justificado.toFixed(2)),
          pendiente,
          pct,
          count: d.count,
          currency: d.currency,
        };
      })
      .sort((a, b) => b.otorgado - a.otorgado);

    const primaryCurrency = items[0]?.moneda || 'USD';

    return {
      completados,
      enProgreso,
      sinComprobantes,
      totalOtorgado: Number(totalOtorgado.toFixed(2)),
      totalPendiente: Number(totalPendiente.toFixed(2)),
      topPendingItem,
      projectSummaries,
      primaryCurrency,
    };
  }, [items]);

  // Filtered expedientes
  const filteredItems = useMemo(() => {
    const query = search.toLowerCase().trim();
    return items.filter((item) => {
      const matchesSearch =
        !query ||
        item.empleado.toLowerCase().includes(query) ||
        (item.empleadoEmail && item.empleadoEmail.toLowerCase().includes(query)) ||
        item.proyecto.toLowerCase().includes(query) ||
        item.id.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      if (filterProject !== 'all' && item.proyecto !== filterProject) {
        return false;
      }

      const m = computeProgressMetrics(item);
      if (filtro === 'COMPLETOS') return m.isComplete;
      if (filtro === 'EN_PROGRESO') return m.isInProgress;
      if (filtro === 'SIN_COMPROBANTES') return m.isEmpty;
      return true;
    });
  }, [items, search, filtro, filterProject]);

  // Resolved selected item synced with live items
  const selectedItem = useMemo(() => {
    if (selectedId) {
      const inFiltered = filteredItems.find((i) => i.id === selectedId);
      if (inFiltered) return inFiltered;
    }
    return filteredItems[0] ?? null;
  }, [selectedId, filteredItems]);

  function handleSelectCard(id: string) {
    setSelectedId(id);
    if (typeof window !== 'undefined' && window.innerWidth < 1280) {
      document
        .getElementById('detail-inspector-panel')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function handleScrollToMaster() {
    if (typeof window !== 'undefined') {
      document
        .getElementById('viaticos-grid')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  return (
    <div
      className="relative w-full flex flex-col gap-6 text-on-surface pb-12 select-text"
      suppressHydrationWarning
    >
      {/* Ambient Background Glows */}
      <div className="absolute -top-24 -right-16 w-96 h-96 rounded-full bg-primary-container/5 blur-3xl pointer-events-none" />
      <div className="absolute top-64 -left-20 w-80 h-80 rounded-full bg-secondary/5 blur-3xl pointer-events-none" />

      {/* Floating Feedback Toast */}
      {feedback && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-surface-container-highest border border-primary/25 shadow-2xl text-xs font-semibold text-on-surface animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2
            className={`w-4 h-4 shrink-0 ${feedback.ok ? 'text-primary' : 'text-error'}`}
          />
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 relative z-10 pt-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-primary shadow-[0_0_24px_-4px_rgba(0,229,153,0.3)] shrink-0">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-on-surface">
              Progreso de Justificación
            </h1>
            {stats.enProgreso + stats.sinComprobantes > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-secondary/15 text-secondary font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                {stats.enProgreso + stats.sinComprobantes} en curso
              </span>
            )}
          </div>
          <p className="text-sm text-on-surface-variant max-w-2xl sm:pl-[52px]">
            Monitoreo en tiempo real del ciclo de justificación, conciliación fiscal y comprobantes registrados vía WhatsApp por colaborador.
          </p>
        </div>
      </div>

      {/* Top 3 Calibrated Executive KPI Cards */}
      <JustificacionKpiGrid
        totalItems={items.length}
        completadosCount={stats.completados}
        enProgresoCount={stats.enProgreso}
        sinComprobantesCount={stats.sinComprobantes}
        totalOtorgado={stats.totalOtorgado}
        totalPendiente={stats.totalPendiente}
        primaryCurrency={stats.primaryCurrency}
        topPendingItem={stats.topPendingItem}
        activeFilter={filtro}
        onSelectFilter={setFiltro}
      />

      {/* Analytical Monitoring Panel by Cost Center */}
      <ProjectMonitoringPanel
        projects={stats.projectSummaries}
        selectedProject={filterProject}
        onSelectProject={setFilterProject}
      />

      {/* Search, Filter Tabs & Project Selector */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 p-3 rounded-2xl bg-surface-container-low shadow-sm relative z-10">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
          <input
            id="justificacion-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por colaborador, centro de costos o ID de expediente..."
            className="w-full h-10 pl-10 pr-9 rounded-xl bg-surface-container text-xs font-medium text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:bg-surface-container-high transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
              title="Limpiar búsqueda"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-surface-container rounded-xl w-full sm:w-auto">
            {(
              [
                { id: 'TODOS', label: `Todos (${items.length})` },
                { id: 'EN_PROGRESO', label: `En Progreso (${stats.enProgreso})` },
                { id: 'COMPLETOS', label: `100% Justificados (${stats.completados})` },
                { id: 'SIN_COMPROBANTES', label: `Sin Comprobantes (${stats.sinComprobantes})` },
              ] as const
            ).map((tab) => {
              const isActive = filtro === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFiltro(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-primary-container text-on-primary-container shadow-[0_0_14px_rgba(0,229,153,0.3)]'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {stats.projectSummaries.length > 1 && (
            <select
              id="filter-justificacion-project"
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="h-9 px-3 rounded-xl bg-surface-container text-on-surface text-xs font-medium focus:outline-none cursor-pointer shrink-0"
            >
              <option value="all">Todos los Proyectos</option>
              {stats.projectSummaries.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Master-Detail Operational Split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start relative z-10">
        {/* Left Panel: Master List of Expedientes */}
        <div
          id="viaticos-grid"
          className="xl:col-span-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-3.5"
        >
          {filteredItems.length === 0 ? (
            <div className="md:col-span-2 xl:col-span-1 p-10 rounded-2xl bg-surface-container-low text-center flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-surface-container-high flex items-center justify-center text-on-surface-variant">
                <ClipboardCheck className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-on-surface">
                No se encontraron viáticos
              </h3>
              <p className="text-xs text-on-surface-variant max-w-sm">
                {search || filtro !== 'TODOS' || filterProject !== 'all'
                  ? 'No hay expedientes que coincidan con la búsqueda o filtros activos.'
                  : 'Los viáticos aprobados aparecerán aquí para dar seguimiento a su rendición.'}
              </p>
              {(search || filtro !== 'TODOS' || filterProject !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setFiltro('TODOS');
                    setFilterProject('all');
                  }}
                  className="mt-1 px-4 py-2 rounded-xl bg-surface-container-high text-xs font-semibold text-primary hover:bg-surface-container-highest transition-colors"
                >
                  Restablecer filtros
                </button>
              )}
            </div>
          ) : (
            filteredItems.map((item) => {
              const m = computeProgressMetrics(item);
              const isSelected = selectedItem?.id === item.id;
              const prefix = getCurrencyPrefix(item.moneda);
              const initial = (item.empleado?.charAt(0) || 'U').toUpperCase();

              let activeRingClass = 'hover:bg-surface-container';
              if (isSelected) {
                activeRingClass = m.isComplete
                  ? 'border-l-4 border-l-primary ring-1 ring-primary/35 bg-surface-container'
                  : m.isEmpty
                  ? 'border-l-4 border-l-tertiary-container ring-1 ring-tertiary-container/35 bg-surface-container'
                  : 'border-l-4 border-l-secondary ring-1 ring-secondary/35 bg-surface-container';
              }

              return (
                <div
                  key={item.id}
                  id={`justificacion-${item.id}`}
                  onClick={() => handleSelectCard(item.id)}
                  className={`relative flex flex-col justify-between rounded-2xl bg-surface-container-low p-4 shadow-md transition-all cursor-pointer ${activeRingClass}`}
                >
                  {/* Card Top Row */}
                  <div className="flex items-start justify-between gap-2.5 mb-3 min-w-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl font-bold text-sm flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-primary-container text-on-primary-container shadow-[0_0_12px_rgba(0,229,153,0.28)]'
                            : 'bg-surface-container-highest text-primary'
                        }`}
                      >
                        {initial}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-on-surface tracking-tight leading-snug truncate">
                          {item.empleado}
                        </span>
                        <span className="text-[11px] text-on-surface-variant flex items-center gap-1 truncate">
                          <FolderKanban
                            className={`w-3 h-3 shrink-0 ${
                              m.isComplete ? 'text-primary' : 'text-secondary'
                            }`}
                          />
                          <span className="truncate">{item.proyecto}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={`text-[11px] font-mono font-semibold ${
                          isSelected ? 'text-secondary' : 'text-on-surface-variant/80'
                        }`}
                      >
                        #{item.id.slice(0, 8)}
                      </span>
                      {m.isComplete ? (
                        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center gap-1 whitespace-nowrap">
                          <CheckCircle2 className="w-3 h-3" />
                          100% Justificado
                        </span>
                      ) : m.isEmpty ? (
                        <span className="px-2 py-0.5 rounded-full bg-tertiary-container/15 text-tertiary-container text-[10px] font-bold flex items-center gap-1 whitespace-nowrap">
                          <AlertTriangle className="w-3 h-3" />
                          Sin Comprobantes
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-secondary/15 text-secondary text-[10px] font-bold flex items-center gap-1 whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                          En Progreso ({m.pct}%)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Calibrated Financial Triad Box */}
                  <div className="grid grid-cols-3 gap-1.5 p-2.5 rounded-xl bg-surface-container-lowest mb-3 text-center">
                    <div className="flex flex-col items-center justify-center min-w-0 px-0.5">
                      <span className="text-[10px] text-on-surface-variant font-semibold tracking-wider uppercase mb-0.5 truncate w-full">
                        Otorgado
                      </span>
                      <span className="text-[11px] font-bold text-on-surface font-mono truncate w-full">
                        {prefix}{formatMoney(item.monto_otorgado)}
                      </span>
                    </div>

                    <div className="flex flex-col items-center justify-center border-l border-surface-container-highest/20 min-w-0 px-0.5">
                      <span
                        className={`text-[10px] font-semibold tracking-wider uppercase mb-0.5 truncate w-full ${
                          m.isComplete ? 'text-primary' : 'text-secondary'
                        }`}
                      >
                        Rendido WA
                      </span>
                      <span
                        className={`text-[11px] font-extrabold font-mono truncate w-full ${
                          m.isComplete ? 'text-primary' : 'text-secondary'
                        }`}
                      >
                        {prefix}{formatMoney(item.monto_gastado)}
                      </span>
                    </div>

                    <div className="flex flex-col items-center justify-center border-l border-surface-container-highest/20 min-w-0 px-0.5">
                      <span
                        className={`text-[10px] font-semibold tracking-wider uppercase mb-0.5 truncate w-full ${
                          m.remaining > 0 ? 'text-tertiary-container' : 'text-on-surface-variant'
                        }`}
                      >
                        Restante
                      </span>
                      <span
                        className={`text-[11px] font-extrabold font-mono truncate w-full ${
                          m.remaining > 0 ? 'text-tertiary-container' : 'text-on-surface'
                        }`}
                      >
                        {prefix}{formatMoney(m.remaining)}
                      </span>
                    </div>
                  </div>

                  {/* Progress Track Bar */}
                  <div
                    className="w-full h-1.5 rounded-full bg-surface-container-highest overflow-hidden mb-2.5"
                    role="progressbar"
                    aria-valuenow={m.pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${item.empleado}: ${m.pct}% justificado`}
                  >
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        m.isComplete
                          ? 'bg-primary shadow-[0_0_8px_rgba(0,229,153,0.5)]'
                          : m.isEmpty
                          ? 'bg-tertiary-container/60'
                          : 'bg-secondary shadow-[0_0_8px_rgba(76,215,246,0.6)]'
                      }`}
                      style={{ width: `${m.pct}%` }}
                    />
                  </div>

                  {/* Card Footer */}
                  <div className="flex items-center justify-between gap-2 text-on-surface-variant text-[11px]">
                    <span className="flex items-center gap-1.5 truncate">
                      <ReceiptText
                        className={`w-3.5 h-3.5 shrink-0 ${
                          m.isComplete ? 'text-primary' : 'text-secondary'
                        }`}
                      />
                      <span className="truncate">
                        {item.gastos_count} comprobante{item.gastos_count !== 1 ? 's' : ''} registrado{item.gastos_count !== 1 ? 's' : ''}
                      </span>
                    </span>
                    <span
                      className={`font-semibold flex items-center gap-1 shrink-0 ${
                        m.isComplete
                          ? 'text-primary'
                          : m.isEmpty
                          ? 'text-tertiary-container'
                          : 'text-secondary'
                      }`}
                    >
                      {m.isComplete ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Completado</span>
                        </>
                      ) : m.isEmpty ? (
                        <span>Sin rendir</span>
                      ) : (
                        <>
                          <RefreshCw className="w-3 h-3" />
                          <span>{item.fecha_aprobacion}</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Panel: Detail & WhatsApp Audit Inspector */}
        <ExpedienteInspectorPanel
          selectedItem={selectedItem}
          onInspectGasto={(gasto) => setSelectedGastoInvoice(gasto)}
          onCopyText={handleCopyText}
          onScrollToMaster={handleScrollToMaster}
        />
      </div>

      {/* Digital Invoice Modal (eReceipt) */}
      {selectedGastoInvoice && (
        <DigitalInvoice
          gasto={selectedGastoInvoice}
          onClose={handleCloseInvoice}
        />
      )}
    </div>
  );
}
