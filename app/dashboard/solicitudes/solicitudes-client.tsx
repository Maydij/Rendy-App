'use client';

/**
 * @name SolicitudesClient
 * @description [UI Component]: High-performance executive financial client for managing corporate travel
 * allowance requests (Solicitudes de Viáticos), budget distributions by project, bank transfer proof attachments,
 * real-time audit timelines, and approval/rejection workflows in alignment with Stitch Design System.
 */

import React, { useState, useTransition, useMemo } from 'react';
import {
  PlaneTakeoff,
  Search,
  X,
  Download,
  Plus,
  Receipt,
  CheckCircle2,
  Clock,
  Ban,
  PieChart,
  Wallet,
  Eye,
  Paperclip,
  Printer,
  Share2,
  Copy,
  Check,
  SendHorizontal,
  ChevronRight,
  AlertCircle,
  FileText,
  UploadCloud,
  MessageCircle,
} from 'lucide-react';
import { rechazarSolicitud } from './actions';
import {
  ModalAprobarViatico,
  type SolicitudViaticoItem,
} from './_components/ModalAprobarViatico';
import { ModalVerComprobanteViatico } from './_components/ModalVerComprobanteViatico';

export interface SolicitudExtended extends SolicitudViaticoItem {
  empleadoEmail?: string;
}

interface SolicitudesClientProps {
  solicitudes: SolicitudExtended[];
  proyectosList?: string[];
  userRole?: 'ADMIN' | 'EMPLOYEE';
}

function formatUSD(amount: number): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function StatusBadge({ estado }: { estado: string }) {
  const estUpper = estado?.toUpperCase() || 'PENDIENTE';
  if (estUpper === 'APROBADO') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary-container/15 text-primary">
        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
        Aprobado
      </span>
    );
  }
  if (estUpper === 'RECHAZADO') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-error-container/20 text-error">
        <span className="w-1.5 h-1.5 rounded-full bg-error" />
        Rechazado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-tertiary-container/15 text-tertiary">
      <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
      Pendiente
    </span>
  );
}

