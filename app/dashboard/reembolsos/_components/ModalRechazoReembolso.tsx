'use client';

/**
 * @name ModalRechazoReembolso
 * @description [UI Component]: Accessible modal allowing administrative users to provide
 * an explanatory audit reason when invalidating or rejecting an employee expense claim.
 */

import React, { useState, useCallback } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { useEscapeClose } from '@/lib/hooks/use-escape-close';

interface ModalRechazoReembolsoProps {
  isOpen: boolean;
  comercio: string;
  montoLabel: string;
  isPending: boolean;
  onClose: () => void;
  onConfirm: (motivo: string) => void;
}

export function ModalRechazoReembolso({
  isOpen,
  comercio,
  montoLabel,
  isPending,
  onClose,
  onConfirm,
}: ModalRechazoReembolsoProps) {
  const [motivo, setMotivo] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    if (isPending) return;
    setMotivo('');
    setErrorMsg(null);
    onClose();
  }, [isPending, onClose]);

  useEscapeClose(handleClose, isOpen);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivo.trim()) {
      setErrorMsg('Por favor especifica el motivo del rechazo para informar al empleado.');
      return;
    }
    setErrorMsg(null);
    onConfirm(motivo.trim());
  };

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
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '16px',
          maxWidth: '480px',
          width: '100%',
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 30px rgba(239, 68, 68, 0.15)',
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
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: 'var(--rendy-danger)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertCircle size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Rechazar Reembolso
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {comercio} • {montoLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isPending}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: isPending ? 'not-allowed' : 'pointer',
              padding: '4px',
              borderRadius: '6px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          <label
            htmlFor="motivo-rechazo"
            style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}
          >
            Motivo del rechazo <span style={{ color: 'var(--rendy-danger)' }}>*</span>
          </label>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
            Indica claramente la causa (ej. comprobante ilegible, gasto no autorizado o duplicado). Este comentario quedará registrado para auditoría.
          </p>
          <textarea
            id="motivo-rechazo"
            rows={4}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            disabled={isPending}
            placeholder="Escribe el motivo del rechazo aquí…"
            style={{
              width: '100%',
              background: 'var(--bg-base)',
              border: errorMsg ? '1px solid var(--rendy-danger)' : '1px solid var(--bg-border)',
              borderRadius: '8px',
              padding: '10px 12px',
              color: 'var(--text-primary)',
              fontSize: '13px',
              outline: 'none',
              resize: 'none',
            }}
          />
          {errorMsg && (
            <p style={{ color: 'var(--rendy-danger)', fontSize: '12px', marginTop: '6px' }}>
              {errorMsg}
            </p>
          )}

          {/* Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button
              type="button"
              onClick={handleClose}
              disabled={isPending}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--bg-border)',
                borderRadius: '8px',
                padding: '8px 16px',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isPending ? 'not-allowed' : 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              style={{
                background: 'var(--rendy-danger)',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isPending ? 'not-allowed' : 'pointer',
                opacity: isPending ? 0.7 : 1,
              }}
            >
              {isPending ? 'Rechazando…' : 'Confirmar Rechazo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

