'use client';

/**
 * @name SolicitudesClient
 * @description [UI Component]: Main interactive client view for reviewing, approving,
 * attaching bank transfer proofs, and rejecting corporate travel allowance requests.
 */

import React, { useState, useTransition } from 'react';
import {
  Check,
  X,
  Search,
  Wallet,
  Eye,
  Paperclip,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { rechazarSolicitud } from './actions';
import {
  ModalAprobarViatico,
  type SolicitudViaticoItem,
} from './_components/ModalAprobarViatico';
import { ModalVerComprobanteViatico } from './_components/ModalVerComprobanteViatico';

export type Solicitud = SolicitudViaticoItem;

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

  // Modals for approval and viewing bank transfer receipts
  const [approveTarget, setApproveTarget] = useState<Solicitud | null>(null);
  const [approveModalMode, setApproveModalMode] = useState<'APROBACION' | 'SUBIR_COMPROBANTE'>('APROBACION');
  const [viewTarget, setViewTarget] = useState<Solicitud | null>(null);

  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);

  const filtered = solicitudes.filter((s) => {
    const matchSearch =
      s.empleado.toLowerCase().includes(search.toLowerCase()) ||
      s.proyecto.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase()) ||
      (s.referencia_transferencia && s.referencia_transferencia.toLowerCase().includes(search.toLowerCase()));
    const matchEstado = filtroEstado === 'TODOS' || s.estado?.toUpperCase() === filtroEstado;
    return matchSearch && matchEstado;
  });

  const pendingCount = solicitudes.filter((s) => s.estado?.toUpperCase() === 'PENDIENTE').length;
  const missingProofCount = solicitudes.filter(
    (s) => s.estado?.toUpperCase() === 'APROBADO' && !s.url_comprobante_transferencia
  ).length;

  function showNotification(msg: string, ok: boolean) {
    setFeedback({ msg, ok });
    setTimeout(() => setFeedback(null), 4000);
  }

  function handleRechazar() {
    if (!rejectTarget) return;
    startTransition(async () => {
      const res = await rechazarSolicitud(rejectTarget, rejectReason);
      setRejectTarget(null);
      setRejectReason('');
      showNotification(
        res.error ? `❌ ${res.error}` : '✅ Solicitud rechazada y notificada por WhatsApp',
        !res.error
      );
    });
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">
          <Wallet size={24} strokeWidth={2} />
          Solicitudes de Viáticos
          {pendingCount > 0 && (
            <span
              style={{
                background: 'rgba(245,158,11,0.15)',
                color: 'var(--rendy-warning)',
                fontSize: '12px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '20px',
              }}
            >
              {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
            </span>
          )}
          {missingProofCount > 0 && (
            <span
              style={{
                background: 'rgba(99,102,241,0.15)',
                color: 'var(--rendy-primary-light)',
                fontSize: '12px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '20px',
              }}
            >
              {missingProofCount} sin transferencia
            </span>
          )}
        </h1>
        <p className="page-subtitle">
          Revisa, aprueba, adjunta comprobantes de transferencia bancaria y audita las solicitudes de fondos.
        </p>
      </div>

      {feedback && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 300,
            background: feedback.ok ? 'var(--rendy-accent)' : 'var(--rendy-danger)',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 600,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}
        >
          {feedback.msg}
        </div>
      )}

      {/* Filter & Search Bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search
            size={15}
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
            id="solicitudes-search"
            type="search"
            placeholder="Buscar por empleado, proyecto, ID o referencia bancaria…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--bg-surface)',
              border: '1px solid var(--bg-border)',
              borderRadius: '8px',
              padding: '9px 12px 9px 36px',
              color: 'var(--text-primary)',
              fontSize: '13px',
              outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['TODOS', 'PENDIENTE', 'APROBADO', 'RECHAZADO'].map((e) => (
            <button
              key={e}
              id={`filter-solicitudes-${e.toLowerCase()}`}
              onClick={() => setFiltroEstado(e)}
              className="btn btn-ghost btn-sm"
              style={
                filtroEstado === e
                  ? {
                      background: 'rgba(99,102,241,0.18)',
                      color: 'var(--rendy-primary-light)',
                      borderColor: 'rgba(99,102,241,0.4)',
                    }
                  : {}
              }
            >
              {e === 'TODOS' ? 'Todos' : e.charAt(0) + e.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Table Card */}
      <div className="card">
        {solicitudes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Wallet size={22} /></div>
            <div className="empty-state-title">Sin solicitudes registradas</div>
            <div className="empty-state-desc">Cuando un empleado solicite viáticos, aparecerá aquí.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table className="rendy-table" aria-label="Solicitudes de viáticos">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Empleado</th>
                  <th>Proyecto</th>
                  <th>Monto Solicitado</th>
                  <th>Monto Aprobado</th>
                  <th>Fecha Solicitud</th>
                  <th>Estado</th>
                  <th>Soporte de Transferencia</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                      Sin resultados para la búsqueda o filtro seleccionado.
                    </td>
                  </tr>
                ) : (
                  filtered.map((sol) => {
                    const mStr = sol.moneda || 'USD';
                    const isApproved = sol.estado?.toUpperCase() === 'APROBADO';
                    const isPendingState = sol.estado?.toUpperCase() === 'PENDIENTE';
                    const hasTransferProof = Boolean(sol.url_comprobante_transferencia);

                    return (
                      <tr key={sol.id}>
                        {/* ID */}
                        <td style={{ verticalAlign: 'middle' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-accent)' }}>
                            {sol.id.slice(0, 8)}…
                          </span>
                        </td>

                        {/* Empleado */}
                        <td style={{ verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, var(--rendy-primary), var(--rendy-primary-light))',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: 'white',
                                flexShrink: 0,
                              }}
                            >
                              {sol.empleado.charAt(0)}
                            </div>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{sol.empleado}</span>
                          </div>
                        </td>

                        {/* Proyecto */}
                        <td style={{ verticalAlign: 'middle' }}>{sol.proyecto}</td>

                        {/* Monto Solicitado */}
                        <td style={{ verticalAlign: 'middle', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {sol.monto_solicitado.toLocaleString('es-VE')} {mStr}
                        </td>

                        {/* Monto Aprobado */}
                        <td style={{ verticalAlign: 'middle', fontWeight: 700, color: 'var(--rendy-accent)' }}>
                          {sol.monto_aprobado != null && sol.monto_aprobado > 0
                            ? `${sol.monto_aprobado.toLocaleString('es-VE')} ${mStr}`
                            : '—'}
                        </td>

                        {/* Fecha Solicitud */}
                        <td style={{ verticalAlign: 'middle', color: 'var(--text-muted)', fontSize: '12px' }}>
                          {new Date(sol.creado_en).toLocaleDateString('es-VE')}
                        </td>

                        {/* Estado */}
                        <td style={{ verticalAlign: 'middle' }}>
                          <StatusBadge estado={sol.estado} />
                        </td>

                        {/* Soporte de Transferencia (Audit Badge & Action) */}
                        <td style={{ verticalAlign: 'middle' }}>
                          {isApproved ? (
                            hasTransferProof ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span
                                  className="badge"
                                  style={{
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    color: 'var(--rendy-accent)',
                                    borderColor: 'rgba(16, 185, 129, 0.35)',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '3px 8px',
                                  }}
                                >
                                  <span className="badge-dot" style={{ background: 'var(--rendy-accent)' }} />
                                  💸 Transferido
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setViewTarget(sol)}
                                  className="btn btn-ghost btn-sm"
                                  style={{ padding: '3px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  title="Ver comprobante de transferencia"
                                >
                                  <Eye size={12} /> Ver
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span
                                  className="badge"
                                  style={{
                                    background: 'rgba(245, 158, 11, 0.15)',
                                    color: 'var(--rendy-warning)',
                                    borderColor: 'rgba(245, 158, 11, 0.35)',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '3px 8px',
                                  }}
                                >
                                  <span className="badge-dot" style={{ background: 'var(--rendy-warning)' }} />
                                  ⏳ Sin Comprobante
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setApproveTarget(sol);
                                    setApproveModalMode('SUBIR_COMPROBANTE');
                                  }}
                                  className="btn btn-ghost btn-sm"
                                  style={{
                                    padding: '3px 8px',
                                    fontSize: '11px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    color: 'var(--rendy-warning)',
                                    borderColor: 'rgba(245, 158, 11, 0.4)',
                                  }}
                                  title="Subir comprobante de transferencia bancaria"
                                >
                                  <Paperclip size={12} /> Subir
                                </button>
                              </div>
                            )
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>

                        {/* Acciones */}
                        <td style={{ verticalAlign: 'middle' }}>
                          {isPendingState ? (
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <button
                                id={`aprobar-${sol.id}`}
                                className="btn btn-success btn-sm"
                                disabled={isPending}
                                onClick={() => {
                                  setApproveTarget(sol);
                                  setApproveModalMode('APROBACION');
                                }}
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
                          ) : isApproved && !hasTransferProof ? (
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{
                                  padding: '4px 10px',
                                  fontSize: '11px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  color: 'var(--rendy-warning)',
                                }}
                                onClick={() => {
                                  setApproveTarget(sol);
                                  setApproveModalMode('SUBIR_COMPROBANTE');
                                }}
                              >
                                <Paperclip size={12} /> Adjuntar Transferencia
                              </button>
                            </div>
                          ) : isApproved && hasTransferProof ? (
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{
                                  padding: '4px 10px',
                                  fontSize: '11px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                }}
                                onClick={() => setViewTarget(sol)}
                              >
                                <Eye size={12} /> Ver Comprobante
                              </button>
                            </div>
                          ) : (
                            <div style={{ textAlign: 'right', fontSize: '12px', color: 'var(--text-muted)' }}>
                              {sol.motivo_rechazo ? `Rechazado: ${sol.motivo_rechazo}` : '—'}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Aprobar Viático / Adjuntar Comprobante */}
      {approveTarget && (
        <ModalAprobarViatico
          solicitud={approveTarget}
          mode={approveModalMode}
          onClose={() => setApproveTarget(null)}
          onSuccess={(msg) => showNotification(msg, true)}
        />
      )}

      {/* Modal: Ver Comprobante Bancario de Transferencia */}
      {viewTarget && (
        <ModalVerComprobanteViatico
          solicitud={viewTarget}
          onClose={() => setViewTarget(null)}
        />
      )}

      {/* Modal: Rechazo de Solicitud */}
      {rejectTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 250,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setRejectTarget(null)}
        >
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--bg-border)',
              borderRadius: '16px',
              padding: '28px',
              width: '420px',
              maxWidth: '90vw',
            }}
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
              style={{
                width: '100%',
                background: 'var(--bg-surface)',
                border: '1px solid var(--bg-border)',
                borderRadius: '8px',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontSize: '13px',
                resize: 'vertical',
                outline: 'none',
                marginBottom: '16px',
              }}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setRejectTarget(null)}>
                Cancelar
              </button>
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
