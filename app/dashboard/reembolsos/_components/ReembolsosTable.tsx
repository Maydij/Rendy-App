'use client';

/**
 * @name ReembolsosTable
 * @description [UI Component]: Stitch Split-View Master-Detail workspace rendering corporate
 * reimbursement claims. Features high-density interactive cards on the left (`xl:col-span-7`)
 * with server-side pagination, paired with a sticky Audit & Settlement Inspector (`xl:col-span-5`),
 * quick portal action menus, digital e-receipt modal (`DigitalInvoice`), and proof upload modals.
 */

import React, { useState, useTransition, useCallback, useEffect, useRef, useMemo } from 'react';
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
  InspectorStatusPill,
  ReembolsoInspectorPanel,
} from './ReembolsoInspectorPanel';
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
  userRole?: 'ADMIN' | 'EMPLOYEE';
}

type ActionMenuState = {
  id: string;
  top: number;
  left: number;
  openUp: boolean;
};

const ACTION_MENU_ESTIMATED_HEIGHT = 168;

function formatNumber(num: number, locale: string = 'es-VE'): string {
  return Number(num || 0).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0] ? parts[0].substring(0, 2) : 'US').toUpperCase();
}

function mapReembolsoToGasto(r: ReembolsoItem): Gasto {
  return {
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
    pais_gasto: r.pais_gasto,
    estado_region: r.estado_region,
    ciudad: r.ciudad,
    codigo_postal: r.codigo_postal,
    tiene_sales_tax: r.tiene_sales_tax,
    subtotal_usd: r.subtotal_usd,
    sales_tax_usd: r.sales_tax_usd,
    propina_usd: r.propina_usd,
    nombre_impuesto_local: r.nombre_impuesto_local,
    tasa_impuesto_aplicada: r.tasa_impuesto_aplicada,
    impuesto_local_monto: r.impuesto_local_monto,
    subtotal_local: r.subtotal_local,
    folio_fiscal_uuid: r.folio_fiscal_uuid,
    tiene_validez_fiscal: r.tiene_validez_fiscal,
    tipo_documento: r.tipo_documento,
  };
}

