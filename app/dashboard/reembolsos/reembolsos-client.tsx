'use client';

import { useState, useTransition } from 'react';
import { RotateCcw, Search, Receipt, ExternalLink } from 'lucide-react';
import type { Reembolso } from './page';
import { actualizarEstadoReembolso } from './actions';

const ESTADO_CONFIG: Record<string, { label: string; badgeClass: string; next: string; nextLabel: string }> = {
  PENDIENTE: { label: 'Pendiente',  badgeClass: 'pendiente', next: 'APROBADO',  nextLabel: 'Marcar Procesado' },
  APROBADO:  { label: 'Procesado', badgeClass: 'amber',     next: 'RECHAZADO', nextLabel: 'Marcar Pagado' },
  RECHAZADO: { label: 'Pagado',    badgeClass: 'pagado',    next: '',           nextLabel: '' },
};

function StatusBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_CONFIG[estado] ?? { label: estado, badgeClass: 'pendiente' };
  return (
    <span className={`badge ${cfg.badgeClass}`}>
      <span className="badge-dot" />
      {cfg.label}
    </span>
  );
}

export default function ReembolsosClient({ reembolsos }: { reembolsos: Reembolso[] }) {
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const filtered = reembolsos.filter((r) => {
    const matchSearch =
      r.empleado.toLowerCase().includes(search.toLowerCase()) ||
      r.comercio.toLowerCase().includes(search.toLowerCase()) ||
      r.id.toLowerCase().includes(search.toLowerCase());
    const matchEstado = filtroEstado === 'TODOS' || r.estado === filtroEstado;
    return matchSearch && matchEstado;
  });

  const totalPendiente = reembolsos.filter((r) => r.estado === 'PENDIENTE').reduce((s, r) => s + r.monto, 0);
  const totalProcesado = reembolsos.filter((r) => r.estado === 'APROBADO').reduce((s, r) => s + r.monto, 0);
  const totalPagado = reembolsos.filter((r) => r.estado === 'RECHAZADO').reduce((s, r) => s + r.monto, 0);

  function handleCambioEstado(id: string, nextEstado: string) {
    startTransition(async () => {
      const res = await actualizarEstadoReembolso(id, nextEstado as any);
      setFeedback(res.error ? `❌ ${res.error}` : '✅ Estado actualizado');
      setTimeout(() => setFeedback(null), 3000);
    });
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title"><RotateCcw size={24} strokeWidth={2} />Gestión de Reembolsos</h1>
        <p className="page-subtitle">Gastos con fondos propios registrados vía WhatsApp que requieren reembolso al empleado.</p>
      </div>

      {feedback && (
        <div style={{ position: 'fixed', top: '20px', right: '24px', zIndex: 200, background: feedback.startsWith('✅') ? 'var(--rendy-accent)' : 'var(--rendy-danger)', color: 'white', padding: '12px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
          {feedback}
        </div>
      )}

      {/* KPI Summary */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '24px' }}>
        <div className="kpi-card">
          <div className="kpi-card-label">Pendiente de Pago</div>
          <div className="kpi-card-value" style={{ color: 'var(--rendy-warning)' }}>${totalPendiente.toLocaleString('es-VE')}</div>
          <div className="kpi-card-delta down">{reembolsos.filter((r) => r.estado === 'PENDIENTE').length} gastos</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-label">En Proceso</div>
          <div className="kpi-card-value">${totalProcesado.toLocaleString('es-VE')}</div>
          <div className="kpi-card-delta up">Transferencia iniciada</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-label">Pagados</div>
          <div className="kpi-card-value" style={{ color: 'var(--rendy-accent)' }}>${totalPagado.toLocaleString('es-VE')}</div>
          <div className="kpi-card-delta up">Completados</div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            id="reembolsos-search"
            type="search"
            placeholder="Buscar por empleado, comercio o ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: '8px', padding: '9px 12px 9px 36px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
          />
        </div>
        {['TODOS', 'PENDIENTE', 'APROBADO', 'RECHAZADO'].map((e) => (
          <button
            key={e}
            id={`filter-reembolsos-${e.toLowerCase()}`}
            onClick={() => setFiltroEstado(e)}
            className="btn btn-ghost btn-sm"
            style={filtroEstado === e ? { background: 'rgba(99,102,241,0.18)', color: 'var(--rendy-primary-light)', borderColor: 'rgba(99,102,241,0.4)' } : {}}
          >
            {e === 'TODOS' ? 'Todos' : e === 'APROBADO' ? 'Procesado' : e === 'RECHAZADO' ? 'Pagado' : 'Pendiente'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card">
        {reembolsos.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><RotateCcw size={22} /></div>
            <div className="empty-state-title">Sin gastos para reembolsar</div>
            <div className="empty-state-desc">Los gastos propios enviados por WhatsApp sin viático asignado aparecerán aquí.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="rendy-table" aria-label="Listado de reembolsos">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Categoría</th>
                  <th>Comercio</th>
                  <th>Monto</th>
                  <th>Fecha</th>
                  <th>Método de Pago</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>Sin resultados.</td>
                  </tr>
                ) : filtered.map((r) => {
                  const cfg = ESTADO_CONFIG[r.estado];
                  return (
                    <tr key={r.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--rendy-accent-dark), var(--rendy-accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                            {r.empleado.charAt(0)}
                          </div>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.empleado}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, color: 'var(--text-accent)' }}>
                          {r.categoria}
                        </span>
                      </td>
                      <td title={r.concepto ?? undefined}>{r.comercio}</td>
                      <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {r.monto.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {r.moneda}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{r.fecha_gasto}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{r.metodo_pago}</td>
                      <td><StatusBadge estado={r.estado} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          {cfg?.next && (
                            <button
                              id={`reembolso-avanzar-${r.id}`}
                              className="btn btn-ghost btn-sm"
                              disabled={isPending}
                              onClick={() => handleCambioEstado(r.id, cfg.next)}
                              title={cfg.nextLabel}
                              aria-label={cfg.nextLabel}
                            >
                              {cfg.nextLabel}
                            </button>
                          )}
                          {r.url_comprobante && (
                            <a
                              href={r.url_comprobante}
                              target="_blank"
                              rel="noopener noreferrer"
                              id={`comprobante-${r.id}`}
                              className="btn btn-ghost btn-sm"
                              aria-label="Ver comprobante"
                            >
                              <Receipt size={13} />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
