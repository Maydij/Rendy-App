'use client';

import React, { useState, useCallback } from 'react';
import {
  AlertTriangle,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Printer,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useEscapeClose } from '@/lib/hooks/use-escape-close';
import type { Gasto } from '@/lib/types/gasto';

/* ─────────────────────────────────────────────────────────────
   Props Interface
   ───────────────────────────────────────────────────────────── */

interface DigitalInvoiceProps {
  /** The expense record to render as an adaptive digital receipt. */
  gasto: Gasto;
  /** Callback to close the modal (sets parent state to null). */
  onClose: () => void;
}

/* ─────────────────────────────────────────────────────────────
   Currency & Jurisdiction Helpers
   ───────────────────────────────────────────────────────────── */

/**
 * @name resolveEffectiveCurrency
 * @description [Business Logic]: Resolves the true operational currency of the receipt.
 * Defends against legacy database records where `moneda_original` was erroneously defaulted
 * to 'VES' by PostgreSQL migration 004 despite the transaction being in 'MXN', 'USD', or 'EUR'.
 */
export function resolveEffectiveCurrency(gasto: Gasto): string {
  const rawOcr = (gasto.datos_ocr || {}) as Record<string, unknown>;
  const ocrMoneda = ((rawOcr.moneda as string) || '').toUpperCase().trim();
  const directMoneda = (gasto.moneda || '').toUpperCase().trim();
  const origMoneda = (gasto.moneda_original || '').toUpperCase().trim();

  // 1. Direct explicit non-VES currency (e.g. MXN, USD, EUR, COP) takes precedence
  // over a legacy default 'VES' stored in moneda_original.
  if (directMoneda && directMoneda !== 'VES') {
    // If direct is USD, check if OCR or original proves it was a localized foreign currency (like MXN, EUR, COP)
    if (directMoneda === 'USD') {
      if (origMoneda && origMoneda !== 'VES' && origMoneda !== 'USD') {
        return origMoneda;
      }
      if (ocrMoneda && ocrMoneda !== 'VES' && ocrMoneda !== 'USD') {
        return ocrMoneda;
      }
      return 'USD';
    }
    return directMoneda;
  }

  // 2. If direct currency is VES or empty, but OCR or original indicates a distinct foreign currency (like MXN)
  if (ocrMoneda && ocrMoneda !== 'VES') {
    return ocrMoneda;
  }
  if (origMoneda && origMoneda !== 'VES') {
    return origMoneda;
  }

  // 3. Check for Mexican RFC or indicators in OCR / merchant
  if (
    rawOcr.rfc ||
    gasto.rif_comercio?.match(/^[A-Z&Ñ]{3,4}\d{6}[A-V1-9][A-Z1-9][0-9A]$/i) ||
    (gasto.pais_gasto || '').toUpperCase() === 'MX' ||
    (rawOcr.pais as string)?.toUpperCase() === 'MX'
  ) {
    return 'MXN';
  }

  return directMoneda || origMoneda || 'VES';
}

/**
 * @name resolveJurisdiction
 * @description [Business Logic]: Determines the fiscal jurisdiction ('US' | 'VE' | 'MX' | 'OTRO')
 * for the expense. Reads persisted `pais_gasto` with intelligent fallback for legacy records.
 * Currency is treated as an inviolable constraint: MXN can never be VE, VES can never be MX/US.
 */
