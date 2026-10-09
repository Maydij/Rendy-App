import { supabaseServer, EMPRESA_ID } from '@/lib/supabase-server';
import { TrendingUp, TrendingDown, Wallet, ClipboardCheck, RotateCcw, DollarSign, ArrowUpRight, Coins } from 'lucide-react';
import Link from 'next/link';

/* ─── helpers ─── */
const ISO_CURRENCIES = new Set(['USD', 'EUR', 'VES', 'MXN', 'COP', 'ARS', 'BRL', 'CLP', 'PEN', 'GBP']);

function fmt(n: number, moneda = 'USD') {
  let safeMoneda = moneda?.toUpperCase() === 'BS' ? 'VES' : moneda?.toUpperCase() ?? 'USD';
  safeMoneda = ISO_CURRENCIES.has(safeMoneda) ? safeMoneda : 'USD';
  return new Intl.NumberFormat('es-VE', { style: 'currency', currency: safeMoneda, maximumFractionDigits: 2 }).format(n);
}

function StatusBadge({ estado }: { estado: string }) {
  const cls = estado === 'APROBADO' ? 'aprobado' : estado === 'RECHAZADO' ? 'rechazado' : 'pendiente';
  const label = { APROBADO: 'Aprobado', RECHAZADO: 'Rechazado', PENDIENTE: 'Pendiente' }[estado] ?? estado;
  return (
    <span className={`badge ${cls}`}>
      <span className="badge-dot" />
      {label}
    </span>
  );
}

/* ─── data fetching ─── */
async function getDashboardData() {
  const [
    { data: gastos },
    { data: solicitudes },
    { data: proyectos },
    { data: empresa },
  ] = await Promise.all([
    supabaseServer
      .from('gastos')
      .select('id, comercio, categoria, monto, moneda, fecha_gasto, estado, proyecto_id, usuario_id, datos_ocr, concepto')
      .eq('empresa_id', EMPRESA_ID)
      .order('creado_en', { ascending: false }),
    supabaseServer
      .from('solicitudes_viaticos')
      .select('id, monto_solicitado, monto_aprobado, estado, usuario_id, proyecto_id')
      .eq('empresa_id', EMPRESA_ID),
    supabaseServer
      .from('proyectos')
      .select('id, nombre')
      .eq('empresa_id', EMPRESA_ID)
      .eq('activo', true),
    supabaseServer
      .from('empresas')
      .select('nombre, moneda')
      .eq('id', EMPRESA_ID)
      .single(),
  ]);

  const moneda = empresa?.moneda ?? 'USD';
  const allGastos = gastos ?? [];

  // Fetch exchange rates
  let rates: Record<string, number> = { USD: 1, VES: 36.5, EUR: 0.92 };
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { next: { revalidate: 3600 } });
    const data = await res.json();
    if (data && data.rates) {
      rates = data.rates;
    }
  } catch (e) {
    console.error("Error fetching exchange rates", e);
  }

  const convert = (amount: number, fromCurrency: string, toCurrency: string) => {
    const rateFrom = rates[fromCurrency] || 1;
    const rateTo = rates[toCurrency] || 1;
    return (amount / rateFrom) * rateTo;
  };

  let totalGastado = 0;
  let mJustificados = 0;
  let reembolsosPendientes = 0;

  const byCurrency: Record<string, number> = {};
  const byProject: Record<string, { nombre: string; total: number }> = {};
  const proyMap = Object.fromEntries((proyectos ?? []).map((p) => [p.id, p.nombre]));

  for (const g of allGastos) {
    let m = (g.datos_ocr as any)?.moneda ?? g.moneda ?? 'USD';
    m = m.toUpperCase();
    if (m === 'BS') m = 'VES';
    
    // Group by currency (native amount)
    if (!byCurrency[m]) byCurrency[m] = 0;
    byCurrency[m] += g.monto ?? 0;

    // Convert to base currency for KPIs
    const valInBase = convert(g.monto ?? 0, m, moneda);
    
    totalGastado += valInBase;
    if (g.solicitud_id) mJustificados += valInBase;
    if (!g.solicitud_id && g.estado === 'PENDIENTE') reembolsosPendientes += valInBase;

    // Group by project (converted to base currency)
    const pid = g.proyecto_id ?? '__sin_proyecto__';
    if (!byProject[pid]) byProject[pid] = { nombre: proyMap[pid] ?? 'Sin proyecto', total: 0 };
    byProject[pid].total += valInBase;
  }

  let viaticosAprobados = 0;
  for (const s of (solicitudes ?? [])) {
    if (s.estado === 'APROBADO') {
       viaticosAprobados += (s.monto_aprobado ?? s.monto_solicitado ?? 0);
    }
  }

  const projectBreakdown = Object.values(byProject)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  const maxProj = projectBreakdown[0]?.total ?? 1;

  const currencyBreakdown = Object.entries(byCurrency).map(([cur, total]) => ({ cur, total }));

  return {
    moneda,
    empresa: empresa?.nombre ?? 'Mi Empresa',
    kpis: { totalGastado, viaticosAprobados, mJustificados, reembolsosPendientes },
    recentGastos: allGastos.slice(0, 6),
    projectBreakdown: projectBreakdown.map((p) => ({
      ...p,
      pct: Math.round((p.total / maxProj) * 100),
    })),
    currencyBreakdown,
    proyMap,
  };
}

