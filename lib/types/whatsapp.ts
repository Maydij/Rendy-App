/**
 * @name WhatsAppStateTypes
 * @description [Domain Types]: State machine definitions and temporary session storage contracts
 * for the Rendy WhatsApp conversational interface.
 *
 * Governs the dual-routing pipeline:
 * - Guided Route: Menu-assisted navigation across 4 administrative operations.
 * - Quick Route: Direct cold-receipt ingestion with automated or interactive resolution.
 */

import type { ExcessDetail } from '@/lib/services/politicasGastos';

/**
 * @name EstadoConversacion
 * @description All valid finite states for the conversational WhatsApp state machine.
 */
export type EstadoConversacion =
  | 'INICIO'
  // Subflow: Request Viáticos (Pedir Viáticos)
  | 'SOLICITANDO_VIATICO_PROYECTO'
  | 'SOLICITANDO_VIATICO_MONTO'
  | 'SOLICITANDO_VIATICO_MONEDA'
  | 'SOLICITANDO_VIATICO_FECHA'
  | 'SOLICITANDO_VIATICO_USO'
  | 'SOLICITANDO_VIATICO_CONFIRMACION'
  // Subflow: Rendir Viáticos (Guided Route)
  | 'SELECCIONANDO_VIATICO_PREVIO'
  | 'ESPERANDO_FOTO_VIATICO'
  // Subflow: Direct Reimbursement (Pedir Reembolso)
  | 'ESPERANDO_FOTO_REEMBOLSO'
  // Subflow: Quick Route (Cold photo with multiple active viáticos)
  | 'RESOLVIENDO_DESTINO_FOTO'
  // Final Review & Persistence
  | 'ESPERANDO_CONFIRMACION';

/**
 * @name ExtraccionOcrSesion
 * @description Normalized OCR and fiscal decomposition data held in the active session.
 */
export interface ExtraccionOcrSesion {
  nombre_comercio: string;
  rif_comercio: string;
  numero_factura: string;
  fecha_emision: string;
  moneda: 'VES' | 'USD';
  tasa_impresa: number | null;
  tasa_cambio: number;
  base_imponible_ves: number;
  iva_ves: number;
  exento_ves: number;
  igtf_ves: number;
  monto_ves: number;
  monto_usd: number;
  hash_duplicado: string;
  categoria?: string;
  concepto?: string;
  url_comprobante?: string | null;
  hash_comprobante?: string | null;
  requiere_revision_fiscal?: boolean;
}

/**
 * @name EvaluacionSaldoSesion
 * @description Financial balance projection and overdraft calculations against active budget allocations.
 */
export interface EvaluacionSaldoSesion {
  monto_asignado_usd: number;
  acumulado_previo_usd: number;
  saldo_restante_usd: number;
  sobregiro_usd: number;
  excede_limite: boolean;
  nombre_proyecto?: string;
}

/**
 * @name NuevoViaticoDraft
 * @description Temporary accumulator for the interactive viático request workflow.
 */
export interface NuevoViaticoDraft {
  proyecto_id?: string;
  proyecto?: string;
  monto_estimado?: number;
  moneda?: string;
  fecha_requerida?: string;
  uso_estimado?: string;
}

/**
 * @name DatosTemporalesSesion
 * @description JSON-serializable session payload persisted to `sesiones_whatsapp.datos_temporales`.
 */
export interface DatosTemporalesSesion {
  viatico_id?: string | null;
  es_reembolso?: boolean;
  nuevo_viatico?: NuevoViaticoDraft;
  extraccion_ocr?: ExtraccionOcrSesion;
  evaluacion_saldo?: EvaluacionSaldoSesion;
  excess_detail?: ExcessDetail | null;
  flujo_origen?: 'RUTA_RAPIDA' | 'RUTA_GUIADA';
  media_id?: string;
  es_pdf?: boolean;
  aviso_inactividad_enviado?: boolean;
}

/**
 * @name SesionWhatsAppRecord
 * @description Representation of a row in the `sesiones_whatsapp` table.
 */
export interface SesionWhatsAppRecord {
  telefono: string;
  empleado_id: string | null;
  estado: EstadoConversacion;
  datos_temporales: DatosTemporalesSesion | null;
  ultima_interaccion: string;
}

