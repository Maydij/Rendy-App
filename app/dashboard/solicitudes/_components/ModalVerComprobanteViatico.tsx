'use client';

/**
 * @name ModalVerComprobanteViatico
 * @description [UI Component]: Modal for viewing the attached bank transfer receipt (image or PDF)
 * for an approved travel allowance, displaying the banking reference and timestamp.
 */

import React, { useCallback } from 'react';
import { X, ExternalLink, Download, FileText, CheckCircle2 } from 'lucide-react';
import { useEscapeClose } from '@/lib/hooks/use-escape-close';
import type { SolicitudViaticoItem } from './ModalAprobarViatico';

interface ModalVerComprobanteViaticoProps {
  solicitud: SolicitudViaticoItem | null;
  onClose: () => void;
}

export function ModalVerComprobanteViatico({
  solicitud,
  onClose,
}: ModalVerComprobanteViaticoProps) {
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEscapeClose(handleClose, solicitud !== null);

  if (!solicitud || !solicitud.url_comprobante_transferencia) return null;

  const url = solicitud.url_comprobante_transferencia;
  const isPdf = /\.(pdf)($|\?)/i.test(url);
  const monedaStr = solicitud.moneda || 'USD';
  const montoDisplay = Number(solicitud.monto_aprobado ?? solicitud.monto_solicitado ?? 0);

  const formatNumber = (num: number) =>
    num.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 7, 15, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 250,
        padding: '16px',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--bg-border)',
          borderRadius: '18px',
          maxWidth: '680px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--bg-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-elevated)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--rendy-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={18} strokeWidth={2.2} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Comprobante de Transferencia Bancaria
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Viático #{solicitud.id.slice(0, 8)}… • {solicitud.empleado}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-sm"
              style={{ padding: '6px 10px', fontSize: '12px' }}
              title="Abrir en pestaña nueva"
            >
              <ExternalLink size={13} />
            </a>
            <a
              href={url}
              download
              className="btn btn-ghost btn-sm"
              style={{ padding: '6px 10px', fontSize: '12px' }}
              title="Descargar comprobante"
            >
              <Download size={13} />
            </a>
            <button
              type="button"
              onClick={handleClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Audit Details Bar */}
        <div
          style={{
            padding: '12px 20px',
            background: 'var(--bg-base)',
            borderBottom: '1px solid var(--bg-border)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
            fontSize: '12px',
          }}
        >
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Monto: </span>
            <strong style={{ color: 'var(--rendy-accent)' }}>
              {formatNumber(montoDisplay)} {monedaStr}
            </strong>
          </div>
          {solicitud.referencia_transferencia && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Referencia: </span>
              <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                {solicitud.referencia_transferencia}
              </strong>
            </div>
          )}
          {solicitud.fecha_transferencia && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Fecha: </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {new Date(solicitud.fecha_transferencia).toLocaleString('es-VE')}
              </span>
            </div>
          )}
          {solicitud.notas_desembolso && (
            <div style={{ width: '100%', marginTop: '2px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Nota: </span>
              <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                {solicitud.notas_desembolso}
              </span>
            </div>
          )}
        </div>

        {/* Media Preview Viewport */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            background: '#090d16',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '340px',
          }}
        >
          {isPdf ? (
            <div style={{ width: '100%', height: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <iframe
                src={`${url}#toolbar=0`}
                title="Comprobante Bancario PDF"
                style={{
                  width: '100%',
                  height: '100%',
                  border: '1px solid var(--bg-border)',
                  borderRadius: '10px',
                  background: 'white',
                }}
              />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={`Comprobante de transferencia para ${solicitud.empleado}`}
              style={{
                maxWidth: '100%',
                maxHeight: '65vh',
                objectFit: 'contain',
                borderRadius: '12px',
                border: '1px solid var(--bg-border)',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.7)',
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--bg-border)',
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'var(--bg-elevated)',
          }}
        >
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
}
