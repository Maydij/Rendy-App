/**
 * @name Gasto
 * @description [Domain Model]: Represents a single expense record captured via WhatsApp OCR.
 * This type is the universal data contract used across the entire platform —
 * Gastos, Reembolsos, and Justificación modules — to ensure consistent
 * rendering in the DigitalInvoice (eReceipt) component.
 *
 * Fields like `tasa_cambio`, `monto_convertido`, and `moneda_viatico` are critical
 * for multi-currency traceability and must never be omitted when available.
 *
 * Sprint 2 additions: Fiscal tax breakdown fields (base_imponible_ves, iva_ves,
 * exento_ves, igtf_ves) and dual-currency consolidation (monto_ves, monto_usd)
 * enable SENIAT-compliant accounting and bimonetary auditing.
 */
export type Gasto = {
  id: string;
  empleado: string;
  categoria: string;
  comercio: string;
  monto: number;
  moneda: string;
  tasa_cambio?: number | null;
  monto_convertido?: number | null;
  moneda_viatico?: string | null;
  fecha_gasto: string;
  creado_en?: string;
  proyecto: string;
  metodo_pago: string;
  estado: string;
  url_comprobante: string | null;
  concepto: string | null;
  datos_ocr?: Record<string, unknown>;

  // ── Sprint 2: Fiscal Tax Breakdown & Dual-Currency ──
  moneda_original?: string | null;
  origen_tasa?: string | null;
  base_imponible_ves?: number | null;
  iva_ves?: number | null;
  exento_ves?: number | null;
  igtf_ves?: number | null;
  monto_ves?: number | null;
  monto_usd?: number | null;
  rif_comercio?: string | null;
  numero_factura?: string | null;
  requiere_revision_fiscal?: boolean | null;
};
