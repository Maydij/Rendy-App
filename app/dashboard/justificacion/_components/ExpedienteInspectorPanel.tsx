'use client';

/**
 * @name ExpedienteInspectorPanel
 * @description [UI Component]: Right-hand sticky detail & WhatsApp receipt audit inspector
 * displaying financial triad metrics, progress status, fiscal compliance tags, and direct
 * access to digital adaptive e-receipts (`DigitalInvoice`) or raw file attachments.
 */

import React from 'react';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  ExternalLink,
  Eye,
  FileQuestion,
  Hourglass,
  Printer,
  ReceiptText,
  Share2,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type { Gasto } from '@/lib/types/gasto';
import {
  computeProgressMetrics,
  formatMoney,
  getCurrencyPrefix,
  mapJustificacionGastoToGasto,
  type JustificacionItem,
} from './types';

interface ExpedienteInspectorPanelProps {
  selectedItem: JustificacionItem | null;
  onInspectGasto: (gasto: Gasto) => void;
  onCopyText: (text: string, label: string) => void;
  onScrollToMaster?: () => void;
}

export function ExpedienteInspectorPanel({
  selectedItem,
  onInspectGasto,
  onCopyText,
  onScrollToMaster,
}: ExpedienteInspectorPanelProps) {
  if (!selectedItem) {
    return (
      <div
        id="detail-inspector-panel"
        className="xl:col-span-7 flex flex-col items-center justify-center text-center gap-3 rounded-2xl bg-surface-container p-8 sm:p-12 shadow-xl border border-surface-container-high/60 min-h-[320px]"
      >
        <div className="w-12 h-12 rounded-2xl bg-surface-container-high flex items-center justify-center text-on-surface-variant">
          <ClipboardCheck className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-on-surface">
          Selecciona un expediente para inspeccionar
        </h3>
        <p className="text-xs text-on-surface-variant max-w-sm">
          Haz clic en cualquiera de los viáticos de la lista para auditar los comprobantes enviados por WhatsApp y su estatus fiscal.
        </p>
      </div>
    );
  }

  const metrics = computeProgressMetrics(selectedItem);
  const prefix = getCurrencyPrefix(selectedItem.moneda);
  const initial = (selectedItem.empleado?.charAt(0) || 'U').toUpperCase();

  return (
    <div
      id="detail-inspector-panel"
      className="xl:col-span-7 flex flex-col gap-5 rounded-2xl bg-surface-container p-5 sm:p-6 shadow-xl xl:sticky xl:top-6 border border-surface-container-high/60"
    >
      {/* Inspector Header */}
      <div className="flex flex-col gap-4 pb-4 border-b border-surface-container-high/60">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 flex-wrap min-w-0">
            {onScrollToMaster && (
              <button
                type="button"
                onClick={onScrollToMaster}
                className="xl:hidden inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container-high text-xs font-medium text-on-surface-variant hover:text-on-surface"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Lista</span>
              </button>
            )}
            <span className="text-lg font-bold text-on-surface tracking-tight">
              Expediente #{selectedItem.id.slice(0, 8)}
            </span>
            {metrics.isComplete ? (
              <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                100% Justificado (Completado)
              </span>
            ) : metrics.isEmpty ? (
              <span className="px-2.5 py-0.5 rounded-full bg-tertiary-container/15 text-tertiary-container text-[11px] font-bold">
                Sin Comprobantes (0%)
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-secondary/15 text-secondary text-[11px] font-bold">
                En Progreso ({metrics.pct}% Rendido)
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onCopyText(selectedItem.id, 'ID del expediente')}
              className="p-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              title="Copiar ID completo"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') window.print();
              }}
              className="p-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              title="Imprimir bitácora"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                onCopyText(
                  `Expediente #${selectedItem.id.slice(0, 8)} · ${selectedItem.empleado} (${selectedItem.proyecto}) — Otorgado: ${prefix}${formatMoney(selectedItem.monto_otorgado)} ${selectedItem.moneda}, Justificado: ${prefix}${formatMoney(selectedItem.monto_gastado)} ${selectedItem.moneda} (${metrics.pct}%)`,
                  'Resumen del expediente'
                )
              }
              className="p-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              title="Copiar resumen para compartir"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Collaborator Profile Mini Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-surface-container-lowest border border-surface-container-high/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary-container font-bold text-base flex items-center justify-center shrink-0">
              {initial}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-on-surface truncate">
                {selectedItem.empleado}
              </span>
              <span className="text-[11px] text-on-surface-variant truncate">
                {selectedItem.empleadoEmail ? `${selectedItem.empleadoEmail} · ` : ''}
                Centro: <strong className="text-on-surface font-medium">{selectedItem.proyecto}</strong>
              </span>
            </div>
          </div>

          <div className="flex flex-col items-start sm:items-end shrink-0">
            <span className="text-[11px] text-on-surface-variant">Fecha Aprobación</span>
            <span className="font-mono text-xs text-on-surface font-semibold">
              {selectedItem.fecha_aprobacion}
            </span>
          </div>
        </div>
      </div>

      {/* Calibrated Financial Status Triad */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high/40">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold">
            Otorgado
          </span>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-lg sm:text-[20px] font-extrabold text-on-surface font-mono truncate">
              {prefix}{formatMoney(selectedItem.monto_otorgado)}
            </span>
            <span className="text-[11px] font-bold text-on-surface-variant font-mono">
              {selectedItem.moneda}
            </span>
          </div>
          <span className="text-[10px] text-on-surface-variant/80 uppercase">
            Desembolsado
          </span>
        </div>

        <div className="flex flex-col gap-1 sm:border-l sm:border-surface-container-high/60 sm:pl-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-surface-container-high/40 min-w-0">
          <span className="text-[11px] text-secondary font-semibold uppercase tracking-wider">
            WhatsApp Justificado
          </span>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-lg sm:text-[20px] font-extrabold text-secondary font-mono truncate">
              {prefix}{formatMoney(selectedItem.monto_gastado)}
            </span>
            <span className="text-[11px] font-bold text-secondary font-mono">
              {selectedItem.moneda}
            </span>
          </div>
          <span className="text-[10px] text-secondary/80 uppercase">
            {metrics.rawPct}% de la meta
          </span>
        </div>

        <div className="flex flex-col gap-1 sm:border-l sm:border-surface-container-high/60 sm:pl-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-surface-container-high/40 min-w-0">
          <span className="text-[11px] text-tertiary-container font-semibold uppercase tracking-wider">
            Saldo Pendiente
          </span>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span
              className={`text-lg sm:text-[20px] font-extrabold font-mono truncate ${
                metrics.remaining > 0 ? 'text-tertiary-container' : 'text-primary'
              }`}
            >
              {prefix}{formatMoney(metrics.remaining)}
            </span>
            <span
              className={`text-[11px] font-bold font-mono ${
                metrics.remaining > 0 ? 'text-tertiary-container' : 'text-primary'
              }`}
            >
              {selectedItem.moneda}
            </span>
          </div>
          <span
            className={`text-[10px] uppercase ${
              metrics.remaining > 0 ? 'text-tertiary-container/80' : 'text-primary/80'
            }`}
          >
            {metrics.remaining > 0 ? 'Requiere comprobantes' : 'Cierre completado'}
          </span>
        </div>
      </div>

      {/* Progress Track */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-on-surface-variant font-medium">
            Progreso de rendición contable
          </span>
          <span
            className={`font-bold font-mono ${
              metrics.isComplete ? 'text-primary' : 'text-secondary'
            }`}
          >
            {metrics.pct}% completado
          </span>
        </div>
        <div
          className="w-full h-2 rounded-full bg-surface-container-highest overflow-hidden"
          role="progressbar"
          aria-valuenow={metrics.pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progreso de ${selectedItem.empleado}: ${metrics.pct}%`}
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              metrics.isComplete
                ? 'bg-primary shadow-[0_0_10px_rgba(0,229,153,0.5)]'
                : 'bg-secondary shadow-[0_0_10px_rgba(76,215,246,0.5)]'
            }`}
            style={{ width: `${metrics.pct}%` }}
          />
        </div>
      </div>

      {/* Receipts Received via WhatsApp */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ReceiptText className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm font-bold text-on-surface truncate">
              Comprobantes Recibidos vía WhatsApp
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-[11px] font-semibold text-on-surface-variant shrink-0">
            {selectedItem.gastos.length}{' '}
            {selectedItem.gastos.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        <div className="flex flex-col gap-2.5">
          {selectedItem.gastos.length === 0 ? (
            <div className="p-8 rounded-xl border-2 border-dashed border-surface-container-high bg-surface-container-lowest/50 text-center flex flex-col items-center gap-2">
              <FileQuestion className="w-8 h-8 text-on-surface-variant" />
              <span className="text-sm font-semibold text-on-surface">
                Sin comprobantes asociados todavía
              </span>
              <p className="text-xs text-on-surface-variant max-w-sm">
                Cuando {selectedItem.empleado} envíe fotografías o PDFs de sus facturas al bot de WhatsApp seleccionando este viático, aparecerán aquí automáticamente con su análisis OCR.
              </p>
            </div>
          ) : (
            selectedItem.gastos.map((gasto, idx) => {
              const hasConversion =
                Boolean(gasto.tasa_cambio) &&
                gasto.tasa_cambio !== 1 &&
                gasto.monto_convertido != null;
              const gastoPrefix = getCurrencyPrefix(gasto.moneda);
              const isFiscalInvalid = gasto.tiene_validez_fiscal === false;
              const hasFiscalData = Boolean(
                gasto.rif_comercio || gasto.numero_factura || gasto.folio_fiscal_uuid
              );

              return (
                <div
                  key={gasto.id || idx}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-surface-container-lowest hover:bg-surface-container-high/60 transition-colors border border-surface-container-high/40 hover:border-surface-container-highest group"
                >
                  {/* Left: Merchant & Metadata */}
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center text-primary group-hover:scale-105 transition-transform shrink-0">
                      <ReceiptText className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-on-surface truncate">
                          {gasto.comercio}
                        </span>
                        {gasto.numero_factura && (
                          <span className="font-mono text-[11px] text-on-surface-variant">
                            #{gasto.numero_factura}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-md bg-surface-container text-[10px] font-semibold text-secondary">
                          {gasto.categoria}
                        </span>
                        {isFiscalInvalid ? (
                          <span className="px-2 py-0.5 rounded-full bg-tertiary-container/15 text-tertiary-container text-[10px] font-bold flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3" />
                            Sin Validez Fiscal
                          </span>
                        ) : hasFiscalData ? (
                          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            Válido Fiscalmente
                          </span>
                        ) : null}
                      </div>

                      {gasto.concepto && (
                        <span className="text-[11px] text-on-surface-variant line-clamp-1">
                          {gasto.concepto}
                        </span>
                      )}

                      <div className="flex items-center gap-3 text-[11px] text-on-surface-variant flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {gasto.fecha_gasto}
                        </span>
                        <span className="flex items-center gap-1 text-primary font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          OCR Aprobado
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Monetary Breakdown & Inspection Buttons */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-surface-container-high/40">
                    <div className="flex flex-col sm:items-end">
                      <div className="flex items-baseline gap-1 whitespace-nowrap">
                        <span className="text-sm font-extrabold text-primary font-mono">
                          {prefix}{formatMoney(gasto.monto_efectivo)}
                        </span>
                        <span className="text-[10px] font-bold text-primary font-mono">
                          {selectedItem.moneda}
                        </span>
                      </div>
                      {(hasConversion || gasto.moneda !== selectedItem.moneda) && (
                        <span className="text-[10px] text-on-surface-variant font-mono whitespace-nowrap">
                          {gastoPrefix} {formatMoney(gasto.monto)} {gasto.moneda}
                          {gasto.tasa_cambio && gasto.tasa_cambio !== 1
                            ? ` · Tasa ${gasto.tasa_cambio}`
                            : ''}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {gasto.url_comprobante ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              onInspectGasto(
                                mapJustificacionGastoToGasto(gasto, selectedItem)
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-highest text-xs font-semibold text-primary transition-colors cursor-pointer"
                            title="Ver factura digital e imagen"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ver Factura</span>
                          </button>
                          <a
                            href={gasto.url_comprobante}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-xl bg-surface-container hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors"
                            title="Abrir archivo original en nueva pestaña"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            onInspectGasto(
                              mapJustificacionGastoToGasto(gasto, selectedItem)
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-highest text-xs font-medium text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                          title="Ver comprobante digital (sin imagen adjunta)"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Detalle</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Pending Balance Placeholder */}
          {selectedItem.gastos.length > 0 && metrics.remaining > 0 && (
            <div className="p-4 rounded-xl border-2 border-dashed border-surface-container-high flex items-center justify-between gap-3 bg-surface-container-lowest/50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant animate-pulse shrink-0">
                  <Hourglass className="w-4 h-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium text-on-surface truncate">
                    Pendiente por enviar vía WhatsApp
                  </span>
                  <span className="text-[11px] text-on-surface-variant truncate">
                    Saldo por justificar: {prefix}{formatMoney(metrics.remaining)} {selectedItem.moneda}
                  </span>
                </div>
              </div>
              <span className="text-[11px] text-tertiary-container font-semibold shrink-0">
                En espera
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
