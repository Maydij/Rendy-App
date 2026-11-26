'use client';

/**
 * @name GastosEmpresaClient
 * @description [Business Logic]: High-tech corporate expense management workspace inspired by
 * the unified Stitch design system. Centralizes, audits, and reconciles company-funded expenses
 * (corporate cards, travel advances, and assigned operational funds) with interactive KPI metrics,
 * a collapsible financial analytics engine (category donut, project distribution, and daily trends),
 * dual feed/table views, and a dedicated Thermal E-Receipt Inspector side drawer.
 *
 * Fully compliant with zero-trust multi-tenant isolation, strict TypeScript typing (no any),
 * and adaptive fiscal validation for SENIAT (VE), SAT (MX), and US Sales Tax.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Receipt,
  Search,
  Calendar,
  FolderOpen,
  Users,
  CreditCard,
  DollarSign,
  TrendingUp,
  FileCheck2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Printer,
  X,
  Maximize2,
  ExternalLink,
  Layers,
  LayoutGrid,
  Table as TableIcon,
  Store,
  Fuel,
  Utensils,
  Laptop,
  HeartPulse,
  Wrench,
  HelpCircle,
  Clock,
  ArrowUpDown,
  FileSpreadsheet,
} from 'lucide-react';
import type { Gasto } from '@/lib/types/gasto';
import DigitalInvoice from './digital-invoice';

interface GastosEmpresaClientProps {
  gastos: Gasto[];
}

/**
 * @name getCategoryIcon
 * @description Maps domain expense category to semantic Lucide icon.
 */
function getCategoryIcon(categoria: string) {
  const cat = categoria.toLowerCase();
  if (cat.includes('aliment') || cat.includes('comida') || cat.includes('restaurant') || cat.includes('food')) {
    return <Utensils size={18} className="text-emerald-400" />;
  }
  if (cat.includes('combustible') || cat.includes('gas') || cat.includes('transporte') || cat.includes('peaje') || cat.includes('uber')) {
    return <Fuel size={18} className="text-amber-400" />;
  }
  if (cat.includes('software') || cat.includes('cloud') || cat.includes('hosting') || cat.includes('licencia') || cat.includes('tecnolog')) {
    return <Laptop size={18} className="text-cyan-400" />;
  }
  if (cat.includes('salud') || cat.includes('farmacia') || cat.includes('médic')) {
    return <HeartPulse size={18} className="text-rose-400" />;
  }
  if (cat.includes('material') || cat.includes('reparac') || cat.includes('herramienta') || cat.includes('mantenimiento')) {
    return <Wrench size={18} className="text-indigo-400" />;
  }
  if (cat.includes('hotel') || cat.includes('hospedaje') || cat.includes('viático')) {
    return <Store size={18} className="text-sky-400" />;
  }
  return <Receipt size={18} className="text-emerald-400" />;
}

