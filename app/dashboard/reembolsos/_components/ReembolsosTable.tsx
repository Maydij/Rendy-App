'use client';

/**
 * @name ReembolsosTable
 * @description [UI Component]: High-performance table rendering personal reimbursement records,
 * supporting status transitions (Pendiente -> Procesado -> Transferido / Rechazado), dual proof inspection
 * (merchant invoice + bank transfer receipt), sticky header within scrollable viewport, portal-based
 * action menus that never clip inside overflow containers, and URL-driven server pagination.
 */

import React, { useState, useTransition, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Eye,
  CheckCircle2,
  SendHorizontal,
  XCircle,
  RotateCcw,
  Receipt,
  ReceiptText,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  ExternalLink,
} from 'lucide-react';
import type { ReembolsoItem, EstadoReembolso } from '@/lib/services/reembolsos.service';
import type { Gasto } from '@/lib/types/gasto';
import DigitalInvoice from '@/app/dashboard/gastos/digital-invoice';
import { useEscapeClose } from '@/lib/hooks/use-escape-close';
import { ModalRechazoReembolso } from './ModalRechazoReembolso';
import { ModalTransferirReembolso } from './ModalTransferirReembolso';
import {
  marcarReembolsoComoProcesadoAction,
  rechazarReembolsoAction,
  revertirEstadoReembolsoAction,
} from '../actions';