export function resolveJurisdiction(gasto: Gasto): 'US' | 'VE' | 'MX' | 'OTRO' {
  const rawOcr = (gasto.datos_ocr || {}) as Record<string, unknown>;
  const moneda = resolveEffectiveCurrency(gasto);
  const rawPais = (
    gasto.pais_gasto ||
    (rawOcr.pais_gasto as string) ||
    (rawOcr.pais as string) ||
    ''
  ).toUpperCase().trim();

  // 1. Inviolable Mexican Jurisdiction Axioms:
  // Mexican Pesos (MXN) or RFC is strictly Mexican jurisdiction (SAT / CFDI).
  if (
    moneda === 'MXN' ||
    rawPais === 'MX' ||
    rawPais === 'MEX' ||
    rawPais === 'MEXICO' ||
    Boolean(gasto.rif_comercio?.match(/^[A-Z&Ñ]{3,4}\d{6}[A-V1-9][A-Z1-9][0-9A]$/i)) ||
    Boolean(rawOcr.rfc)
  ) {
    return 'MX';
  }

  // 2. Inviolable Venezuelan Jurisdiction Axioms:
  // Venezuelan Bolivars (VES) is strictly Venezuelan jurisdiction (SENIAT).
  const hasSeniatRif = Boolean(gasto.rif_comercio?.match(/^[JVEGPjvegp]-?\d{7,9}-?\d?$/i));
  if (moneda === 'VES') {
    return 'VE';
  }

  // 3. Explicit USA jurisdiction
  if (rawPais === 'US' || rawPais === 'USA') {
    return 'US';
  }

  if (rawPais === 'OTRO') {
    return 'OTRO';
  }

  // 4. International non-USD currencies (EUR, COP, CLP, PEN, GBP, BRL, CAD, etc.)
  if (moneda && moneda !== 'USD' && moneda !== 'VES' && moneda !== 'MXN') {
    return 'OTRO';
  }

  // 5. USD currency resolution: distinguish between US and Venezuelan bimonetary invoices
  if (moneda === 'USD') {
    const hasVesFiscalData =
      Number(gasto.base_imponible_ves || 0) > 0 ||
      Number(gasto.iva_ves || 0) > 0 ||
      Number(gasto.igtf_ves || 0) > 0 ||
      Number(gasto.monto_ves || 0) > 0;

    // Only assign to Venezuela if there is verifiable SENIAT fiscal proof
    if (hasSeniatRif || (rawPais === 'VE' && hasVesFiscalData)) {
      return 'VE';
    }

    // Default to US for USD expenses
    return 'US';
  }

  // 6. Generic fallback: Only assign VE if there is explicit SENIAT RIF or genuine VES currency
  if (rawPais === 'VE' && (hasSeniatRif || moneda === 'VES')) {
    return 'VE';
  }

  return 'OTRO';
}

/* ─────────────────────────────────────────────────────────────
   Component
   ───────────────────────────────────────────────────────────── */

/**
 * @name DigitalInvoice
 * @description [UI Component]: Full-screen modal that renders a polymorphic,
 * country-adaptive digital receipt (e-Receipt) for any expense across the platform.
 * Supports USA (Sales Tax & State), Venezuela (SENIAT), Mexico (SAT/CFDI), and
 * International currencies without forcing hardcoded 16% IVA formulas.
 */