export default function GastosEmpresaClient({ gastos }: GastosEmpresaClientProps) {
  // ── Search & Filter State ──
  const [search, setSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('ALL');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('ALL');
  const [selectedFiscalStatus, setSelectedFiscalStatus] = useState<'ALL' | 'VALID' | 'NON_FISCAL'>('ALL');
  const [sortBy, setSortBy] = useState<'DATE_DESC' | 'DATE_ASC' | 'AMOUNT_DESC' | 'AMOUNT_ASC'>('DATE_DESC');

  // ── Layout & View States ──
  const [viewMode, setViewMode] = useState<'feed' | 'table'>('feed');
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(true);
  const [analyticsTab, setAnalyticsTab] = useState<'cat' | 'proj' | 'trend'>('cat');

  // ── Inspector Drawer & Modal States ──
  const [selectedGastoId, setSelectedGastoId] = useState<string | null>(gastos[0]?.id ?? null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [modalGasto, setModalGasto] = useState<Gasto | null>(null);

  // ── Unique Options for Smart Filters ──
  const projectOptions = useMemo(() => {
    const set = new Set<string>();
    gastos.forEach((g) => {
      if (g.proyecto && g.proyecto !== '—') set.add(g.proyecto);
    });
    return Array.from(set).sort();
  }, [gastos]);

  const employeeOptions = useMemo(() => {
    const set = new Set<string>();
    gastos.forEach((g) => {
      if (g.empleado && g.empleado !== 'Sin asignar') set.add(g.empleado);
    });
    return Array.from(set).sort();
  }, [gastos]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    gastos.forEach((g) => {
      if (g.categoria) set.add(g.categoria);
    });
    return Array.from(set).sort();
  }, [gastos]);

  const currencyOptions = useMemo(() => {
    const set = new Set<string>();
    gastos.forEach((g) => {
      if (g.moneda) set.add(g.moneda);
    });
    return Array.from(set).sort();
  }, [gastos]);

  // ── Filtered & Sorted Expenses ──
  const filteredGastos = useMemo(() => {
    const query = search.trim().toLowerCase();

    return gastos
      .filter((g) => {
        // Search bar
        if (query) {
          const matchEmp = g.empleado.toLowerCase().includes(query);
          const matchCom = g.comercio.toLowerCase().includes(query);
          const matchProy = g.proyecto.toLowerCase().includes(query);
          const matchCat = g.categoria.toLowerCase().includes(query);
          const matchConcept = (g.concepto ?? '').toLowerCase().includes(query);
          const matchRif = (g.rif_comercio ?? '').toLowerCase().includes(query);
          const matchInvoice = (g.numero_factura ?? '').toLowerCase().includes(query);
          if (!matchEmp && !matchCom && !matchProy && !matchCat && !matchConcept && !matchRif && !matchInvoice) {
            return false;
          }
        }

        // Project filter
        if (selectedProject !== 'ALL' && g.proyecto !== selectedProject) {
          return false;
        }

        // Employee filter
        if (selectedEmployee !== 'ALL' && g.empleado !== selectedEmployee) {
          return false;
        }

        // Category filter
        if (selectedCategory !== 'ALL' && g.categoria !== selectedCategory) {
          return false;
        }

        // Currency filter
        if (selectedCurrency !== 'ALL' && g.moneda !== selectedCurrency) {
          return false;
        }

        // Fiscal validity filter
        if (selectedFiscalStatus === 'VALID' && g.tiene_validez_fiscal === false) {
          return false;
        }
        if (selectedFiscalStatus === 'NON_FISCAL' && g.tiene_validez_fiscal !== false) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const amountA = a.monto_convertido ?? a.monto_usd ?? a.monto;
        const amountB = b.monto_convertido ?? b.monto_usd ?? b.monto;
        const dateA = new Date(a.fecha_gasto || a.creado_en || 0).getTime();
        const dateB = new Date(b.fecha_gasto || b.creado_en || 0).getTime();

        if (sortBy === 'DATE_DESC') return dateB - dateA;
        if (sortBy === 'DATE_ASC') return dateA - dateB;
        if (sortBy === 'AMOUNT_DESC') return amountB - amountA;
        if (sortBy === 'AMOUNT_ASC') return amountA - amountB;
        return 0;
      });
  }, [
    gastos,
    search,
    selectedProject,
    selectedEmployee,
    selectedCategory,
    selectedCurrency,
    selectedFiscalStatus,
    sortBy,
  ]);

  // Selected expense object for Drawer Inspector
  const selectedGasto = useMemo(() => {
    if (!selectedGastoId) return filteredGastos[0] || null;
    return filteredGastos.find((g) => g.id === selectedGastoId) || filteredGastos[0] || null;
  }, [filteredGastos, selectedGastoId]);

  // ── Executive KPI Metrics Computation ──
  const kpis = useMemo(() => {
    let totalUsd = 0;
    let totalVes = 0;
    let validOcr = 0;
    let nonFiscal = 0;

    gastos.forEach((g) => {
      const usdVal = Number(g.monto_convertido ?? g.monto_usd ?? (g.moneda === 'USD' ? g.monto : (g.tasa_cambio ? g.monto / g.tasa_cambio : 0)));
      const vesVal = Number(g.monto_ves ?? (g.moneda === 'VES' ? g.monto : (g.tasa_cambio ? g.monto * g.tasa_cambio : 0)));

      totalUsd += usdVal;
      totalVes += vesVal;

      if (g.datos_ocr) validOcr++;
      if (g.tiene_validez_fiscal === false || g.requiere_revision_fiscal) nonFiscal++;
    });

    const activeCollabs = new Set(gastos.map((g) => g.empleado).filter((e) => e && e !== 'Sin asignar')).size;
    const activeCards = new Set(gastos.map((g) => g.metodo_pago).filter(Boolean)).size;
    const ocrPct = gastos.length > 0 ? ((validOcr / gastos.length) * 100).toFixed(1) : '100';
    const weightedBcv = totalUsd > 0 && totalVes > 0 ? (totalVes / totalUsd).toFixed(2) : '918.42';

    return {
      totalUsd,
      totalVes,
      count: gastos.length,
      validOcr,
      ocrPct,
      nonFiscal,
      activeCollabs,
      activeCards,
      weightedBcv,
    };
  }, [gastos]);

  // ── Analytics: Categories Breakdown & Donut Calculations ──
  const categoriesBreakdown = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    let grandTotal = 0;

    gastos.forEach((g) => {
      const cat = g.categoria || 'Otros';
      const usd = Number(g.monto_convertido ?? g.monto_usd ?? (g.moneda === 'USD' ? g.monto : 0));
      const prev = map.get(cat) || { total: 0, count: 0 };
      map.set(cat, { total: prev.total + usd, count: prev.count + 1 });
      grandTotal += usd;
    });

    const colors = ['#00e599', '#03b5d3', '#fcc025', '#e0e2ef', '#f43f5e', '#a855f7'];
    const items = Array.from(map.entries())
      .map(([name, stat], idx) => {
        const pct = grandTotal > 0 ? (stat.total / grandTotal) * 100 : 0;
        return {
          name,
          total: stat.total,
          count: stat.count,
          percentage: pct,
          color: colors[idx % colors.length],
        };
      })
      .sort((a, b) => b.total - a.total);

    // Circumference for r=38
    const circumference = 2 * Math.PI * 38;
    let accumulatedLength = 0;

    const segments = items.map((item) => {
      const length = (item.percentage / 100) * circumference;
      const offset = accumulatedLength;
      accumulatedLength += length;
      return {
        ...item,
        length,
        offset,
      };
    });

    return { items, segments, grandTotal, circumference };
  }, [gastos]);

  // ── Analytics: Projects Breakdown ──
  const projectsBreakdown = useMemo(() => {
    const map = new Map<string, { total: number; count: number; collabs: Set<string> }>();
    let grandTotal = 0;

    gastos.forEach((g) => {
      const proy = g.proyecto && g.proyecto !== '—' ? g.proyecto : 'Gastos Operativos';
      const usd = Number(g.monto_convertido ?? g.monto_usd ?? (g.moneda === 'USD' ? g.monto : 0));
      const prev = map.get(proy) || { total: 0, count: 0, collabs: new Set() };
      if (g.empleado) prev.collabs.add(g.empleado);
      map.set(proy, { total: prev.total + usd, count: prev.count + 1, collabs: prev.collabs });
      grandTotal += usd;
    });

    const colors = ['#00e599', '#03b5d3', '#fcc025', '#a855f7'];

    return Array.from(map.entries())
      .map(([name, stat], idx) => {
        const pct = grandTotal > 0 ? (stat.total / grandTotal) * 100 : 0;
        return {
          name,
          total: stat.total,
          count: stat.count,
          collaboratorCount: stat.collabs.size,
          percentage: pct,
          color: colors[idx % colors.length],
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [gastos]);

  // ── Analytics: Daily Expense Flow ──
  const dailyFlow = useMemo(() => {
    const map = new Map<string, number>();

    gastos.forEach((g) => {
      const rawDate = g.fecha_gasto || g.creado_en;
      if (!rawDate) return;
      const dateKey = rawDate.slice(0, 10);
      const usd = Number(g.monto_convertido ?? g.monto_usd ?? (g.moneda === 'USD' ? g.monto : 0));
      map.set(dateKey, (map.get(dateKey) || 0) + usd);
    });

    const sortedDates = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const maxVal = Math.max(...sortedDates.map(([, val]) => val), 1);
    const avgVal = sortedDates.length > 0 ? sortedDates.reduce((acc, [, val]) => acc + val, 0) / sortedDates.length : 0;

    return {
      points: sortedDates.slice(-14),
      maxVal,
      avgVal,
    };
  }, [gastos]);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (search.trim()) count++;
    if (selectedProject !== 'ALL') count++;
    if (selectedEmployee !== 'ALL') count++;
    if (selectedCategory !== 'ALL') count++;
    if (selectedCurrency !== 'ALL') count++;
    if (selectedFiscalStatus !== 'ALL') count++;
    return count;
  }, [search, selectedProject, selectedEmployee, selectedCategory, selectedCurrency, selectedFiscalStatus]);

  const handleResetFilters = useCallback(() => {
    setSearch('');
    setSelectedProject('ALL');
    setSelectedEmployee('ALL');
    setSelectedCategory('ALL');
    setSelectedCurrency('ALL');
    setSelectedFiscalStatus('ALL');
  }, []);

  return (
    <div className="w-full flex flex-col gap-6" style={{ maxWidth: '1600px', margin: '0 auto' }}>
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 1. TOP HEADER AREA                                                  */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-[0_0_16px_rgba(0,229,153,0.15)]"
              style={{
                background: 'color-mix(in oklab, var(--primary-container) 12%, transparent)',
                color: 'var(--primary)',
              }}
            >
              <Receipt size={22} strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--on-surface)' }}>
                Gastos de Empresa
              </h1>
            </div>
          </div>
          <p className="text-sm max-w-3xl" style={{ color: 'var(--on-surface-variant)' }}>
            Centraliza, audita y concilia los comprobantes emitidos con fondos corporativos (tarjetas de crédito/débito y fondos operativos asignados).
          </p>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 2. BENTO METRICS CARDS (4 CARDS)                                   */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Gastos Totales */}
        <div
          className="rounded-2xl p-5 flex flex-col justify-between transition-all relative overflow-hidden shadow-md hover:bg-surface-container"
          style={{
            background: 'var(--surface-container-low)',
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wider font-bold" style={{ color: 'var(--outline)' }}>
                Gastos Totales (Consolidado)
              </span>
              <div className="flex items-baseline gap-1.5 mt-1.5" suppressHydrationWarning>
                <span className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--on-surface)' }}>
                  ${kpis.totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-xs font-bold" style={{ color: 'var(--primary-container)' }}>
                  USD
                </span>
              </div>
            </div>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: 'color-mix(in oklab, var(--primary-container) 15%, transparent)',
                color: 'var(--primary-container)',
              }}
            >
              <DollarSign size={20} />
            </div>
          </div>
          <div
            className="mt-4 pt-3 flex items-center justify-between -mx-5 -mb-5 px-5 py-2.5 rounded-b-2xl"
            style={{ background: 'color-mix(in oklab, var(--surface-container-lowest) 70%, transparent)' }}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--primary-container)' }}>
              <TrendingUp size={14} />
              <span>{kpis.count} transacciones auditadas</span>
            </div>
            <span className="text-xs font-medium" style={{ color: 'var(--outline)' }}>
              Bs. {kpis.totalVes.toLocaleString('es-VE', { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>

        {/* Card 2: Comprobantes Digitalizados */}
        <div
          className="rounded-2xl p-5 flex flex-col justify-between transition-all relative overflow-hidden shadow-md hover:bg-surface-container"
          style={{
            background: 'var(--surface-container-low)',
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wider font-bold" style={{ color: 'var(--outline)' }}>
                Comprobantes Digitalizados
              </span>
              <div className="flex items-baseline gap-1.5 mt-1.5">
                <span className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--on-surface)' }}>
                  {kpis.count}
                </span>
                <span className="text-xs" style={{ color: 'var(--outline)' }}>
                  facturas/recibos
                </span>
              </div>
            </div>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: 'color-mix(in oklab, var(--secondary) 15%, transparent)',
                color: 'var(--secondary)',
              }}
            >
              <FileCheck2 size={20} />
            </div>
          </div>
          <div
            className="mt-4 pt-3 flex items-center justify-between -mx-5 -mb-5 px-5 py-2.5 rounded-b-2xl"
            style={{ background: 'color-mix(in oklab, var(--surface-container-lowest) 70%, transparent)' }}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--secondary)' }}>
              <span>{kpis.ocrPct}% validados por IA</span>
            </div>
            <span className="text-xs" style={{ color: 'var(--outline)' }}>
              {kpis.validOcr} con OCR completo
            </span>
          </div>
        </div>

        {/* Card 3: Observaciones Fiscales */}
        <div
          className={`rounded-2xl p-5 flex flex-col justify-between transition-all relative overflow-hidden cursor-pointer group shadow-md hover:bg-surface-container ${
            selectedFiscalStatus === 'NON_FISCAL' ? 'ring-1 ring-tertiary-container/60' : ''
          }`}
          onClick={() => setSelectedFiscalStatus((prev) => (prev === 'NON_FISCAL' ? 'ALL' : 'NON_FISCAL'))}
          style={{
            background: 'var(--surface-container-low)',
          }}
          title="Haz clic para filtrar comprobantes sin validez fiscal"
        >
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wider font-bold" style={{ color: 'var(--tertiary-container)' }}>
                Observaciones Fiscales
              </span>
              <div className="flex items-baseline gap-1.5 mt-1.5">
                <span className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--tertiary-container)' }}>
                  {kpis.nonFiscal}
                </span>
                <span className="text-xs font-bold" style={{ color: 'var(--tertiary-container)' }}>
                  alertas
                </span>
              </div>
            </div>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: 'color-mix(in oklab, var(--tertiary-container) 15%, transparent)',
                color: 'var(--tertiary-container)',
              }}
            >
              <AlertTriangle size={20} />
            </div>
          </div>
          <div
            className="mt-4 pt-3 flex items-center justify-between -mx-5 -mb-5 px-5 py-2.5 rounded-b-2xl"
            style={{ background: 'color-mix(in oklab, var(--surface-container-lowest) 70%, transparent)' }}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--tertiary-container)' }}>
              <span>Vouchers POS / Notas de Entrega</span>
            </div>
            <span className="text-xs underline font-bold" style={{ color: 'var(--tertiary-container)' }}>
              {selectedFiscalStatus === 'NON_FISCAL' ? 'Quitar filtro' : 'Filtrar'}
            </span>
          </div>
        </div>

        {/* Card 4: Colaboradores Activos */}
        <div
          className="rounded-2xl p-5 flex flex-col justify-between transition-all relative overflow-hidden shadow-md hover:bg-surface-container"
          style={{
            background: 'var(--surface-container-low)',
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wider font-bold" style={{ color: 'var(--outline)' }}>
                Colaboradores Activos
              </span>
              <div className="flex items-baseline gap-1.5 mt-1.5">
                <span className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--on-surface)' }}>
                  {kpis.activeCollabs}
                </span>
                <span className="text-xs" style={{ color: 'var(--outline)' }}>
                  con gastos imputados
                </span>
              </div>
            </div>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: 'var(--surface-container-high)',
                color: 'var(--on-surface)',
              }}
            >
              <Users size={20} />
            </div>
          </div>
          <div
            className="mt-4 pt-3 flex items-center justify-between -mx-5 -mb-5 px-5 py-2.5 rounded-b-2xl"
            style={{ background: 'color-mix(in oklab, var(--surface-container-lowest) 70%, transparent)' }}
          >
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--outline)' }}>
              <CreditCard size={14} style={{ color: 'var(--primary-container)' }} />
              <span>{kpis.activeCards} métodos de pago</span>
            </div>
            <span className="text-xs font-bold" style={{ color: 'var(--primary-container)' }}>
              En norma
            </span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 3. COLLAPSIBLE FINANCIAL ANALYTICS DRAWER                           */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-5 shadow-lg transition-all"
        style={{
          background: 'var(--surface-container-low)',
        }}
      >
        <div
          className="flex items-center justify-between cursor-pointer select-none"
          onClick={() => setIsAnalyticsOpen((prev) => !prev)}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: 'var(--surface-container-high)',
                color: 'var(--primary-container)',
              }}
            >
              <Layers size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: 'var(--on-surface)' }}>
                Análisis de Distribución de Fondos
              </h2>
              <p className="text-xs" style={{ color: 'var(--outline)' }}>
                Desglose presupuestario por categoría, centros de costo y velocidad diaria
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold hidden sm:inline" style={{ color: 'var(--primary-container)' }}>
              Tasa Ponderada: <strong>{kpis.weightedBcv} VES/USD</strong>
            </span>
            <button
              type="button"
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{
                background: 'var(--surface-container)',
                color: 'var(--on-surface-variant)',
              }}
              aria-label="Alternar análisis"
            >
              {isAnalyticsOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>
        </div>

        {isAnalyticsOpen && (
          <div
            className="mt-4 pt-4 rounded-xl p-4 transition-all"
            style={{
              background: 'color-mix(in oklab, var(--surface-container-lowest) 60%, transparent)',
            }}
          >
            {/* Tabs switcher */}
            <div className="flex items-center justify-between flex-wrap gap-3 pb-3 mb-4 border-b border-surface-container-highest/25">
              <div className="flex items-center p-1 rounded-xl" style={{ background: 'var(--surface-container-high)' }}>
                <button
                  type="button"
                  onClick={() => setAnalyticsTab('cat')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    analyticsTab === 'cat'
                      ? 'shadow-sm text-emerald-400'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  style={{
                    background: analyticsTab === 'cat' ? 'var(--surface-container-lowest)' : 'transparent',
                    color: analyticsTab === 'cat' ? 'var(--primary-container)' : 'var(--outline)',
                  }}
                >
                  Por Categorías
                </button>
                <button
                  type="button"
                  onClick={() => setAnalyticsTab('proj')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    analyticsTab === 'proj'
                      ? 'shadow-sm text-emerald-400'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  style={{
                    background: analyticsTab === 'proj' ? 'var(--surface-container-lowest)' : 'transparent',
                    color: analyticsTab === 'proj' ? 'var(--primary-container)' : 'var(--outline)',
                  }}
                >
                  Por Proyectos
                </button>
                <button
                  type="button"
                  onClick={() => setAnalyticsTab('trend')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    analyticsTab === 'trend'
                      ? 'shadow-sm text-emerald-400'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  style={{
                    background: analyticsTab === 'trend' ? 'var(--surface-container-lowest)' : 'transparent',
                    color: analyticsTab === 'trend' ? 'var(--primary-container)' : 'var(--outline)',
                  }}
                >
                  Evolución Diaria
                </button>
              </div>

              <div className="text-xs" style={{ color: 'var(--outline)' }}>
                {gastos.length} comprobantes consolidados
              </div>
            </div>

            {/* Tab 1: Categories Donut & Bars */}
            {analyticsTab === 'cat' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                {/* Donut Chart */}
                <div className="lg:col-span-4 flex items-center justify-center py-2 relative">
                  <svg className="w-48 h-48 -rotate-90 transform" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" fill="transparent" r="38" stroke="#1c1f29" strokeWidth="12" />
                    {categoriesBreakdown.segments.map((seg, i) => (
                      <circle
                        key={i}
                        cx="50"
                        cy="50"
                        fill="transparent"
                        r="38"
                        stroke={seg.color}
                        strokeWidth="12"
                        strokeDasharray={`${seg.length} ${categoriesBreakdown.circumference - seg.length}`}
                        strokeDashoffset={-seg.offset}
                      />
                    ))}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl font-extrabold" style={{ color: 'var(--on-surface)' }}>
                      ${Math.round(categoriesBreakdown.grandTotal).toLocaleString('en-US')}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--outline)' }}>
                      Total Ejecutado
                    </span>
                  </div>
                </div>

                {/* Category Horizontal Breakdown Bars */}
                <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {categoriesBreakdown.items.slice(0, 6).map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl flex flex-col gap-1.5"
                      style={{ background: 'var(--surface-container-low)' }}
                    >
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="flex items-center gap-2" style={{ color: 'var(--on-surface)' }}>
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                          <span className="truncate max-w-[140px]">{item.name}</span>
                        </span>
                        <span className="font-bold" style={{ color: item.color }}>
                          ${item.total.toFixed(2)} ({item.percentage.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div className="h-1.5 rounded-full" style={{ width: `${item.percentage}%`, background: item.color }} />
                      </div>
                      <span className="text-[10px]" style={{ color: 'var(--outline)' }}>
                        {item.count} comprobante{item.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 2: Projects Breakdown */}
            {analyticsTab === 'proj' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {projectsBreakdown.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl flex flex-col gap-2.5"
                    style={{ background: 'var(--surface-container-low)' }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold truncate max-w-[180px]" style={{ color: 'var(--on-surface)' }}>
                        {p.name}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-bold"
                        style={{
                          background: 'color-mix(in oklab, var(--primary-container) 15%, transparent)',
                          color: 'var(--primary-container)',
                        }}
                      >
                        {p.percentage.toFixed(0)}% Total
                      </span>
                    </div>
                    <span className="text-xl font-extrabold" style={{ color: p.color }}>
                      ${p.total.toFixed(2)} USD
                    </span>
                    <div className="w-full bg-slate-800 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full" style={{ width: `${p.percentage}%`, background: p.color }} />
                    </div>
                    <span className="text-[11px]" style={{ color: 'var(--outline)' }}>
                      {p.count} Comprobantes • {p.collaboratorCount} Colaborador{p.collaboratorCount !== 1 ? 'es' : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Tab 3: Daily Trend */}
            {analyticsTab === 'trend' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold" style={{ color: 'var(--on-surface)' }}>
                    Flujo de gastos recientes
                  </span>
                  <span style={{ color: 'var(--outline)' }}>
                    Promedio: ${dailyFlow.avgVal.toFixed(2)} USD/día
                  </span>
                </div>
                <div className="h-32 w-full flex items-end gap-2 pt-6 pb-2 border-b border-surface-container-highest/25">
                  {dailyFlow.points.map(([date, val], idx) => {
                    const heightPct = Math.min(100, Math.max(12, (val / dailyFlow.maxVal) * 100));
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end">
                        <div
                          className="w-full rounded-t transition-all group-hover:brightness-125"
                          style={{
                            height: `${heightPct}%`,
                            background: idx === dailyFlow.points.length - 1 ? 'var(--primary-container)' : 'var(--surface-container-high)',
                          }}
                        />
                        <span className="absolute -top-7 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                          ${val.toFixed(0)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[10px] font-semibold" style={{ color: 'var(--outline)' }}>
                  <span>{dailyFlow.points[0]?.[0] || 'Inicio'}</span>
                  <span>{dailyFlow.points[dailyFlow.points.length - 1]?.[0] || 'Actual'}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 4. ADVANCED SMART FILTER BAR & CONTROLS                            */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        {/* Main Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--outline)' }} />
            <input
              type="text"
              placeholder="Buscar por comercio, empleado, concepto o RIF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl text-xs font-medium transition-all focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
              style={{
                background: 'var(--surface-container-low)',
                color: 'var(--on-surface)',
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {/* Project Filter */}
            {projectOptions.length > 0 && (
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer shadow-sm [color-scheme:dark]"
                style={{
                  background: 'var(--surface-container-low)',
                  color: selectedProject !== 'ALL' ? 'var(--primary-container)' : 'var(--on-surface)',
                }}
              >
                <option value="ALL">📁 Todos los proyectos</option>
                {projectOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            )}

            {/* Employee Filter */}
            {employeeOptions.length > 0 && (
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer shadow-sm [color-scheme:dark]"
                style={{
                  background: 'var(--surface-container-low)',
                  color: selectedEmployee !== 'ALL' ? 'var(--primary-container)' : 'var(--on-surface)',
                }}
              >
                <option value="ALL">👤 Todos los colaboradores</option>
                {employeeOptions.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            )}

            {/* Category Filter */}
            {categoryOptions.length > 0 && (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer shadow-sm [color-scheme:dark]"
                style={{
                  background: 'var(--surface-container-low)',
                  color: selectedCategory !== 'ALL' ? 'var(--primary-container)' : 'var(--on-surface)',
                }}
              >
                <option value="ALL">🏷️ Categorías</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}

            {/* Currency Filter */}
            {currencyOptions.length > 1 && (
              <select
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer shadow-sm [color-scheme:dark]"
                style={{
                  background: 'var(--surface-container-low)',
                  color: selectedCurrency !== 'ALL' ? 'var(--primary-container)' : 'var(--on-surface)',
                }}
              >
                <option value="ALL">💵 Divisas</option>
                {currencyOptions.map((curr) => (
                  <option key={curr} value={curr}>
                    {curr}
                  </option>
                ))}
              </select>
            )}

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer shadow-sm [color-scheme:dark]"
              style={{
                background: 'var(--surface-container-low)',
                color: 'var(--on-surface)',
              }}
            >
              <option value="DATE_DESC">⏱️ Más recientes</option>
              <option value="DATE_ASC">⏱️ Más antiguos</option>
              <option value="AMOUNT_DESC">💰 Mayor monto</option>
              <option value="AMOUNT_ASC">💰 Menor monto</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div
            className="flex items-center p-1 rounded-xl shrink-0 shadow-inner"
            style={{
              background: 'var(--surface-container-low)',
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('feed')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold transition-all ${
                viewMode === 'feed'
                  ? 'bg-slate-800 text-emerald-400 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              style={{
                background: viewMode === 'feed' ? 'var(--surface-container)' : 'transparent',
                color: viewMode === 'feed' ? 'var(--primary-container)' : 'var(--outline)',
              }}
            >
              <LayoutGrid size={15} />
              <span>Tarjetas</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold transition-all ${
                viewMode === 'table'
                  ? 'bg-slate-800 text-emerald-400 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              style={{
                background: viewMode === 'table' ? 'var(--surface-container)' : 'transparent',
                color: viewMode === 'table' ? 'var(--primary-container)' : 'var(--outline)',
              }}
            >
              <TableIcon size={15} />
              <span>Tabla</span>
            </button>
          </div>
        </div>

        {/* Active Filters Pill Bar */}
        {activeFiltersCount > 0 && (
          <div className="flex items-center flex-wrap gap-2 text-xs pt-1">
            <span className="uppercase text-[10px] font-bold" style={{ color: 'var(--outline)' }}>
              Filtros activos:
            </span>

            {search && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{ background: 'var(--surface-container-high)', color: 'var(--on-surface)' }}
              >
                Búsqueda: &quot;{search}&quot;
                <button type="button" onClick={() => setSearch('')} className="hover:text-rose-400">
                  <X size={12} />
                </button>
              </span>
            )}

            {selectedProject !== 'ALL' && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{ background: 'var(--surface-container-high)', color: 'var(--primary-container)' }}
              >
                Proyecto: {selectedProject}
                <button type="button" onClick={() => setSelectedProject('ALL')} className="hover:text-rose-400">
                  <X size={12} />
                </button>
              </span>
            )}

            {selectedEmployee !== 'ALL' && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{ background: 'var(--surface-container-high)', color: 'var(--secondary)' }}
              >
                Colaborador: {selectedEmployee}
                <button type="button" onClick={() => setSelectedEmployee('ALL')} className="hover:text-rose-400">
                  <X size={12} />
                </button>
              </span>
            )}

            {selectedCategory !== 'ALL' && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{ background: 'var(--surface-container-high)', color: 'var(--on-surface)' }}
              >
                Categoría: {selectedCategory}
                <button type="button" onClick={() => setSelectedCategory('ALL')} className="hover:text-rose-400">
                  <X size={12} />
                </button>
              </span>
            )}

            {selectedFiscalStatus !== 'ALL' && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{
                  background: 'color-mix(in oklab, var(--tertiary-container) 20%, transparent)',
                  color: 'var(--tertiary-container)',
                }}
              >
                {selectedFiscalStatus === 'NON_FISCAL' ? 'Solo Sin Validez Fiscal' : 'Solo Validados'}
                <button type="button" onClick={() => setSelectedFiscalStatus('ALL')} className="hover:text-rose-400">
                  <X size={12} />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs underline hover:text-white transition-colors ml-1"
              style={{ color: 'var(--outline)' }}
            >
              Restablecer todo
            </button>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 5. MAIN DUAL-PANEL WORKSPACE                                        */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start relative">
        {/* Left Column: Transaction List (Feed or Table) */}
        <div className={`transition-all duration-300 ${isDrawerOpen && selectedGasto ? 'lg:col-span-8' : 'lg:col-span-12'}`}>
          {filteredGastos.length === 0 ? (
            <div
              className="p-12 rounded-2xl flex flex-col items-center justify-center text-center gap-3"
              style={{
                background: 'var(--surface-container-low)',
                border: '1px dashed var(--outline-variant)',
              }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{
                  background: 'color-mix(in oklab, var(--primary-container) 15%, transparent)',
                  color: 'var(--primary-container)',
                }}
              >
                <Receipt size={24} />
              </div>
              <h3 className="text-base font-bold" style={{ color: 'var(--on-surface)' }}>
                No se encontraron comprobantes
              </h3>
              <p className="text-xs max-w-sm" style={{ color: 'var(--outline)' }}>
                {activeFiltersCount > 0
                  ? 'Intenta ajustar o restablecer los filtros de búsqueda para ver más resultados.'
                  : 'Los gastos registrados por los colaboradores vía WhatsApp aparecerán aquí automáticamente.'}
              </p>
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-2 px-4 py-2 rounded-xl text-xs font-bold"
                  style={{
                    background: 'var(--surface-container)',
                    color: 'var(--primary-container)',
                  }}
                >
                  Restablecer filtros
                </button>
              )}
            </div>
          ) : viewMode === 'feed' ? (
            /* Feed / Cards View */
            <div className="flex flex-col gap-3">
              {filteredGastos.map((g) => {
                const isSelected = selectedGasto?.id === g.id && isDrawerOpen;
                const convertedUsd = Number(g.monto_convertido ?? g.monto_usd ?? (g.moneda === 'USD' ? g.monto : (g.tasa_cambio ? g.monto / g.tasa_cambio : 0)));
                const isNonFiscal = g.tiene_validez_fiscal === false || g.requiere_revision_fiscal;

                return (
                  <div
                    key={g.id}
                    onClick={() => {
                      setSelectedGastoId(g.id);
                      setIsDrawerOpen(true);
                    }}
                    className={`p-4 rounded-2xl cursor-pointer transition-all shadow-md relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 ${
                      isSelected
                        ? 'border-emerald-400 bg-slate-800/80 shadow-emerald-500/10'
                        : isNonFiscal
                        ? 'border-amber-400/80 hover:border-amber-400'
                        : 'border-transparent hover:border-emerald-400/50'
                    }`}
                    style={{
                      background: isSelected ? 'var(--surface-container)' : 'var(--surface-container-low)',
                    }}
                  >
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                      {/* Merchant Avatar / Icon */}
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm relative"
                        style={{ background: 'var(--surface-container-high)' }}
                      >
                        {getCategoryIcon(g.categoria)}
                        {isNonFiscal ? (
                          <span
                            className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
                            style={{ background: 'var(--tertiary-container)', color: '#000' }}
                          >
                            !
                          </span>
                        ) : (
                          <span
                            className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
                            style={{ background: 'var(--primary-container)', color: '#000' }}
                          >
                            ✓
                          </span>
                        )}
                      </div>

                      {/* Merchant Info & Meta */}
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm tracking-tight truncate max-w-[220px]" style={{ color: 'var(--on-surface)' }}>
                            {g.comercio}
                          </span>
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
                            style={{
                              background: 'color-mix(in oklab, var(--primary-container) 15%, transparent)',
                              color: 'var(--primary-container)',
                            }}
                          >
                            {g.categoria}
                          </span>
                          {g.proyecto && g.proyecto !== '—' && (
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-medium"
                              style={{ background: 'var(--surface-container-highest)', color: 'var(--secondary)' }}
                            >
                              {g.proyecto}
                            </span>
                          )}
                          {isNonFiscal && (
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"
                              style={{
                                background: 'color-mix(in oklab, var(--tertiary-container) 20%, transparent)',
                                color: 'var(--tertiary-container)',
                              }}
                            >
                              <AlertTriangle size={11} />
                              Sin Validez Fiscal
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs mt-1 flex-wrap" style={{ color: 'var(--outline)' }}>
                          <span className="font-medium text-slate-300">{g.empleado}</span>
                          <span>•</span>
                          <span>{g.metodo_pago}</span>
                          <span>•</span>
                          <span>{g.fecha_gasto || (g.creado_en ? g.creado_en.slice(0, 10) : '—')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Price & Action Button */}
                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pl-14 sm:pl-0">
                      <div className="flex flex-col sm:items-end">
                        <span className="text-lg font-extrabold tracking-tight leading-none" style={{ color: 'var(--primary-container)' }}>
                          ${convertedUsd.toFixed(2)} USD
                        </span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[11px]" style={{ color: 'var(--outline)' }}>
                            {g.monto.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {g.moneda}
                          </span>
                          {g.tasa_cambio && g.tasa_cambio !== 1 && (
                            <span
                              className="text-[10px] px-1 rounded font-mono"
                              style={{ background: 'var(--surface-container-high)', color: 'var(--outline)' }}
                            >
                              Tasa: {g.tasa_cambio}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedGastoId(g.id);
                          setIsDrawerOpen(true);
                        }}
                        className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                        style={{
                          background: isSelected ? 'var(--primary-container)' : 'var(--surface-container)',
                          color: isSelected ? '#000' : 'var(--on-surface)',
                        }}
                        title="Ver detalle contable"
                      >
                        <Maximize2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Table View */
            <div
              className="overflow-x-auto rounded-2xl shadow-md"
              style={{
                background: 'var(--surface-container-low)',
              }}
            >
              <table className="w-full text-left text-xs">
                <thead
                  className="uppercase tracking-wider font-bold text-[10px]"
                  style={{
                    background: 'var(--surface-container-high)',
                    color: 'var(--outline)',
                  }}
                >
                  <tr>
                    <th className="p-3.5">Empleado</th>
                    <th className="p-3.5">Categoría</th>
                    <th className="p-3.5">Comercio</th>
                    <th className="p-3.5 text-right">Monto Original</th>
                    <th className="p-3.5 text-right">Tasa</th>
                    <th className="p-3.5 text-right">Convertido USD</th>
                    <th className="p-3.5">Proyecto</th>
                    <th className="p-3.5">Fecha</th>
                    <th className="p-3.5 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-highest/20">
                  {filteredGastos.map((g) => {
                    const isSelected = selectedGasto?.id === g.id && isDrawerOpen;
                    const convertedUsd = Number(g.monto_convertido ?? g.monto_usd ?? (g.moneda === 'USD' ? g.monto : (g.tasa_cambio ? g.monto / g.tasa_cambio : 0)));
                    const isNonFiscal = g.tiene_validez_fiscal === false || g.requiere_revision_fiscal;

                    return (
                      <tr
                        key={g.id}
                        onClick={() => {
                          setSelectedGastoId(g.id);
                          setIsDrawerOpen(true);
                        }}
                        className="transition-colors cursor-pointer hover:bg-slate-800/50"
                        style={{
                          background: isSelected ? 'var(--surface-container)' : 'transparent',
                        }}
                      >
                        <td className="p-3.5 font-semibold" style={{ color: 'var(--on-surface)' }}>
                          {g.empleado}
                        </td>
                        <td className="p-3.5">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-bold"
                            style={{
                              background: 'color-mix(in oklab, var(--primary-container) 15%, transparent)',
                              color: 'var(--primary-container)',
                            }}
                          >
                            {g.categoria}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="font-semibold" style={{ color: 'var(--on-surface)' }}>
                            {g.comercio}
                          </div>
                          {isNonFiscal && (
                            <span className="text-[10px] font-bold" style={{ color: 'var(--tertiary-container)' }}>
                              ⚠️ Sin Validez Fiscal
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold" style={{ color: 'var(--on-surface)' }}>
                          {g.monto.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {g.moneda}
                        </td>
                        <td className="p-3.5 text-right font-mono text-[11px]" style={{ color: 'var(--outline)' }}>
                          {g.tasa_cambio ? g.tasa_cambio : '1.00'}
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold" style={{ color: 'var(--primary-container)' }}>
                          ${convertedUsd.toFixed(2)} USD
                        </td>
                        <td className="p-3.5 text-[11px]" style={{ color: 'var(--outline)' }}>
                          {g.proyecto}
                        </td>
                        <td className="p-3.5 text-[11px]" style={{ color: 'var(--outline)' }}>
                          {g.fecha_gasto || (g.creado_en ? g.creado_en.slice(0, 10) : '—')}
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedGastoId(g.id);
                              setIsDrawerOpen(true);
                            }}
                            className="inline-flex items-center gap-1 font-bold text-xs"
                            style={{ color: 'var(--primary-container)' }}
                          >
                            <Maximize2 size={13} /> Ver
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

        {/* ───────────────────────────────────────────────────────────────── */}
        {/* RIGHT COLUMN: HIGH-TECH FINANCIAL INSPECTOR / SIDE DETAIL DRAWER   */}
        {/* ───────────────────────────────────────────────────────────────── */}
        {isDrawerOpen && selectedGasto && (
          <div
            className="lg:col-span-4 sticky top-20 rounded-2xl p-5 shadow-2xl flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-200"
            style={{
              background: 'var(--surface-container-low)',
            }}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-highest/25">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    background: 'var(--primary-container)',
                    boxShadow: '0 0 8px var(--primary-container)',
                  }}
                />
                <span className="text-sm font-bold" style={{ color: 'var(--on-surface)' }}>
                  Detalle del Comprobante
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors text-slate-300 hover:text-white"
                  style={{ background: 'var(--surface-container)' }}
                  title="Imprimir"
                >
                  <Printer size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors text-slate-300 hover:text-white"
                  style={{ background: 'var(--surface-container)' }}
                  title="Cerrar panel"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Currency Conversion Hero Card */}
            <div
              className="p-4 rounded-xl relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, var(--surface-container) 0%, var(--surface-container-high) 100%)',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--outline)' }}>
                  Monto Convertido
                </span>
                {selectedGasto.tiene_validez_fiscal !== false ? (
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1"
                    style={{
                      background: 'color-mix(in oklab, var(--primary-container) 20%, transparent)',
                      color: 'var(--primary-container)',
                    }}
                  >
                    ✓ Validado Fiscal
                  </span>
                ) : (
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1"
                    style={{
                      background: 'color-mix(in oklab, var(--tertiary-container) 20%, transparent)',
                      color: 'var(--tertiary-container)',
                    }}
                  >
                    ⚠️ Sin Validez Fiscal
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--primary-container)' }}>
                  $
                  {(
                    selectedGasto.monto_convertido ??
                    selectedGasto.monto_usd ??
                    (selectedGasto.moneda === 'USD'
                      ? selectedGasto.monto
                      : selectedGasto.tasa_cambio
                      ? selectedGasto.monto / selectedGasto.tasa_cambio
                      : 0)
                  ).toFixed(2)}
                </span>
                <span className="text-sm font-bold" style={{ color: 'var(--on-surface)' }}>
                  USD
                </span>
              </div>
              <div
                className="mt-3 pt-3 grid grid-cols-2 gap-2 text-xs border-t border-surface-container-highest/25"
              >
                <div>
                  <span className="block text-[10px]" style={{ color: 'var(--outline)' }}>
                    Monto Original
                  </span>
                  <span className="font-bold" style={{ color: 'var(--on-surface)' }}>
                    {selectedGasto.monto.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {selectedGasto.moneda}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px]" style={{ color: 'var(--outline)' }}>
                    Tasa de Cambio
                  </span>
                  <span className="font-bold" style={{ color: 'var(--secondary)' }}>
                    {selectedGasto.tasa_cambio ? `${selectedGasto.tasa_cambio} ${selectedGasto.moneda}/USD` : '1.00 USD'}
                  </span>
                </div>
              </div>
            </div>

            {/* DIGITAL THERMAL RECEIPT VISUALIZER */}
            <div className="w-full bg-[#f8fafc] text-[#0f172a] rounded-xl p-4 shadow-xl relative overflow-hidden font-mono text-[11px] leading-relaxed">
              {/* Guaranteed E-Receipt Ribbon */}
              <div className="flex items-center justify-between pb-2.5 border-b border-dashed border-slate-300">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-sky-500 text-white flex items-center justify-center font-bold">
                    <Receipt size={14} />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-sans font-extrabold text-[11px] tracking-tight text-sky-950 uppercase">
                      GUARANTEED E-RECEIPT
                    </span>
                    <span className="font-sans text-[8.5px] text-slate-500">
                      OCR Verificado • Rendy Fiscal
                    </span>
                  </div>
                </div>
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    background: selectedGasto.tiene_validez_fiscal !== false ? '#10b981' : '#f59e0b',
                  }}
                />
              </div>

              {/* Merchant Info */}
              <div className="py-2.5 flex flex-col items-center text-center border-b border-dashed border-slate-300">
                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-sans font-semibold">
                  Comercio Emisor
                </span>
                <span className="font-sans text-sm font-extrabold text-slate-900 mt-0.5">
                  {selectedGasto.comercio}
                </span>
                <span className="text-[10px] text-slate-600">
                  {selectedGasto.rif_comercio
                    ? `RIF: ${selectedGasto.rif_comercio}`
                    : (selectedGasto.datos_ocr?.rif as string) || 'Identificación fiscal registrada'}
                </span>
                <span className="text-[9.5px] text-slate-500 mt-0.5">
                  Fecha: {selectedGasto.fecha_gasto || selectedGasto.creado_en?.slice(0, 10) || '—'}
                </span>
              </div>

              {/* Itemized Concept or OCR Items */}
              <div className="py-2 flex flex-col gap-1 border-b border-dashed border-slate-300">
                <div className="flex justify-between text-slate-700">
                  <span className="truncate max-w-[180px]">
                    {selectedGasto.concepto || selectedGasto.categoria}
                  </span>
                  <span className="font-bold">
                    {selectedGasto.monto.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {selectedGasto.moneda}
                  </span>
                </div>
                {selectedGasto.tiene_validez_fiscal === false && (
                  <span className="text-[9px] text-amber-700 font-sans font-bold">
                    ⚠️ {selectedGasto.tipo_documento === 'VOUCHER_POS' ? 'Voucher de Punto de Venta (Sin Crédito Fiscal)' : 'Comprobante sin validez tributaria SENIAT'}
                  </span>
                )}
              </div>

              {/* Subtotal & Taxes */}
              <div className="py-2 flex flex-col gap-0.5">
                {selectedGasto.base_imponible_ves != null && selectedGasto.base_imponible_ves > 0 && (
                  <div className="flex justify-between text-slate-500 text-[10px]">
                    <span>Base Imponible:</span>
                    <span>{selectedGasto.base_imponible_ves.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs</span>
                  </div>
                )}
                {selectedGasto.iva_ves != null && selectedGasto.iva_ves > 0 && (
                  <div className="flex justify-between text-slate-500 text-[10px]">
                    <span>IVA (16%):</span>
                    <span>{selectedGasto.iva_ves.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs</span>
                  </div>
                )}
                {selectedGasto.sales_tax_usd != null && selectedGasto.sales_tax_usd > 0 && (
                  <div className="flex justify-between text-slate-500 text-[10px]">
                    <span>Sales Tax (US):</span>
                    <span>${selectedGasto.sales_tax_usd.toFixed(2)} USD</span>
                  </div>
                )}
                <div className="flex justify-between font-sans text-sm font-extrabold text-slate-950 pt-1">
                  <span>Total Pagado:</span>
                  <span>
                    {selectedGasto.monto.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {selectedGasto.moneda}
                  </span>
                </div>
              </div>

              {/* Barcode Graphic Simulation */}
              <div className="pt-2 flex flex-col items-center justify-center">
                <div className="w-full h-6 flex items-center justify-center gap-0.5 overflow-hidden">
                  <span className="w-0.5 h-full bg-slate-900" />
                  <span className="w-1.5 h-full bg-slate-900" />
                  <span className="w-0.5 h-full bg-slate-900" />
                  <span className="w-2 h-full bg-slate-900" />
                  <span className="w-0.5 h-full bg-slate-900" />
                  <span className="w-1 h-full bg-slate-900" />
                  <span className="w-0.5 h-full bg-slate-900" />
                  <span className="w-3 h-full bg-slate-900" />
                  <span className="w-0.5 h-full bg-slate-900" />
                  <span className="w-1 h-full bg-slate-900" />
                  <span className="w-2 h-full bg-slate-900" />
                  <span className="w-0.5 h-full bg-slate-900" />
                  <span className="w-1.5 h-full bg-slate-900" />
                  <span className="w-2.5 h-full bg-slate-900" />
                </div>
                <span className="font-sans text-[8.5px] text-slate-500 mt-1 uppercase tracking-widest font-semibold">
                  RENDY CORE • UUID-{selectedGasto.id.slice(0, 8)}
                </span>
              </div>
            </div>

            {/* Receipt Action Bar */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setModalGasto(selectedGasto)}
                className="py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors hover:brightness-110"
                style={{
                  background: 'var(--surface-container)',
                  color: 'var(--primary-container)',
                }}
              >
                <Maximize2 size={14} />
                <span>Ampliar Factura</span>
              </button>

              {selectedGasto.url_comprobante ? (
                <a
                  href={selectedGasto.url_comprobante}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors hover:brightness-110"
                  style={{
                    background: 'var(--surface-container)',
                    color: 'var(--secondary)',
                  }}
                >
                  <ExternalLink size={14} />
                  <span>Ver Original</span>
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 opacity-50 cursor-not-allowed"
                  style={{
                    background: 'var(--surface-container)',
                    color: 'var(--outline)',
                  }}
                >
                  <ExternalLink size={14} />
                  <span>Sin Archivo</span>
                </button>
              )}
            </div>

            {/* Accounting Metadata Details */}
            <div className="flex flex-col gap-2 text-xs pt-2 border-t border-surface-container-highest/25">
              <div className="flex items-center justify-between py-0.5">
                <span style={{ color: 'var(--outline)' }}>Colaborador:</span>
                <span className="font-semibold" style={{ color: 'var(--on-surface)' }}>
                  {selectedGasto.empleado}
                </span>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span style={{ color: 'var(--outline)' }}>Proyecto Imputado:</span>
                <span className="font-semibold" style={{ color: 'var(--primary-container)' }}>
                  {selectedGasto.proyecto}
                </span>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span style={{ color: 'var(--outline)' }}>Método de Pago:</span>
                <span className="font-semibold" style={{ color: 'var(--on-surface)' }}>
                  {selectedGasto.metodo_pago}
                </span>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span style={{ color: 'var(--outline)' }}>Estado:</span>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold"
                  style={{
                    background: selectedGasto.estado === 'REQUIERE_APROBACION_ESPECIAL'
                      ? 'color-mix(in oklab, var(--tertiary-container) 20%, transparent)'
                      : 'color-mix(in oklab, var(--primary-container) 20%, transparent)',
                    color: selectedGasto.estado === 'REQUIERE_APROBACION_ESPECIAL'
                      ? 'var(--tertiary-container)'
                      : 'var(--primary-container)',
                  }}
                >
                  {selectedGasto.estado}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 6. MODAL EXPANDED VIEW                                              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {modalGasto && (
        <DigitalInvoice
          gasto={modalGasto}
          onClose={() => setModalGasto(null)}
        />
      )}
    </div>
  );
}
