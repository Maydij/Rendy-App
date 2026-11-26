import { supabaseServer } from '@/lib/supabase-server';
import { requireAuthenticatedSession } from '@/lib/auth/session-context';
import {
  TrendingUp,
  Wallet,
  ClipboardCheck,
  RotateCcw,
  DollarSign,
  ArrowUpRight,
  Coins,
  CheckCircle2,
  Clock,
  SendHorizontal,
  BarChart3,
  Globe,
  Utensils,
  Fuel,
  Truck,
  Building2,
  ShoppingBag,
  Store,
  Receipt,
  PlusCircle,
  FileSpreadsheet,
} from 'lucide-react';
import Link from 'next/link';
import { getExchangeRates, convertAmount, formatCurrency, normalizeMoneda } from '@/lib/currency';
import { DashboardInteractiveShell } from '@/components/dashboard/DashboardInteractiveShell';
import type { FtuxState } from '@/app/actions/ftux.actions';
import { obtenerKpisReembolsos } from '@/lib/services/reembolsos.service';

const fmt = formatCurrency;

/**
 * @name getCategoryIcon
 * @description [Business Logic]: Resolves an appropriate icon based on the expense's
 * business category (food, fuel, transport, lodging, materials, retail).
 */
function getCategoryIcon(categoria?: string | null) {
  const cat = (categoria || '').toLowerCase();
  if (cat.includes('food') || cat.includes('beverage') || cat.includes('aliment') || cat.includes('comida') || cat.includes('restaurante')) {
    return Utensils;
  }
  if (cat.includes('gas') || cat.includes('fuel') || cat.includes('combustible')) {
    return Fuel;
  }
  if (cat.includes('transporte') || cat.includes('viaje') || cat.includes('travel') || cat.includes('vuelo') || cat.includes('taxi') || cat.includes('envio')) {
    return Truck;
  }
  if (cat.includes('hotel') || cat.includes('hospedaje') || cat.includes('alojamiento')) {
    return Building2;
  }
  if (cat.includes('material') || cat.includes('compra') || cat.includes('suministro')) {
    return ShoppingBag;
  }
  return Store;
}

/**
 * @name getCurrencyDetails
 * @description [Business Logic]: Normalizes currency codes to visual tokens, friendly labels,
 * and brand-aligned styling for multi-currency distribution charts.
 */
function getCurrencyDetails(code: string): { label: string; dot: string; bar: string; text: string } {
  const c = code.toUpperCase();
  if (c === 'VES' || c === 'BS') {
    return { label: 'Bolívares', dot: 'bg-secondary', bar: 'bg-secondary', text: 'text-secondary' };
  }
  if (c === 'USD') {
    return { label: 'Dólares', dot: 'bg-primary', bar: 'bg-primary', text: 'text-primary' };
  }
  if (c === 'MXN') {
    return { label: 'Pesos Mex', dot: 'bg-tertiary-container', bar: 'bg-tertiary-container', text: 'text-tertiary-container' };
  }
  if (c === 'EUR') {
    return { label: 'Euros', dot: 'bg-primary', bar: 'bg-primary', text: 'text-primary' };
  }
  if (c === 'COP') {
    return { label: 'Pesos Col', dot: 'bg-secondary', bar: 'bg-secondary', text: 'text-secondary' };
  }
  return { label: c, dot: 'bg-tertiary-container', bar: 'bg-tertiary-container', text: 'text-tertiary-container' };
}

/**
 * @name DashboardStatusBadge
 * @description [Business Logic]: Renders refined, congruent status pills according to fiscal
 * and operational compliance states. Normalizes raw uppercase database enums (e.g. REQUIERE_APROBACION_ESPECIAL)
 * into elegant title-case badges with consistent font sizing and alignment.
 */
function DashboardStatusBadge({ estado, requiereRevisionFiscal }: { estado: string; requiereRevisionFiscal?: boolean }) {
  const norm = (estado || 'PENDIENTE').toUpperCase();

  if (norm.includes('REQUIERE_APROBACION') || norm.includes('ESPECIAL') || requiereRevisionFiscal) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-tertiary-container/15 text-tertiary-container text-[11px] font-medium tracking-normal border border-tertiary-container/25 whitespace-nowrap shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-tertiary-container animate-pulse shrink-0" />
        Aprobación especial
      </span>
    );
  }

  if (norm === 'APROBADO' || norm === 'TRANSFERIDO' || norm === 'PAGADO' || norm === 'PROCESADO' || norm === 'LIQUIDADO') {
    const displayLabel = norm === 'APROBADO' ? 'Aprobado' : norm === 'TRANSFERIDO' ? 'Transferido' : norm === 'PROCESADO' ? 'Procesado' : 'Liquidado';
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary-container/15 text-primary text-[11px] font-medium tracking-normal border border-primary-container/25 whitespace-nowrap shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
        {displayLabel}
      </span>
    );
  }

  if (norm === 'RECHAZADO' || norm === 'CANCELADO' || norm === 'ANULADO') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-error/15 text-error text-[11px] font-medium tracking-normal border border-error/25 whitespace-nowrap shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-error shrink-0" />
        Rechazado
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary-container/15 text-secondary text-[11px] font-medium tracking-normal border border-secondary-container/25 whitespace-nowrap shrink-0">
      <span className="w-1.5 h-1.5 rounded-full bg-secondary shrink-0" />
      Pendiente
    </span>
  );
}

