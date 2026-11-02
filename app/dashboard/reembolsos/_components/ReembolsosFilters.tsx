'use client';

/**
 * @name ReembolsosFilters
 * @description [UI Component]: Interactive filter controls driven strictly by URL Search Params
 * (bookmarkable, shareable, and browser-history friendly). Implements debounced text search,
 * employee dropdown, status selector, and date-range constraints.
 */

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Search, Filter, Calendar, X, User } from 'lucide-react';
import type { EmpleadoOption, EstadoReembolso } from '@/lib/services/reembolsos.service';

interface ReembolsosFiltersProps {
  empleados: EmpleadoOption[];
}

export function ReembolsosFilters({ empleados }: ReembolsosFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Read current parameters from URL
  const currentSearch = searchParams.get('busqueda') || '';
  const currentEmpleado = searchParams.get('empleado') || 'TODOS';
  const currentEstado = (searchParams.get('estado') as EstadoReembolso | 'TODOS') || 'TODOS';
  const currentDesde = searchParams.get('desde') || '';
  const currentHasta = searchParams.get('hasta') || '';

  // Local state for debounced search input
  const [searchTerm, setSearchTerm] = useState(currentSearch);

  // Sync local search term if URL changes externally
  useEffect(() => {
    setSearchTerm(currentSearch);
  }, [currentSearch]);

  // Apply URL updates smoothly with page reset to 1
  const updateParams = (newEntries: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    // Reset pagination on any filter update
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
  };

  // Debounce search term by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchTerm !== currentSearch) {
        updateParams({ busqueda: searchTerm.trim() || null });
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  const hasActiveFilters = Boolean(
    currentSearch ||
    (currentEmpleado && currentEmpleado !== 'TODOS') ||
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

  const statusOptions: { id: EstadoReembolso | 'TODOS'; label: string }[] = [
    { id: 'TODOS', label: 'Todos' },
    { id: 'PENDIENTE', label: 'Pendientes' },
    { id: 'PROCESADO', label: 'Procesados' },
    { id: 'TRANSFERIDO', label: 'Transferidos' },
    { id: 'RECHAZADO', label: 'Rechazados' },
  ];

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--bg-border)',
        borderRadius: '14px',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      {/* Top Row: Search and Status Selector */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        {/* Search Bar */}
        <div style={{ position: 'relative', flex: '1 1 280px', minWidth: '220px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            id="reembolsos-search"
            type="search"
            placeholder="Buscar por comercio, RIF o # factura…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--bg-base)',
              border: '1px solid var(--bg-border)',
              borderRadius: '8px',
              padding: '8px 12px 8px 36px',
              color: 'var(--text-primary)',
              fontSize: '13px',
              outline: 'none',
            }}
          />
        </div>

        {/* Status Pills */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--bg-base)',
            padding: '4px',
            borderRadius: '10px',
            border: '1px solid var(--bg-border)',
            flexWrap: 'wrap',
          }}
        >
          {statusOptions.map((opt) => {
            const isActive = currentEstado === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => updateParams({ estado: opt.id })}
                style={{
                  background: isActive ? 'var(--rendy-primary)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'background 150ms ease, color 150ms ease',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Row: Employee Filter, Date Range & Clear Filters */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '12px',
          paddingTop: '10px',
          borderTop: '1px solid rgba(99, 102, 241, 0.08)',
        }}
      >
        {/* Employee Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <User size={14} style={{ color: 'var(--text-muted)' }} />
          <select
            id="reembolsos-empleado-filter"
            value={currentEmpleado}
            onChange={(e) => updateParams({ empleado: e.target.value })}
            style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--bg-border)',
              borderRadius: '8px',
              padding: '6px 12px',
              color: 'var(--text-primary)',
              fontSize: '12px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="TODOS">Todos los empleados</option>
            {empleados.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.nombre} {emp.email ? `(${emp.email})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Date Range: Desde */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Desde:</span>
          <input
            id="reembolsos-desde-filter"
            type="date"
            value={currentDesde}
            onChange={(e) => updateParams({ desde: e.target.value })}
            style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--bg-border)',
              borderRadius: '8px',
              padding: '5px 10px',
              color: 'var(--text-primary)',
              fontSize: '12px',
              outline: 'none',
            }}
          />
        </div>

        {/* Date Range: Hasta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Hasta:</span>
          <input
            id="reembolsos-hasta-filter"
            type="date"
            value={currentHasta}
            onChange={(e) => updateParams({ hasta: e.target.value })}
            style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--bg-border)',
              borderRadius: '8px',
              padding: '5px 10px',
              color: 'var(--text-primary)',
              fontSize: '12px',
              outline: 'none',
            }}
          />
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAllFilters}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '8px',
              padding: '5px 10px',
              color: 'var(--rendy-danger)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              marginLeft: 'auto',
            }}
          >
            <X size={13} />
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  );
}

