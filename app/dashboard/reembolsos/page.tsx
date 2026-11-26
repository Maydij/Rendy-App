/**
 * @name ReembolsosPage
 * @description [Server Component]: Main server-side page for corporate reimbursement tracking
 * and settlement (/dashboard/reembolsos). Reads URL searchParams as the single source of truth,
 * fetches paginated expenses, aggregated KPIs, multi-currency breakdowns, and coordinates client actions.
 */

import React from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { requireAuthenticatedSession } from '@/lib/auth/session-context';
import {
  obtenerReembolsosPaginados,
  obtenerKpisReembolsos,
  obtenerEmpleadosEmpresa,
  type EstadoReembolso,
} from '@/lib/services/reembolsos.service';
import { ReembolsosHeaderActions } from './_components/ReembolsosHeaderActions';
import { ReembolsosStatsCards } from './_components/ReembolsosStatsCards';
import { ReembolsosAnalyticsPanel } from './_components/ReembolsosAnalyticsPanel';
import { ReembolsosFilters } from './_components/ReembolsosFilters';
import { ReembolsosTable } from './_components/ReembolsosTable';

interface PageProps {
  searchParams: Promise<{
    empleado?: string;
    estado?: string;
    moneda?: string;
    desde?: string;
    hasta?: string;
    busqueda?: string;
    page?: string;
  }>;
}

export const dynamic = 'force-dynamic';

export default async function ReembolsosPage({ searchParams }: PageProps) {
  const session = await requireAuthenticatedSession();
  const isEmployee = session.role === 'EMPLOYEE';
  const params = await searchParams;

  const validEstados: Set<string> = new Set([
    'PENDIENTE',
    'PROCESADO',
    'TRANSFERIDO',
    'RECHAZADO',
    'TODOS',
  ]);

  const estadoParsed =
    params.estado && validEstados.has(params.estado)
      ? (params.estado as EstadoReembolso | 'TODOS')
      : 'TODOS';

  const parsedPage = params.page ? parseInt(params.page, 10) : 1;

  const filtros = {
    empleadoId: isEmployee ? session.userId : params.empleado || undefined,
    estado: estadoParsed,
    moneda: params.moneda && params.moneda !== 'TODOS' ? params.moneda : undefined,
    fechaDesde: params.desde || undefined,
    fechaHasta: params.hasta || undefined,
    busqueda: params.busqueda || undefined,
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    pageSize: 15,
  };

  // Parallel server fetch for optimal performance
  const [paginatedData, kpis, empleados] = await Promise.all([
    obtenerReembolsosPaginados(session.empresaId, filtros),
    obtenerKpisReembolsos(session.empresaId, isEmployee ? session.userId : undefined),
    obtenerEmpleadosEmpresa(session.empresaId),
  ]);

  const { reembolsos, totalCount, totalPages, currentPage, pageSize } = paginatedData;

  return (
    <div
      className="relative w-full flex flex-col gap-6 text-on-surface pb-12 select-text"
      suppressHydrationWarning
    >
      {/* Ambient Background Glows */}
      <div className="absolute -top-24 -right-16 w-96 h-96 rounded-full bg-primary-container/5 blur-3xl pointer-events-none" />
      <div className="absolute top-64 -left-20 w-80 h-80 rounded-full bg-secondary/5 blur-3xl pointer-events-none" />

      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2 relative z-10">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-primary-container/15 flex items-center justify-center text-primary-container shadow-[0_0_20px_rgba(0,229,153,0.15)] shrink-0">
            <ArrowLeftRight className="w-6 h-6" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-[26px] text-on-surface tracking-tight font-bold">
                Liquidación de Reembolsos
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-tertiary-container/15 text-tertiary-fixed-dim inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim animate-pulse" />
                Auditoría Activa
              </span>
            </div>
            <p className="text-xs sm:text-sm text-on-surface-variant max-w-3xl mt-1 leading-relaxed">
              {isEmployee
                ? 'Revisa tus gastos personales rendidos y verifica el estado en tiempo real de tus liquidaciones y transferencias.'
                : 'Supervisa, aprueba y audita los pagos adeudados a empleados por gastos cubiertos con fondos personales (multidivisa VES / USD / MXN).'}
            </p>
          </div>
        </div>

        <ReembolsosHeaderActions
          data={reembolsos}
          procesadosCount={kpis.procesadosCount}
          userRole={session.role}
        />
      </div>

      {/* 4 Calibrated Executive KPI Cards */}
      <ReembolsosStatsCards kpis={kpis} />

      {/* Intermediate Treasury & Multi-Currency Analytics Panel */}
      <ReembolsosAnalyticsPanel kpis={kpis} />

      {/* Interactive URL-Driven Filters & Status Pills */}
      <ReembolsosFilters
        empleados={empleados}
        kpis={kpis}
        visibleCount={reembolsos.length}
        userRole={session.role}
      />

      {/* Split-View Master-Detail Claims Workspace, Pagination & Modals */}
      <ReembolsosTable
        data={reembolsos}
        totalCount={totalCount}
        totalPages={totalPages}
        currentPage={currentPage}
        pageSize={pageSize}
        userRole={session.role}
      />
    </div>
  );
}