export default function SolicitudesClient({
  solicitudes,
  proyectosList = [],
  userRole = 'ADMIN',
}: SolicitudesClientProps) {
  const isEmployee = userRole === 'EMPLOYEE';
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'TODOS' | 'PENDIENTE' | 'APROBADO' | 'RECHAZADO'>('TODOS');
  const [filterProject, setFilterProject] = useState<string>('all');

  // Selected item for the Detail Drawer
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Modals state
  const [approveTarget, setApproveTarget] = useState<SolicitudViaticoItem | null>(null);
  const [approveModalMode, setApproveModalMode] = useState<'APROBACION' | 'SUBIR_COMPROBANTE'>('APROBACION');
  const [viewTarget, setViewTarget] = useState<SolicitudViaticoItem | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);

  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);

  function showNotification(msg: string, ok: boolean) {
    setFeedback({ msg, ok });
    setTimeout(() => setFeedback(null), 4000);
  }

  // Filter logic
  const filtered = useMemo(() => {
    return solicitudes.filter((s) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        s.empleado.toLowerCase().includes(q) ||
        (s.empleadoEmail && s.empleadoEmail.toLowerCase().includes(q)) ||
        s.proyecto.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        (s.referencia_transferencia && s.referencia_transferencia.toLowerCase().includes(q));

      const matchEstado =
        filtroEstado === 'TODOS' || s.estado?.toUpperCase() === filtroEstado;

      const matchProject =
        filterProject === 'all' || s.proyecto.toLowerCase() === filterProject.toLowerCase();

      return matchSearch && matchEstado && matchProject;
    });
  }, [solicitudes, search, filtroEstado, filterProject]);

  // Set default selected request
  const selectedSolicitud = useMemo(() => {
    if (selectedId) {
      const found = solicitudes.find((s) => s.id === selectedId);
      if (found) return found;
    }
    return filtered.length > 0 ? filtered[0] : solicitudes.length > 0 ? solicitudes[0] : null;
  }, [selectedId, filtered, solicitudes]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalSolicitado = 0;
    let totalAprobado = 0;
    let totalRechazado = 0;
    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let missingProofCount = 0;

    const projectSums: Record<string, { amount: number; count: number }> = {};

    solicitudes.forEach((s) => {
      const mSol = Number(s.monto_solicitado || 0);
      const mApr = Number(s.monto_aprobado ?? (s.estado === 'APROBADO' ? mSol : 0));
      totalSolicitado += mSol;

      const proy = s.proyecto || 'Sin proyecto';
      if (!projectSums[proy]) projectSums[proy] = { amount: 0, count: 0 };
      projectSums[proy].amount += mSol;
      projectSums[proy].count += 1;

      const est = s.estado?.toUpperCase();
      if (est === 'APROBADO') {
        approvedCount += 1;
        totalAprobado += mApr;
        if (!s.url_comprobante_transferencia) {
          missingProofCount += 1;
        }
      } else if (est === 'RECHAZADO') {
        rejectedCount += 1;
        totalRechazado += mSol;
      } else {
        pendingCount += 1;
      }
    });

    const projectDistribution = Object.entries(projectSums)
      .map(([name, data]) => ({
        name,
        amount: data.amount,
        count: data.count,
        percent: totalSolicitado > 0 ? Math.round((data.amount / totalSolicitado) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      totalSolicitado,
      totalAprobado,
      totalRechazado,
      pendingCount,
      approvedCount,
      rejectedCount,
      missingProofCount,
      projectDistribution,
    };
  }, [solicitudes]);

  // Project filter options
  const projectOptions = useMemo(() => {
    const set = new Set<string>();
    proyectosList.forEach((p) => set.add(p));
    solicitudes.forEach((s) => {
      if (s.proyecto && s.proyecto !== 'Sin proyecto') set.add(s.proyecto);
    });
    return Array.from(set);
  }, [proyectosList, solicitudes]);

  // Rejection handler
  function handleRechazar() {
    if (!rejectTarget) return;
    startTransition(async () => {
      const res = await rechazarSolicitud(rejectTarget, rejectReason);
      setRejectTarget(null);
      setRejectReason('');
      showNotification(
        res.error ? `❌ ${res.error}` : '✅ Solicitud rechazada y notificada por WhatsApp',
        !res.error
      );
    });
  }

  // Export Ledger to CSV
  function handleExportLedger() {
    if (solicitudes.length === 0) {
      showNotification('No hay solicitudes disponibles para exportar.', false);
      return;
    }

    const headers = [
      'ID',
      'Empleado',
      'Email',
      'Proyecto',
      'Monto Solicitado (USD)',
      'Monto Aprobado (USD)',
      'Moneda',
      'Estado',
      'Fecha Creación',
      'Fecha Transferencia',
      'Referencia Transferencia',
      'Motivo Rechazo',
    ];

    const rows = (filtered.length > 0 ? filtered : solicitudes).map((s) => [
      `"${s.id}"`,
      `"${s.empleado.replace(/"/g, '""')}"`,
      `"${(s.empleadoEmail || '').replace(/"/g, '""')}"`,
      `"${s.proyecto.replace(/"/g, '""')}"`,
      s.monto_solicitado.toFixed(2),
      (s.monto_aprobado ?? 0).toFixed(2),
      `"${s.moneda || 'USD'}"`,
      `"${s.estado}"`,
      `"${new Date(s.creado_en).toLocaleDateString('es-VE')}"`,
      `"${s.fecha_transferencia ? new Date(s.fecha_transferencia).toLocaleDateString('es-VE') : ''}"`,
      `"${(s.referencia_transferencia || '').replace(/"/g, '""')}"`,
      `"${(s.motivo_rechazo || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `rendy_solicitudes_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotification('Libro contable de viáticos exportado con éxito.', true);
  }

  // Copy ID helper
  function copyToClipboard(text: string, label: string) {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      showNotification(`${label} copiado al portapapeles.`, true);
    }
  }

  return (
    <div className="relative w-full flex flex-col gap-6 text-on-surface pb-12 select-text" suppressHydrationWarning>
      {/* Ambient background glows */}
      <div className="absolute -top-24 -right-16 w-96 h-96 rounded-full bg-primary-container/5 blur-3xl pointer-events-none" />
      <div className="absolute top-64 -left-20 w-80 h-80 rounded-full bg-secondary/5 blur-3xl pointer-events-none" />

      {/* Floating Notification Feedback */}
      {feedback && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-surface-container-high border border-outline-variant shadow-2xl text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-200">
          <span className={feedback.ok ? 'text-primary' : 'text-error'}>
            {feedback.ok ? '✓' : '⚠️'}
          </span>
          <span className="text-on-surface">{feedback.msg}</span>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10 pt-2">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-primary shadow-sm shrink-0">
              <PlaneTakeoff className="w-5 h-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-on-surface">
              Solicitudes de Viáticos
            </h1>
            {metrics.missingProofCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-tertiary-container/15 text-tertiary shadow-[0_0_14px_rgba(252,192,37,0.15)] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
                {metrics.missingProofCount} pendiente{metrics.missingProofCount > 1 ? 's' : ''} de transferencia
              </span>
            ) : metrics.pendingCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-tertiary-container/15 text-tertiary shadow-[0_0_14px_rgba(252,192,37,0.15)] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
                {metrics.pendingCount} en revisión
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-primary-container/15 text-primary font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Al día
              </span>
            )}
          </div>
          <p className="text-sm text-on-surface-variant max-w-2xl">
            Gestiona la aprobación, registro de giro bancario y trazabilidad financiera de adelantos y viáticos por proyecto en tiempo real.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap sm:flex-nowrap">
          <button
            onClick={handleExportLedger}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all shadow-sm text-xs font-semibold"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Ledger</span>
          </button>
          <button
            onClick={() => setShowNewRequestModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary-container text-on-primary-container hover:bg-primary text-xs font-bold transition-all shadow-[0_0_24px_rgba(0,229,153,0.3)] hover:-translate-y-0.5 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Nueva Solicitud</span>
          </button>
        </div>
      </div>

      {/* Top Bento KPI Cards (4 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 relative z-10">
        {/* Total Solicitado */}
        <div className="p-5 rounded-2xl bg-surface-container-low hover:bg-surface-container transition-all flex flex-col justify-between gap-4 shadow-sm group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold">
              Total Solicitado
            </span>
            <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-secondary group-hover:scale-110 transition-transform">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex flex-col min-w-0 pr-2">
              <span className="text-2xl sm:text-[28px] font-bold text-on-surface leading-none tracking-tight truncate">
                ${formatUSD(metrics.totalSolicitado)}
              </span>
              <span className="text-xs text-on-surface-variant mt-1.5 font-medium truncate">
                {solicitudes.length} solicitudes en este ciclo
              </span>
            </div>
            <div className="text-secondary/70 shrink-0">
              <svg className="w-14 h-7" fill="none" viewBox="0 0 64 32">
                <path d="M2 26L14 20L26 24L38 12L50 16L62 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
              </svg>
            </div>
          </div>
        </div>

        {/* Aprobadas / Giro */}
        <div className="p-5 rounded-2xl bg-surface-container-low hover:bg-surface-container transition-all flex flex-col justify-between gap-4 shadow-sm group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-primary uppercase tracking-wider font-semibold">
              Aprobadas / Giro
            </span>
            <div className="w-8 h-8 rounded-lg bg-primary-container/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex flex-col min-w-0 pr-2">
              <span className="text-2xl sm:text-[28px] font-bold text-primary leading-none tracking-tight truncate">
                ${formatUSD(metrics.totalAprobado)}
              </span>
              <span className="text-xs text-primary-fixed-dim mt-1.5 font-semibold truncate">
                {metrics.approvedCount} solicitudes validadas
              </span>
            </div>
            <div className="text-primary/70 shrink-0">
              <svg className="w-14 h-7" fill="none" viewBox="0 0 64 32">
                <path d="M2 28L16 22L28 14L40 18L52 6L62 8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
              </svg>
            </div>
          </div>
        </div>

        {/* Sin Comprobante */}
        <div className="p-5 rounded-2xl bg-surface-container-low hover:bg-surface-container transition-all flex flex-col justify-between gap-4 shadow-sm group relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-tertiary-container" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-tertiary uppercase tracking-wider font-semibold">
              Sin Comprobante
            </span>
            <div className="w-8 h-8 rounded-lg bg-tertiary-container/20 flex items-center justify-center text-tertiary group-hover:scale-110 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex flex-col min-w-0 pr-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-[28px] font-bold text-tertiary leading-none tracking-tight">
                  {metrics.missingProofCount}
                </span>
                <span className="text-xs text-tertiary/90 font-medium">alertas</span>
              </div>
              <span className="text-xs text-on-surface-variant mt-1.5 truncate">
                Falta comprobante bancario
              </span>
            </div>
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-tertiary-container/20 text-tertiary text-xs font-bold ring-2 ring-tertiary/30 shrink-0">
              !
            </span>
          </div>
        </div>

        {/* Rechazadas / Excedidas */}
        <div className="p-5 rounded-2xl bg-surface-container-low hover:bg-surface-container transition-all flex flex-col justify-between gap-4 shadow-sm group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold">
              Rechazadas / Excedidas
            </span>
            <div className="w-8 h-8 rounded-lg bg-error-container/30 flex items-center justify-center text-error group-hover:scale-110 transition-transform">
              <Ban className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex flex-col min-w-0 pr-2">
              <span className="text-2xl sm:text-[28px] font-bold text-error leading-none tracking-tight truncate">
                ${formatUSD(metrics.totalRechazado)}
              </span>
              <span className="text-xs text-error/90 mt-1.5 font-medium truncate">
                {metrics.rejectedCount} {metrics.rejectedCount === 1 ? 'solicitud descartada' : 'solicitudes descartadas'}
              </span>
            </div>
            <div className="text-error/50 shrink-0">
              <svg className="w-14 h-7" fill="none" viewBox="0 0 64 32">
                <path d="M2 8L20 14L36 20L48 24L62 30" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Budget & Distribution Row (2/1 Split) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 relative z-10">
        {/* Distribución Presupuestaria por Proyecto (Span 2) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-surface-container-low flex flex-col justify-between gap-4 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-secondary" />
              <span className="text-sm text-on-surface font-semibold">
                Distribución Presupuestaria por Proyecto
              </span>
            </div>
            <span className="text-xs text-on-surface-variant">
              Total Imputado: <strong className="text-on-surface">${formatUSD(metrics.totalSolicitado)} USD</strong>
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {/* Multi-segment Progress Bar */}
            <div className="w-full h-3 rounded-full bg-surface-container-high flex overflow-hidden p-0.5 gap-1">
              {metrics.projectDistribution.length === 0 ? (
                <div className="h-full bg-surface-container-highest rounded-full w-full" />
              ) : (
                metrics.projectDistribution.map((item, idx) => {
                  const colors = ['bg-secondary', 'bg-primary-container', 'bg-tertiary-container', 'bg-primary-fixed', 'bg-accent'];
                  const color = colors[idx % colors.length];
                  return (
                    <div
                      key={item.name}
                      className={`h-full ${color} rounded-full transition-all duration-500`}
                      style={{ width: `${Math.max(item.percent, 3)}%` }}
                      title={`${item.name}: ${item.percent}% ($${formatUSD(item.amount)} USD)`}
                    />
                  );
                })
              )}
            </div>

            {/* Distribution Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {metrics.projectDistribution.slice(0, 3).map((item, idx) => {
                const dotColors = ['bg-secondary', 'bg-primary-container', 'bg-tertiary-container'];
                const textColors = ['text-secondary', 'text-primary', 'text-tertiary'];
                const dot = dotColors[idx % dotColors.length];
                const txt = textColors[idx % textColors.length];
                return (
                  <div key={item.name} className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-lowest">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${dot} shrink-0`} />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs text-on-surface font-semibold truncate">{item.name}</span>
                        <span className="text-[11px] text-on-surface-variant truncate">
                          {item.count} solicitud{item.count > 1 ? 'es' : ''}
                        </span>
                      </div>
                    </div>
                    <span className={`text-xs ${txt} font-bold shrink-0`}>{item.percent}%</span>
                  </div>
                );
              })}
              {metrics.projectDistribution.length === 0 && (
                <div className="col-span-3 text-center py-2 text-xs text-on-surface-variant">
                  No hay proyectos con gastos asignados en este ciclo.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Presupuesto por Proyecto (Span 1) */}
        <div className="p-5 rounded-2xl bg-surface-container-low flex flex-col justify-between gap-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              <span className="text-sm text-on-surface font-semibold">
                Presupuesto por Proyecto
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-primary-container/15 text-primary text-[11px] font-bold">
              En Monitoreo
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {metrics.projectDistribution.slice(0, 2).map((item, idx) => {
              const estBudget = Math.max(item.amount * 1.6, 1000);
              const execPercent = Math.min(Math.round((item.amount / estBudget) * 100), 100);
              const barColors = ['bg-secondary', 'bg-primary-container'];
              const textColors = ['text-secondary', 'text-primary'];
              const bar = barColors[idx % barColors.length];
              const txt = textColors[idx % textColors.length];
              return (
                <div key={item.name} className="flex flex-col gap-1 pb-1.5 border-b border-surface-container-high/40 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-on-surface truncate pr-2">{item.name}</span>
                    <span className={`${txt} font-bold shrink-0`}>${formatUSD(item.amount)} USD</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                    <div className={`h-full ${bar} rounded-full`} style={{ width: `${execPercent}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
                    <span className="text-primary-fixed-dim">Disponible: ${formatUSD(estBudget - item.amount)}</span>
                    <span>{execPercent}% ejecutado</span>
                  </div>
                </div>
              );
            })}
            {metrics.projectDistribution.length === 0 && (
              <div className="text-center py-4 text-xs text-on-surface-variant">
                Sin datos presupuestarios activos.
              </div>
            )}
          </div>

          <div className="p-2.5 rounded-xl bg-surface-container-lowest flex items-center justify-between text-[11px] text-on-surface-variant">
            <span>Total: <strong className="text-on-surface">${formatUSD(metrics.totalSolicitado)} USD</strong></span>
            <span className="text-primary font-semibold">
              Validadas: {metrics.approvedCount}/{solicitudes.length}
            </span>
          </div>
        </div>
      </div>

      {/* Search and Filters Toolbar */}
      <div className="p-4 rounded-2xl bg-surface-container-low flex flex-col lg:flex-row items-center justify-between gap-4 shadow-sm relative z-10">
        <div className="relative w-full lg:w-96 flex items-center">
          <Search className="w-4 h-4 absolute left-3.5 text-on-surface-variant pointer-events-none" />
          <input
            id="solicitudes-search-input"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por colaborador, ID o proyecto..."
            className="w-full h-10 pl-11 pr-10 rounded-xl bg-surface-container text-xs text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:bg-surface-container-high transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 text-on-surface-variant hover:text-on-surface"
              title="Limpiar búsqueda"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0 flex-wrap sm:flex-nowrap">
          {/* Status Tabs */}
          <div className="p-1 rounded-xl bg-surface-container flex items-center gap-1 w-full sm:w-auto">
            <button
              onClick={() => setFiltroEstado('TODOS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                filtroEstado === 'TODOS'
                  ? 'bg-surface-container-highest text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <span>Todos</span>
              <span className="px-1.5 py-0.2 rounded-full bg-surface-container-high text-[11px] text-on-surface">
                {solicitudes.length}
              </span>
            </button>

            <button
              onClick={() => setFiltroEstado('PENDIENTE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                filtroEstado === 'PENDIENTE'
                  ? 'bg-surface-container-highest text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <span>Pendiente</span>
              <span className="px-1.5 py-0.2 rounded-full bg-surface-container-high text-[11px] text-on-surface-variant">
                {metrics.pendingCount}
              </span>
            </button>

            <button
              onClick={() => setFiltroEstado('APROBADO')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                filtroEstado === 'APROBADO'
                  ? 'bg-surface-container-highest text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <span>Aprobados</span>
              <span className="px-1.5 py-0.2 rounded-full bg-primary-container/20 text-[11px] text-primary font-bold">
                {metrics.approvedCount}
              </span>
            </button>

            <button
              onClick={() => setFiltroEstado('RECHAZADO')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                filtroEstado === 'RECHAZADO'
                  ? 'bg-surface-container-highest text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <span>Rechazados</span>
              <span className="px-1.5 py-0.2 rounded-full bg-error-container/30 text-[11px] text-error font-bold">
                {metrics.rejectedCount}
              </span>
            </button>
          </div>

          {/* Project Dropdown */}
          <select
            id="filter-project-select"
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="h-9 px-3 rounded-xl bg-surface-container text-on-surface text-xs focus:outline-none cursor-pointer"
          >
            <option value="all">Todos los Proyectos</option>
            {projectOptions.map((proj) => (
              <option key={proj} value={proj}>
                {proj}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Master-Detail Operational Split (7 / 5 Grid on Desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10 items-start">
        {/* Left Column (Span 7): Request Cards List */}
        <div className="lg:col-span-7 flex flex-col gap-3.5">
          {filtered.length === 0 ? (
            <div className="p-12 rounded-2xl bg-surface-container-low text-center flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-surface-container-high flex items-center justify-center text-on-surface-variant">
                <Receipt className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-on-surface">Sin solicitudes encontradas</h3>
              <p className="text-xs text-on-surface-variant max-w-sm">
                No hay solicitudes que coincidan con los filtros aplicados o los términos de búsqueda.
              </p>
              {(search || filtroEstado !== 'TODOS' || filterProject !== 'all') && (
                <button
                  onClick={() => {
                    setSearch('');
                    setFiltroEstado('TODOS');
                    setFilterProject('all');
                  }}
                  className="mt-2 px-4 py-2 rounded-xl bg-surface-container text-xs text-primary hover:bg-surface-container-high transition-all"
                >
                  Restablecer filtros
                </button>
              )}
            </div>
          ) : (
            filtered.map((sol) => {
              const isSelected = selectedSolicitud?.id === sol.id;
              const isApproved = sol.estado?.toUpperCase() === 'APROBADO';
              const isPendingState = sol.estado?.toUpperCase() === 'PENDIENTE';
              const isRejected = sol.estado?.toUpperCase() === 'RECHAZADO';
              const hasTransferProof = Boolean(sol.url_comprobante_transferencia);
              const mStr = sol.moneda || 'USD';
              const initial = (sol.empleado?.charAt(0) || 'U').toUpperCase();

              return (
                <div
                  key={sol.id}
                  onClick={() => setSelectedId(sol.id)}
                  className={`group p-4 rounded-2xl bg-surface-container-low hover:bg-surface-container transition-all cursor-pointer shadow-sm flex flex-col gap-3 ${
                    isSelected
                      ? 'bg-surface-container ring-1 ring-primary/40 shadow-[0_0_20px_rgba(0,229,153,0.08)]'
                      : ''
                  }`}
                >
                  {/* Card Top Row */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 overflow-hidden min-w-0">
                      {/* Avatar initial */}
                      <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container font-bold text-sm flex items-center justify-center shadow-sm shrink-0">
                        {initial}
                      </div>
                      <div className="flex flex-col min-w-0 truncate">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm text-on-surface font-bold truncate">
                            {sol.empleado}
                          </span>
                          <StatusBadge estado={sol.estado} />
                        </div>
                        <span className="text-xs text-on-surface-variant truncate">
                          {sol.empleadoEmail ? `${sol.empleadoEmail} · ` : ''}ID:{' '}
                          <strong className="font-mono text-secondary font-medium">
                            {sol.id.slice(0, 8)}
                          </strong>
                        </span>
                      </div>
                    </div>

                    {/* Amount info */}
                    <div className="flex flex-col items-end shrink-0 text-right">
                      <span
                        className={`text-base sm:text-lg font-bold ${
                          isApproved
                            ? 'text-primary'
                            : isRejected
                            ? 'text-error'
                            : 'text-on-surface'
                        }`}
                      >
                        ${formatUSD(isApproved ? (sol.monto_aprobado ?? sol.monto_solicitado) : sol.monto_solicitado)} {mStr}
                      </span>
                      <span className="text-[11px] text-on-surface-variant">
                        {isApproved
                          ? `Sol: $${formatUSD(sol.monto_solicitado)}`
                          : isRejected
                          ? 'Aprobado: $0.00'
                          : 'En espera'}
                      </span>
                    </div>
                  </div>

                  {/* Card Bottom Row */}
                  <div className="flex items-center justify-between pt-2 border-t border-surface-container-highest/20 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-surface-container text-on-surface text-xs font-medium">
                        {sol.proyecto}
                      </span>
                      <span className="text-[11px] text-on-surface-variant">
                        {new Date(sol.creado_en).toLocaleDateString('es-VE')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isApproved && !hasTransferProof && (
                        <>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-tertiary-container/15 text-tertiary">
                            <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
                            Sin Comprobante
                          </span>
                          {!isEmployee && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setApproveTarget(sol);
                                setApproveModalMode('SUBIR_COMPROBANTE');
                              }}
                              className="px-3 py-1 rounded-lg bg-tertiary-container/15 hover:bg-tertiary-container/25 text-tertiary text-xs font-semibold transition-all flex items-center gap-1"
                              title="Subir comprobante de transferencia bancaria"
                            >
                              <Paperclip className="w-3.5 h-3.5" />
                              <span>Adjuntar</span>
                            </button>
                          )}
                        </>
                      )}

                      {isApproved && hasTransferProof && (
                        <>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary-container/15 text-primary">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                            💸 Transferido
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewTarget(sol);
                            }}
                            className="px-3 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary text-xs font-semibold transition-all flex items-center gap-1"
                            title="Ver comprobante de transferencia"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ver</span>
                          </button>
                        </>
                      )}

                      {isPendingState && !isEmployee && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setApproveTarget(sol);
                              setApproveModalMode('APROBACION');
                            }}
                            className="px-3 py-1 rounded-lg bg-primary-container text-on-primary-container hover:bg-primary text-xs font-bold transition-all flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Aprobar</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRejectTarget(sol.id);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-error-container/20 text-error hover:bg-error-container/30 text-xs font-semibold transition-all flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Rechazar</span>
                          </button>
                        </div>
                      )}

                      {isPendingState && isEmployee && (
                        <span className="text-[11px] text-on-surface-variant font-medium">
                          En espera de aprobación
                        </span>
                      )}

                      {isRejected && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-error font-medium truncate max-w-[180px]">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{sol.motivo_rechazo || 'Descartada'}</span>
                        </span>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(sol.id);
                        }}
                        className="p-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
                        title="Ver detalle de auditoría"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column (Span 5 - Sticky): Detalle de Solicitud (Audit Trail & Action Drawer) */}
        <div className="lg:col-span-5 lg:sticky lg:top-6 flex flex-col gap-4">
          {selectedSolicitud ? (
            <div className="rounded-2xl bg-surface-container-low p-6 shadow-sm flex flex-col gap-5">
              {/* Detail Header */}
              <div className="flex items-center justify-between border-b border-surface-container-highest/20 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-primary">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-on-surface">
                        Detalle de Solicitud
                      </h3>
                      <StatusBadge estado={selectedSolicitud.estado} />
                    </div>
                    <span className="text-xs text-on-surface-variant">
                      ID:{' '}
                      <strong className="font-mono text-secondary">
                        {selectedSolicitud.id.slice(0, 8)}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        window.print();
                      }
                    }}
                    className="w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center"
                    title="Imprimir / Guardar en PDF"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => copyToClipboard(selectedSolicitud.id, 'ID de solicitud')}
                    className="w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center"
                    title="Copiar ID de auditoría"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Amount Banner */}
              <div className="p-4 rounded-xl bg-surface-container-lowest flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs text-on-surface-variant">
                    {selectedSolicitud.estado === 'APROBADO' ? 'Monto Aprobado para Giro' : 'Monto Solicitado'}
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-2xl font-bold text-primary">
                      ${formatUSD(
                        selectedSolicitud.estado === 'APROBADO'
                          ? (selectedSolicitud.monto_aprobado ?? selectedSolicitud.monto_solicitado)
                          : selectedSolicitud.monto_solicitado
                      )}
                    </span>
                    <span className="text-xs text-on-surface-variant font-medium">
                      {selectedSolicitud.moneda || 'USD'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col text-right">
                  <span className="text-xs text-on-surface-variant">Tasa Convertida</span>
                  <span className="text-xs text-on-surface font-semibold">1.00 USD/USD</span>
                  <span className="text-[11px] text-primary-fixed-dim">Libre de comisión</span>
                </div>
              </div>

              {/* 2-Column Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-surface-container flex flex-col gap-0.5 min-w-0">
                  <span className="text-[11px] text-on-surface-variant">Beneficiario</span>
                  <span className="text-xs text-on-surface font-semibold truncate">
                    {selectedSolicitud.empleado}
                  </span>
                  <span className="text-[11px] text-secondary truncate">
                    {selectedSolicitud.empleadoEmail || 'Usuario registrado'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-surface-container flex flex-col gap-0.5 min-w-0">
                  <span className="text-[11px] text-on-surface-variant">Centro / Proyecto</span>
                  <span className="text-xs text-on-surface font-semibold truncate">
                    {selectedSolicitud.proyecto}
                  </span>
                  <span className="text-[11px] text-on-surface-variant">
                    Fecha: {new Date(selectedSolicitud.creado_en).toLocaleDateString('es-VE')}
                  </span>
                </div>
              </div>

              {/* Audit Timeline */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-on-surface font-semibold uppercase tracking-wider">
                    Línea de Tiempo de Auditoría
                  </span>
                  <span className="text-[11px] text-on-surface-variant">
                    {selectedSolicitud.url_comprobante_transferencia
                      ? 'Paso 4 de 4 · Completado'
                      : selectedSolicitud.estado === 'APROBADO'
                      ? 'Paso 3 de 4 · Giro Pendiente'
                      : selectedSolicitud.estado === 'RECHAZADO'
                      ? 'Descartado'
                      : 'Paso 2 de 4 · En Revisión'}
                  </span>
                </div>

                <div className="flex flex-col gap-3 relative pl-6 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-container-high">
                  {/* Step 1: Request Registered */}
                  <div className="relative flex flex-col">
                    <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-surface-container-low" />
                    <span className="text-xs text-on-surface font-semibold">1. Solicitud Registrada</span>
                    <span className="text-[11px] text-on-surface-variant">
                      Ingresada por el colaborador con justificación vía WhatsApp
                    </span>
                  </div>

                  {/* Step 2: Management Approval */}
                  <div className="relative flex flex-col">
                    <span
                      className={`absolute -left-6 top-1 w-2.5 h-2.5 rounded-full ring-4 ring-surface-container-low ${
                        selectedSolicitud.estado === 'APROBADO'
                          ? 'bg-primary'
                          : selectedSolicitud.estado === 'RECHAZADO'
                          ? 'bg-error'
                          : 'bg-tertiary animate-pulse'
                      }`}
                    />
                    <span
                      className={`text-xs font-semibold ${
                        selectedSolicitud.estado === 'RECHAZADO'
                          ? 'text-error'
                          : selectedSolicitud.estado === 'PENDIENTE'
                          ? 'text-tertiary'
                          : 'text-on-surface'
                      }`}
                    >
                      2. Aprobación Gerencial
                    </span>
                    <span className="text-[11px] text-on-surface-variant">
                      {selectedSolicitud.estado === 'APROBADO'
                        ? 'Aprobado y validado por Administración'
                        : selectedSolicitud.estado === 'RECHAZADO'
                        ? `Rechazado: ${selectedSolicitud.motivo_rechazo || 'Presupuesto agotado'}`
                        : 'En espera de revisión por el equipo de Finanzas'}
                    </span>
                  </div>

                  {/* Step 3: Bank Transfer & Proof */}
                  <div className="relative flex flex-col">
                    <span
                      className={`absolute -left-6 top-1 w-2.5 h-2.5 rounded-full ring-4 ring-surface-container-low ${
                        selectedSolicitud.url_comprobante_transferencia
                          ? 'bg-primary'
                          : selectedSolicitud.estado === 'APROBADO'
                          ? 'bg-tertiary animate-pulse'
                          : 'bg-outline/40'
                      }`}
                    />
                    <span
                      className={`text-xs font-semibold ${
                        selectedSolicitud.url_comprobante_transferencia
                          ? 'text-primary'
                          : selectedSolicitud.estado === 'APROBADO'
                          ? 'text-tertiary'
                          : 'text-on-surface-variant'
                      }`}
                    >
                      3. Giro Bancario & Comprobante
                    </span>
                    <span className="text-[11px] text-on-surface-variant">
                      {selectedSolicitud.url_comprobante_transferencia
                        ? `Transferencia registrada (Ref: ${selectedSolicitud.referencia_transferencia || 'S/R'})`
                        : selectedSolicitud.estado === 'APROBADO'
                        ? 'Pendiente: Adjuntar voucher de transferencia'
                        : 'Requiere aprobación gerencial previa'}
                    </span>
                  </div>

                  {/* Step 4: Reconciliation and Closure */}
                  <div className="relative flex flex-col">
                    <span
                      className={`absolute -left-6 top-1 w-2.5 h-2.5 rounded-full ring-4 ring-surface-container-low ${
                        selectedSolicitud.url_comprobante_transferencia ? 'bg-primary' : 'bg-outline/40'
                      }`}
                    />
                    <span
                      className={`text-xs font-semibold ${
                        selectedSolicitud.url_comprobante_transferencia ? 'text-on-surface' : 'text-on-surface-variant opacity-60'
                      }`}
                    >
                      4. Conciliación y Cierre
                    </span>
                    <span className="text-[11px] text-on-surface-variant">
                      {selectedSolicitud.url_comprobante_transferencia
                        ? 'Giro completado y notificado al empleado vía WhatsApp'
                        : 'Notificación automática al beneficiario tras adjuntar voucher'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action / Voucher Upload Trigger Zone */}
              {selectedSolicitud.estado === 'APROBADO' && !selectedSolicitud.url_comprobante_transferencia && !isEmployee && (
                <div
                  onClick={() => {
                    setApproveTarget(selectedSolicitud);
                    setApproveModalMode('SUBIR_COMPROBANTE');
                  }}
                  className="p-4 rounded-xl bg-surface-container-lowest border-2 border-dashed border-tertiary/40 hover:border-primary transition-all flex flex-col items-center justify-center gap-2 cursor-pointer text-center group"
                >
                  <div className="w-10 h-10 rounded-full bg-tertiary-container/15 text-tertiary group-hover:bg-primary-container/20 group-hover:text-primary transition-colors flex items-center justify-center">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-on-surface">
                      Cargar Voucher de Transferencia
                    </span>
                    <span className="text-[11px] text-on-surface-variant">
                      Adjunta el comprobante bancario (.PDF, .PNG, .JPG)
                    </span>
                  </div>
                </div>
              )}

              {selectedSolicitud.estado === 'APROBADO' && selectedSolicitud.url_comprobante_transferencia && (
                <div className="p-3.5 rounded-xl bg-surface-container-lowest flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-primary-container/20 text-primary flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-on-surface">
                        Comprobante Bancario Registrado
                      </span>
                      <span className="text-[11px] text-on-surface-variant">
                        Ref: {selectedSolicitud.referencia_transferencia || 'Sin referencia'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setViewTarget(selectedSolicitud)}
                    className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary text-xs font-semibold transition-all flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Ver</span>
                  </button>
                </div>
              )}

              {/* Bottom Drawer Actions */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                {selectedSolicitud.estado === 'PENDIENTE' && !isEmployee && (
                  <>
                    <button
                      onClick={() => {
                        setApproveTarget(selectedSolicitud);
                        setApproveModalMode('APROBACION');
                      }}
                      className="flex-1 py-2.5 px-4 rounded-full bg-primary-container hover:bg-primary text-on-primary-container text-xs font-bold transition-all shadow-[0_0_16px_rgba(0,229,153,0.25)] flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Aprobar Solicitud</span>
                    </button>
                    <button
                      onClick={() => setRejectTarget(selectedSolicitud.id)}
                      className="py-2.5 px-4 rounded-full bg-surface-container hover:bg-surface-container-high text-error text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                    >
                      <X className="w-4 h-4" />
                      <span>Rechazar</span>
                    </button>
                  </>
                )}

                {selectedSolicitud.estado === 'APROBADO' && !selectedSolicitud.url_comprobante_transferencia && !isEmployee && (
                  <button
                    onClick={() => {
                      setApproveTarget(selectedSolicitud);
                      setApproveModalMode('SUBIR_COMPROBANTE');
                    }}
                    className="flex-1 py-2.5 px-4 rounded-full bg-tertiary-container hover:bg-tertiary text-on-tertiary-fixed text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <Paperclip className="w-4 h-4" />
                    <span>Adjuntar Comprobante</span>
                  </button>
                )}

                {selectedSolicitud.estado === 'APROBADO' && selectedSolicitud.url_comprobante_transferencia && (
                  <button
                    onClick={() => setViewTarget(selectedSolicitud)}
                    className="flex-1 py-2.5 px-4 rounded-full bg-primary-container hover:bg-primary text-on-primary-container text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Ver Comprobante de Giro</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    const text = `Solicitud de Viático: ${selectedSolicitud.empleado} - ${selectedSolicitud.proyecto} - Monto: $${selectedSolicitud.monto_aprobado ?? selectedSolicitud.monto_solicitado} USD - Estado: ${selectedSolicitud.estado}`;
                    copyToClipboard(text, 'Resumen de solicitud');
                  }}
                  className="py-2.5 px-4 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Compartir</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-surface-container-low p-8 text-center text-xs text-on-surface-variant">
              Selecciona una solicitud para ver su detalle y auditoría.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Aprobar Viático / Adjuntar Comprobante */}
      {approveTarget && (
        <ModalAprobarViatico
          solicitud={approveTarget}
          mode={approveModalMode}
          onClose={() => setApproveTarget(null)}
          onSuccess={(msg) => showNotification(msg, true)}
        />
      )}

      {/* Modal: Ver Comprobante Bancario de Transferencia */}
      {viewTarget && (
        <ModalVerComprobanteViatico
          solicitud={viewTarget}
          onClose={() => setViewTarget(null)}
        />
      )}

      {/* Modal: Rechazo de Solicitud */}
      {rejectTarget && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setRejectTarget(null)}
        >
          <div
            className="bg-surface-container rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-on-surface mb-1">Rechazar Solicitud</h3>
            <p className="text-xs text-on-surface-variant mb-4">
              Indica el motivo. El empleado recibirá una notificación automática por WhatsApp.
            </p>
            <textarea
              id="reject-reason-input"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ej: Presupuesto del proyecto agotado..."
              rows={4}
              className="w-full bg-surface-container-lowest rounded-xl p-3 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary transition-all resize-y mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="px-4 py-2 rounded-full text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="confirm-reject-btn"
                disabled={isPending}
                onClick={handleRechazar}
                className="px-4 py-2 rounded-full text-xs font-bold bg-error-container text-on-error hover:opacity-90 transition-all flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>Confirmar Rechazo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nueva Solicitud (WhatsApp Flow Instructions) */}
      {showNewRequestModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowNewRequestModal(false)}
        >
          <div
            className="bg-surface-container rounded-2xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-surface-container-highest/20 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary-container/20 text-primary flex items-center justify-center">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-on-surface">Nueva Solicitud de Viático</h3>
                  <span className="text-[11px] text-on-surface-variant">Canal Oficial de WhatsApp Rendy</span>
                </div>
              </div>
              <button
                onClick={() => setShowNewRequestModal(false)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              En Rendy, las solicitudes de viáticos se registran de forma automatizada mediante nuestro bot conversacional en WhatsApp. Los colaboradores solo deben enviar un mensaje indicando el monto y el proyecto para que la solicitud aparezca de inmediato aquí para su aprobación y giro.
            </p>

            <div className="p-3 rounded-xl bg-surface-container-lowest flex flex-col gap-1 text-xs">
              <span className="font-semibold text-on-surface">Paso a paso para el empleado:</span>
              <span className="text-on-surface-variant">1. Escribir al bot oficial de WhatsApp de Rendy.</span>
              <span className="text-on-surface-variant">2. Escribir &ldquo;Solicitar viático&rdquo; o indicar el monto.</span>
              <span className="text-on-surface-variant">3. Seleccionar el proyecto imputado.</span>
              <span className="text-on-surface-variant">4. La solicitud quedará registrada en tiempo real en este panel.</span>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setShowNewRequestModal(false)}
                className="px-5 py-2.5 rounded-full bg-primary-container text-on-primary-container text-xs font-bold hover:bg-primary transition-all shadow-[0_0_16px_rgba(0,229,153,0.3)]"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
