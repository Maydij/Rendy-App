'use client';

import { useState, useEffect } from 'react';
import {
  ClipboardCheck,
  AlertTriangle,
  Receipt,
  ReceiptText,
  ExternalLink,
  Eye,
  X,
  Search,
  CheckCircle2,
  Calendar,
  Tag,
  DollarSign,
  ArrowRight,
  TrendingUp,
  FileQuestion,
} from 'lucide-react';
import DigitalInvoice from '../gastos/digital-invoice';

export type GastoJustificacion = {
  id: string;
  categoria: string;
  comercio: string;
  monto: number;
  moneda: string;
  tasa_cambio: number | null;
  monto_convertido: number | null;
  monto_efectivo: number;
  fecha_gasto: string;
  url_comprobante: string | null;
  concepto: string | null;
  estado: string;
  creado_en: string;
};

export type JustificacionItem = {
  id: string;
  empleado: string;
  proyecto: string;
  monto_otorgado: number;
  monto_gastado: number;
  moneda: string;
  gastos_count: number;
  fecha_aprobacion: string;
  gastos: GastoJustificacion[];
};

export default function JustificacionClient({ items }: { items: JustificacionItem[] }) {
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState<'TODOS' | 'COMPLETOS' | 'EN_PROGRESO' | 'SIN_COMPROBANTES'>('TODOS');
  
  // Modal de Detalle de Gastos
  const [selectedSolicitud, setSelectedSolicitud] = useState<JustificacionItem | null>(null);
  
  // Modal Lightbox para Comprobante/Factura
  const [selectedReceipt, setSelectedReceipt] = useState<{
    url: string;
    comercio: string;
    montoStr: string;
    fecha: string;
  } | null>(null);

  // Manejo de tecla Escape para cerrar modales
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedReceipt) {
          setSelectedReceipt(null);
        } else if (selectedSolicitud) {
          setSelectedSolicitud(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedReceipt, selectedSolicitud]);

  // Mantener actualizado el viático seleccionado si la lista cambia
  useEffect(() => {
    if (selectedSolicitud) {
      const updated = items.find((i) => i.id === selectedSolicitud.id);
      if (updated) setSelectedSolicitud(updated);
    }
  }, [items, selectedSolicitud]);

  const completados = items.filter((j) => j.monto_gastado >= j.monto_otorgado && j.monto_otorgado > 0).length;
  const alertas = items.filter((j) => j.gastos_count === 0).length;
  const enProgreso = items.filter((j) => j.monto_gastado < j.monto_otorgado && j.gastos_count > 0).length;

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.empleado.toLowerCase().includes(search.toLowerCase()) ||
      item.proyecto.toLowerCase().includes(search.toLowerCase()) ||
      item.id.toLowerCase().includes(search.toLowerCase());

    const isCompleto = item.monto_gastado >= item.monto_otorgado && item.monto_otorgado > 0;
    const isSinComprobantes = item.gastos_count === 0;
    const isEnProgreso = !isCompleto && !isSinComprobantes;

    if (!matchesSearch) return false;

    if (filtro === 'COMPLETOS') return isCompleto;
    if (filtro === 'EN_PROGRESO') return isEnProgreso;
    if (filtro === 'SIN_COMPROBANTES') return isSinComprobantes;
    return true;
  });

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">
          <ClipboardCheck size={24} strokeWidth={2} />
          Progreso de Justificación
        </h1>
        <p className="page-subtitle">
          Monitoreo en tiempo real del avance de viáticos otorgados y comprobantes registrados vía WhatsApp.
        </p>
      </div>

      {/* KPI GRID */}
      <div className="kpi-grid">
        <div
          className="kpi-card"
          onClick={() => setFiltro('TODOS')}
          style={{ cursor: 'pointer', border: filtro === 'TODOS' ? '1px solid var(--rendy-primary)' : undefined }}
        >
          <div className="kpi-card-label">Viáticos Activos</div>
          <div className="kpi-card-value">{items.length}</div>
          <div className="kpi-card-delta up">En seguimiento</div>
        </div>
        <div
          className="kpi-card"
          onClick={() => setFiltro('COMPLETOS')}
          style={{ cursor: 'pointer', border: filtro === 'COMPLETOS' ? '1px solid var(--rendy-accent)' : undefined }}
        >
          <div className="kpi-card-label">100% Justificados</div>
          <div className="kpi-card-value" style={{ color: 'var(--rendy-accent)' }}>{completados}</div>
          <div className="kpi-card-delta up">Comprobados</div>
        </div>
        <div
          className="kpi-card"
          onClick={() => setFiltro('SIN_COMPROBANTES')}
          style={{ cursor: 'pointer', border: filtro === 'SIN_COMPROBANTES' ? '1px solid var(--rendy-warning)' : undefined }}
        >
          <div className="kpi-card-label">Sin Comprobantes</div>
          <div className="kpi-card-value" style={{ color: 'var(--rendy-warning)' }}>{alertas}</div>
          <div className="kpi-card-delta down">Requieren rendición</div>
        </div>
      </div>

      {/* SEARCH AND FILTERS */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search
            size={15}
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}
          />
          <input
            id="justificacion-search"
            type="search"
            placeholder="Buscar por empleado, proyecto o ID de viático…"
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
          {[
            { id: 'TODOS', label: 'Todos' },
            { id: 'EN_PROGRESO', label: `En Progreso (${enProgreso})` },
            { id: 'COMPLETOS', label: `100% Listos (${completados})` },
            { id: 'SIN_COMPROBANTES', label: `Sin Comprobantes (${alertas})` },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id as any)}
              className="btn btn-sm"
              style={{
                background: filtro === f.id ? 'var(--rendy-primary)' : 'var(--bg-elevated)',
                color: filtro === f.id ? 'white' : 'var(--text-secondary)',
                border: '1px solid',
                borderColor: filtro === f.id ? 'var(--rendy-primary)' : 'var(--bg-border)',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* CARDS LIST */}
      {filteredItems.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon"><ClipboardCheck size={22} /></div>
            <div className="empty-state-title">No se encontraron viáticos</div>
            <div className="empty-state-desc">
              {search ? 'No hay resultados que coincidan con la búsqueda.' : 'Los viáticos aprobados aparecerán aquí.'}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 380px), 1fr))', gap: '16px' }}>
          {filteredItems.map((item) => {
            const pct = item.monto_otorgado > 0
              ? Math.min(Math.round((item.monto_gastado / item.monto_otorgado) * 100), 100)
              : 0;
            const restante = Math.max(0, item.monto_otorgado - item.monto_gastado);
            const isCompleto = pct >= 100;
            const isAlerta = pct < 40 && item.gastos_count === 0;

            let barClass = '';
            if (isCompleto) barClass = 'accent';
            else if (isAlerta) barClass = 'warning';

            const mStr = item.moneda;

            return (
              <div
                key={item.id}
                className="card"
                id={`justificacion-${item.id}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div style={{ padding: '20px 24px' }}>
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, var(--rendy-primary), var(--rendy-primary-light))',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '13px',
                          fontWeight: 700,
                          color: 'white',
                          boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
                        }}
                      >
                        {item.empleado.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>{item.empleado}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.proyecto}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isAlerta && (
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'rgba(245, 158, 11, 0.1)',
                            color: 'var(--rendy-warning)',
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: '6px',
                          }}
                        >
                          <AlertTriangle size={12} /> Sin justificar
                        </span>
                      )}
                      {isCompleto && (
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'rgba(16, 185, 129, 0.1)',
                            color: 'var(--rendy-accent)',
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: '6px',
                          }}
                        >
                          <CheckCircle2 size={12} /> 100% Justificado
                        </span>
                      )}
                      <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--text-muted)' }}>
                        {item.id.slice(0, 8)}…
                      </span>
                    </div>
                  </div>

                  {/* Financial Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px', marginBottom: '16px' }}>
                    {[
                      {
                        label: 'Monto Otorgado',
                        value: `${item.monto_otorgado.toLocaleString('es-VE', { minimumFractionDigits: 2 })} ${mStr}`,
                        color: 'var(--text-primary)',
                      },
                      {
                        label: 'Justificado (WhatsApp)',
                        value: `${item.monto_gastado.toLocaleString('es-VE', { minimumFractionDigits: 2 })} ${mStr}`,
                        color: 'var(--rendy-accent)',
                      },
                      {
                        label: 'Restante',
                        value: `${restante.toLocaleString('es-VE', { minimumFractionDigits: 2 })} ${mStr}`,
                        color: restante > 0 ? 'var(--rendy-warning)' : 'var(--rendy-accent)',
                      },
                    ].map((m) => (
                      <div
                        key={m.label}
                        style={{
                          background: 'var(--bg-elevated)',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          border: '1px solid var(--bg-border)',
                        }}
                      >
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 500 }}>
                          {m.label}
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: m.color, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{m.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {item.gastos_count} comprobante{item.gastos_count !== 1 ? 's' : ''} registrado{item.gastos_count !== 1 ? 's' : ''}
                      </span>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 700,
                          color: isCompleto ? 'var(--rendy-accent)' : isAlerta ? 'var(--rendy-warning)' : 'var(--text-primary)',
                        }}
                      >
                        {pct}% justificado
                      </span>
                    </div>
                    <div
                      className="progress-track"
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${item.empleado}: ${pct}% justificado`}
                    >
                      <div className={`progress-fill ${barClass}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                      Aprobado el {item.fecha_aprobacion}
                    </div>
                  </div>
                </div>

                {/* Card Footer: Action Button */}
                <div
                  style={{
                    padding: '12px 24px',
                    borderTop: '1px solid var(--bg-border)',
                    background: 'rgba(255, 255, 255, 0.01)',
                  }}
                >
                  <button
                    id={`ver-justificacion-${item.id}`}
                    onClick={() => setSelectedSolicitud(item)}
                    className="btn"
                    style={{
                      width: '100%',
                      justifyContent: 'center',
                      background: item.gastos_count > 0 ? 'var(--bg-elevated)' : 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid',
                      borderColor: item.gastos_count > 0 ? 'var(--bg-border)' : 'transparent',
                      color: item.gastos_count > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                      gap: '8px',
                      padding: '9px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (item.gastos_count > 0) {
                        e.currentTarget.style.borderColor = 'var(--rendy-primary)';
                        e.currentTarget.style.background = 'rgba(99, 102, 241, 0.12)';
                        e.currentTarget.style.color = 'var(--rendy-primary-light)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (item.gastos_count > 0) {
                        e.currentTarget.style.borderColor = 'var(--bg-border)';
                        e.currentTarget.style.background = 'var(--bg-elevated)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }
                    }}
                  >
                    <ReceiptText size={15} style={{ color: item.gastos_count > 0 ? 'var(--rendy-primary-light)' : 'var(--text-muted)' }} />
                    <span>
                      {item.gastos_count > 0
                        ? `Ver desglose de gastos (${item.gastos_count})`
                        : 'Ver detalle de solicitud'}
                    </span>
                    <ArrowRight size={13} style={{ marginLeft: 'auto', opacity: 0.7 }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================
          MODAL FLOTANTE: DETALLE DE GASTOS Y COMPROBANTES
          ========================================================= */}
      {selectedSolicitud && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 7, 15, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={() => setSelectedSolicitud(null)}
        >
          <div
            id="modal-detalle-justificacion"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: '18px',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7), 0 0 40px rgba(99, 102, 241, 0.15)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--bg-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-elevated)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--rendy-primary-light)',
                  }}
                >
                  <Receipt size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Comprobantes Justificativos
                  </h2>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span>{selectedSolicitud.empleado}</span>
                    <span>•</span>
                    <span>{selectedSolicitud.proyecto}</span>
                    <span>•</span>
                    <span style={{ fontFamily: 'monospace' }}>#{selectedSolicitud.id.slice(0, 8)}</span>
                  </div>
                </div>
              </div>

              <button
                id="close-modal-justificacion"
                onClick={() => setSelectedSolicitud(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
                aria-label="Cerrar modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              {/* Financial Progress Summary Banner */}
              <div
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--bg-border)',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '20px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <TrendingUp size={16} style={{ color: 'var(--rendy-accent)' }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Progreso de la Rendición
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: selectedSolicitud.monto_gastado >= selectedSolicitud.monto_otorgado ? 'var(--rendy-accent)' : 'var(--text-primary)',
                      background: selectedSolicitud.monto_gastado >= selectedSolicitud.monto_otorgado ? 'rgba(16, 185, 129, 0.12)' : 'rgba(99, 102, 241, 0.12)',
                      padding: '3px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    {selectedSolicitud.monto_otorgado > 0
                      ? Math.min(Math.round((selectedSolicitud.monto_gastado / selectedSolicitud.monto_otorgado) * 100), 100)
                      : 0}% Justificado
                  </span>
                </div>

                {/* Progress bar */}
                <div className="progress-track" style={{ height: '8px', marginBottom: '14px' }}>
                  <div
                    className={`progress-fill ${selectedSolicitud.monto_gastado >= selectedSolicitud.monto_otorgado ? 'accent' : ''}`}
                    style={{
                      width: `${selectedSolicitud.monto_otorgado > 0
                        ? Math.min(Math.round((selectedSolicitud.monto_gastado / selectedSolicitud.monto_otorgado) * 100), 100)
                        : 0}%`,
                    }}
                  />
                </div>

                {/* 3 Metric Pills */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                  <div style={{ background: 'var(--bg-surface)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--bg-border)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Monto Otorgado</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                      {selectedSolicitud.monto_otorgado.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {selectedSolicitud.moneda}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-surface)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--bg-border)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Total Justificado</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--rendy-accent)', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                      {selectedSolicitud.monto_gastado.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {selectedSolicitud.moneda}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-surface)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--bg-border)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Restante</div>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere',
                        color: selectedSolicitud.monto_otorgado - selectedSolicitud.monto_gastado > 0 ? 'var(--rendy-warning)' : 'var(--rendy-accent)',
                      }}
                    >
                      {Math.max(0, selectedSolicitud.monto_otorgado - selectedSolicitud.monto_gastado).toLocaleString('es-VE', { minimumFractionDigits: 2 })} {selectedSolicitud.moneda}
                    </div>
                  </div>
                </div>
              </div>

              {/* Title of Section */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Gastos Justificados ({selectedSolicitud.gastos.length})
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Registrados vía WhatsApp
                </div>
              </div>

              {/* List of expenses */}
              {selectedSolicitud.gastos.length === 0 ? (
                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px dashed var(--bg-border)',
                    borderRadius: '12px',
                    padding: '36px 20px',
                    textAlign: 'center',
                  }}
                >
                  <FileQuestion size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    Sin comprobantes asociados todavía
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '340px', margin: '0 auto' }}>
                    Cuando el empleado rinda viáticos enviando fotos de sus facturas al bot de WhatsApp y seleccione este viático, aparecerán listados aquí con su cálculo y comprobante.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {selectedSolicitud.gastos.map((gasto, idx) => {
                    const tieneConversion = gasto.tasa_cambio && gasto.tasa_cambio !== 1 && gasto.monto_convertido != null;

                    return (
                      <div
                        key={gasto.id || idx}
                        style={{
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--bg-border)',
                          borderRadius: '12px',
                          padding: '14px 16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          transition: 'border-color 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1 }}>
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                background: 'rgba(99, 102, 241, 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--rendy-primary-light)',
                                flexShrink: 0,
                                marginTop: '2px',
                              }}
                            >
                              <Tag size={16} />
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                                  {gasto.comercio}
                                </span>
                                <span
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    background: 'var(--bg-surface)',
                                    color: 'var(--text-accent)',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    border: '1px solid var(--bg-border)',
                                  }}
                                >
                                  {gasto.categoria}
                                </span>
                              </div>

                              {gasto.concepto && (
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                  {gasto.concepto}
                                </div>
                              )}

                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Calendar size={12} /> {gasto.fecha_gasto}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Amounts */}
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                              {gasto.monto.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {gasto.moneda}
                            </div>
                            {tieneConversion && (
                              <div style={{ fontSize: '11px', color: 'var(--rendy-accent)', marginTop: '2px' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Tasa {gasto.tasa_cambio} → </span>
                                <strong>{gasto.monto_convertido?.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {selectedSolicitud.moneda}</strong>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Comprobante Action Bar */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingTop: '8px',
                            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                          }}
                        >
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Deduce del viático:{' '}
                            <strong style={{ color: 'var(--text-primary)' }}>
                              {gasto.monto_efectivo.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {selectedSolicitud.moneda}
                            </strong>
                          </span>

                          <div>
                            {gasto.url_comprobante ? (
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  className="btn btn-sm"
                                  onClick={() =>
                                    setSelectedReceipt({
                                      url: gasto.url_comprobante!,
                                      comercio: gasto.comercio,
                                      montoStr: `${gasto.monto.toLocaleString('es-VE', { minimumFractionDigits: 2 })} ${gasto.moneda}`,
                                      fecha: gasto.fecha_gasto,
                                    })
                                  }
                                  style={{
                                    background: 'rgba(99, 102, 241, 0.15)',
                                    color: 'var(--rendy-primary-light)',
                                    border: '1px solid rgba(99, 102, 241, 0.3)',
                                    gap: '5px',
                                    padding: '4px 10px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <Eye size={12} /> Ver Factura
                                </button>
                                <a
                                  href={gasto.url_comprobante}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-ghost btn-sm"
                                  style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '6px' }}
                                  title="Abrir en pestaña nueva"
                                >
                                  <ExternalLink size={12} />
                                </a>
                              </div>
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                Sin imagen adjunta
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--bg-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--bg-elevated)',
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {selectedSolicitud.gastos.length} comprobante{selectedSolicitud.gastos.length !== 1 ? 's' : ''} justificado{selectedSolicitud.gastos.length !== 1 ? 's' : ''}
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setSelectedSolicitud(null)}
                style={{ padding: '8px 16px', borderRadius: '8px', fontWeight: 600 }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          LIGHTBOX MODAL: VISOR DE COMPROBANTE / FACTURA
          ========================================================= */}
      {selectedReceipt && (
        <DigitalInvoice
          selectedReceipt={selectedReceipt}
          setSelectedReceipt={setSelectedReceipt}
        />
        // <div
        //   style={{
        //     position: 'fixed',
        //     inset: 0,
        //     background: 'rgba(0, 0, 0, 0.88)',
        //     backdropFilter: 'blur(10px)',
        //     display: 'flex',
        //     alignItems: 'center',
        //     justifyContent: 'center',
        //     zIndex: 200,
        //     padding: '20px',
        //     animation: 'fadeIn 0.15s ease',
        //   }}
        //   onClick={() => setSelectedReceipt(null)}
        // >
        //   <div
        //     style={{
        //       background: 'var(--bg-surface)',
        //       border: '1px solid rgba(255, 255, 255, 0.15)',
        //       borderRadius: '16px',
        //       maxWidth: '650px',
        //       width: '100%',
        //       maxHeight: '92vh',
        //       display: 'flex',
        //       flexDirection: 'column',
        //       overflow: 'hidden',
        //       boxShadow: '0 30px 80px rgba(0, 0, 0, 0.9)',
        //     }}
        //     onClick={(e) => e.stopPropagation()}
        //   >
        //     {/* Header del Lightbox */}
        //     <div
        //       style={{
        //         padding: '14px 20px',
        //         borderBottom: '1px solid var(--bg-border)',
        //         display: 'flex',
        //         alignItems: 'center',
        //         justifyContent: 'space-between',
        //         background: 'var(--bg-elevated)',
        //       }}
        //     >
        //       <div>
        //         <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
        //           Factura / Comprobante: {selectedReceipt.comercio}
        //         </div>
        //         <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
        //           {selectedReceipt.montoStr} • {selectedReceipt.fecha}
        //         </div>
        //       </div>

        //       <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        //         <a
        //           href={selectedReceipt.url}
        //           target="_blank"
        //           rel="noopener noreferrer"
        //           className="btn btn-ghost btn-sm"
        //           style={{ gap: '6px', fontSize: '12px', padding: '6px 10px' }}
        //         >
        //           <ExternalLink size={13} /> Abrir original
        //         </a>
        //         <button
        //           onClick={() => setSelectedReceipt(null)}
        //           style={{
        //             background: 'transparent',
        //             border: 'none',
        //             color: 'var(--text-muted)',
        //             cursor: 'pointer',
        //             padding: '6px',
        //             borderRadius: '8px',
        //             display: 'flex',
        //             alignItems: 'center',
        //             justifyContent: 'center',
        //           }}
        //           aria-label="Cerrar comprobante"
        //         >
        //           <X size={20} />
        //         </button>
        //       </div>
        //     </div>

        //     {/* Receipt Image Display */}
        //     <div
        //       style={{
        //         flex: 1,
        //         overflowY: 'auto',
        //         display: 'flex',
        //         alignItems: 'center',
        //         justifyContent: 'center',
        //         padding: '16px',
        //         background: '#090b13',
        //       }}
        //     >
        //       {/* eslint-disable-next-line @next/next/no-img-element */}
        //       <img
        //         src={selectedReceipt.url}
        //         alt={`Comprobante ${selectedReceipt.comercio}`}
        //         style={{
        //           maxWidth: '100%',
        //           maxHeight: '72vh',
        //           objectFit: 'contain',
        //           borderRadius: '8px',
        //           boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
        //         }}
        //       />
        //     </div>
        //   </div>
        // </div>
      )}
    </>
  );
}
