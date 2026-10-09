'use client';

import { useState, useTransition } from 'react';
import { Check, X, Search, Wallet } from 'lucide-react';
import { aprobarSolicitud, rechazarSolicitud } from './actions';

type Solicitud = {
  id: string;
  empleado: string;
  proyecto: string;
  monto_solicitado: number;
  monto_aprobado: number | null;
  moneda: string | null;
  estado: string;
  creado_en: string;
  fecha_requerida: string | null;
  motivo_rechazo: string | null;
};

function StatusBadge({ estado }: { estado: string }) {
  const estUpper = estado?.toUpperCase() || 'PENDIENTE';
  const cls = estUpper === 'APROBADO' ? 'aprobado' : estUpper === 'RECHAZADO' ? 'rechazado' : 'pendiente';
  const label = { APROBADO: 'Aprobado', RECHAZADO: 'Rechazado', PENDIENTE: 'Pendiente' }[estUpper] ?? estado;
  return (
    <span className={`badge ${cls}`}>
      <span className="badge-dot" />
      {label}
    </span>
  );
}

export default function SolicitudesClient({ solicitudes }: { solicitudes: Solicitud[] }) {
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);

  const filtered = solicitudes.filter((s) => {
    const matchSearch =
      s.empleado.toLowerCase().includes(search.toLowerCase()) ||
      s.proyecto.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase());
    const matchEstado = filtroEstado === 'TODOS' || s.estado?.toUpperCase() === filtroEstado;
    return matchSearch && matchEstado;
  });

  const pendingCount = solicitudes.filter((s) => s.estado?.toUpperCase() === 'PENDIENTE').length;

  function handleAprobar(id: string) {
    startTransition(async () => {
      const res = await aprobarSolicitud(id);
      setFeedback({ msg: res.error ? `❌ ${res.error}` : '✅ Solicitud aprobada y notificada por WhatsApp', ok: !res.error });
      setTimeout(() => setFeedback(null), 3500);
    });
  }

  function handleRechazar() {
    if (!rejectTarget) return;
    startTransition(async () => {
      const res = await rechazarSolicitud(rejectTarget, rejectReason);
      setRejectTarget(null);
      setRejectReason('');
      setFeedback({ msg: res.error ? `❌ ${res.error}` : '✅ Solicitud rechazada y notificada por WhatsApp', ok: !res.error });
      setTimeout(() => setFeedback(null), 3500);
    });
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">
          <Wallet size={24} strokeWidth={2} />
          Solicitudes de Viáticos
          {pendingCount > 0 && (
            <span style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--rendy-warning)', fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px' }}>
              {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
            </span>
          )}
        </h1>
        <p className="page-subtitle">Revisa, aprueba o rechaza las solicitudes de fondos de tu equipo.</p>
      </div>

      {feedback && (
        <div style={{
          position: 'fixed', top: '20px', right: '24px', zIndex: 200,
          background: feedback.ok ? 'var(--rendy-accent)' : 'var(--rendy-danger)',
          color: 'white', padding: '12px 20px', borderRadius: '10px',
          fontSize: '13px', fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          {feedback.msg}
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            id="solicitudes-search"
            type="search"
            placeholder="Buscar por empleado, proyecto o ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: '8px', padding: '9px 12px 9px 36px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
          />
        </div>
        {['TODOS', 'PENDIENTE', 'APROBADO', 'RECHAZADO'].map((e) => (
          <button
            key={e}
            id={`filter-solicitudes-${e.toLowerCase()}`}
            onClick={() => setFiltroEstado(e)}
            className="btn btn-ghost btn-sm"
            style={filtroEstado === e ? { background: 'rgba(99,102,241,0.18)', color: 'var(--rendy-primary-light)', borderColor: 'rgba(99,102,241,0.4)' } : {}}
          >
            {e === 'TODOS' ? 'Todos' : e.charAt(0) + e.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="card">
        {solicitudes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Wallet size={22} /></div>
            <div className="empty-state-title">Sin solicitudes registradas</div>
            <div className="empty-state-desc">Cuando un empleado solicite viáticos, aparecerá aquí.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="rendy-table" aria-label="Solicitudes de viáticos">
              <thead>
                <tr>
                  <th style={{ verticalAlign: 'middle', padding: '14px 16px' }}>ID</th>
                  <th style={{ verticalAlign: 'middle', padding: '14px 16px' }}>Empleado</th>
                  <th style={{ verticalAlign: 'middle', padding: '14px 16px' }}>Proyecto</th>
                  <th style={{ verticalAlign: 'middle', padding: '14px 16px' }}>Monto Solicitado</th>
                  <th style={{ verticalAlign: 'middle', padding: '14px 16px' }}>Monto Aprobado</th>
                  <th style={{ verticalAlign: 'middle', padding: '14px 16px' }}>Fecha Solicitud</th>
                  <th style={{ verticalAlign: 'middle', padding: '14px 16px' }}>Fecha Requerida</th>
                  <th style={{ verticalAlign: 'middle', padding: '14px 16px' }}>Estado</th>
                  <th style={{ verticalAlign: 'middle', padding: '14px 16px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                      Sin resultados.
                    </td>
                  </tr>
                ) : filtered.map((sol) => {
                  const mStr = sol.moneda || 'USD';
                  return (
                    <tr key={sol.id}>
                      <td style={{ verticalAlign: 'middle' }}><span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-accent)' }}>{sol.id.slice(0, 8)}…</span></td>
                      <td style={{ verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--rendy-primary), var(--rendy-primary-light))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                            {sol.empleado.charAt(0)}
                          </div>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{sol.empleado}</span>
                        </div>
                      </td>
                      <td style={{ verticalAlign: 'middle' }}>{sol.proyecto}</td>
                      <td style={{ verticalAlign: 'middle', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {sol.monto_solicitado.toLocaleString('es-VE')} {mStr}
                      </td>
                      <td style={{ verticalAlign: 'middle', fontWeight: 700, color: 'var(--rendy-accent)' }}>
                        {sol.monto_aprobado != null && sol.monto_aprobado > 0 ? `${sol.monto_aprobado.toLocaleString('es-VE')} ${mStr}` : '—'}
                      </td>
                      <td style={{ verticalAlign: 'middle', color: 'var(--text-muted)', fontSize: '12px' }}>{new Date(sol.creado_en).toLocaleDateString('es-VE')}</td>
                      <td style={{ verticalAlign: 'middle', color: 'var(--rendy-warning)', fontWeight: 600, fontSize: '12px' }}>
                        {sol.fecha_requerida || new Date(sol.creado_en).toLocaleDateString('es-VE')}
                      </td>
                      <td style={{ verticalAlign: 'middle' }}><StatusBadge estado={sol.estado} /></td>
                      <td style={{ verticalAlign: 'middle' }}>
                        {sol.estado?.toUpperCase() === 'PENDIENTE' ? (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              id={`aprobar-${sol.id}`}
                              className="btn btn-success btn-sm"
                              disabled={isPending}
                              onClick={() => handleAprobar(sol.id)}
                            >
                              <Check size={13} /> Aprobar
                            </button>
                            <button
                              id={`rechazar-${sol.id}`}
                              className="btn btn-danger btn-sm"
                              disabled={isPending}
                              onClick={() => setRejectTarget(sol.id)}
                            >
                              <X size={13} /> Rechazar
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rejectTarget && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}
          onClick={() => setRejectTarget(null)}
        >
          <div
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: '16px', padding: '28px', width: '420px', maxWidth: '90vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Rechazar Solicitud</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Indica el motivo. El empleado recibirá una notificación automática por WhatsApp.
            </p>
            <textarea
              id="reject-reason-input"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ej: Presupuesto del proyecto agotado…"
              rows={4}
              style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '13px', resize: 'vertical', outline: 'none', marginBottom: '16px' }}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setRejectTarget(null)}>Cancelar</button>
              <button
                id="confirm-reject-btn"
                className="btn btn-danger"
                disabled={isPending}
                onClick={handleRechazar}
              >
                <X size={14} /> Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}