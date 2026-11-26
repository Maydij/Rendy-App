'use client';

/**
 * @name ReembolsosFilters
 * @description [UI Component]: Interactive URL-driven filter controls with 300ms debounced search,
 * employee filter, multi-currency selector, date range bounds, and status pill tabs displaying live counts.
 */

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Search, User, Coins, ChevronDown, X } from 'lucide-react';
import type {
  EmpleadoOption,
  EstadoReembolso,
  ReembolsosKpisResponse,
} from '@/lib/services/reembolsos.service';

interface ReembolsosFiltersProps {
  empleados: EmpleadoOption[];
  kpis: ReembolsosKpisResponse;
  visibleCount: number;
  userRole?: 'ADMIN' | 'EMPLOYEE';
}

export function ReembolsosFilters({
  empleados,
  kpis,
  visibleCount,
  userRole = 'ADMIN',
}: ReembolsosFiltersProps) {
  const router = useRouter();
  const isEmployee = userRole === 'EMPLOYEE';
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const currentSearch = searchParams.get('busqueda') || '';
  const currentEmpleado = searchParams.get('empleado') || 'TODOS';
  const currentMoneda = searchParams.get('moneda') || 'TODOS';
  const currentEstado = (searchParams.get('estado') as EstadoReembolso | 'TODOS') || 'TODOS';
  const currentDesde = searchParams.get('desde') || '';
  const currentHasta = searchParams.get('hasta') || '';

  const [searchTerm, setSearchTerm] = useState(currentSearch);

  useEffect(() => {
    setSearchTerm(currentSearch);
  }, [currentSearch]);

  const updateParams = useCallback(
    (newEntries: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('page', '1');

      for (const [key, value] of Object.entries(newEntries)) {
        if (!value || value === 'TODOS' || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [pathname, router, searchParams]
  );

  // Debounce text search by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchTerm !== currentSearch) {
        updateParams({ busqueda: searchTerm.trim() || null });
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [searchTerm, currentSearch, updateParams]);

  const hasActiveFilters = Boolean(
    currentSearch ||
      (currentEmpleado && currentEmpleado !== 'TODOS') ||
      (currentMoneda && currentMoneda !== 'TODOS') ||
      (currentEstado && currentEstado !== 'TODOS') ||
      currentDesde ||
      currentHasta
  );

  const clearAllFilters = () => {
    setSearchTerm('');
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  };

  const statusOptions: {
    id: EstadoReembolso | 'TODOS';
    label: string;
    count: number;
    badgeClass: string;
  }[] = [
    {
      id: 'TODOS',
      label: 'Todos',
      count: kpis.totalCount,
      badgeClass: 'bg-primary/20 text-primary',
    },
    {
      id: 'PENDIENTE',
      label: 'Pendientes',
      count: kpis.pendientesCount,
      badgeClass: 'bg-tertiary-container/20 text-tertiary-fixed-dim',
    },
    {
      id: 'PROCESADO',
      label: 'Procesados',
      count: kpis.procesadosCount,
      badgeClass: 'bg-primary-container/20 text-primary',
    },
    {
      id: 'TRANSFERIDO',
      label: 'Transferidos',
      count: kpis.transferidosCount,
      badgeClass: 'bg-secondary/20 text-secondary',
    },
    {
      id: 'RECHAZADO',
      label: 'Rechazados',
      count: kpis.rechazadosCount,
      badgeClass: 'bg-surface-container-high text-error',
    },
  ];

  return (
    <div className="flex flex-col gap-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/30 p-4 shadow-sm relative z-10">
      {/* Top Row: Search Input & Dropdown / Date Selectors */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
          <input
            id="reembolsos-search"
            type="text"
            placeholder="Buscar por comercio, RIF o # factura…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-10 pr-9 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-xs sm:text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
              title="Limpiar búsqueda"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Selectors & Dates */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Employee Selector (Admin only) */}
          {!isEmployee && (
            <div className="relative min-w-[180px] flex-1 sm:flex-initial">
              <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
              <select
                id="reembolsos-empleado-filter"
                value={currentEmpleado}
                onChange={(e) => updateParams({ empleado: e.target.value })}
                className="w-full h-10 pl-9 pr-8 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-xs font-medium text-on-surface appearance-none focus:outline-none focus:border-primary cursor-pointer transition-all [color-scheme:dark]"
              >
                <option value="TODOS">Todos los empleados</option>
                {empleados.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nombre} {emp.email ? `(${emp.email})` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
            </div>
          )}

          {/* Currency Selector */}
          <div className="relative min-w-[140px] flex-1 sm:flex-initial">
            <Coins className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
            <select
              id="reembolsos-moneda-filter"
              value={currentMoneda}
              onChange={(e) => updateParams({ moneda: e.target.value })}
              className="w-full h-10 pl-9 pr-8 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-xs font-medium text-on-surface appearance-none focus:outline-none focus:border-primary cursor-pointer transition-all [color-scheme:dark]"
            >
              <option value="TODOS">Todas divisas</option>
              <option value="VES">VES (Bs.)</option>
              <option value="USD">USD ($)</option>
              <option value="MXN">MXN ($)</option>
              <option value="EUR">EUR (€)</option>
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
          </div>

          {/* Date Range: Desde */}
          <div className="flex items-center gap-1.5 bg-surface-container-lowest border border-outline-variant/30 px-3 rounded-xl h-10">
            <span className="text-[11px] font-medium text-on-surface-variant">Desde:</span>
            <input
              id="reembolsos-desde-filter"
              type="date"
              value={currentDesde}
              onChange={(e) => updateParams({ desde: e.target.value })}
              className="bg-transparent text-xs text-on-surface focus:outline-none cursor-pointer [color-scheme:dark]"
            />
          </div>

          {/* Date Range: Hasta */}
          <div className="flex items-center gap-1.5 bg-surface-container-lowest border border-outline-variant/30 px-3 rounded-xl h-10">
            <span className="text-[11px] font-medium text-on-surface-variant">Hasta:</span>
            <input
              id="reembolsos-hasta-filter"
              type="date"
              value={currentHasta}
              onChange={(e) => updateParams({ hasta: e.target.value })}
              className="bg-transparent text-xs text-on-surface focus:outline-none cursor-pointer [color-scheme:dark]"
            />
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1.5 px-3 h-10 rounded-xl bg-error-container/20 border border-error/30 text-error text-xs font-semibold hover:bg-error-container/30 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpiar</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom Row: Status Pill Tabs & Visible Count Telemetry */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-outline-variant/20">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-container-lowest border border-outline-variant/30 overflow-x-auto max-w-full">
          {statusOptions.map((opt) => {
            const isActive = currentEstado === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => updateParams({ estado: opt.id })}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-surface-container-high text-primary border border-primary/25 shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                <span>{opt.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${opt.badgeClass}`}
                >
                  {opt.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-on-surface-variant text-xs">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
          <span>
            Mostrando <strong className="text-on-surface font-semibold">{visibleCount}</strong> de{' '}
            {kpis.totalCount} comprobantes registrados
          </span>
        </div>
      </div>
    </div>
  );
}