export function ReembolsosTable({
  data,
  totalCount,
  totalPages,
  currentPage,
  pageSize,
  userRole = 'ADMIN',
}: ReembolsosTableProps) {
  const router = useRouter();
  const isEmployee = userRole === 'EMPLOYEE';
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Master-Detail active selection
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = useMemo(() => {
    if (selectedId) {
      const found = data.find((d) => d.id === selectedId);
      if (found) return found;
    }
    return data[0] ?? null;
  }, [data, selectedId]);

  // Original merchant receipt modal (`DigitalInvoice`)
  const [selectedGasto, setSelectedGasto] = useState<Gasto | null>(null);
  const handleCloseModal = useCallback(() => setSelectedGasto(null), []);
  useEscapeClose(handleCloseModal, selectedGasto !== null);

  // Transfer settlement & rejection modals
  const [transferTarget, setTransferTarget] = useState<ReembolsoItem | null>(null);
  const [rejectionTarget, setRejectionTarget] = useState<ReembolsoItem | null>(null);

  // Portal action menu
  const [actionMenu, setActionMenu] = useState<ActionMenuState | null>(null);

  // Feedback banner/toast state
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const showFeedback = useCallback((type: 'success' | 'error', message: string) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setFeedback({ type, message });
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), 4500);
  }, []);

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

  // Dismiss floating portal menu on scroll/resize
  useEffect(() => {
    if (!actionMenu) return;
    const dismiss = () => setActionMenu(null);
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss, true);
    return () => {
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('scroll', dismiss, true);
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

  const handleMarcarProcesado = (item: ReembolsoItem) => {
    closeActionMenu();
    setFeedback(null);

    startTransition(async () => {
      const result = await marcarReembolsoComoProcesadoAction(item.id);
      if (result.success) {
        showFeedback(
          'success',
          `Reembolso de ${item.comercio} marcado como PROCESADO. Notificación enviada a ${item.usuario.nombre}.`
        );
        router.refresh();
      } else {
        showFeedback('error', result.error || 'No se pudo actualizar el estado.');
      }
    });
  };

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
        showFeedback(
          'success',
          `Reembolso de ${target.comercio} rechazado. Se informó al colaborador por WhatsApp.`
        );
        setRejectionTarget(null);
        router.refresh();
      } else {
        showFeedback('error', result.error || 'No se pudo rechazar el reembolso.');
      }
    });
  };

  const handleRevertirEstado = (item: ReembolsoItem, nuevoEstado: EstadoReembolso) => {
    closeActionMenu();
    setFeedback(null);

    startTransition(async () => {
      const result = await revertirEstadoReembolsoAction({
        gastoId: item.id,
        nuevoEstado,
      });

      if (result.success) {
        showFeedback('success', `Estado de ${item.comercio} revertido a ${nuevoEstado}.`);
        router.refresh();
      } else {
        showFeedback('error', result.error || 'No se pudo revertir el estado.');
      }
    });
  };

  const handleCopyText = useCallback(
    (text: string, label: string) => {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
        showFeedback('success', `${label} copiado al portapapeles.`);
      }
    },
    [showFeedback]
  );

  const handleSelectCard = (id: string) => {
    setSelectedId(id);
    if (typeof window !== 'undefined' && window.innerWidth < 1280) {
      document
        .getElementById('reembolso-inspector-panel')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleScrollToList = () => {
    if (typeof window !== 'undefined') {
      document
        .getElementById('reembolsos-master-list')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const listUsdSum = useMemo(
    () => data.reduce((acc, item) => acc + Number(item.monto_usd || 0), 0),
    [data]
  );

  const activeMenuItem = actionMenu ? data.find((item) => item.id === actionMenu.id) ?? null : null;

  const renderActionMenuItems = (r: ReembolsoItem) => (
    <>
      {r.estado === 'PENDIENTE' && (
        <>
          <MenuActionButton
            icon={CheckCircle2}
            color="var(--rendy-primary)"
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
          color="var(--rendy-primary)"
          label="Validar como Procesado"
          onClick={() => handleMarcarProcesado(r)}
          disabled={isPending}
        />
      )}
    </>
  );

  return (
    <>
      {/* Portal Floating Action Menu */}
      {actionMenu &&
        activeMenuItem &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[90] bg-transparent"
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
              }}
              className="z-[100] min-w-[210px] rounded-xl bg-surface-container-highest border border-outline-variant/40 p-1.5 shadow-2xl flex flex-col gap-0.5 text-left"
            >
              {renderActionMenuItems(activeMenuItem)}
            </div>
          </>,
          document.body
        )}

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs sm:text-sm font-medium flex items-center justify-between gap-3 border relative z-10 animate-in fade-in duration-150 ${
            feedback.type === 'success'
              ? 'bg-primary-container/15 text-primary border-primary/30'
              : 'bg-error-container/20 text-error border-error/30'
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-current hover:opacity-75 px-1 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Split-View Master-Detail Operational Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start relative z-10">
        {/* Left Column: High-Density Reimbursement Cards + Pagination */}
        <div id="reembolsos-master-list" className="xl:col-span-7 flex flex-col gap-3">
          {data.length === 0 ? (
            <div className="rounded-2xl bg-surface-container-low border border-outline-variant/30 p-10 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-surface-container-high flex items-center justify-center text-on-surface-variant">
                <Receipt className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-on-surface">
                No hay reembolsos coincidentes
              </h3>
              <p className="text-xs text-on-surface-variant max-w-sm">
                No se encontraron comprobantes cubiertos con fondos personales para los filtros aplicados.
              </p>
            </div>
          ) : (
            data.map((r) => {
              const initials = getInitials(r.usuario.nombre);
              const isSelected = selectedItem?.id === r.id;

              return (
                <div
                  key={r.id}
                  onClick={() => handleSelectCard(r.id)}
                  className={`group relative rounded-2xl p-4 transition-all cursor-pointer flex flex-col gap-3 ${
                    isSelected
                      ? 'bg-surface-container border-2 border-primary/50 shadow-[0_0_20px_rgba(0,229,153,0.12)]'
                      : 'bg-surface-container-low border border-outline-variant/30 hover:bg-surface-container hover:border-outline-variant/60 shadow-sm'
                  }`}
                >
                  {/* Top Row: Avatar, Collaborator, Merchant Info & Status Pill */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl border flex items-center justify-center text-xs font-bold shrink-0 ${
                          isSelected
                            ? 'bg-secondary/15 text-secondary border-secondary/30'
                            : 'bg-surface-container-highest text-primary border-primary/20'
                        }`}
                      >
                        {initials}
                      </div>

                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-xs sm:text-sm font-bold truncate ${
                              isSelected
                                ? 'text-primary'
                                : 'text-on-surface group-hover:text-primary transition-colors'
                            }`}
                          >
                            {r.usuario.nombre}
                          </span>
                          <span className="text-[11px] font-normal text-on-surface-variant truncate">
                            {r.usuario.email || `+${r.usuario.telefono_whatsapp}`}
                          </span>
                        </div>
                        <span className="text-[11px] text-on-surface-variant truncate mt-0.5">
                          Comercio:{' '}
                          <strong className="text-on-surface font-semibold">
                            {r.comercio}
                          </strong>
                          {r.rif_comercio ? ` · RIF: ${r.rif_comercio}` : ''}
                          {r.numero_factura ? ` · Fac: #${r.numero_factura}` : ''}
                          {!r.rif_comercio && !r.numero_factura ? ' · Ticket general' : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <InspectorStatusPill estado={r.estado} />
                      {!isEmployee && (
                        <button
                          type="button"
                          aria-haspopup="menu"
                          aria-expanded={actionMenu?.id === r.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            openActionMenu(r.id, e.currentTarget);
                          }}
                          className={`p-1.5 rounded-lg border border-outline-variant/30 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer ${
                            actionMenu?.id === r.id
                              ? 'bg-surface-container-highest text-on-surface'
                              : 'bg-surface-container hover:bg-surface-container-high'
                          }`}
                          title="Acciones rápidas"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Bottom Row: Category, Date, Amount & Inspection Buttons */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-outline-variant/25 flex-wrap gap-2.5 text-[11px] text-on-surface-variant">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md font-semibold bg-surface-container-high text-primary border border-outline-variant/30 truncate max-w-[150px]">
                        {r.categoria}
                      </span>
                      <span className="whitespace-nowrap">· {r.fecha_gasto}</span>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap shrink-0 ml-auto">
                      <div className="flex flex-col text-right">
                        <span className="text-sm font-bold text-secondary font-mono whitespace-nowrap">
                          {r.moneda === 'VES'
                            ? `${formatNumber(r.monto_ves || r.monto)} Bs`
                            : r.moneda === 'USD'
                            ? `$${formatNumber(r.monto, 'en-US')} USD`
                            : `${formatNumber(r.monto)} ${r.moneda}`}
                        </span>
                        {r.moneda !== 'USD' && (
                          <span className="text-[10px] text-on-surface-variant font-mono whitespace-nowrap">
                            ~${formatNumber(r.monto_usd, 'en-US')} USD
                            {r.tasa_cambio ? ` · Tasa: ${formatNumber(r.tasa_cambio)}` : ''}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedGasto(mapReembolsoToGasto(r));
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-primary-container text-on-primary-container hover:bg-primary-fixed shadow-sm'
                              : 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-outline-variant/30'
                          }`}
                          title="Inspeccionar factura digital y foto"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Auditar Factura</span>
                        </button>

                        {r.estado === 'TRANSFERIDO' && r.url_comprobante_pago && (
                          <a
                            href={r.url_comprobante_pago}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="px-2.5 py-1.5 rounded-lg bg-primary-container/15 border border-primary/30 text-primary hover:bg-primary-container/25 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                            title="Ver comprobante de transferencia bancaria"
                          >
                            <ReceiptText className="w-3.5 h-3.5" />
                            <span>Pago</span>
                            <ExternalLink className="w-3 h-3 opacity-75" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Server-Side Pagination Footer */}
          {totalCount > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-on-surface-variant text-xs">
              <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                <span className="font-medium text-on-surface">
                  Mostrando {(currentPage - 1) * pageSize + 1} a{' '}
                  {Math.min(currentPage * pageSize, totalCount)} de {totalCount}
                </span>
                <span className="text-outline-variant">·</span>
                <span>
                  Suma en página:{' '}
                  <strong className="text-secondary font-semibold font-mono">
                    ${formatNumber(listUsdSum, 'en-US')} USD
                  </strong>
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1 || isPending}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Anterior</span>
                </button>
                <span className="px-2.5 py-1 rounded-md bg-surface-container-high text-primary font-bold font-mono">
                  {currentPage}
                </span>
                <span className="px-1 text-on-surface-variant">de {totalPages}</span>
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages || isPending}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <span>Siguiente</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Sticky Detail & Settlement Inspector */}
        <ReembolsoInspectorPanel
          selectedItem={selectedItem}
          isEmployee={isEmployee}
          isPending={isPending}
          onOpenInvoiceModal={(item) => setSelectedGasto(mapReembolsoToGasto(item))}
          onMarcarProcesado={handleMarcarProcesado}
          onOpenTransferModal={setTransferTarget}
          onOpenRejectionModal={setRejectionTarget}
          onRevertirEstado={handleRevertirEstado}
          onCopyText={handleCopyText}
          onScrollToList={handleScrollToList}
        />
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
          showFeedback('success', msg);
          router.refresh();
        }}
      />

      {/* Rejection Comment Modal */}
      <ModalRechazoReembolso
        isOpen={rejectionTarget !== null}
        comercio={rejectionTarget?.comercio || ''}
        montoLabel={`$${(rejectionTarget?.monto_usd || 0).toFixed(2)} USD`}
        isPending={isPending}
        onClose={() => setRejectionTarget(null)}
        onConfirm={handleRechazarConfirm}
      />
    </>
  );
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
      className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-transparent hover:bg-surface-container-high text-on-surface text-xs font-medium text-left w-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
    >
      <Icon size={14} style={{ color }} />
      <span>{label}</span>
    </button>
  );
}
