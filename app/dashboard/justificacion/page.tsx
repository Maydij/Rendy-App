import { supabaseServer, EMPRESA_ID } from '@/lib/supabase-server';
import { ClipboardCheck, AlertTriangle } from 'lucide-react';

async function getJustificacionData() {
  // Solicitudes aprobadas con sus gastos asociados
  const { data: solicitudes } = await supabaseServer
    .from('solicitudes_viaticos')
    .select('id, usuario_id, proyecto_id, monto_aprobado, monto_solicitado, moneda, estado, creado_en')
    .eq('empresa_id', EMPRESA_ID)
    .eq('estado', 'APROBADO')
    .order('creado_en', { ascending: false });

  const { data: gastos } = await supabaseServer
    .from('gastos')
    .select('solicitud_id, monto')
    .eq('empresa_id', EMPRESA_ID)
    .not('solicitud_id', 'is', null);

  const { data: usuarios } = await supabaseServer
    .from('usuarios')
    .select('id, nombre')
    .eq('empresa_id', EMPRESA_ID);

  const { data: proyectos } = await supabaseServer
    .from('proyectos')
    .select('id, nombre')
    .eq('empresa_id', EMPRESA_ID);

  const usuMap = Object.fromEntries((usuarios ?? []).map((u) => [u.id, u.nombre]));
  const proyMap = Object.fromEntries((proyectos ?? []).map((p) => [p.id, p.nombre]));

  const gastosBySol: Record<string, number> = {};
  const countBySol: Record<string, number> = {};
  for (const g of gastos ?? []) {
    if (!g.solicitud_id) continue;
    gastosBySol[g.solicitud_id] = (gastosBySol[g.solicitud_id] ?? 0) + (g.monto ?? 0);
    countBySol[g.solicitud_id] = (countBySol[g.solicitud_id] ?? 0) + 1;
  }

  return (solicitudes ?? []).map((s) => ({
    id: s.id,
    empleado: usuMap[s.usuario_id] ?? 'Usuario',
    proyecto: s.proyecto_id ? (proyMap[s.proyecto_id] ?? 'Sin proyecto') : 'Sin proyecto',
    monto_otorgado: s.monto_aprobado ?? s.monto_solicitado ?? 0,
    monto_gastado: gastosBySol[s.id] ?? 0,
    moneda: s.moneda || 'USD',
    gastos_count: countBySol[s.id] ?? 0,
    fecha_aprobacion: new Date(s.creado_en).toLocaleDateString('es-VE'),
  }));
}

function JustificacionCard({ item }: { item: Awaited<ReturnType<typeof getJustificacionData>>[0] }) {
  const pct = item.monto_otorgado > 0
    ? Math.min(Math.round((item.monto_gastado / item.monto_otorgado) * 100), 100)
    : 0;
  const restante = item.monto_otorgado - item.monto_gastado;
  const isCompleto = pct >= 100;
  const isAlerta = pct < 40 && item.gastos_count === 0;

  let barClass = '';
  if (isCompleto) barClass = 'accent';
  else if (isAlerta) barClass = 'warning';

  const mStr = item.moneda;

  return (
    <div className="card" id={`justificacion-${item.id}`}>
      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--rendy-primary), var(--rendy-primary-light))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: 'white' }}>
              {item.empleado.charAt(0)}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{item.empleado}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.proyecto}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isAlerta && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--rendy-warning)', fontSize: '12px' }}>
                <AlertTriangle size={13} /> Sin justificar
              </span>
            )}
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--text-muted)' }}>
              {item.id.slice(0, 8)}…
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
          {[
            { label: 'Monto Otorgado', value: `${item.monto_otorgado.toLocaleString('es-VE')} ${mStr}`, color: 'var(--text-primary)' },
            { label: 'Justificado (WhatsApp)', value: `${item.monto_gastado.toLocaleString('es-VE')} ${mStr}`, color: 'var(--rendy-accent)' },
            { label: 'Restante', value: `${restante.toLocaleString('es-VE')} ${mStr}`, color: restante > 0 ? 'var(--rendy-warning)' : 'var(--rendy-accent)' },
          ].map((m) => (
            <div key={m.label} style={{ background: 'var(--bg-elevated)', borderRadius: '8px', padding: '10px 12px', border: '1px solid var(--bg-border)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>{m.label}</div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {item.gastos_count} comprobante{item.gastos_count !== 1 ? 's' : ''} vía WhatsApp
            </span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: isCompleto ? 'var(--rendy-accent)' : isAlerta ? 'var(--rendy-warning)' : 'var(--text-primary)' }}>
              {pct}% justificado
            </span>
          </div>
          <div className="progress-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${item.empleado}: ${pct}% justificado`}>
            <div className={`progress-fill ${barClass}`} style={{ width: `${pct}%` }} />
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
            Aprobado el {item.fecha_aprobacion}
            {isCompleto && <span style={{ color: 'var(--rendy-accent)', marginLeft: '8px', fontWeight: 600 }}>✓ Completo</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function JustificacionPage() {
  const items = await getJustificacionData();

  const completados = items.filter((j) => j.monto_gastado >= j.monto_otorgado).length;
  const alertas = items.filter((j) => j.gastos_count === 0).length;

  return (
    <>
      <div className="page-header">
        <h1 className="page-title"><ClipboardCheck size={24} strokeWidth={2} />Progreso de Justificación</h1>
        <p className="page-subtitle">
          Monitoreo en tiempo real del avance de justificación. Los comprobantes se registran automáticamente vía WhatsApp.
        </p>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '24px' }}>
        <div className="kpi-card">
          <div className="kpi-card-label">Viáticos Aprobados Activos</div>
          <div className="kpi-card-value">{items.length}</div>
          <div className="kpi-card-delta up">En seguimiento</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-label">Completamente Justificados</div>
          <div className="kpi-card-value" style={{ color: 'var(--rendy-accent)' }}>{completados}</div>
          <div className="kpi-card-delta up">100% comprobado</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-label">Sin Comprobantes (alerta)</div>
          <div className="kpi-card-value" style={{ color: 'var(--rendy-warning)' }}>{alertas}</div>
          <div className="kpi-card-delta down">Requieren atención</div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon"><ClipboardCheck size={22} /></div>
            <div className="empty-state-title">Sin viáticos aprobados</div>
            <div className="empty-state-desc">Los viáticos aprobados con gastos registrados via WhatsApp aparecerán aquí.</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))', gap: '16px' }}>
          {items.map((j) => <JustificacionCard key={j.id} item={j} />)}
        </div>
      )}
    </>
  );
}
