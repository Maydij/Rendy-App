'use client';

import { useState, useTransition, useEffect } from 'react';
import { RotateCcw, Search, Eye } from 'lucide-react';
import { actualizarEstadoReembolso } from './actions';
import { formatCurrency } from '@/lib/currency';
import DigitalInvoice from '../gastos/digital-invoice';
import { Gasto } from '../gastos/gasto-type';

export type ReembolsoItem = {
  id: string;
  empleado: string;
  categoria: string;
  comercio: string;
  monto: number;
  moneda: string;
  monto_convertido_org: number;
  fecha_gasto: string;
  proyecto: string;
  metodo_pago: string;
  estado: string;
  url_comprobante: string | null;
  concepto: string | null;
};

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

export default function ReembolsosClient({
  reembolsos,
  monedaOrg = 'USD',
  rates = {},
}: {
  reembolsos: ReembolsoItem[];
  monedaOrg?: string;
  rates?: Record<string, number>;
}) {
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  // Estados para el Modal de Factura Digital
  const [selectedGasto, setSelectedGasto] = useState<Gasto | null>(null);
  const [modalTab, setModalTab] = useState<'digital' | 'imagen'>('digital');

  // Cerrar modal al presionar la tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedGasto(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filtered = reembolsos.filter((r) => {
    const matchSearch =
      r.empleado.toLowerCase().includes(search.toLowerCase()) ||
      r.comercio.toLowerCase().includes(search.toLowerCase()) ||
      r.id.toLowerCase().includes(search.toLowerCase());
    const matchEstado = filtroEstado === 'TODOS' || r.estado === filtroEstado;
    return matchSearch && matchEstado;
  });

  const totalGeneral = reembolsos.reduce((s, r) => s + r.monto_convertido_org, 0);

  const totalPendiente = reembolsos
    .filter((r) => r.estado === 'PENDIENTE')
    .reduce((s, r) => s + r.monto_convertido_org, 0);

  const totalProcesado = reembolsos
    .filter((r) => r.estado === 'APROBADO')
    .reduce((s, r) => s + r.monto_convertido_org, 0);

  const totalPagado = reembolsos
    .filter((r) => r.estado === 'RECHAZADO')
    .reduce((s, r) => s + r.monto_convertido_org, 0);

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
        <p className="page-subtitle">
          Gastos con fondos personales registrados vía WhatsApp que requieren reembolso al empleado (Valores consolidados en {monedaOrg}).
        </p>
      </div>

      {feedback && (
        <div style={{ position: 'fixed', top: '20px', right: '24px', zIndex: 200, background: feedback.startsWith('✅') ? 'var(--rendy-accent)' : 'var(--rendy-danger)', color: 'white', padding: '12px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
          {feedback}
        </div>
      )}

      {/* KPI Summary */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-card-label">Total a Reembolsar</div>
          <div className="kpi-card-value">
            {formatCurrency(totalGeneral, monedaOrg)}
          </div>
          <div className="kpi-card-delta up">
            {reembolsos.length} gastos en total · En {monedaOrg}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-label">Pendiente de Pago</div>
          <div className="kpi-card-value" style={{ color: 'var(--rendy-warning)' }}>
            {formatCurrency(totalPendiente, monedaOrg)}
          </div>
          <div className="kpi-card-delta down">
            {reembolsos.filter((r) => r.estado === 'PENDIENTE').length} gastos · En {monedaOrg}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-label">En Proceso</div>
          <div className="kpi-card-value">
            {formatCurrency(totalProcesado, monedaOrg)}
          </div>
          <div className="kpi-card-delta up">Transferencia iniciada · En {monedaOrg}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-label">Pagados</div>
          <div className="kpi-card-value" style={{ color: 'var(--rendy-accent)' }}>
            {formatCurrency(totalPagado, monedaOrg)}
          </div>
          <div className="kpi-card-delta up">Completados · En {monedaOrg}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
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
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
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
                  <th style={{ textAlign: 'right' }}>Acciones</th>
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
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {r.monto.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {r.moneda}
                        </div>
                        {r.moneda !== monedaOrg && (
                          <div style={{ fontSize: '11px', color: 'var(--rendy-accent)', fontWeight: 600, marginTop: '2px' }}>
                            ≈ {formatCurrency(r.monto_convertido_org, monedaOrg)}
                          </div>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{r.fecha_gasto}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{r.metodo_pago}</td>
                      <td><StatusBadge estado={r.estado} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'flex-end' }}>
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
                          <button
                            onClick={() => {
                              setSelectedGasto({
                                id: r.id,
                                empleado: r.empleado,
                                categoria: r.categoria,
                                comercio: r.comercio,
                                monto: r.monto,
                                moneda: r.moneda,
                                fecha_gasto: r.fecha_gasto,
                                proyecto: r.proyecto,
                                metodo_pago: r.metodo_pago,
                                estado: r.estado,
                                url_comprobante: r.url_comprobante,
                                concepto: r.concepto,
                              });
                              setModalTab('digital');
                            }}
                            className="btn btn-ghost btn-sm"
                            style={{
                              background: 'rgba(99, 102, 241, 0.1)',
                              border: '1px solid rgba(99, 102, 241, 0.25)',
                              color: 'var(--rendy-primary-light)',
                              gap: '5px',
                              cursor: 'pointer',
                            }}
                            title="Ver Factura Digital"
                          >
                            <Eye size={12} /> Ver
                          </button>
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

      {/* MODAL FACTURA DIGITAL / COMPROBANTE ORIGINAL */}
      {selectedGasto && (
        <DigitalInvoice
          setSelectedGasto={setSelectedGasto}
          modalTab={modalTab}
          setModalTab={setModalTab}
          selectedGasto={selectedGasto}
        />
      )}
    </>
  );
}