interface ReembolsosTableProps {
  data: ReembolsoItem[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

type ActionMenuState = {
  id: string;
  top: number;
  left: number;
  openUp: boolean;
};

const ACTION_MENU_ESTIMATED_HEIGHT = 168;

export function ReembolsosTable({
  data,
  totalCount,
  totalPages,
  currentPage,
  pageSize,
}: ReembolsosTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Receipt modal state (original invoice eReceipt)
  const [selectedGasto, setSelectedGasto] = useState<Gasto | null>(null);
  const handleCloseModal = useCallback(() => setSelectedGasto(null), []);
  useEscapeClose(handleCloseModal, selectedGasto !== null);

  // Transfer settlement modal state
  const [transferTarget, setTransferTarget] = useState<ReembolsoItem | null>(null);

  // Rejection modal state
  const [rejectionTarget, setRejectionTarget] = useState<ReembolsoItem | null>(null);

  // Action menu rendered via portal so overflow containers never clip it
  const [actionMenu, setActionMenu] = useState<ActionMenuState | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);

  // Feedback banner state
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const closeActionMenu = useCallback(() => setActionMenu(null), []);

  const openActionMenu = useCallback((id: string, anchor: HTMLElement) => {
    setActionMenu((prev) => {
      if (prev?.id === id) return null;

      const rect = anchor.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUp = spaceBelow < ACTION_MENU_ESTIMATED_HEIGHT && spaceAbove > spaceBelow;

      return {
        id,
        top: openUp ? rect.top - 6 : rect.bottom + 6,
        left: rect.right,
        openUp,
      };
    });
  }, []);

  // Keep menu usable: dismiss on scroll/resize so fixed coords never go stale
  useEffect(() => {
    if (!actionMenu) return;

    const dismiss = () => setActionMenu(null);
    const scrollEl = tableScrollRef.current;

    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss, true);
    scrollEl?.addEventListener('scroll', dismiss);

    return () => {
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('scroll', dismiss, true);
      scrollEl?.removeEventListener('scroll', dismiss);
    };
  }, [actionMenu]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  /**
   * @name handleMarcarProcesado
   * @description Advances an expense claim from 'PENDIENTE' to 'PROCESADO' and dispatches WhatsApp alert.
   */
  const handleMarcarProcesado = (item: ReembolsoItem) => {
    closeActionMenu();
    setFeedback(null);

    startTransition(async () => {
      const result = await marcarReembolsoComoProcesadoAction(item.id);

      if (result.success) {
        setFeedback({
          type: 'success',
          message: `Reembolso de ${item.comercio} marcado como PROCESADO. Notificación enviada a ${item.usuario.nombre}.`,
        });
        router.refresh();
      } else {
        setFeedback({
          type: 'error',
          message: result.error || 'No se pudo actualizar el estado.',
        });
      }
    });
  };

  /**
   * @name handleRechazarConfirm
   * @description Confirms expense invalidation with audit comment and notifies employee.
   */
  const handleRechazarConfirm = (motivo: string) => {
    if (!rejectionTarget) return;
    const target = rejectionTarget;
    setFeedback(null);

    startTransition(async () => {
      const result = await rechazarReembolsoAction({
        gastoId: target.id,
        motivo,
      });

      if (result.success) {
        setFeedback({
          type: 'success',
          message: `Reembolso de ${target.comercio} rechazado. Se informó al colaborador por WhatsApp.`,
        });
        setRejectionTarget(null);
        router.refresh();
      } else {
        setFeedback({
          type: 'error',
          message: result.error || 'No se pudo rechazar el reembolso.',
        });
      }
    });
  };

  /**
   * @name handleRevertirEstado
   * @description Restores an expense claim to a prior lifecycle state.
   */
  const handleRevertirEstado = (item: ReembolsoItem, nuevoEstado: EstadoReembolso) => {
    closeActionMenu();
    setFeedback(null);

    startTransition(async () => {
      const result = await revertirEstadoReembolsoAction({
        gastoId: item.id,
        nuevoEstado,
      });

      if (result.success) {
        setFeedback({
          type: 'success',
          message: `Estado de ${item.comercio} revertido a ${nuevoEstado}.`,
        });
        router.refresh();
      } else {
        setFeedback({
          type: 'error',
          message: result.error || 'No se pudo revertir el estado.',
        });
      }
    });
  };

  // Maps a ReembolsoItem into the universal Gasto contract for DigitalInvoice
  const openInvoiceModal = (r: ReembolsoItem) => {
    const gastoAdapted: Gasto = {
      id: r.id,
      empleado: r.usuario.nombre,
      categoria: r.categoria,
      comercio: r.comercio,
      monto: r.monto,
      moneda: r.moneda,
      tasa_cambio: r.tasa_cambio,
      monto_convertido: r.monto_usd,
      moneda_viatico: 'USD',
      fecha_gasto: r.fecha_gasto,
      creado_en: r.creado_en,
      proyecto: 'Reembolso Personal',
      metodo_pago: 'Fondos Personales',
      estado: r.estado,
      url_comprobante: r.url_comprobante,
      concepto: r.concepto,
      datos_ocr: (r.datos_ocr as Record<string, unknown>) || undefined,
      moneda_original: r.moneda,
      origen_tasa: r.origen_tasa,
      base_imponible_ves: r.base_imponible_ves,
      iva_ves: r.iva_ves,
      exento_ves: r.exento_ves,
      igtf_ves: r.igtf_ves,
      monto_ves: r.monto_ves,
      monto_usd: r.monto_usd,
      rif_comercio: r.rif_comercio,
      numero_factura: r.numero_factura,
      requiere_revision_fiscal: r.requiere_revision_fiscal,
    };
    setSelectedGasto(gastoAdapted);
  };

  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (parts[0] ? parts[0].substring(0, 2) : 'US').toUpperCase();
  };

  const formatNumber = (num: number): string =>
    num.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const activeMenuItem = actionMenu ? data.find((item) => item.id === actionMenu.id) ?? null : null;