/* ─── Multi-Tenant Data Fetching ─── */
/**
 * @name getDashboardData
 * @description [Business Logic]: Gathers multi-currency financial telemetry, approved allowances,
 * justified WhatsApp expenses, and pending out-of-pocket settlements. Enforces strict tenant isolation
 * by `empresaId`, and role isolation when accessed by a collaborator with role 'EMPLOYEE'.
 */
async function getDashboardData(empresaId: string, role?: string, userId?: string) {
  let gastosQuery = supabaseServer
    .from('gastos')
    .select(
      'id, comercio, categoria, monto, moneda, monto_usd, monto_ves, tasa_cambio, fecha_gasto, estado, proyecto_id, usuario_id, datos_ocr, concepto, solicitud_id, es_reembolso, rif_comercio, numero_factura, requiere_revision_fiscal'
    )
    .eq('empresa_id', empresaId)
    .order('creado_en', { ascending: false });

  let solicitudesQuery = supabaseServer
    .from('solicitudes_viaticos')
    .select('id, monto_solicitado, monto_aprobado, moneda, estado, usuario_id, proyecto_id')
    .eq('empresa_id', empresaId);

  if (role === 'EMPLOYEE' && userId) {
    gastosQuery = gastosQuery.eq('usuario_id', userId);
    solicitudesQuery = solicitudesQuery.eq('usuario_id', userId);
  }

  const [
    { data: gastos },
    { data: solicitudes },
    { data: proyectos },
    { data: usuarios },
    { data: empresa },
    rates,
    reembolsosKpis,
  ] = await Promise.all([
    gastosQuery,
    solicitudesQuery,
    supabaseServer
      .from('proyectos')
      .select('id, nombre')
      .eq('empresa_id', empresaId)
      .eq('activo', true),
    supabaseServer
      .from('usuarios')
      .select('id, nombre, email, telefono_whatsapp')
      .eq('empresa_id', empresaId),
    supabaseServer
      .from('empresas')
      .select('nombre, moneda, ftux_state')
      .eq('id', empresaId)
      .single(),
    getExchangeRates(),
    obtenerKpisReembolsos(empresaId, role === 'EMPLOYEE' ? userId : undefined),
  ]);

  const moneda = normalizeMoneda(empresa?.moneda ?? 'USD');
  const allGastos = gastos ?? [];

  const convert = (amount: number, fromCurrency: string, toCurrency: string) => {
    return convertAmount(amount, fromCurrency, toCurrency, rates);
  };

  let totalGastado = 0;
  let mJustificados = 0;

  const byCurrency: Record<string, number> = {};
  const byProject: Record<string, { nombre: string; total: number }> = {};
  const proyMap = Object.fromEntries((proyectos ?? []).map((p) => [p.id, p.nombre]));
  const usuMap = Object.fromEntries(
    (usuarios ?? []).map((u) => [u.id, { nombre: u.nombre, email: u.email, telefono: u.telefono_whatsapp }])
  );

  for (const g of allGastos) {
    const ocrRecord = g.datos_ocr as Record<string, unknown> | null;
    const rawCurrency = typeof ocrRecord?.moneda === 'string' ? ocrRecord.moneda : g.moneda ?? 'USD';
    let m = rawCurrency.toUpperCase();
    if (m === 'BS') m = 'VES';

    if (!byCurrency[m]) byCurrency[m] = 0;
    byCurrency[m] += g.monto ?? 0;

    const valInBase = convert(g.monto ?? 0, m, moneda);

    totalGastado += valInBase;
    if (g.solicitud_id) mJustificados += valInBase;

    // Strict project isolation: only corporate expenses with a registered project
    // are included in the Project breakdown.
    if (!g.es_reembolso && g.proyecto_id) {
      const pid = g.proyecto_id;
      if (!byProject[pid]) byProject[pid] = { nombre: proyMap[pid] ?? 'Proyecto desconocido', total: 0 };
      byProject[pid].total += valInBase;
    }
  }

  let viaticosAprobados = 0;
  for (const s of solicitudes ?? []) {
    if (s.estado === 'APROBADO') {
      const mSol = s.moneda || 'USD';
      const val = convert(s.monto_aprobado ?? s.monto_solicitado ?? 0, mSol, moneda);
      viaticosAprobados += val;
    }
  }

  const projectBreakdown = Object.values(byProject)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  const maxProj = projectBreakdown[0]?.total ?? 1;
  const totalProjectSpending = projectBreakdown.reduce((acc, p) => acc + p.total, 0);

  // Proportional breakdown for currencies
  const currencyBreakdownRaw = Object.entries(byCurrency).map(([cur, total]) => {
    const totalInBase = convert(total, cur, moneda);
    return { cur, total, totalInBase };
  });
  const maxCurrencyBase = Math.max(...currencyBreakdownRaw.map((c) => c.totalInBase), 1);
  const currencyBreakdown = currencyBreakdownRaw.map((c) => ({
    ...c,
    pct: Math.min(100, Math.max(15, Math.round((c.totalInBase / maxCurrencyBase) * 100))),
  }));

  const recentGastos = allGastos.filter((g) => !g.es_reembolso).slice(0, 6);

  const recentReembolsos = allGastos
    .filter((g) => g.es_reembolso)
    .slice(0, 6)
    .map((g) => {
      const usuario = g.usuario_id ? usuMap[g.usuario_id] : null;
      const ocrRecord = g.datos_ocr as Record<string, unknown> | null;
      const rawCurrency = typeof ocrRecord?.moneda === 'string' ? ocrRecord.moneda : g.moneda ?? 'USD';
      const gMoneda = rawCurrency.toUpperCase();
      const montoUsd =
        g.monto_usd ??
        (gMoneda === 'USD' ? (g.monto ?? 0) : convert(g.monto ?? 0, gMoneda === 'BS' ? 'VES' : gMoneda, 'USD'));

      return {
        id: g.id,
        empleado: usuario?.nombre ?? 'Sin asignar',
        empleadoDetalle: usuario?.email || (usuario?.telefono ? `+${usuario.telefono}` : null),
        fecha_gasto: g.fecha_gasto,
        comercio: g.comercio ?? (typeof ocrRecord?.comercio === 'string' ? ocrRecord.comercio : '—'),
        rif_comercio: g.rif_comercio,
        numero_factura: g.numero_factura,
        categoria: g.categoria || 'Otros',
        monto: g.monto ?? 0,
        moneda: gMoneda === 'BS' ? 'VES' : gMoneda,
        monto_usd: montoUsd,
        monto_ves: g.monto_ves,
        tasa_cambio: g.tasa_cambio,
        estado: g.estado,
        requiere_revision_fiscal: g.requiere_revision_fiscal ?? false,
      };
    });

  const defaultFtux: FtuxState = {
    accounting_template_selected: null,
    setup_call_scheduled: false,
    first_employee_invited: false,
    checklist_dismissed: false,
  };

  const reembolsosPendientesBase =
    moneda === 'USD'
      ? reembolsosKpis.pendientesMontoUsd
      : convert(reembolsosKpis.pendientesMontoUsd, 'USD', moneda);

  return {
    moneda,
    empresa: empresa?.nombre ?? 'Mi Empresa',
    ftuxState: (empresa?.ftux_state as FtuxState | null) ?? defaultFtux,
    kpis: {
      totalGastado,
      viaticosAprobados,
      mJustificados,
      reembolsosPendientes: reembolsosPendientesBase,
    },
    reembolsosKpis,
    recentGastos,
    recentReembolsos,
    projectBreakdown: projectBreakdown.map((p) => ({
      ...p,
      pct: Math.round((p.total / maxProj) * 100),
    })),
    totalProjectSpending,
    currencyBreakdown,
    proyMap,
  };
}

