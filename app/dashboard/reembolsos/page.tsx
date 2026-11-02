/**
 * @name ReembolsosPage
 * @description [Server Component]: Main server-side page for corporate reimbursement tracking
 * and settlement (/dashboard/reembolsos). Reads URL searchParams as the single source of truth,
 * fetches paginated expenses and aggregated KPIs, and coordinates client filtering and mutations.
 */

import React from 'react';
import { RotateCcw } from 'lucide-react';
import { EMPRESA_ID } from '@/lib/supabase-server';
import {
  obtenerReembolsosPaginados,
  obtenerKpisReembolsos,
  obtenerEmpleadosEmpresa,
  type EstadoReembolso,
} from '@/lib/services/reembolsos.service';
import { ReembolsosStatsCards } from './_components/ReembolsosStatsCards';
import { ReembolsosFilters } from './_components/ReembolsosFilters';
import { ReembolsosTable } from './_components/ReembolsosTable';

interface PageProps {
  searchParams: Promise<{
    empleado?: string;
    estado?: string;
    desde?: string;
    hasta?: string;
    busqueda?: string;
    page?: string;
  }>;
}

export const dynamic = 'force-dynamic';

export default async function ReembolsosPage({ searchParams }: PageProps) {
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

  const filtros = {
    empleadoId: params.empleado || undefined,
    estado: estadoParsed,
    fechaDesde: params.desde || undefined,
    fechaHasta: params.hasta || undefined,
    busqueda: params.busqueda || undefined,
    page: params.page ? parseInt(params.page, 10) : 1,
    pageSize: 15,
  };

  // Parallel server fetch for optimal performance
  const [paginatedData, kpis, empleados] = await Promise.all([
    obtenerReembolsosPaginados(EMPRESA_ID, filtros),
    obtenerKpisReembolsos(EMPRESA_ID),
    obtenerEmpleadosEmpresa(EMPRESA_ID),
  ]);

  const { reembolsos, totalCount, totalPages, currentPage, pageSize } = paginatedData;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', width: '100%' }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <RotateCcw size={24} strokeWidth={2.2} style={{ color: 'var(--rendy-primary)' }} />
          Liquidación de Reembolsos
        </h1>
        <p className="page-subtitle">
          Supervisa, aprueba y audita los pagos adeudados a empleados por gastos cubiertos con fondos personales.
        </p>
      </div>

      {/* KPI Cards */}
      <ReembolsosStatsCards kpis={kpis} />

      {/* Filters (URL-Driven with 300ms Debounce) */}
      <ReembolsosFilters empleados={empleados} />

      {/* Paginated Data Table with Actions & eReceipt Modal */}
      <ReembolsosTable
        data={reembolsos}
        totalCount={totalCount}
        totalPages={totalPages}
        currentPage={currentPage}
        pageSize={pageSize}
      />
    </div>
  );
}