/* ─── page ─── */
export default async function DashboardPage() {
  const { moneda, empresa, kpis, recentGastos, projectBreakdown, currencyBreakdown, proyMap } = await getDashboardData();

  const kpiCards = [
    { id: 'total-gastado', label: 'Total Registrado', value: fmt(kpis.totalGastado, moneda), icon: DollarSign, color: 'indigo', trend: 'up' as const },
    { id: 'viaticos-aprobados', label: 'Viáticos Aprobados', value: fmt(kpis.viaticosAprobados, moneda), icon: Wallet, color: 'emerald', trend: 'up' as const },
    { id: 'justificados', label: 'Gastos Justificados (vía WA)', value: fmt(kpis.mJustificados, moneda), icon: ClipboardCheck, color: 'amber', trend: 'up' as const },
    { id: 'reembolsos-pendientes', label: 'Reembolsos Pendientes', value: fmt(kpis.reembolsosPendientes, moneda), icon: RotateCcw, color: 'rose', trend: kpis.reembolsosPendientes > 0 ? 'down' as const : 'up' as const },
  ];

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">
          Dashboard
          <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)', letterSpacing: 0 }}>
            {empresa}
          </span>
        </h1>
        <p className="page-subtitle">Resumen ejecutivo de gastos, viáticos y reembolsos de tu organización (convirtiendo monedas locales a {moneda}).</p>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" role="list" aria-label="Indicadores clave">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <article key={kpi.id} className="kpi-card" role="listitem" id={`kpi-${kpi.id}`}>
              <div className={`kpi-card-icon ${kpi.color}`}><Icon size={20} strokeWidth={2} /></div>
              <div className="kpi-card-label">{kpi.label}</div>
              <div className="kpi-card-value">{kpi.value}</div>
              <div className={`kpi-card-delta ${kpi.trend}`}>
                {kpi.trend === 'up' ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                Datos en tiempo real
              </div>
            </article>
          );
        })}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', alignItems: 'start' }}>

        {/* Gastos recientes */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Últimos Gastos (vía WhatsApp)</h2>
            <Link href="/dashboard/reembolsos" className="btn btn-ghost btn-sm" id="dashboard-ver-todos-btn">
              Ver todos <ArrowUpRight size={13} />
            </Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {recentGastos.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><DollarSign size={22} /></div>
                <div className="empty-state-title">Sin gastos registrados</div>
                <div className="empty-state-desc">Los gastos enviados por WhatsApp aparecerán aquí.</div>
              </div>
            ) : (
              <table className="rendy-table" aria-label="Últimos gastos registrados">
                <thead>
                  <tr>
                    <th>Comercio</th>
                    <th>Categoría</th>
                    <th>Monto Original</th>
                    <th>Proyecto</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {recentGastos.map((g) => {
                    const gMoneda = (g.datos_ocr as any)?.moneda ?? g.moneda ?? moneda;
                    return (
                      <tr key={g.id}>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {g.comercio ?? (g.datos_ocr as any)?.comercio ?? '—'}
                        </td>
                        <td>
                          <span style={{ background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, color: 'var(--text-accent)' }}>
                            {g.categoria}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {fmt(g.monto ?? 0, gMoneda)}
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                          {g.proyecto_id ? (proyMap[g.proyecto_id] ?? '—') : '—'}
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{g.fecha_gasto}</td>
                        <td><StatusBadge estado={g.estado} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div>
          {/* Gastos por moneda */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card-header">
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Coins size={16} /> Gastos por Moneda
              </h2>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {currencyBreakdown.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '20px' }}>Sin datos.</p>
              ) : (
                <table className="rendy-table">
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: '24px' }}>Divisa</th>
                      <th style={{ textAlign: 'right', paddingRight: '24px' }}>Total Bruto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currencyBreakdown.map((c) => (
                      <tr key={c.cur}>
                        <td style={{ fontWeight: 600, paddingLeft: '24px' }}>{c.cur}</td>
                        <td style={{ fontWeight: 700, color: 'var(--rendy-accent)', textAlign: 'right', paddingRight: '24px' }}>
                          {fmt(c.total, c.cur)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Gasto por proyecto */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Gasto por Proyecto (en {moneda})</h2>
            </div>
            <div className="card-body">
              {projectBreakdown.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Sin datos de proyectos.</p>
              ) : projectBreakdown.map((p) => {
                const barClass = p.pct >= 80 ? 'warning' : p.pct >= 50 ? '' : 'accent';
                return (
                  <div key={p.nombre} style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{p.nombre}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.pct}%</span>
                    </div>
                    <div className="progress-track" role="progressbar" aria-valuenow={p.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.nombre}: ${p.pct}%`}>
                      <div className={`progress-fill ${barClass}`} style={{ width: `${p.pct}%` }} />
                    </div>
                    <div style={{ marginTop: '5px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      {fmt(p.total, moneda)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