/* ─── Page ─── */
/**
 * @name DashboardPage
 * @description [Business Logic]: Executive financial dashboard view designed to match the Rendy
 * Deep Dark brand aesthetic and Stitch design system. Surfaces real-time multi-currency metrics,
 * AI WhatsApp expense streams, pending collaborator reimbursements, and project distributions.
 * Fully fluid and responsive across mobile, tablet, laptop, and ultra-wide viewports.
 */
export default async function DashboardPage() {
  const session = await requireAuthenticatedSession();
  const isEmployee = session.role === 'EMPLOYEE';
  const {
    moneda,
    empresa,
    ftuxState,
    kpis,
    reembolsosKpis,
    recentGastos,
    recentReembolsos,
    projectBreakdown,
    totalProjectSpending,
    currencyBreakdown,
    proyMap,
  } = await getDashboardData(session.empresaId, session.role, session.userId);

  return (
    <div className="w-full max-w-[1440px] mx-auto flex flex-col gap-6 sm:gap-8">
      {/* ─── Header Section ─── */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <h1 className="font-headline-lg text-2xl sm:text-3xl lg:text-[38px] font-bold text-on-surface tracking-tight leading-none">
            Dashboard
          </h1>
          <span className="px-2.5 py-1 rounded-full bg-surface-container-high text-primary font-label-sm text-[11px] sm:text-xs tracking-wide font-semibold border border-primary/20 shrink-0">
            {empresa}
          </span>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-low text-secondary font-label-sm text-[11px] sm:text-xs border border-secondary/20 shrink-0">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="font-medium text-[11px]">En vivo</span>
          </div>
        </div>
        <p className="font-body-md text-on-surface-variant max-w-3xl text-xs sm:text-sm md:text-base leading-relaxed">
          {isEmployee
            ? `Resumen personal de tus gastos, viáticos y reembolsos registrados (convirtiendo monedas locales a ${moneda}).`
            : `Resumen ejecutivo de gastos, viáticos y reembolsos de tu organización (convirtiendo monedas locales a ${moneda}).`}
        </p>
      </div>

      {/* ─── FTUX Checklist + Invite Employee Modal (Only for Admins) ─── */}
      {!isEmployee && <DashboardInteractiveShell companyName={empresa} ftuxState={ftuxState} />}

      {/* ─── 4 Bento KPI Cards Grid ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" role="list" aria-label="Indicadores clave">
        {/* KPI 1: Total Registrado (Mint) */}
        <div
          className="bg-surface-container-low hover:bg-surface-container rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-md transition-all group border border-outline-variant/20 min-w-0 overflow-hidden"
          role="listitem"
          id="kpi-total-gastado"
        >
          <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary-container/15 text-primary flex items-center justify-center shrink-0">
              <DollarSign size={20} className="sm:w-[22px] sm:h-[22px]" strokeWidth={2.2} />
            </div>
            {/* Sparkline SVG (Mint) */}
            <div className="w-16 sm:w-20 h-6 shrink-0 flex items-center justify-end">
              <svg className="w-full h-full text-primary" fill="none" preserveAspectRatio="none" viewBox="0 0 80 24" aria-hidden="true">
                <path d="M1 18 L18 14 L35 19 L52 8 L68 12 L79 3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                <path d="M1 18 L18 14 L35 19 L52 8 L68 12 L79 3 V24 H1 Z" fill="currentColor" fillOpacity="0.08" />
              </svg>
            </div>
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <span className="font-label-sm uppercase tracking-wider text-on-surface-variant text-[10px] sm:text-[11px] font-semibold truncate">
              Total Registrado
            </span>
            <span
              className="font-bold text-on-surface tracking-tight text-lg sm:text-xl md:text-2xl xl:text-[22px] 2xl:text-[26px] leading-tight truncate"
              title={fmt(kpis.totalGastado, moneda)}
            >
              {fmt(kpis.totalGastado, moneda)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-3 pt-3 bg-surface-container-lowest/40 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 px-4 sm:px-5 py-2.5 rounded-b-2xl border-t border-outline-variant/10 text-primary">
            <TrendingUp size={13} className="shrink-0" />
            <span className="font-label-sm font-medium text-[10px] sm:text-[11px] truncate">Datos en tiempo real</span>
          </div>
        </div>

        {/* KPI 2: Viáticos Aprobados (Cyan) */}
        <div
          className="bg-surface-container-low hover:bg-surface-container rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-md transition-all group border border-outline-variant/20 min-w-0 overflow-hidden"
          role="listitem"
          id="kpi-viaticos-aprobados"
        >
          <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center shrink-0">
              <Wallet size={20} className="sm:w-[22px] sm:h-[22px]" strokeWidth={2.2} />
            </div>
            {/* Sparkline SVG (Cyan) */}
            <div className="w-16 sm:w-20 h-6 shrink-0 flex items-center justify-end">
              <svg className="w-full h-full text-secondary" fill="none" preserveAspectRatio="none" viewBox="0 0 80 24" aria-hidden="true">
                <path d="M1 16 L16 16 L32 11 L48 13 L64 6 L79 4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                <path d="M1 16 L16 16 L32 11 L48 13 L64 6 L79 4 V24 H1 Z" fill="currentColor" fillOpacity="0.08" />
              </svg>
            </div>
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <span className="font-label-sm uppercase tracking-wider text-on-surface-variant text-[10px] sm:text-[11px] font-semibold truncate">
              Viáticos Aprobados
            </span>
            <span
              className="font-bold text-on-surface tracking-tight text-lg sm:text-xl md:text-2xl xl:text-[22px] 2xl:text-[26px] leading-tight truncate"
              title={fmt(kpis.viaticosAprobados, moneda)}
            >
              {fmt(kpis.viaticosAprobados, moneda)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-3 pt-3 bg-surface-container-lowest/40 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 px-4 sm:px-5 py-2.5 rounded-b-2xl border-t border-outline-variant/10 text-secondary">
            <CheckCircle2 size={13} className="shrink-0" />
            <span className="font-label-sm font-medium text-[10px] sm:text-[11px] truncate">Datos en tiempo real</span>
          </div>
        </div>

        {/* KPI 3: Gastos Justificados (WA) (Amber) */}
        <div
          className="bg-surface-container-low hover:bg-surface-container rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-md transition-all group border border-outline-variant/20 min-w-0 overflow-hidden"
          role="listitem"
          id="kpi-justificados"
        >
          <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-tertiary-container/15 text-tertiary-container flex items-center justify-center shrink-0">
              <ClipboardCheck size={20} className="sm:w-[22px] sm:h-[22px]" strokeWidth={2.2} />
            </div>
            {/* Sparkline SVG (Amber) */}
            <div className="w-16 sm:w-20 h-6 shrink-0 flex items-center justify-end">
              <svg className="w-full h-full text-tertiary-container" fill="none" preserveAspectRatio="none" viewBox="0 0 80 24" aria-hidden="true">
                <path d="M1 19 L19 12 L37 15 L53 7 L67 9 L79 2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                <path d="M1 19 L19 12 L37 15 L53 7 L67 9 L79 2 V24 H1 Z" fill="currentColor" fillOpacity="0.08" />
              </svg>
            </div>
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <span className="font-label-sm uppercase tracking-wider text-on-surface-variant text-[10px] sm:text-[11px] font-semibold truncate">
              Gastos Justificados (vía WA)
            </span>
            <span
              className="font-bold text-on-surface tracking-tight text-lg sm:text-xl md:text-2xl xl:text-[22px] 2xl:text-[26px] leading-tight truncate"
              title={fmt(kpis.mJustificados, moneda)}
            >
              {fmt(kpis.mJustificados, moneda)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-3 pt-3 bg-surface-container-lowest/40 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 px-4 sm:px-5 py-2.5 rounded-b-2xl border-t border-outline-variant/10 text-tertiary-container">
            <RotateCcw size={13} className="shrink-0" />
            <span className="font-label-sm font-medium text-[10px] sm:text-[11px] truncate">Datos en tiempo real</span>
          </div>
        </div>

        {/* KPI 4: Reembolsos Pendientes (Coral / Error) */}
        <div
          className="bg-surface-container-low hover:bg-surface-container rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-md transition-all group border border-outline-variant/20 min-w-0 overflow-hidden"
          role="listitem"
          id="kpi-reembolsos-pendientes"
        >
          <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-error/15 text-error flex items-center justify-center shrink-0">
              <Clock size={20} className="sm:w-[22px] sm:h-[22px]" strokeWidth={2.2} />
            </div>
            {/* Sparkline SVG (Error/Coral) */}
            <div className="w-16 sm:w-20 h-6 shrink-0 flex items-center justify-end">
              <svg className="w-full h-full text-error" fill="none" preserveAspectRatio="none" viewBox="0 0 80 24" aria-hidden="true">
                <path d="M1 9 L20 13 L38 8 L54 16 L69 11 L79 19" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                <path d="M1 9 L20 13 L38 8 L54 16 L69 11 L79 19 V24 H1 Z" fill="currentColor" fillOpacity="0.08" />
              </svg>
            </div>
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <span className="font-label-sm uppercase tracking-wider text-on-surface-variant text-[10px] sm:text-[11px] font-semibold truncate">
              Reembolsos Pendientes
            </span>
            <span
              className="font-bold text-on-surface tracking-tight text-lg sm:text-xl md:text-2xl xl:text-[22px] 2xl:text-[26px] leading-tight truncate"
              title={fmt(kpis.reembolsosPendientes, moneda)}
            >
              {fmt(kpis.reembolsosPendientes, moneda)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-3 pt-3 bg-surface-container-lowest/40 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 px-4 sm:px-5 py-2.5 rounded-b-2xl border-t border-outline-variant/10 text-error">
            <Clock size={13} className="shrink-0" />
            <span className="font-label-sm font-medium text-[10px] sm:text-[11px] truncate">Datos en tiempo real</span>
          </div>
        </div>
      </div>

      {/* ─── Main Dual-Column Operational Workspace ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* ─── LEFT COLUMN (Span 8): Activity & Transactions ─── */}
        <div className="xl:col-span-8 flex flex-col gap-6 lg:gap-8 min-w-0">
          {/* SECTION 1: Últimos Gastos (vía WhatsApp) */}
          <div className="bg-surface-container-low rounded-2xl p-4 sm:p-6 flex flex-col gap-4 sm:gap-5 shadow-lg border border-outline-variant/20 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary shrink-0">
                  <Receipt size={18} strokeWidth={2.2} />
                </div>
                <div className="flex flex-col min-w-0">
                  <h2 className="font-headline-sm text-base sm:text-lg font-semibold text-on-surface leading-tight truncate">
                    Últimos Gastos (vía WhatsApp)
                  </h2>
                  <span className="font-label-sm text-on-surface-variant text-[10px] sm:text-[11px] truncate">
                    Flujo procesado automáticamente vía WhatsApp IA
                  </span>
                </div>
              </div>
              <Link
                href="/dashboard/gastos"
                id="dashboard-ver-todos-btn"
                className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-xs font-semibold transition-colors border border-outline-variant/20 shrink-0"
              >
                <span>Ver todos</span>
                <ArrowUpRight size={14} />
              </Link>
            </div>

            {/* Transaction Ledger Items */}
            <div className="flex flex-col gap-2.5">
              {recentGastos.length === 0 ? (
                <div className="p-8 rounded-xl bg-surface-container/60 border border-outline-variant/20 text-center flex flex-col items-center justify-center gap-2">
                  <Receipt size={28} className="text-on-surface-variant/50" />
                  <span className="text-on-surface font-semibold text-sm">Sin gastos corporativos registrados</span>
                  <span className="text-on-surface-variant text-xs">
                    Los gastos enviados por WhatsApp aparecerán aquí en tiempo real.
                  </span>
                </div>
              ) : (
                recentGastos.map((g) => {
                  const ocrRecord = g.datos_ocr as Record<string, unknown> | null;
                  const rawCurrency = typeof ocrRecord?.moneda === 'string' ? ocrRecord.moneda : g.moneda ?? moneda;
                  const gMoneda = rawCurrency.toUpperCase() === 'BS' ? 'VES' : rawCurrency.toUpperCase();
                  const CategoryIcon = getCategoryIcon(g.categoria);
                  const projectName = g.proyecto_id ? proyMap[g.proyecto_id] ?? 'Proyecto General' : 'Sin proyecto';
                  const commerceName = g.comercio ?? (typeof ocrRecord?.comercio === 'string' ? ocrRecord.comercio : 'Comercio General');

                  return (
                    <div
                      key={g.id}
                      className="p-3.5 sm:p-4 rounded-xl bg-surface-container hover:bg-surface-container-high transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 group border border-outline-variant/15 min-w-0"
                    >
                      {/* Left: Store Icon + Commerce + Category + Project */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-surface-container-highest flex items-center justify-center text-tertiary-container shrink-0 border border-outline-variant/20">
                          <CategoryIcon size={18} className="sm:w-[19px] sm:h-[19px]" strokeWidth={2.1} />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <span
                              className="font-label-md font-semibold text-on-surface text-sm truncate max-w-[160px] sm:max-w-[200px] md:max-w-[260px] xl:max-w-[300px]"
                              title={commerceName}
                            >
                              {commerceName}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-surface-container-highest text-on-surface-variant font-label-sm text-[10px] sm:text-[11px] font-medium border border-outline-variant/20 shrink-0">
                              {g.categoria || 'Otros'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 font-label-sm text-on-surface-variant text-[11px] min-w-0">
                            <span className="text-primary font-medium truncate max-w-[130px] sm:max-w-[180px]">
                              {projectName}
                            </span>
                            <span className="shrink-0">•</span>
                            <span className="shrink-0">{g.fecha_gasto || '—'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Amounts & Status Badge */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-outline-variant/15">
                        <div className="text-left sm:text-right min-w-0">
                          <div className="font-label-md font-bold text-on-surface text-sm sm:text-base leading-snug truncate">
                            {fmt(g.monto ?? 0, gMoneda)}
                          </div>
                          <div className="font-label-sm text-on-surface-variant text-[10px] sm:text-[11px] truncate">
                            {gMoneda === 'USD' ? 'USD Directo' : `${gMoneda} Local`}
                          </div>
                        </div>
                        <div className="shrink-0">
                          <DashboardStatusBadge
                            estado={g.estado}
                            requiereRevisionFiscal={Boolean(g.requiere_revision_fiscal)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* SECTION 2: Últimas Solicitudes de Reembolso (vía WhatsApp) */}
          <div className="bg-surface-container-low rounded-2xl p-4 sm:p-6 flex flex-col gap-4 sm:gap-5 shadow-lg border border-outline-variant/20 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center text-secondary shrink-0">
                  <RotateCcw size={18} strokeWidth={2.2} />
                </div>
                <div className="flex flex-col min-w-0">
                  <h2 className="font-headline-sm text-base sm:text-lg font-semibold text-on-surface leading-tight truncate">
                    Últimas Solicitudes de Reembolso (vía WhatsApp)
                  </h2>
                  <span className="font-label-sm text-on-surface-variant text-[10px] sm:text-[11px] truncate">
                    Gestión de comprobantes y transferencias pendientes a colaboradores
                  </span>
                </div>
              </div>
              <Link
                href="/dashboard/reembolsos"
                id="dashboard-ver-reembolsos-btn"
                className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-xs font-semibold transition-colors border border-outline-variant/20 shrink-0"
              >
                <span>Ver todos</span>
                <ArrowUpRight size={14} />
              </Link>
            </div>

            {/* Refund Card Items */}
            <div className="flex flex-col gap-3">
              {recentReembolsos.length === 0 ? (
                <div className="p-8 rounded-xl bg-surface-container/60 border border-outline-variant/20 text-center flex flex-col items-center justify-center gap-2">
                  <RotateCcw size={28} className="text-on-surface-variant/50" />
                  <span className="text-on-surface font-semibold text-sm">Sin solicitudes de reembolso registradas</span>
                  <span className="text-on-surface-variant text-xs">
                    Las solicitudes enviadas por colaboradores vía WhatsApp aparecerán aquí.
                  </span>
                </div>
              ) : (
                recentReembolsos.map((r) => {
                  const initials = r.empleado
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w: string) => w[0]?.toUpperCase() ?? '')
                    .join('');

                  return (
                    <div
                      key={r.id}
                      className="p-3.5 sm:p-4 rounded-xl bg-surface-container hover:bg-surface-container-high transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 sm:gap-4 border border-outline-variant/15 min-w-0"
                    >
                      {/* 1. Employee Identification: vertical stack with uniform spacing */}
                      <div className="flex items-center gap-3 min-w-0 w-full lg:w-[220px] xl:w-[250px] shrink-0">
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-secondary/15 text-secondary font-headline-sm flex items-center justify-center font-bold shrink-0 border border-secondary/25 text-sm sm:text-base">
                          {initials || 'EM'}
                        </div>
                        <div className="flex flex-col gap-1 min-w-0 flex-1 justify-center">
                          <span className="font-label-md font-semibold text-on-surface text-sm truncate" title={r.empleado}>
                            {r.empleado}
                          </span>
                          <div className="leading-none">
                            <span className="inline-block px-2 py-0.5 rounded-md bg-secondary/15 text-secondary font-label-sm text-[10px] sm:text-[11px] font-medium border border-secondary/20">
                              {r.categoria || 'General'}
                            </span>
                          </div>
                          <span
                            className="font-label-sm text-on-surface-variant text-[11px] truncate"
                            title={r.empleadoDetalle || 'Sin contacto registrado'}
                          >
                            {r.empleadoDetalle || 'Sin contacto registrado'}
                          </span>
                        </div>
                      </div>

                      {/* 2. Receipt & Merchant Metadata Box: uniform dimensions and alignment */}
                      <div className="flex flex-col justify-center font-label-sm text-on-surface-variant bg-surface-container-lowest/70 px-3.5 py-2.5 rounded-xl border border-outline-variant/20 min-w-0 w-full lg:flex-1 lg:max-w-md min-h-[58px]">
                        <div className="flex items-center gap-2 text-xs truncate">
                          <span className="font-semibold text-on-surface truncate" title={r.comercio}>
                            Comercio: {r.comercio}
                          </span>
                          <span className="shrink-0 text-on-surface-variant/50">•</span>
                          <span className="shrink-0 text-on-surface-variant text-[11px]">{r.fecha_gasto || '—'}</span>
                        </div>
                        <span className="text-on-surface-variant/80 font-mono text-[10px] sm:text-[11px] mt-0.5 truncate">
                          {r.rif_comercio ? `RIF: ${r.rif_comercio}` : ''}
                          {r.numero_factura ? ` · Fac: #${r.numero_factura}` : ''}
                          {!r.rif_comercio && !r.numero_factura ? 'Comprobante general' : ''}
                        </span>
                      </div>

                      {/* 3. Amounts & Status */}
                      <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-outline-variant/15 w-full lg:w-[200px] xl:w-[220px]">
                        <div className="text-left lg:text-right min-w-0 flex-1 lg:flex-initial">
                          <div className="font-label-md font-bold text-secondary text-sm sm:text-base leading-snug truncate">
                            {fmt(r.monto_ves || r.monto, r.moneda)}
                          </div>
                          {r.moneda !== 'USD' && (
                            <div className="font-label-sm text-on-surface-variant text-[10px] sm:text-[11px] truncate">
                              {fmt(r.monto_usd, 'USD')}
                              {r.tasa_cambio ? ` · Tasa: ${Number(r.tasa_cambio).toLocaleString('es-VE')}` : ''}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0">
                          <DashboardStatusBadge
                            estado={r.estado}
                            requiereRevisionFiscal={Boolean(r.requiere_revision_fiscal)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ─── RIGHT COLUMN (Span 4): Distribution & Currency Analytics ─── */}
        <div className="xl:col-span-4 flex flex-col gap-6 min-w-0">
          {/* CARD 1: Gastos por Moneda */}
          <div className="bg-surface-container-low rounded-2xl p-4 sm:p-6 flex flex-col gap-4 sm:gap-5 shadow-lg border border-outline-variant/20 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary border border-outline-variant/20 shrink-0">
                  <Coins size={16} strokeWidth={2.2} />
                </div>
                <h3 className="font-headline-sm text-base sm:text-lg font-semibold text-on-surface truncate">
                  Gastos por Moneda
                </h3>
              </div>
              <Globe size={18} className="text-on-surface-variant shrink-0" />
            </div>

            <div className="flex justify-between items-center text-on-surface-variant font-label-sm uppercase tracking-wider text-[10px] sm:text-[11px] font-semibold pb-1">
              <span>Divisa</span>
              <span>Total Bruto</span>
            </div>

            {/* Currency Rows with Proportional Progress Bars */}
            <div className="flex flex-col gap-3">
              {currencyBreakdown.length === 0 ? (
                <p className="text-on-surface-variant text-xs py-2">Sin gastos registrados en divisas.</p>
              ) : (
                currencyBreakdown.map((c) => {
                  const details = getCurrencyDetails(c.cur);
                  return (
                    <div
                      key={c.cur}
                      className="flex flex-col gap-2 p-3 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors border border-outline-variant/15 min-w-0"
                    >
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className={`w-2 h-2 rounded-full ${details.dot} shrink-0`} />
                          <span className="font-label-md font-bold text-on-surface text-sm shrink-0">{c.cur}</span>
                          <span className="font-label-sm text-on-surface-variant text-xs truncate min-w-0">{details.label}</span>
                        </div>
                        <span className={`font-label-md font-bold ${details.text} text-sm shrink-0 text-right`}>
                          {fmt(c.total, c.cur)}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                        <div
                          className={`h-full ${details.bar} rounded-full transition-all duration-500`}
                          style={{ width: `${c.pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* CARD 2: Gasto por Proyecto (en USD) */}
          <div className="bg-surface-container-low rounded-2xl p-4 sm:p-6 flex flex-col gap-5 sm:gap-6 shadow-lg border border-outline-variant/20 overflow-hidden min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-surface-container-highest flex items-center justify-center text-tertiary-container border border-outline-variant/20 shrink-0">
                  <BarChart3 size={16} strokeWidth={2.2} />
                </div>
                <h3 className="font-headline-sm text-base sm:text-lg font-semibold text-on-surface truncate">
                  Gasto por Proyecto ({moneda})
                </h3>
              </div>
              <span className="font-label-sm text-primary font-semibold text-xs shrink-0">
                Total: {fmt(totalProjectSpending, moneda)}
              </span>
            </div>

            <div className="flex flex-col gap-5">
              {projectBreakdown.length === 0 ? (
                <p className="text-on-surface-variant text-xs py-2">Sin gastos asignados a proyectos activos.</p>
              ) : (
                projectBreakdown.map((p, idx) => {
                  const colors = [
                    { dot: 'bg-tertiary-container', bar: 'bg-tertiary-container', shadow: 'shadow-[0_0_12px_rgba(252,192,37,0.4)]', text: 'text-tertiary-container' },
                    { dot: 'bg-primary', bar: 'bg-primary', shadow: 'shadow-[0_0_12px_rgba(0,229,153,0.35)]', text: 'text-primary' },
                    { dot: 'bg-secondary', bar: 'bg-secondary', shadow: 'shadow-[0_0_12px_rgba(76,215,246,0.3)]', text: 'text-secondary' },
                  ];
                  const scheme = colors[idx % colors.length];

                  return (
                    <div key={p.nombre} className="flex flex-col gap-2 min-w-0">
                      <div className="flex items-center justify-between font-label-md text-sm gap-2 min-w-0">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className={`w-2 h-2 rounded-full ${scheme.dot} shrink-0`} />
                          <span className="font-semibold text-on-surface truncate min-w-0" title={p.nombre}>
                            {p.nombre}
                          </span>
                        </div>
                        <span className={`${scheme.text} font-bold text-xs shrink-0`}>{p.pct}%</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-surface-container-highest overflow-hidden">
                        <div
                          className={`h-full ${scheme.bar} ${scheme.shadow} rounded-full transition-all duration-500`}
                          style={{ width: `${p.pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center font-label-sm text-on-surface-variant text-xs gap-2 min-w-0">
                        <span className="truncate">Ejecución Presupuestaria</span>
                        <span className="font-semibold text-on-surface shrink-0">{fmt(p.total, moneda)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick Actions Panel */}
            <div className="pt-4 bg-surface-container-lowest/50 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 p-4 sm:p-6 rounded-b-2xl flex flex-col gap-3 border-t border-outline-variant/20">
              <span className="font-label-sm uppercase tracking-wider text-on-surface-variant text-[10px] sm:text-[11px] font-bold">
                Acciones rápidas
              </span>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/dashboard/solicitudes"
                  className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-xs font-semibold transition-colors border border-outline-variant/20"
                >
                  <PlusCircle size={16} className="text-primary shrink-0" />
                  <span className="truncate">Asignar cupo</span>
                </Link>
                <Link
                  href="/dashboard/reportes"
                  className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-xs font-semibold transition-colors border border-outline-variant/20"
                >
                  <FileSpreadsheet size={16} className="text-secondary shrink-0" />
                  <span className="truncate">Exportar CSV</span>
                </Link>
              </div>
            </div>
          </div>

          {/* CARD 3: Resumen de Reembolsos */}
          <div className="bg-surface-container-low rounded-2xl p-4 sm:p-6 flex flex-col gap-4 shadow-lg border border-outline-variant/20 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-surface-container-highest flex items-center justify-center text-secondary border border-outline-variant/20 shrink-0">
                  <RotateCcw size={16} strokeWidth={2.2} />
                </div>
                <h3 className="font-headline-sm text-base sm:text-lg font-semibold text-on-surface truncate">
                  Resumen de Reembolsos
                </h3>
              </div>
              <Link
                href="/dashboard/reembolsos"
                id="dashboard-ver-reembolsos-kpi-btn"
                className="font-label-sm text-xs text-secondary hover:underline flex items-center gap-0.5 shrink-0"
              >
                <span>Ver todos</span>
                <ArrowUpRight size={13} />
              </Link>
            </div>

            {reembolsosKpis.totalCount === 0 ? (
              <p className="text-on-surface-variant text-xs py-2">Sin solicitudes de reembolso registradas.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Total Acumulado */}
                <div className="flex justify-between items-baseline pb-3 border-b border-outline-variant/20 gap-2">
                  <div className="min-w-0">
                    <span className="font-label-sm uppercase tracking-wider text-on-surface-variant text-[10px] font-semibold truncate block">
                      Volumen Total
                    </span>
                    <div className="font-headline-md font-bold text-on-surface text-base sm:text-lg truncate">
                      {fmt(reembolsosKpis.totalMontoUsd, 'USD')}
                    </div>
                  </div>
                  <span className="text-xs text-on-surface-variant font-medium shrink-0">
                    {reembolsosKpis.totalCount} {reembolsosKpis.totalCount === 1 ? 'comprobante' : 'comprobantes'}
                  </span>
                </div>

                {/* Pagados / Transferidos */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-primary/10 border border-primary/20 gap-2 min-w-0">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-7 h-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0">
                      <SendHorizontal size={14} strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-on-surface truncate">Pagados / Transferidos</div>
                      <div className="text-[11px] text-on-surface-variant truncate">
                        {reembolsosKpis.transferidosCount} {reembolsosKpis.transferidosCount === 1 ? 'liquidado' : 'liquidados'}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-primary shrink-0 text-right">
                    {fmt(reembolsosKpis.transferidosMontoUsd, 'USD')}
                  </div>
                </div>

                {/* Listos para Transferir */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/10 border border-secondary/20 gap-2 min-w-0">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-7 h-7 rounded-lg bg-secondary/20 text-secondary flex items-center justify-center shrink-0">
                      <CheckCircle2 size={14} strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-on-surface truncate">Listos para Transferir</div>
                      <div className="text-[11px] text-on-surface-variant truncate">
                        {reembolsosKpis.procesadosCount} {reembolsosKpis.procesadosCount === 1 ? 'aprobado' : 'aprobados'}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-secondary shrink-0 text-right">
                    {fmt(reembolsosKpis.procesadosMontoUsd, 'USD')}
                  </div>
                </div>

                {/* Pendientes de Revisión */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-tertiary-container/10 border border-tertiary-container/20 gap-2 min-w-0">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-7 h-7 rounded-lg bg-tertiary-container/20 text-tertiary-container flex items-center justify-center shrink-0">
                      <Clock size={14} strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-on-surface truncate">Pendientes de Revisión</div>
                      <div className="text-[11px] text-on-surface-variant truncate">
                        {reembolsosKpis.pendientesCount} por auditar
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-tertiary-container shrink-0 text-right">
                    {fmt(reembolsosKpis.pendientesMontoUsd, 'USD')}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
