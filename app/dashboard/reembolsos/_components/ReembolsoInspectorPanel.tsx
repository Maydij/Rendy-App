'use client';

/**
 * @name ReembolsoInspectorPanel
 * @description [UI Component]: Right-hand sticky detail & settlement inspector panel displaying
 * net reimbursement payout in USD & original currency, employee profile, verified OCR tax fields,
 * interactive e-receipt (`DigitalInvoice`) launcher, 4-step audit timeline, and Admin actions.
 */

import React from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  ExternalLink,
  Landmark,
  Printer,
  ReceiptText,
  RotateCcw,
  SendHorizontal,
  Share2,
  ShieldAlert,
  ShieldCheck,
  User,
  X,
  XCircle,
} from 'lucide-react';
import type { EstadoReembolso, ReembolsoItem } from '@/lib/services/reembolsos.service';

interface ReembolsoInspectorPanelProps {
  selectedItem: ReembolsoItem | null;
  isEmployee: boolean;
  isPending: boolean;
  onOpenInvoiceModal: (item: ReembolsoItem) => void;
  onMarcarProcesado: (item: ReembolsoItem) => void;
  onOpenTransferModal: (item: ReembolsoItem) => void;
  onOpenRejectionModal: (item: ReembolsoItem) => void;
  onRevertirEstado: (item: ReembolsoItem, nuevoEstado: EstadoReembolso) => void;
  onCopyText: (text: string, label: string) => void;
  onScrollToList?: () => void;
}

function formatNum(value: number, locale: string = 'es-VE'): string {
  return Number(value || 0).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatNominalDisplay(item: ReembolsoItem): string {
  if (item.moneda === 'VES') {
    return `${formatNum(item.monto_ves || item.monto)} Bs`;
  }
  if (item.moneda === 'USD') {
    return `$${formatNum(item.monto, 'en-US')} USD`;
  }
  return `${formatNum(item.monto)} ${item.moneda}`;
}

export function InspectorStatusPill({ estado }: { estado: string }) {
  switch (estado) {
    case 'PENDIENTE':
    case 'REQUIERE_APROBACION_ESPECIAL':
    case 'REVISION_DUPLICADO':
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-tertiary-container/15 text-tertiary-fixed-dim inline-flex items-center gap-1.5 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-tertiary-container" />
          Pendiente
        </span>
      );
    case 'PROCESADO':
    case 'APROBADO':
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary-container/20 text-primary inline-flex items-center gap-1.5 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-primary-container" />
          Procesado
        </span>
      );
    case 'TRANSFERIDO':
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-secondary/20 text-secondary inline-flex items-center gap-1.5 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
          Transferido
        </span>
      );
    case 'RECHAZADO':
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-error-container/25 text-error inline-flex items-center gap-1.5 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-error" />
          Rechazado
        </span>
      );
    default:
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-surface-container-highest text-on-surface-variant inline-flex items-center gap-1.5 shrink-0">
          {estado}
        </span>
      );
  }
}

