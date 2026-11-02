'use client';

/**
 * @name ModalTransferirReembolso
 * @description [UI Component]: Modal allowing administrators to settle an employee reimbursement
 * by uploading a proof of payment (bank transfer screenshot/PDF) to Supabase Storage, marking it as
 * 'TRANSFERIDO', and triggering an automated WhatsApp notification.
 */

import React, { useState, useRef, useCallback } from 'react';
import { SendHorizontal, Upload, X, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { useEscapeClose } from '@/lib/hooks/use-escape-close';
import type { ReembolsoItem } from '@/lib/services/reembolsos.service';
import { subirComprobanteYTransferirAction } from '../actions';

interface ModalTransferirReembolsoProps {
  item: ReembolsoItem | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function ModalTransferirReembolso({
  item,
  onClose,
  onSuccess,
}: ModalTransferirReembolsoProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    setSelectedFile(null);
    setErrorMessage(null);
    onClose();
  }, [isSubmitting, onClose]);

  useEscapeClose(handleClose, item !== null);

  if (!item) return null;

  const handleFileChange = (file: File | null) => {
    setErrorMessage(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      setErrorMessage('El comprobante no debe superar los 5MB.');
      return;
    }

    const validMimes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/jpg',
      'application/pdf',
    ];
    if (!validMimes.includes(file.type)) {
      setErrorMessage('Formato no válido. Sube una imagen (JPG, PNG) o un PDF.');
      return;
    }

    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('gastoId', item.id);
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      const res = await subirComprobanteYTransferirAction(formData);

      if (res.success) {
        onSuccess(
          `Reembolso a ${item.usuario.nombre} marcado como Transferido. Se envió notificación por WhatsApp.`
        );
        handleClose();
      } else {
        setErrorMessage(res.error || 'No se pudo registrar la transferencia.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

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
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '18px',
          maxWidth: '520px',
          width: '100%',
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 30px rgba(16, 185, 129, 0.15)',
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
              <SendHorizontal size={18} strokeWidth={2.2} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Registrar Transferencia de Reembolso
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Liquidación contable para {item.usuario.nombre}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              padding: '4px',
              borderRadius: '6px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          {/* Summary Box */}
          <div
            style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--bg-border)',
              borderRadius: '12px',
              padding: '14px',
              marginBottom: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Comercio:</span>
              <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{item.comercio}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Monto a Liquidar:</span>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--rendy-accent)' }}>
                  ${formatNumber(item.monto_usd)} USD
                </span>
                {item.moneda !== 'USD' && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    ({formatNumber(item.monto)} {item.moneda})
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>WhatsApp Notificación:</span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                +{item.usuario.telefono_whatsapp}
              </span>
            </div>
          </div>

          {/* Upload Area */}
          <div style={{ marginBottom: '14px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '6px',
              }}
            >
              Comprobante de Transferencia Bancaria (Opcional)
            </label>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
              Adjunta la captura o constancia bancaria (PNG, JPG o PDF hasta 5MB) para respaldo contable y consulta del empleado.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              style={{ display: 'none' }}
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
            />

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: isDragOver
                  ? '2px dashed var(--rendy-accent)'
                  : '2px dashed var(--bg-border)',
                background: isDragOver ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-base)',
                borderRadius: '12px',
                padding: '20px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'border-color 150ms ease, background 150ms ease',
              }}
            >
              {selectedFile ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <FileText size={24} style={{ color: 'var(--rendy-accent)' }} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {selectedFile.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {(selectedFile.size / 1024).toFixed(1)} KB • Clic para cambiar
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: 'none',
                      borderRadius: '50%',
                      padding: '4px',
                      color: 'var(--rendy-danger)',
                      cursor: 'pointer',
                      marginLeft: '10px',
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                  <Upload size={22} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    Arrastra aquí el comprobante o haz clic para examinar
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    PNG, JPG, WEBP o PDF (Máx. 5MB)
                  </span>
                </div>
              )}
            </div>
          </div>

          {errorMessage && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: 'var(--rendy-danger)',
                fontSize: '12px',
                marginBottom: '14px',
              }}
            >
              <AlertCircle size={15} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--bg-border)',
                borderRadius: '8px',
                padding: '8px 16px',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--rendy-accent)',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 18px',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              <CheckCircle2 size={15} />
              {isSubmitting ? 'Procesando y Notificando…' : 'Confirmar Transferencia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