  const renderActionMenuItems = (r: ReembolsoItem) => (
    <>
      {r.estado === 'PENDIENTE' && (
        <>
          <MenuActionButton
            icon={CheckCircle2}
            color="var(--rendy-primary-light)"
            label="Marcar Procesado"
            onClick={() => handleMarcarProcesado(r)}
            disabled={isPending}
          />
          <MenuActionButton
            icon={XCircle}
            color="var(--rendy-danger)"
            label="Rechazar Comprobante"
            onClick={() => {
              closeActionMenu();
              setRejectionTarget(r);
            }}
            disabled={isPending}
          />
        </>
      )}

      {r.estado === 'PROCESADO' && (
        <>
          <MenuActionButton
            icon={SendHorizontal}
            color="var(--rendy-accent)"
            label="Marcar Transferido"
            onClick={() => {
              closeActionMenu();
              setTransferTarget(r);
            }}
            disabled={isPending}
          />
          <MenuActionButton
            icon={RotateCcw}
            color="var(--text-secondary)"
            label="Revertir a Pendiente"
            onClick={() => handleRevertirEstado(r, 'PENDIENTE')}
            disabled={isPending}
          />
          <MenuActionButton
            icon={XCircle}
            color="var(--rendy-danger)"
            label="Rechazar Comprobante"
            onClick={() => {
              closeActionMenu();
              setRejectionTarget(r);
            }}
            disabled={isPending}
          />
        </>
      )}

      {r.estado === 'TRANSFERIDO' && (
        <MenuActionButton
          icon={RotateCcw}
          color="var(--text-secondary)"
          label="Revertir a Procesado"
          onClick={() => handleRevertirEstado(r, 'PROCESADO')}
          disabled={isPending}
        />
      )}

      {r.estado === 'RECHAZADO' && (
        <MenuActionButton
          icon={RotateCcw}
          color="var(--rendy-warning)"
          label="Reabrir a Pendiente"
          onClick={() => handleRevertirEstado(r, 'PENDIENTE')}
          disabled={isPending}
        />
      )}

      {!['PENDIENTE', 'PROCESADO', 'TRANSFERIDO', 'RECHAZADO'].includes(r.estado) && (
        <MenuActionButton
          icon={CheckCircle2}
          color="var(--rendy-primary-light)"
          label="Validar como Procesado"
          onClick={() => handleMarcarProcesado(r)}
          disabled={isPending}
        />
      )}
    </>
  );