const DigitalInvoice = ({ gasto, onClose }: DigitalInvoiceProps) => {
  const [activeTab, setActiveTab] = useState<'digital' | 'imagen'>('digital');

  const handleClose = useCallback(() => onClose(), [onClose]);
  useEscapeClose(handleClose);

  const imageUrl =
    gasto.url_comprobante ??
    (gasto.datos_ocr as { url_comprobante?: string })?.url_comprobante ??
    null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn"
      onClick={handleClose}
    >
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-digital-receipt,
          #printable-digital-receipt * {
            visibility: visible;
          }
          #printable-digital-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            filter: none !important;
            box-shadow: none !important;
          }
        }
      `}</style>

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
        {/* ── Header with Tab Selector & Actions ── */}
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
            <button
              type="button"
              onClick={handlePrint}
              className="btn btn-ghost btn-sm"
              style={{ padding: '6px 10px', fontSize: '11px' }}
              title="Imprimir o guardar como PDF"
            >
              <Printer size={13} />
            </button>
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
            <ReceiptBody gasto={gasto} />
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
 * @description Renders the paper-style digital receipt with polymorphic
 * layout adapting to the expense's fiscal jurisdiction (US, VE, MX, OTRO).
 */
function ReceiptBody({ gasto }: { gasto: Gasto }) {
  const jurisdiccion = resolveJurisdiction(gasto);

  const formatVes = (n: number) =>
    n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatDec = (n: number) =>
    Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const hasExchangeRate = gasto.tasa_cambio != null && gasto.tasa_cambio > 0 && gasto.tasa_cambio !== 1;
  const monedaOriginal = resolveEffectiveCurrency(gasto);

  // ── USA Computed Amounts ──
  const salesTaxUsd = Number(gasto.sales_tax_usd || 0);
  const propinaUsd = Number(gasto.propina_usd || 0);
  const totalUsd = Number(gasto.monto_usd || (gasto.moneda === 'USD' ? gasto.monto : 0));
  const subtotalUsd = Number(
    gasto.subtotal_usd ||
    (totalUsd > 0 ? Math.max(0, totalUsd - salesTaxUsd - propinaUsd) : 0)
  );
  const tieneSalesTax = salesTaxUsd > 0 || Boolean(gasto.tiene_sales_tax);

  // ── Mexico & International Computed Amounts (with fallback to datos_ocr) ──
  const rawOcr = (gasto.datos_ocr || {}) as Record<string, unknown>;
  const impuestoLocalMonto = Number(
    gasto.impuesto_local_monto ??
    (rawOcr.impuesto_local_monto != null
      ? rawOcr.impuesto_local_monto
      : rawOcr.iva != null && Number(rawOcr.iva) > 0
      ? rawOcr.iva
      : 0)
  );
  const subtotalLocal = Number(
    gasto.subtotal_local ??
    (rawOcr.subtotal_local != null
      ? rawOcr.subtotal_local
      : rawOcr.subtotal != null
      ? rawOcr.subtotal
      : null) ??
    Math.max(0, Number(gasto.monto || 0) - impuestoLocalMonto - propinaUsd)
  );
  const tasaImpuesto = Number(
    gasto.tasa_impuesto_aplicada ??
    (rawOcr.tasa_impuesto_aplicada != null
      ? rawOcr.tasa_impuesto_aplicada
      : impuestoLocalMonto > 0 && subtotalLocal > 0
      ? Math.round((impuestoLocalMonto / subtotalLocal) * 100)
      : 0)
  );

  // ── USA Location String ──
  const ubicacionUsa = [
    gasto.ciudad,
    gasto.estado_region,
    gasto.codigo_postal ? `ZIP ${gasto.codigo_postal}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div
      id="printable-digital-receipt"
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

      <div style={{ padding: '24px 26px 20px' }}>
        {/* ── Section A: Adaptive Header Badge & Status Pill ── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            marginBottom: '18px',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#0284c7',
              fontSize: '13px',
              fontWeight: 800,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            <ShieldCheck size={18} strokeWidth={2.4} />
            GUARANTEED ERECEIPT
          </div>

          {/* Dynamic Jurisdiction Badge & Status Pill */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              marginTop: '6px',
            }}
          >
            {jurisdiccion === 'US' && (
              <>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#334155',
                    background: '#e2e8f0',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                  }}
                >
                  🇺🇸 USA • {gasto.estado_region || 'USA'} {gasto.codigo_postal || ''}
                </span>
                {tieneSalesTax ? (
                  <span
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 800,
                      color: '#92400e',
                      background: '#fef3c7',
                      border: '1px solid #fde68a',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                    }}
                  >
                    CON TAX
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 800,
                      color: '#065f46',
                      background: '#d1fae5',
                      border: '1px solid #a7f3d0',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                    }}
                  >
                    SIN TAX ($0.00)
                  </span>
                )}
              </>
            )}

            {jurisdiccion === 'VE' && (
              <>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#334155',
                    background: '#e2e8f0',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                  }}
                >
                  🇻🇪 Venezuela • SENIAT
                </span>
                {gasto.tiene_validez_fiscal !== false && gasto.es_deducible_fiscal !== false ? (
                  <span
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 800,
                      color: '#065f46',
                      background: '#d1fae5',
                      border: '1px solid #a7f3d0',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                    }}
                  >
                    Factura Fiscal SENIAT
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 800,
                      color: '#92400e',
                      background: '#fef3c7',
                      border: '1px solid #fde68a',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                    }}
                  >
                    ⚠️ Sin Validez Fiscal ({gasto.tipo_documento === 'VOUCHER_POS' ? 'Voucher POS' : gasto.tipo_documento === 'NOTA_ENTREGA' ? 'Nota de Entrega' : 'Recibo'})
                  </span>
                )}
              </>
            )}

            {jurisdiccion === 'MX' && (
              <>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#334155',
                    background: '#e2e8f0',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                  }}
                >
                  🇲🇽 México • SAT
                </span>
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 800,
                    color: '#1e40af',
                    background: '#dbeafe',
                    border: '1px solid #bfdbfe',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                  }}
                >
                  {gasto.rif_comercio || (gasto.datos_ocr as Record<string, unknown>)?.rfc
                    ? `RFC: ${gasto.rif_comercio || (gasto.datos_ocr as Record<string, unknown>).rfc}`
                    : 'Comprobante Fiscal'}
                </span>
              </>
            )}

            {jurisdiccion === 'OTRO' && (
              <>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#334155',
                    background: '#e2e8f0',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                  }}
                >
                  🌍 Internacional • {monedaOriginal}
                </span>
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 800,
                    color: '#5b21b6',
                    background: '#ede9fe',
                    border: '1px solid #ddd6fe',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                  }}
                >
                  {monedaOriginal}
                </span>
              </>
            )}
          </div>

          <div
            style={{
              fontSize: '10.5px',
              color: '#64748b',
              fontWeight: 500,
              marginTop: '4px',
            }}
          >
            OCR Verificado Rendy IA • Desglose Fiscal Objetivo
          </div>
        </div>

        {/* ── Main Amount Display ── */}
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Amount • {gasto.metodo_pago?.includes('Tarjeta') ? 'Card' : 'Viático / Reembolso'}
          </div>
          <div
            style={{
              fontSize: '30px',
              fontWeight: 900,
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '2px',
            }}
          >
            {jurisdiccion === 'US' ? (
              <span>${formatDec(totalUsd || gasto.monto)} USD</span>
            ) : jurisdiccion === 'VE' ? (
              <span>Bs. {formatVes(gasto.monto_ves || gasto.monto)} VES</span>
            ) : jurisdiccion === 'MX' ? (
              <span>${formatDec(gasto.monto)} MXN</span>
            ) : (
              <span>{formatDec(gasto.monto)} {monedaOriginal}</span>
            )}
            <span
              style={{
                width: '9px',
                height: '9px',
                borderRadius: '50%',
                background: hasExchangeRate || jurisdiccion === 'US' ? '#10b981' : '#f59e0b',
              }}
            />
          </div>
        </div>

        {/* ── Exchange Rate / Policy Banner ── */}
        <div
          style={{
            background: '#fef3c7',
            border: '1px solid #fde68a',
            borderRadius: '10px',
            padding: '9px 12px',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '11px',
            color: '#92400e',
            lineHeight: 1.4,
          }}
        >
          <AlertTriangle size={15} style={{ flexShrink: 0, color: '#d97706' }} />
          <div>
            {jurisdiccion === 'US' ? (
              <>
                <strong>Jurisdicción USA:</strong> Comprobante procesado en USD bajo tributación estatal/local.
              </>
            ) : jurisdiccion === 'VE' && hasExchangeRate ? (
              <>
                <strong>Conversión Congelada:</strong> Tasa oficial Bs. {gasto.tasa_cambio} → Deducible{' '}
                <strong>
                  ${Number(gasto.monto_usd || gasto.monto_convertido || 0).toFixed(2)} USD
                </strong>
              </>
            ) : (jurisdiccion === 'MX' || monedaOriginal === 'MXN') && hasExchangeRate ? (
              <>
                <strong>Tipo de Cambio:</strong> 1 USD = ${Number(gasto.tasa_cambio).toFixed(4)} MXN → Deducible{' '}
                <strong>
                  ${Number(gasto.monto_usd || gasto.monto_convertido || 0).toFixed(2)} USD
                </strong>
              </>
            ) : monedaOriginal !== 'USD' && hasExchangeRate ? (
              <>
                <strong>Tipo de Cambio:</strong> 1 USD = {gasto.tasa_cambio} {monedaOriginal} → Deducible{' '}
                <strong>
                  ${Number(gasto.monto_usd || gasto.monto_convertido || 0).toFixed(2)} USD
                </strong>
              </>
            ) : (
              <>
                <strong>Gasto Registrado:</strong> Comprobante procesado en divisa original sin puente cambiario.
              </>
            )}
          </div>
        </div>

        {/* ── Section B: Merchant & Fiscal Identification Block (Strictly by Country) ── */}
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              fontSize: '17px',
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
              fontSize: '11.5px',
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

            {/* US Fiscal Identification: Location + Receipt # (NO RIF, NO N° Control) */}
            {jurisdiccion === 'US' && (
              <>
                {ubicacionUsa && (
                  <div>
                    📍 Ubicación: <strong>{ubicacionUsa}</strong>
                  </div>
                )}
                {Boolean(gasto.numero_factura) && (
                  <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>
                    Receipt / Doc #: #{gasto.numero_factura}
                  </div>
                )}
              </>
            )}

            {/* Venezuela Fiscal Identification: RIF, N° Factura, N° Control, Tasa BCV */}
            {jurisdiccion === 'VE' && (
              <>
                {gasto.tiene_validez_fiscal === false && (
                  <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600 }}>
                    ⚠️ Documento sin validez fiscal ({gasto.tipo_documento === 'VOUCHER_POS' ? 'Voucher de Punto de Venta' : gasto.tipo_documento === 'NOTA_ENTREGA' ? 'Nota de Entrega' : 'Recibo'})
                  </div>
                )}
                {Boolean(gasto.rif_comercio || (gasto.datos_ocr as Record<string, unknown>)?.rif) && (
                  <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>
                    RIF: {gasto.rif_comercio || String((gasto.datos_ocr as Record<string, unknown>).rif)}
                  </div>
                )}
                {Boolean(gasto.numero_factura) && (
                  <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>
                    Factura Nº: #{gasto.numero_factura}
                  </div>
                )}
                {Boolean(gasto.numero_control) && (
                  <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>
                    N° Control SENIAT: {gasto.numero_control}
                  </div>
                )}
                {Boolean(gasto.tasa_cambio) && (
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    Tasa Oficial BCV: Bs. {gasto.tasa_cambio}
                  </div>
                )}
              </>
            )}

            {/* Mexico Fiscal Identification: RFC, Folio / UUID CFDI */}
            {jurisdiccion === 'MX' && (
              <>
                {Boolean(gasto.rif_comercio || (gasto.datos_ocr as Record<string, unknown>)?.rfc) && (
                  <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>
                    RFC Emisor: {gasto.rif_comercio || String((gasto.datos_ocr as Record<string, unknown>).rfc)}
                  </div>
                )}
                {Boolean(gasto.folio_fiscal_uuid || gasto.numero_factura || (gasto.datos_ocr as Record<string, unknown>)?.folio_fiscal) && (
                  <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>
                    Folio Fiscal / UUID: {gasto.folio_fiscal_uuid || gasto.numero_factura || String((gasto.datos_ocr as Record<string, unknown>).folio_fiscal)}
                  </div>
                )}
                {Boolean(gasto.tasa_cambio) && (
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    Tipo de Cambio (MXN/USD): 1 USD = ${Number(gasto.tasa_cambio).toFixed(4)} MXN
                  </div>
                )}
              </>
            )}

            {/* Other International Countries */}
            {jurisdiccion === 'OTRO' && (
              <>
                {Boolean(gasto.folio_fiscal_uuid || gasto.numero_factura) && (
                  <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>
                    Doc / Ref #: {gasto.folio_fiscal_uuid || gasto.numero_factura}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div style={{ borderBottom: '1px dashed #cbd5e1', marginBottom: '14px' }} />

        {/* ── Line Items ── */}
        <div style={{ fontSize: '12px', marginBottom: '14px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#0f172a', fontWeight: 600 }}>
              1x {gasto.concepto || gasto.categoria || 'Consumo Registrado'}
            </span>
            <span style={{ fontWeight: 700, color: '#0f172a' }}>
              {jurisdiccion === 'US'
                ? `$${formatDec(totalUsd || gasto.monto)} USD`
                : jurisdiccion === 'VE'
                ? `Bs. ${formatVes(gasto.monto_ves || gasto.monto)}`
                : jurisdiccion === 'MX'
                ? `$${formatDec(gasto.monto)} MXN`
                : `${formatDec(gasto.monto)} ${monedaOriginal}`}
            </span>
          </div>
        </div>

        <div style={{ borderBottom: '1px dashed #cbd5e1', marginBottom: '14px' }} />

        {/* ── Section C: Totals Breakdown (Strictly Conditional by Jurisdiction) ── */}
        {jurisdiccion === 'US' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
              <span>Subtotal (Base)</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                ${formatDec(subtotalUsd)} USD
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
              <span>Sales Tax ({gasto.estado_region || 'USA'})</span>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  color: salesTaxUsd > 0 ? '#b45309' : '#047857',
                }}
              >
                ${formatDec(salesTaxUsd)} USD
              </span>
            </div>
            {propinaUsd > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                <span>Propina / Tip (No gravable)</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                  ${formatDec(propinaUsd)} USD
                </span>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '15px',
                fontWeight: 900,
                color: '#0f172a',
                marginTop: '6px',
                paddingTop: '8px',
                borderTop: '2px solid #0f172a',
              }}
            >
              <span>Total Pagado</span>
              <span style={{ fontFamily: 'monospace', color: '#0284c7' }}>
                ${formatDec(totalUsd || gasto.monto)} USD
              </span>
            </div>
          </div>
        )}

        {jurisdiccion === 'VE' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
              <span>Base Imponible</span>
              <span style={{ fontFamily: 'monospace' }}>
                Bs. {formatVes(Number(gasto.base_imponible_ves || 0))}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
              <span>Monto Exento</span>
              <span style={{ fontFamily: 'monospace' }}>
                Bs. {formatVes(Number(gasto.exento_ves || 0))}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
              <span>IVA (16%)</span>
              <span style={{ fontFamily: 'monospace' }}>
                Bs. {formatVes(Number(gasto.iva_ves || 0))}
              </span>
            </div>
            {Number(gasto.igtf_ves || 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                <span>IGTF (3%)</span>
                <span style={{ fontFamily: 'monospace' }}>
                  Bs. {formatVes(Number(gasto.igtf_ves))}
                </span>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '15px',
                fontWeight: 900,
                color: '#0f172a',
                marginTop: '6px',
                paddingTop: '8px',
                borderTop: '2px solid #0f172a',
              }}
            >
              <span>Total Factura (VES)</span>
              <span style={{ fontFamily: 'monospace' }}>
                Bs. {formatVes(Number(gasto.monto_ves || gasto.monto || 0))}
              </span>
            </div>
            {Number(gasto.monto_usd || 0) > 0 && Number(gasto.tasa_cambio || 0) > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  color: '#64748b',
                  marginTop: '4px',
                }}
              >
                <span>Equivalente USD (Tasa Bs. {Number(gasto.tasa_cambio).toFixed(2)})</span>
                <span style={{ fontFamily: 'monospace', color: '#047857', fontWeight: 700 }}>
                  ${formatDec(Number(gasto.monto_usd))} USD
                </span>
              </div>
            )}
          </div>
        )}

        {jurisdiccion === 'MX' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
              <span>Subtotal MXN</span>
              <span style={{ fontFamily: 'monospace' }}>
                ${formatDec(subtotalLocal)} MXN
              </span>
            </div>
            {impuestoLocalMonto > 0 ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                <span>
                  {gasto.nombre_impuesto_local || 'IVA Trasladado'}
                  {tasaImpuesto > 0 ? ` (${tasaImpuesto}%)` : ''}
                </span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                  ${formatDec(impuestoLocalMonto)} MXN
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '11px' }}>
                <span>IVA Trasladado</span>
                <span style={{ fontStyle: 'italic', fontFamily: 'monospace' }}>
                  Incluido en el total / No desglosado
                </span>
              </div>
            )}
            {propinaUsd > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                <span>Propina</span>
                <span style={{ fontFamily: 'monospace' }}>
                  ${formatDec(propinaUsd)} MXN
                </span>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '15px',
                fontWeight: 900,
                color: '#0f172a',
                marginTop: '6px',
                paddingTop: '8px',
                borderTop: '2px solid #0f172a',
              }}
            >
              <span>Total Factura (MXN)</span>
              <span style={{ fontFamily: 'monospace', color: '#0284c7' }}>
                ${formatDec(Number(gasto.monto || 0))} MXN
              </span>
            </div>
            {Number(gasto.monto_usd || 0) > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  color: '#64748b',
                  marginTop: '4px',
                }}
              >
                <span>Equivalente Deducible USD (Tasa ${Number(gasto.tasa_cambio || 0).toFixed(2)})</span>
                <span style={{ fontFamily: 'monospace', color: '#047857', fontWeight: 700 }}>
                  ${formatDec(Number(gasto.monto_usd))} USD
                </span>
              </div>
            )}
          </div>
        )}

        {jurisdiccion === 'OTRO' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
              <span>Subtotal</span>
              <span style={{ fontFamily: 'monospace' }}>
                {formatDec(subtotalLocal)} {monedaOriginal}
              </span>
            </div>
            {impuestoLocalMonto > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                <span>
                  {gasto.nombre_impuesto_local || 'Impuestos Locales'}
                  {tasaImpuesto > 0 ? ` (${tasaImpuesto}%)` : ''}
                </span>
                <span style={{ fontFamily: 'monospace' }}>
                  {formatDec(impuestoLocalMonto)} {monedaOriginal}
                </span>
              </div>
            )}
            {propinaUsd > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                <span>Propina</span>
                <span style={{ fontFamily: 'monospace' }}>
                  {formatDec(propinaUsd)} {monedaOriginal}
                </span>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '15px',
                fontWeight: 900,
                color: '#0f172a',
                marginTop: '6px',
                paddingTop: '8px',
                borderTop: '2px solid #0f172a',
              }}
            >
              <span>Total ({monedaOriginal})</span>
              <span style={{ fontFamily: 'monospace', color: '#0284c7' }}>
                {formatDec(Number(gasto.monto || 0))} {monedaOriginal}
              </span>
            </div>
            {monedaOriginal !== 'USD' && Number(gasto.monto_usd || 0) > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  color: '#64748b',
                  marginTop: '4px',
                }}
              >
                <span>Equivalente Referencial USD</span>
                <span style={{ fontFamily: 'monospace', color: '#047857', fontWeight: 700 }}>
                  ${formatDec(Number(gasto.monto_usd))} USD
                </span>
              </div>
            )}
          </div>
        )}

        {gasto.requiere_revision_fiscal && (
          <div
            style={{
              marginTop: '10px',
              padding: '6px 8px',
              borderRadius: '6px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              fontSize: '10.5px',
              color: '#991b1b',
              fontWeight: 600,
            }}
          >
            ⚠️ Discrepancia detectada en desglose fiscal. Requiere revisión contable.
          </div>
        )}

        {/* ── Decorative Barcode & Footer Branding ── */}
        <div style={{ marginTop: '22px', textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
              height: '32px',
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
              fontSize: '9px',
              fontWeight: 700,
              color: '#64748b',
              letterSpacing: '0.12em',
              marginTop: '5px',
            }}
          >
            SWORC RENDY GLOBAL E-RECEIPT ENGINE
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
