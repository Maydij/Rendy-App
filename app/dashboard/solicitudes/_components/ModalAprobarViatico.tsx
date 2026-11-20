'use client';

/**
 * @name ModalAprobarViatico
 * @description [UI Component]: Modal for administrators to approve travel allowance requests
 * and attach bank transfer proofs (JPG, PNG, WEBP, PDF up to 5MB), enter banking references,
 * and optional disbursement notes with real-time employee notification via WhatsApp.
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  CheckCircle2,
  Upload,
  X,
  FileText,
  AlertCircle,
  Paperclip,
  Check,
  SendHorizontal,
} from 'lucide-react';
import { useEscapeClose } from '@/lib/hooks/use-escape-close';
import {
  aprobarSolicitudConComprobanteAction,
  adjuntarComprobanteTransferenciaPosteriorAction,
} from '../actions';

export interface SolicitudViaticoItem {
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
  url_comprobante_transferencia?: string | null;
  referencia_transferencia?: string | null;
  fecha_transferencia?: string | null;
  notas_desembolso?: string | null;
}

interface ModalAprobarViaticoProps {
  solicitud: SolicitudViaticoItem | null;
  mode: 'APROBACION' | 'SUBIR_COMPROBANTE';
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/jpg',
  'application/pdf',
];

export function ModalAprobarViatico({
  solicitud,
  mode,
  onClose,
  onSuccess,
}: ModalAprobarViaticoProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [referencia, setReferencia] = useState('');
  const [notas, setNotas] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setReferencia('');
    setNotas('');
    setErrorMessage(null);
    onClose();
  }, [isSubmitting, onClose, previewUrl]);

  useEscapeClose(handleClose, solicitud !== null);

  if (!solicitud) return null;

  const handleFileChange = (file: File | null) => {
    setErrorMessage(null);
    if (!file) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage('El comprobante no debe superar los 5MB.');
      return;
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setErrorMessage('Formato no válido. Solo se aceptan imágenes (JPG, PNG, WEBP) o documentos PDF.');
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
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

    if (mode === 'SUBIR_COMPROBANTE' && !selectedFile) {
      setErrorMessage('Debes adjuntar el comprobante bancario para continuar.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('solicitudId', solicitud.id);
      if (selectedFile) {
        formData.append('file', selectedFile);
      }
      if (referencia.trim()) {
        formData.append('referenciaTransferencia', referencia.trim());
      }
      if (notas.trim()) {
        formData.append('notasDesembolso', notas.trim());
      }

      if (mode === 'APROBACION') {
        const res = await aprobarSolicitudConComprobanteAction(formData);
        if (res.success) {
          const msg = selectedFile
            ? `✅ Viático para ${solicitud.empleado} aprobado y transferido. Se envió el comprobante por WhatsApp.`
            : `✅ Viático para ${solicitud.empleado} aprobado. Pendiente de comprobante de transferencia.`;
          onSuccess(msg);
          handleClose();
        } else {
          setErrorMessage(res.error || 'No se pudo aprobar la solicitud.');
        }
      } else {
        const res = await adjuntarComprobanteTransferenciaPosteriorAction(formData);
        if (res.success) {
          onSuccess(`✅ Comprobante de transferencia adjuntado y enviado por WhatsApp a ${solicitud.empleado}.`);
          handleClose();
        } else {
          setErrorMessage(res.error || 'No se pudo adjuntar el comprobante.');
        }
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

  const isApprovalMode = mode === 'APROBACION';
  const hasFile = Boolean(selectedFile);
  const monedaStr = solicitud.moneda || 'USD';
  const montoDisplay = Number(solicitud.monto_aprobado ?? solicitud.monto_solicitado ?? 0);

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
          border: '1px solid rgba(16, 185, 129, 0.35)',
          borderRadius: '18px',
          maxWidth: '520px',
          width: '100%',
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 35px rgba(16, 185, 129, 0.15)',
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
              {isApprovalMode ? <Check size={18} strokeWidth={2.4} /> : <Paperclip size={18} strokeWidth={2.2} />}
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {isApprovalMode ? 'Aprobar Solicitud de Viáticos' : 'Adjuntar Comprobante de Transferencia'}
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {isApprovalMode ? `Desembolso para ${solicitud.empleado}` : `Soporte de pago para ${solicitud.empleado}`}
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
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Colaborador:</span>
              <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{solicitud.empleado}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Proyecto / Destino:</span>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{solicitud.proyecto}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {isApprovalMode ? 'Monto Solicitado:' : 'Monto Aprobado:'}
              </span>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--rendy-accent)' }}>
                  {formatNumber(montoDisplay)} {monedaStr}
                </span>
              </div>
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
                marginBottom: '4px',
              }}
            >
              Comprobante de Transferencia Bancaria {isApprovalMode ? '(Opcional)' : '(Requerido)'}
            </label>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
              {isApprovalMode
                ? 'Puedes adjuntarlo ahora para notificarlo de inmediato al empleado o aprobar y adjuntarlo luego.'
                : 'Sube la constancia o captura bancaria para enviar al colaborador vía WhatsApp y dejar respaldo contable.'}
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
                  : hasFile
                  ? '2px solid rgba(16, 185, 129, 0.4)'
                  : '2px dashed var(--bg-border)',
                background: isDragOver
                  ? 'rgba(16, 185, 129, 0.08)'
                  : hasFile
                  ? 'rgba(16, 185, 129, 0.04)'
                  : 'var(--bg-base)',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              {selectedFile ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                    {previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewUrl}
                        alt="Vista previa"
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '8px',
                          objectFit: 'cover',
                          border: '1px solid var(--bg-border)',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '8px',
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: 'var(--rendy-accent)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <FileText size={22} />
                      </div>
                    )}
                    <div style={{ textAlign: 'left', overflow: 'hidden' }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                        }}
                      >
                        {selectedFile.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {(selectedFile.size / 1024).toFixed(1)} KB • Clic para reemplazar
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFileChange(null);
                    }}
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '26px',
                      height: '26px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--rendy-danger)',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                    title="Quitar archivo"
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
                    JPG, PNG, WEBP o PDF (Máximo 5MB)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Complementary Fields: Reference & Notes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  marginBottom: '4px',
                }}
              >
                N° de Referencia Bancaria (Opcional)
              </label>
              <input
                type="text"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                placeholder="Ej. Zelle #982341, Ref. 00482910 o Transferencia #1289"
                style={{
                  width: '100%',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--bg-border)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  marginBottom: '4px',
                }}
              >
                Notas de Desembolso (Opcional)
              </label>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Ej. Transferido a la cuenta del empleado vía Banesco / Zelle registrado..."
                rows={2}
                style={{
                  width: '100%',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--bg-border)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
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
              className="btn btn-ghost"
              style={{ padding: '8px 16px', fontSize: '13px' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (!isApprovalMode && !selectedFile)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: hasFile ? 'var(--rendy-accent)' : 'var(--rendy-primary)',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 18px',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting || (!isApprovalMode && !selectedFile) ? 0.6 : 1,
                boxShadow: hasFile ? '0 4px 14px rgba(16, 185, 129, 0.35)' : 'none',
                transition: 'all 150ms ease',
              }}
            >
              {isSubmitting ? (
                <>
                  <SendHorizontal size={15} className="animate-spin" />
                  Procesando y Notificando…
                </>
              ) : hasFile ? (
                <>
                  <CheckCircle2 size={15} />
                  {isApprovalMode ? 'Aprobar y Enviar Comprobante' : 'Adjuntar y Enviar a Empleado'}
                </>
              ) : (
                <>
                  <Check size={15} />
                  Aprobar Solicitud
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