  return (
    <>
      {/* Portal menu: escapes table overflow so it never clips across filters/pages */}
      {actionMenu &&
        activeMenuItem &&
        createPortal(
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'transparent' }}
              onClick={closeActionMenu}
              aria-hidden
            />
            <div
              role="menu"
              style={{
                position: 'fixed',
                top: actionMenu.top,
                left: actionMenu.left,
                transform: actionMenu.openUp ? 'translate(-100%, -100%)' : 'translateX(-100%)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--bg-border)',
                borderRadius: '10px',
                padding: '6px',
                minWidth: '200px',
                zIndex: 100,
                boxShadow: '0 12px 36px rgba(0,0,0,0.7)',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                textAlign: 'left',
              }}
            >
              {renderActionMenuItems(activeMenuItem)}
            </div>
          </>,
          document.body
        )}

      {/* Feedback Alert */}
      {feedback && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background:
              feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: feedback.type === 'success' ? 'var(--rendy-accent)' : 'var(--rendy-danger)',
            border:
              feedback.type === 'success'
                ? '1px solid rgba(16, 185, 129, 0.3)'
                : '1px solid rgba(239, 68, 68, 0.3)',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>
      )}

      {/* Main Table Card */}
      <div className="card" style={{ position: 'relative' }}>
        {data.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Receipt size={24} />
            </div>
            <div className="empty-state-title">No hay reembolsos coincidentes</div>
            <div className="empty-state-desc">
              No se encontraron comprobantes cubiertos con fondos personales para los filtros aplicados.
            </div>
          </div>
        ) : (
          /* Scrollable Container with Sticky Table Header */
          <div
            ref={tableScrollRef}
            style={{
              maxHeight: '650px',
              overflowY: 'auto',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              position: 'relative',
            }}
          >
            <table className="rendy-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 20,
                  background: 'var(--bg-surface)',
                  boxShadow: '0 1px 0 var(--bg-border)',
                }}
              >
                <tr>
                  <th style={{ background: 'var(--bg-surface)', position: 'sticky', top: 0, zIndex: 20 }}>Empleado</th>
                  <th style={{ background: 'var(--bg-surface)', position: 'sticky', top: 0, zIndex: 20 }}>Fecha</th>
                  <th style={{ background: 'var(--bg-surface)', position: 'sticky', top: 0, zIndex: 20 }}>Comercio / Factura</th>
                  <th style={{ background: 'var(--bg-surface)', position: 'sticky', top: 0, zIndex: 20 }}>Categoría</th>
                  <th style={{ background: 'var(--bg-surface)', position: 'sticky', top: 0, zIndex: 20 }}>Importe</th>
                  <th style={{ background: 'var(--bg-surface)', position: 'sticky', top: 0, zIndex: 20 }}>Estado</th>
                  <th style={{ background: 'var(--bg-surface)', position: 'sticky', top: 0, zIndex: 20, textAlign: 'center' }}>
                    Comprobante
                  </th>
                  <th style={{ background: 'var(--bg-surface)', position: 'sticky', top: 0, zIndex: 20, textAlign: 'right' }}>
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => {
                  const initials = getInitials(r.usuario.nombre);

                  return (
                    <tr key={r.id}>
                      {/* Employee Info */}
                      <td style={{ verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: 'rgba(99, 102, 241, 0.2)',
                              color: 'var(--rendy-primary-light)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {initials}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                              {r.usuario.nombre}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {r.usuario.email || `+${r.usuario.telefono_whatsapp}`}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Date */}
                      <td style={{ verticalAlign: 'middle', whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {r.fecha_gasto}
                      </td>

                      {/* Merchant & Tax ID */}
                      <td style={{ verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                          {r.comercio}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {r.rif_comercio ? `RIF/ID: ${r.rif_comercio}` : ''}
                          {r.numero_factura ? ` • Fac: #${r.numero_factura}` : ''}
                          {!r.rif_comercio && !r.numero_factura ? 'Ticket general' : ''}
                        </div>
                      </td>

                      {/* Category */}
                      <td style={{ verticalAlign: 'middle' }}>
                        <span
                          style={{
                            background: 'var(--bg-elevated)',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: 'var(--text-accent)',
                            letterSpacing: '0.3px',
                          }}
                        >
                          {r.categoria}
                        </span>
                      </td>

                      {/* Amount: original receipt primary + USD conversion secondary */}
                      <td style={{ verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 700, color: 'var(--rendy-accent)', fontSize: '14px' }}>
                          {r.moneda === 'VES'
                            ? `${formatNumber(r.monto_ves || r.monto)} Bs`
                            : r.moneda === 'USD'
                              ? `$${formatNumber(r.monto)} USD`
                              : `${formatNumber(r.monto)} ${r.moneda}`}
                        </div>
                        {r.moneda !== 'USD' && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            ${formatNumber(r.monto_usd)} USD
                            {r.tasa_cambio ? ` • Tasa: ${formatNumber(r.tasa_cambio)}` : ''}
                          </div>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td style={{ verticalAlign: 'middle' }}>
                        <RenderStatusBadge estado={r.estado} comentarioRechazo={r.comentario_rechazo} />
                      </td>

                      {/* Dual Proof View Buttons */}
                      <td style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            justifyContent: 'center',
                          }}
                        >
                          {/* 1. Original Merchant Receipt / Invoice */}
                          <button
                            type="button"
                            onClick={() => openInvoiceModal(r)}
                            title="Inspeccionar factura fiscal y foto original"
                            style={{
                              background: 'var(--bg-elevated)',
                              border: '1px solid var(--bg-border)',
                              borderRadius: '8px',
                              padding: '5px 9px',
                              color: 'var(--text-accent)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontSize: '11px',
                              fontWeight: 600,
                              transition: 'background 150ms ease',
                            }}
                          >
                            <Eye size={13} />
                            <span>Factura</span>
                          </button>

                          {/* 2. Bank Transfer Receipt (if settled with transfer proof) */}
                          {r.estado === 'TRANSFERIDO' && r.url_comprobante_pago && (
                            <a
                              href={r.url_comprobante_pago}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Ver comprobante de transferencia bancaria"
                              style={{
                                background: 'rgba(16, 185, 129, 0.12)',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                borderRadius: '8px',
                                padding: '5px 9px',
                                color: 'var(--rendy-accent)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '11px',
                                fontWeight: 600,
                                textDecoration: 'none',
                                transition: 'background 150ms ease',
                              }}
                            >
                              <ReceiptText size={13} />
                              <span>Pago</span>
                              <ExternalLink size={10} style={{ opacity: 0.7 }} />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Action Menu trigger (menu itself is portaled to document.body) */}
                      <td style={{ verticalAlign: 'middle', textAlign: 'right' }}>
                        <button
                          type="button"
                          aria-haspopup="menu"
                          aria-expanded={actionMenu?.id === r.id}
                          onClick={(e) => openActionMenu(r.id, e.currentTarget)}
                          style={{
                            background: actionMenu?.id === r.id ? 'var(--bg-overlay)' : 'transparent',
                            border: '1px solid var(--bg-border)',
                            borderRadius: '8px',
                            padding: '6px 8px',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                          }}
                        >
                          <MoreVertical size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Server-Side Pagination Footer */}
        {totalCount > 0 && (
          <div
            style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--bg-border)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              fontSize: '13px',
              color: 'var(--text-secondary)',
            }}
          >
            <div>
              Mostrando{' '}
              <strong style={{ color: 'var(--text-primary)' }}>
                {(currentPage - 1) * pageSize + 1}
              </strong>{' '}
              a{' '}
              <strong style={{ color: 'var(--text-primary)' }}>
                {Math.min(currentPage * pageSize, totalCount)}
              </strong>{' '}
              de <strong style={{ color: 'var(--text-primary)' }}>{totalCount}</strong> reembolsos
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1 || isPending}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--bg-border)',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  color: currentPage <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                  cursor: currentPage <= 1 || isPending ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <ChevronLeft size={14} />
                Anterior
              </button>

              <span style={{ padding: '0 8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Página {currentPage} de {totalPages}
              </span>

              <button
                type="button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages || isPending}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--bg-border)',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  color: currentPage >= totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                  cursor: currentPage >= totalPages || isPending ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                Siguiente
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Digital Receipt Modal (Original Invoice) */}
      {selectedGasto && (
        <DigitalInvoice gasto={selectedGasto} onClose={handleCloseModal} />
      )}

      {/* Transfer Settlement Modal (File Upload to Storage) */}
      <ModalTransferirReembolso
        item={transferTarget}
        onClose={() => setTransferTarget(null)}
        onSuccess={(msg) => {
          setTransferTarget(null);
          setFeedback({
            type: 'success',
            message: msg,
          });
          router.refresh();
        }}
      />

      {/* Rejection Comment Modal */}
      <ModalRechazoReembolso
        isOpen={rejectionTarget !== null}
        comercio={rejectionTarget?.comercio || ''}
        montoLabel={`$${rejectionTarget?.monto_usd.toFixed(2)} USD`}
        isPending={isPending}
        onClose={() => setRejectionTarget(null)}
        onConfirm={handleRechazarConfirm}
      />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Subcomponents & Helpers
 * ───────────────────────────────────────────────────────────── */

function RenderStatusBadge({
  estado,
  comentarioRechazo,
}: {
  estado: string;
  comentarioRechazo: string | null;
}) {
  switch (estado) {
    case 'PENDIENTE':
    case 'REQUIERE_APROBACION_ESPECIAL':
      return (
        <span className="badge pendiente">
          <span className="badge-dot" />
          Pendiente
        </span>
      );
    case 'PROCESADO':
    case 'APROBADO':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 10px',
            borderRadius: '20px',
            fontSize: '11px',
            fontWeight: 700,
            background: 'rgba(99, 102, 241, 0.15)',
            color: 'var(--rendy-primary-light)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--rendy-primary-light)' }} />
          Procesado
        </span>
      );
    case 'TRANSFERIDO':
      return (
        <span className="badge aprobado">
          <span className="badge-dot" />
          Transferido
        </span>
      );
    case 'RECHAZADO':
      return (
        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <span className="badge rechazado">
            <span className="badge-dot" />
            Rechazado
          </span>
          {comentarioRechazo && (
            <span
              title={comentarioRechazo}
              style={{
                fontSize: '10px',
                color: 'var(--rendy-danger)',
                marginTop: '3px',
                maxWidth: '120px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {comentarioRechazo}
            </span>
          )}
        </div>
      );
    default:
      return (
        <span className="badge pendiente">
          <span className="badge-dot" />
          {estado}
        </span>
      );
  }
}

function MenuActionButton({
  icon: Icon,
  color,
  label,
  onClick,
  disabled,
}: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  color: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '7px 10px',
        background: 'transparent',
        border: 'none',
        borderRadius: '6px',
        color: 'var(--text-primary)',
        fontSize: '12px',
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'background 120ms ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-overlay)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <Icon size={14} style={{ color }} />
      {label}
    </button>
  );
}
