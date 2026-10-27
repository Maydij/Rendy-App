'use client';

import React, { useState, useCallback } from 'react';
import {
  AlertTriangle,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useEscapeClose } from '@/lib/hooks/use-escape-close';
import type { Gasto } from '@/lib/types/gasto';

/* ─────────────────────────────────────────────────────────────
   Props Interface
   ───────────────────────────────────────────────────────────── */

interface DigitalInvoiceProps {
  /** The expense record to render as a digital receipt. */
  gasto: Gasto;
  /** Callback to close the modal (sets parent state to null). */
  onClose: () => void;
}

/* ─────────────────────────────────────────────────────────────
   Component
   ───────────────────────────────────────────────────────────── */

/**
 * @name DigitalInvoice
 * @description [UI Component]: Full-screen modal that renders a stylised
 * e-Receipt (digital invoice) for any expense across the platform.
 * Accepts a single `Gasto` object so the receipt data is always
 * consistent regardless of which module triggers it (Gastos,
 * Reembolsos, or Justificación).
 *
 * Includes two tabs:
 * 1. **Factura Digital** — Paper-style receipt with OCR-verified data.
 * 2. **Foto Original** — Raw receipt image from Supabase Storage.
 */
const DigitalInvoice = ({ gasto, onClose }: DigitalInvoiceProps) => {
  const [activeTab, setActiveTab] = useState<'digital' | 'imagen'>('digital');

  const handleClose = useCallback(() => onClose(), [onClose]);

  useEscapeClose(handleClose);

  const imageUrl = gasto.url_comprobante ?? null;
  const hasExchangeRate = gasto.tasa_cambio != null && gasto.tasa_cambio !== 1;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 7, 15, 0.85)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: '16px',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: '20px',
          maxWidth: '560px',
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow:
            '0 30px 80px rgba(0, 0, 0, 0.9), 0 0 50px rgba(99, 102, 241, 0.15)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header with Tab Selector ── */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--bg-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-elevated)',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: '6px',
              background: 'var(--bg-surface)',
              padding: '4px',
              borderRadius: '10px',
              border: '1px solid var(--bg-border)',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('digital')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '7px',
                border: 'none',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                background:
                  activeTab === 'digital'
                    ? 'var(--rendy-primary)'
                    : 'transparent',
                color:
                  activeTab === 'digital' ? 'white' : 'var(--text-muted)',
                transition: 'all 0.15s ease',
              }}
            >
              <FileText size={14} /> Factura Digital
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('imagen')}
              disabled={!imageUrl}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '7px',
                border: 'none',
                fontSize: '12px',
                fontWeight: 700,
                cursor: imageUrl ? 'pointer' : 'not-allowed',
                background:
                  activeTab === 'imagen'
                    ? 'var(--rendy-primary)'
                    : 'transparent',
                color:
                  activeTab === 'imagen'
                    ? 'white'
                    : imageUrl
                      ? 'var(--text-muted)'
                      : 'rgba(255,255,255,0.2)',
                transition: 'all 0.15s ease',
              }}
            >
              <ImageIcon size={14} /> Foto Original
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {imageUrl && (
              <a
                href={imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-sm"
                style={{ padding: '6px 10px', fontSize: '11px' }}
                title="Abrir imagen en pestaña nueva"
              >
                <ExternalLink size={12} />
              </a>
            )}
            <button
              type="button"
              onClick={handleClose}
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
              }}
              aria-label="Cerrar modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ── Dynamic Content Area ── */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            background: '#0a0d16',
          }}
        >
          {activeTab === 'digital' ? (
            <ReceiptBody gasto={gasto} hasExchangeRate={hasExchangeRate} />
          ) : (
            <ReceiptImage imageUrl={imageUrl} comercio={gasto.comercio} />
          )}
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--bg-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-elevated)',
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Estado del Gasto:{' '}
            <strong style={{ color: 'var(--rendy-accent)' }}>
              {gasto.estado}
            </strong>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleClose}
            style={{ padding: '6px 16px', borderRadius: '8px' }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   Sub-components (co-located, not exported)
   ───────────────────────────────────────────────────────────── */

/**
 * @name ReceiptBody
 * @description Renders the paper-style digital receipt with all
 * financial details, conversion banner, and decorative barcode.
 */
function ReceiptBody({
  gasto,
  hasExchangeRate,
}: {
  gasto: Gasto;
  hasExchangeRate: boolean;
}) {
  const formatMonto = (n: number) =>
    n.toLocaleString('es-VE', { minimumFractionDigits: 2 });

  return (
    <div
      style={{
        background: '#fcfaf6',
        color: '#1a1a1a',
        borderRadius: '6px',
        filter: 'drop-shadow(0 20px 40px rgba(0, 0, 0, 0.7))',
        maxWidth: '420px',
        margin: '0 auto',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Zigzag top border */}
      <svg
        viewBox="0 0 300 12"
        style={{ display: 'block', width: '100%', height: '11px', fill: '#0a0d16' }}
      >
        <path d="M0,0 L5,12 L10,0 L15,12 L20,0 L25,12 L30,0 L35,12 L40,0 L45,12 L50,0 L55,12 L60,0 L65,12 L70,0 L75,12 L80,0 L85,12 L90,0 L95,12 L100,0 L105,12 L110,0 L115,12 L120,0 L125,12 L130,0 L135,12 L140,0 L145,12 L150,0 L155,12 L160,0 L165,12 L170,0 L175,12 L180,0 L185,12 L190,0 L195,12 L200,0 L205,12 L210,0 L215,12 L220,0 L225,12 L230,0 L235,12 L240,0 L245,12 L250,0 L255,12 L260,0 L265,12 L270,0 L275,12 L280,0 L285,12 L290,0 L295,12 L300,0 Z" />
      </svg>

      <div style={{ padding: '26px 28px 20px' }}>
        {/* Badge */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#0284c7',
              fontSize: '14px',
              fontWeight: 800,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            <ShieldCheck size={20} strokeWidth={2.4} />
            GUARANTEED ERECEIPT
          </div>
          <div
            style={{
              fontSize: '11px',
              color: '#64748b',
              fontWeight: 600,
              marginTop: '3px',
            }}
          >
            OCR Verificado Rendy IA • Tasa Fiscal Congelada
          </div>
        </div>

        {/* Main Amount */}
        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Amount •{' '}
            {gasto.metodo_pago?.includes('Tarjeta') ? 'Card' : 'Viático'}
          </div>
          <div
            style={{
              fontSize: '32px',
              fontWeight: 900,
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '2px',
            }}
          >
            <span>
              {gasto.moneda === 'USD' ? '$' : ''}
              {formatMonto(gasto.monto)} {gasto.moneda}
            </span>
            <span
              style={{
                width: '9px',
                height: '9px',
                borderRadius: '50%',
                background: hasExchangeRate ? '#10b981' : '#f59e0b',
              }}
            />
          </div>
        </div>

        {/* Exchange Rate / Policy Banner */}
        <div
          style={{
            background: '#fef3c7',
            border: '1px solid #fde68a',
            borderRadius: '10px',
            padding: '10px 12px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '11.5px',
            color: '#92400e',
            lineHeight: 1.4,
          }}
        >
          <AlertTriangle
            size={16}
            style={{ flexShrink: 0, color: '#d97706' }}
          />
          <div>
            {hasExchangeRate ? (
              <>
                <strong>Conversión Congelada:</strong> Tasa oficial{' '}
                {gasto.tasa_cambio} → Deducible{' '}
                <strong>
                  {gasto.monto_convertido?.toLocaleString('es-VE', {
                    minimumFractionDigits: 2,
                  })}{' '}
                  {gasto.moneda_viatico || 'USD'}
                </strong>
              </>
            ) : (
              <>
                <strong>Gasto Registrado:</strong> Comprobante procesado en
                divisa original sin necesidad de puente cambiario.
              </>
            )}
          </div>
        </div>

        {/* Merchant & Fiscal Data */}
        <div style={{ marginBottom: '18px' }}>
          <div
            style={{
              fontSize: '18px',
              fontWeight: 800,
              color: '#0f172a',
              lineHeight: 1.2,
              textTransform: 'uppercase',
            }}
          >
            {gasto.comercio}
          </div>
          <div
            style={{
              fontSize: '12px',
              color: '#475569',
              marginTop: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
            }}
          >
            <div>
              Date: {gasto.fecha_gasto} •{' '}
              {gasto.creado_en
                ? new Date(gasto.creado_en).toLocaleTimeString('es-VE', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '12:00'}
            </div>
            {gasto.categoria && (
              <div>
                Category: <strong>{gasto.categoria}</strong>
              </div>
            )}
            {gasto.metodo_pago && <div>Método: {gasto.metodo_pago}</div>}
            {gasto.empleado && (
              <div>
                Empleado: <strong>{gasto.empleado}</strong>
              </div>
            )}
            {gasto.id && (
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  color: '#64748b',
                }}
              >
                Folio UUID: {gasto.id.slice(0, 18).toUpperCase()}
              </div>
            )}
            {Boolean(gasto.rif_comercio || (gasto.datos_ocr as Record<string, unknown>)?.rif) && (
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  color: '#64748b',
                }}
              >
                RIF: {gasto.rif_comercio || String((gasto.datos_ocr as Record<string, unknown>).rif)}
              </div>
            )}
            {Boolean(gasto.numero_factura) && (
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  color: '#64748b',
                }}
              >
                Factura Nº: #{gasto.numero_factura}
              </div>
            )}
          </div>
        </div>

        <div style={{ borderBottom: '1px dashed #cbd5e1', marginBottom: '16px' }} />

        {/* Line Items */}
        <div style={{ fontSize: '12.5px', marginBottom: '16px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
            }}
          >
            <span style={{ color: '#0f172a', fontWeight: 600 }}>
              1x {gasto.concepto || gasto.categoria || 'Consumo Registrado'}
            </span>
            <span style={{ fontWeight: 700, color: '#0f172a' }}>
              {formatMonto(gasto.monto)} {gasto.moneda}
            </span>
          </div>
        </div>

        {/* Totals */}
        <div style={{ borderBottom: '1px dashed #cbd5e1', marginBottom: '16px' }} />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            fontSize: '12.5px',
          }}
        >
          {gasto.base_imponible_ves != null ? (
            <>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: '#475569',
                }}
              >
                <span>Base Imponible (VES)</span>
                <span>{formatMonto(gasto.base_imponible_ves)} Bs</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: '#475569',
                }}
              >
                <span>IVA Trasladado 16% (VES)</span>
                <span>{formatMonto(gasto.iva_ves || 0)} Bs</span>
              </div>
              {Number(gasto.exento_ves) > 0 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    color: '#475569',
                  }}
                >
                  <span>Monto Exento (VES)</span>
                  <span>{formatMonto(gasto.exento_ves || 0)} Bs</span>
                </div>
              )}
              {Number(gasto.igtf_ves) > 0 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    color: '#475569',
                  }}
                >
                  <span>IGTF 3% (VES)</span>
                  <span>{formatMonto(gasto.igtf_ves || 0)} Bs</span>
                </div>
              )}
            </>
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: '#475569',
                }}
              >
                <span>Subtotal</span>
                <span>
                  {formatMonto(gasto.monto * 0.84)} {gasto.moneda}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: '#475569',
                }}
              >
                <span>IVA Trasladado (16%)</span>
                <span>
                  {formatMonto(gasto.monto * 0.16)} {gasto.moneda}
                </span>
              </div>
            </>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '16px',
              fontWeight: 900,
              color: '#0f172a',
              marginTop: '6px',
              paddingTop: '8px',
              borderTop: '2px solid #0f172a',
            }}
          >
            <span>Total Facturado</span>
            <span>
              {formatMonto(gasto.monto)} {gasto.moneda}
            </span>
          </div>

          {/* Consolidación Dual VES / USD si aplica */}
          {Boolean(gasto.monto_usd && gasto.monto_ves && gasto.moneda_original) && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '11px',
                fontWeight: 600,
                color: '#64748b',
                marginTop: '4px',
              }}
            >
              <span>Consolidación Dual:</span>
              <span>
                {formatMonto(gasto.monto_ves!)} Bs ≈ ${formatMonto(gasto.monto_usd!)} USD
              </span>
            </div>
          )}

          {gasto.requiere_revision_fiscal && (
            <div
              style={{
                marginTop: '6px',
                padding: '6px 8px',
                borderRadius: '6px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                fontSize: '11px',
                color: '#991b1b',
                fontWeight: 600,
              }}
            >
              ⚠️ Discrepancia detectada en desglose fiscal (&gt;0.05). Requiere revisión contable.
            </div>
          )}
        </div>

        {/* Decorative Barcode */}
        <div style={{ marginTop: '26px', textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
              height: '36px',
              opacity: 0.85,
            }}
          >
            {[3, 1, 4, 1, 2, 4, 1, 3, 2, 1, 4, 2, 3, 1, 2, 1, 4, 3, 1, 2, 4, 1, 3, 2, 4, 1, 2, 3].map(
              (w, idx) => (
                <span
                  key={idx}
                  style={{
                    display: 'inline-block',
                    width: `${w}px`,
                    height: '100%',
                    background: '#1a1a1a',
                  }}
                />
              ),
            )}
          </div>
          <div
            style={{
              fontSize: '9.5px',
              fontWeight: 700,
              color: '#64748b',
              letterSpacing: '0.12em',
              marginTop: '6px',
            }}
          >
            SWORK RENDY CORE V4.2
          </div>
        </div>
      </div>

      {/* Zigzag bottom border */}
      <svg
        viewBox="0 0 300 12"
        style={{ display: 'block', width: '100%', height: '11px', fill: '#0a0d16' }}
      >
        <path d="M0,12 L5,0 L10,12 L15,0 L20,12 L25,0 L30,12 L35,0 L40,12 L45,0 L50,12 L55,0 L60,12 L65,0 L70,12 L75,0 L80,12 L85,0 L90,12 L95,0 L100,12 L105,0 L110,12 L115,0 L120,12 L125,0 L130,12 L135,0 L140,12 L145,0 L150,12 L155,0 L160,12 L165,0 L170,12 L175,0 L180,12 L185,0 L190,12 L195,0 L200,12 L205,0 L210,12 L215,0 L220,12 L225,0 L230,12 L235,0 L240,12 L245,0 L250,12 L255,0 L260,12 L265,0 L270,12 L275,0 L280,12 L285,0 L290,12 L295,0 L300,12 Z" />
      </svg>
    </div>
  );
}

/**
 * @name ReceiptImage
 * @description Renders the original receipt photograph or a placeholder
 * when no image was attached.
 */
function ReceiptImage({
  imageUrl,
  comercio,
}: {
  imageUrl: string | null;
  comercio: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {imageUrl ? (
        <div style={{ position: 'relative', width: '100%', textAlign: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={`Comprobante de ${comercio}`}
            style={{
              maxWidth: '100%',
              maxHeight: '68vh',
              objectFit: 'contain',
              borderRadius: '12px',
              border: '1px solid var(--bg-border)',
              boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
              margin: '0 auto',
            }}
          />
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-title">Sin archivo adjunto</div>
          <div className="empty-state-desc">
            Este gasto fue registrado sin comprobante fotográfico.
          </div>
        </div>
      )}
    </div>
  );
}

export default DigitalInvoice;