export function ReembolsoInspectorPanel({
  selectedItem,
  isEmployee,
  isPending,
  onOpenInvoiceModal,
  onMarcarProcesado,
  onOpenTransferModal,
  onOpenRejectionModal,
  onRevertirEstado,
  onCopyText,
  onScrollToList,
}: ReembolsoInspectorPanelProps) {
  if (!selectedItem) {
    return (
      <div
        id="reembolso-inspector-panel"
        className="xl:col-span-5 flex flex-col items-center justify-center text-center gap-3 rounded-2xl bg-surface-container-low p-8 shadow-xl min-h-[340px]"
      >
        <div className="w-12 h-12 rounded-2xl bg-surface-container-high flex items-center justify-center text-on-surface-variant">
          <ReceiptText className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-on-surface">
          Selecciona un reembolso
        </h3>
        <p className="text-xs text-on-surface-variant max-w-xs">
          Haz clic en cualquier comprobante de la lista para revisar sus datos fiscales, historial y gestionar su liquidación.
        </p>
      </div>
    );
  }

  const shortRef = selectedItem.numero_factura
    ? `FAC-${selectedItem.numero_factura}`
    : `REF-${selectedItem.id.slice(0, 6).toUpperCase()}`;
  const isPendiente =
    selectedItem.estado === 'PENDIENTE' ||
    selectedItem.estado === 'REQUIERE_APROBACION_ESPECIAL' ||
    selectedItem.estado === 'REVISION_DUPLICADO';
  const isProcesado =
    selectedItem.estado === 'PROCESADO' || selectedItem.estado === 'APROBADO';
  const isTransferido = selectedItem.estado === 'TRANSFERIDO';
  const isRechazado = selectedItem.estado === 'RECHAZADO';

  return (
    <div
      id="reembolso-inspector-panel"
      className="xl:col-span-5 xl:sticky xl:top-6 flex flex-col gap-4"
    >
      <div className="rounded-2xl bg-surface-container-low p-5 shadow-xl flex flex-col gap-4">
        {/* Inspector Header */}
        <div className="flex items-start justify-between gap-2 pb-3 border-b border-surface-container-highest/20 flex-wrap">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {onScrollToList && (
                <button
                  type="button"
                  onClick={onScrollToList}
                  className="xl:hidden inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-surface-container-high text-xs font-medium text-on-surface-variant hover:text-on-surface"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Lista</span>
                </button>
              )}
              <span className="text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold">
                Detalle de Reembolso
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-surface-container-highest text-primary font-mono font-bold">
                #{shortRef}
              </span>
            </div>
            <span className="text-[11px] text-on-surface-variant mt-1 font-mono truncate">
              ID: {selectedItem.id.slice(0, 13)}…
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <InspectorStatusPill estado={selectedItem.estado} />
            <button
              type="button"
              onClick={() => onCopyText(selectedItem.id, 'ID de reembolso')}
              className="w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
              title="Copiar ID"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') window.print();
              }}
              className="w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
              title="Imprimir"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                onCopyText(
                  `Reembolso #${shortRef} — ${selectedItem.usuario.nombre} | ${selectedItem.comercio}: $${formatNum(selectedItem.monto_usd, 'en-US')} USD (${selectedItem.estado})`,
                  'Resumen de reembolso'
                )
              }
              className="w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
              title="Compartir resumen"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Highlighted Net Reimbursement Amount */}
        <div className="p-4 rounded-xl bg-surface-container-lowest flex flex-col gap-1.5 relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full bg-primary-container/10 blur-xl pointer-events-none" />
          <span className="text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold">
            Monto Neto a Reembolsar
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl leading-none text-primary font-extrabold tracking-tight font-mono">
              ${formatNum(selectedItem.monto_usd, 'en-US')}
            </span>
            <span className="text-xs text-primary/80 font-bold">USD</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-[11px] text-on-surface-variant pt-2 border-t border-surface-container-highest/20 flex-wrap">
            <span className="font-semibold text-secondary font-mono">
              {formatNominalDisplay(selectedItem)}
            </span>
            {selectedItem.moneda !== 'USD' && selectedItem.tasa_cambio ? (
              <span>
                Tasa:{' '}
                <strong className="text-on-surface font-mono">
                  {formatNum(selectedItem.tasa_cambio)}
                </strong>{' '}
                {selectedItem.origen_tasa ? `(${selectedItem.origen_tasa})` : ''}
              </span>
            ) : (
              <span>Paridad directa 1:1 USD</span>
            )}
          </div>
        </div>

        {/* Collaborator Info Card */}
        <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-surface-container">
          <span className="text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-primary" />
            Datos del Solicitante
          </span>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-on-surface truncate">
                {selectedItem.usuario.nombre}
              </span>
              <span className="text-[11px] text-on-surface-variant truncate">
                WhatsApp: +{selectedItem.usuario.telefono_whatsapp}
              </span>
            </div>
            {selectedItem.usuario.email && (
              <span className="text-[11px] text-secondary font-mono truncate">
                {selectedItem.usuario.email}
              </span>
            )}
          </div>
        </div>

        {/* Validated Fiscal Metadata Card */}
        <div className="flex flex-col gap-2.5 p-3.5 rounded-xl bg-surface-container">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold flex items-center gap-1.5">
              {selectedItem.requiere_revision_fiscal ||
              selectedItem.tiene_validez_fiscal === false ? (
                <ShieldAlert className="w-4 h-4 text-tertiary-fixed-dim" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-secondary" />
              )}
              Datos Fiscales Validados
            </span>
            {selectedItem.requiere_revision_fiscal ||
            selectedItem.tiene_validez_fiscal === false ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-tertiary-container/20 text-tertiary-fixed-dim">
                Revisión Fiscal
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-primary">
                OCR Verificado
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] text-on-surface-variant">Comercio / Emisor</span>
              <span className="font-semibold text-on-surface truncate">
                {selectedItem.comercio}
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] text-on-surface-variant">RIF / Tax ID</span>
              <span className="font-mono font-semibold text-on-surface truncate">
                {selectedItem.rif_comercio || 'No especificado'}
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] text-on-surface-variant">Factura N°</span>
              <span className="font-mono font-semibold text-secondary truncate">
                {selectedItem.numero_factura ? `#${selectedItem.numero_factura}` : 'Ticket'}
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] text-on-surface-variant">Categoría / Fecha</span>
              <span className="font-semibold text-on-surface truncate">
                {selectedItem.categoria} · {selectedItem.fecha_gasto}
              </span>
            </div>
          </div>

          {/* Tax Subtotals if available (VES / USD Sales Tax / Local Tax) */}
          {(selectedItem.iva_ves != null ||
            selectedItem.sales_tax_usd != null ||
            selectedItem.impuesto_local_monto != null) && (
            <div className="pt-2 border-t border-surface-container-highest/20 flex items-center justify-between text-[11px] text-on-surface-variant flex-wrap gap-2">
              {selectedItem.iva_ves != null && (
                <span>
                  Base: <strong className="text-on-surface font-mono">{formatNum(selectedItem.base_imponible_ves || 0)} Bs</strong> · IVA:{' '}
                  <strong className="text-on-surface font-mono">{formatNum(selectedItem.iva_ves)} Bs</strong>
                </span>
              )}
              {selectedItem.sales_tax_usd != null && (
                <span>
                  Sales Tax:{' '}
                  <strong className="text-on-surface font-mono">
                    ${formatNum(selectedItem.sales_tax_usd, 'en-US')} USD
                  </strong>
                </span>
              )}
              {selectedItem.impuesto_local_monto != null && (
                <span>
                  {selectedItem.nombre_impuesto_local || 'Impuesto'}:{' '}
                  <strong className="text-on-surface font-mono">
                    {formatNum(selectedItem.impuesto_local_monto)} {selectedItem.moneda}
                  </strong>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Interactive Fiscal Receipt Preview Box */}
        <div className="p-3 rounded-xl bg-surface-container-lowest flex items-center justify-between gap-2 group hover:bg-surface-container transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary shrink-0">
              <ReceiptText className="w-5 h-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-on-surface truncate">
                Factura_{selectedItem.comercio.replace(/\s+/g, '_')}_{shortRef}
              </span>
              <span className="text-[11px] text-on-surface-variant truncate">
                {selectedItem.url_comprobante
                  ? 'Digitalizado vía Rendy OCR WhatsApp'
                  : 'Registro digital (sin imagen adjunta)'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenInvoiceModal(selectedItem)}
            className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-secondary hover:text-primary text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Ver Factura</span>
          </button>
        </div>

        {/* Transfer Receipt Banner if Transferred with Proof */}
        {isTransferido && selectedItem.url_comprobante_pago && (
          <div className="p-3 rounded-xl bg-primary-container/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <Landmark className="w-4 h-4 text-primary shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-primary truncate">
                  Comprobante de Pago Registrado
                </span>
                <span className="text-[11px] text-on-surface-variant truncate">
                  {selectedItem.fecha_transferencia
                    ? `Liquidado el ${selectedItem.fecha_transferencia.split('T')[0]}`
                    : 'Transferencia confirmada'}
                </span>
              </div>
            </div>
            <a
              href={selectedItem.url_comprobante_pago}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 rounded-lg bg-primary-container text-on-primary-container text-xs font-bold flex items-center gap-1 hover:bg-primary-fixed transition-colors shrink-0"
            >
              <span>Abrir Pago</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Rejection Comment Alert */}
        {isRechazado && selectedItem.comentario_rechazo && (
          <div className="p-3 rounded-xl bg-error-container/20 flex items-start gap-2.5">
            <XCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-error">Motivo del Rechazo</span>
              <span className="text-[11px] text-on-surface-variant mt-0.5">
                {selectedItem.comentario_rechazo}
              </span>
            </div>
          </div>
        )}

        {/* Step-by-Step Audit Timeline */}
        <div className="flex flex-col gap-2 pt-1">
          <span className="text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold">
            Progreso de Auditoría &amp; Flujo
          </span>
          <div className="relative pl-5 space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-outline-variant/40">
            {/* Step 1 */}
            <div className="relative flex items-start justify-between gap-2">
              <span className="absolute -left-5 top-0.5 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-surface-container-low" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-on-surface">
                  1. Factura Registrada vía WhatsApp
                </span>
                <span className="text-[11px] text-on-surface-variant truncate">
                  Cargado por {selectedItem.usuario.nombre}
                </span>
              </div>
              <span className="text-[11px] text-on-surface-variant shrink-0 font-mono">
                {selectedItem.fecha_gasto}
              </span>
            </div>

            {/* Step 2 */}
            <div className="relative flex items-start justify-between gap-2">
              <span
                className={`absolute -left-5 top-0.5 w-2.5 h-2.5 rounded-full ring-4 ring-surface-container-low ${
                  isPendiente
                    ? 'bg-tertiary-fixed-dim animate-pulse'
                    : isRechazado
                    ? 'bg-error'
                    : 'bg-primary'
                }`}
              />
              <div className="flex flex-col min-w-0">
                <span
                  className={`text-xs font-bold ${
                    isPendiente
                      ? 'text-tertiary-fixed-dim'
                      : isRechazado
                      ? 'text-error'
                      : 'text-on-surface'
                  }`}
                >
                  2. Aprobación Contable (Procesado)
                </span>
                <span className="text-[11px] text-on-surface-variant truncate">
                  {isPendiente
                    ? 'Pendiente de auditoría por Tesorería'
                    : isRechazado
                    ? 'Comprobante invalidado en revisión'
                    : 'Validado y listo para dispersión'}
                </span>
              </div>
              <span
                className={`text-[11px] font-semibold shrink-0 ${
                  isPendiente
                    ? 'text-tertiary-fixed-dim'
                    : isRechazado
                    ? 'text-error'
                    : 'text-primary'
                }`}
              >
                {isPendiente ? 'En espera' : isRechazado ? 'Rechazado' : 'Aprobado'}
              </span>
            </div>

            {/* Step 3 */}
            <div
              className={`relative flex items-start justify-between gap-2 ${
                isPendiente || isRechazado ? 'opacity-50' : ''
              }`}
            >
              <span
                className={`absolute -left-5 top-0.5 w-2.5 h-2.5 rounded-full ring-4 ring-surface-container-low ${
                  isTransferido
                    ? 'bg-secondary'
                    : isProcesado
                    ? 'bg-primary animate-pulse'
                    : 'bg-outline-variant'
                }`}
              />
              <div className="flex flex-col min-w-0">
                <span
                  className={`text-xs font-semibold ${
                    isTransferido
                      ? 'text-secondary font-bold'
                      : isProcesado
                      ? 'text-primary font-bold'
                      : 'text-on-surface'
                  }`}
                >
                  3. Dispersión Bancaria &amp; Comprobante
                </span>
                <span className="text-[11px] text-on-surface-variant truncate">
                  {isTransferido
                    ? 'Fondos transferidos y notificados por WhatsApp'
                    : isProcesado
                    ? 'Listo para adjuntar soporte de pago'
                    : 'Pendiente de validación previa'}
                </span>
              </div>
              <span
                className={`text-[11px] font-semibold shrink-0 ${
                  isTransferido
                    ? 'text-secondary'
                    : isProcesado
                    ? 'text-primary'
                    : 'text-on-surface-variant'
                }`}
              >
                {isTransferido ? 'Liquidado' : isProcesado ? 'Por pagar' : 'Pendiente'}
              </span>
            </div>
          </div>
        </div>

        {/* Administrative Action Controls */}
        {!isEmployee && (
          <div className="pt-3 border-t border-surface-container-highest/20 flex flex-col gap-2">
            {isPendiente && (
              <>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => onMarcarProcesado(selectedItem)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary-container hover:bg-primary-fixed text-on-primary-container text-xs sm:text-sm font-bold shadow-[0_0_24px_rgba(0,229,153,0.3)] transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Marcar como Procesado (Aprobar)</span>
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => onOpenRejectionModal(selectedItem)}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-surface-container-high hover:bg-error-container/25 text-on-surface-variant hover:text-error text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>Rechazar Comprobante</span>
                </button>
              </>
            )}

            {isProcesado && (
              <>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => onOpenTransferModal(selectedItem)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary-container hover:bg-primary-fixed text-on-primary-container text-xs sm:text-sm font-bold shadow-[0_0_24px_rgba(0,229,153,0.3)] transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  <SendHorizontal className="w-4 h-4" />
                  <span>Marcar Transferido &amp; Adjuntar Pago</span>
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => onRevertirEstado(selectedItem, 'PENDIENTE')}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>A Pendiente</span>
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => onOpenRejectionModal(selectedItem)}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-surface-container-high hover:bg-error-container/25 text-on-surface-variant hover:text-error text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Rechazar</span>
                  </button>
                </div>
              </>
            )}

            {isTransferido && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => onRevertirEstado(selectedItem, 'PROCESADO')}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Revertir a Procesado</span>
              </button>
            )}

            {isRechazado && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => onRevertirEstado(selectedItem, 'PENDIENTE')}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-tertiary-container/20 hover:bg-tertiary-container/30 text-tertiary-fixed-dim text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reabrir a Pendiente</span>
              </button>
            )}

            {!isPendiente && !isProcesado && !isTransferido && !isRechazado && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => onMarcarProcesado(selectedItem)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary-container hover:bg-primary-fixed text-on-primary-container text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Validar como Procesado</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
