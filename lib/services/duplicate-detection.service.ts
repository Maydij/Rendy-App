/**
 * @name DuplicateDetectionService
 * @description [Anti-Fraud Module]: Orchestrates the full duplicate invoice detection
 * workflow against Supabase. It performs a "double-lock" check:
 *   1. Primary lock: SHA-256 hash match on `hash_duplicado` column (hard block).
 *   2. Secondary lock: Composite field match on `rif_comercio + numero_factura + monto_total`
 *      (defensive fallback in case hash was not stored on older records).
 *
 * When a duplicate is detected, the service logs the attempt into `intentos_duplicados`
 * for auditing and returns the formatted WhatsApp alert message.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  generateExpenseHash,
  hasSufficientFiscalData,
  sanitizeTaxId,
  sanitizeInvoiceNumber,
  sanitizeAmount,
  buildDuplicateAlertMessage,
  type DuplicateCheckResult,
} from '@/lib/utils/hash';

/* ─────────────────────────────────────────────────────────
 * TYPES
 * ───────────────────────────────────────────────────────── */

/**
 * @description Input payload for the duplicate verification pipeline.
 */
export interface DuplicateVerificationInput {
  employeeId: string;
  senderPhone: string;
  taxId: string | null;
  invoiceNumber: string | null;
  totalAmount: number | null;
  merchantName: string | null;
  currency: string;
}

/**
 * @description Complete result returned by the duplicate verification pipeline.
 */
export interface DuplicateVerificationResult {
  isDuplicate: boolean;
  duplicateHash: string | null;
  blockMessage: string | null;
  originalExpenseId: string | null;
}

/* ─────────────────────────────────────────────────────────
 * CORE SERVICE
 * ───────────────────────────────────────────────────────── */

/**
 * @name verifyInvoiceDuplicate
 * @description [Business Logic]: Executes the anti-fraud "double-lock" verification
 * pipeline before any expense is inserted. If a duplicate is found, blocks the
 * insertion, registers the attempt in `intentos_duplicados`, and returns the
 * formatted WhatsApp alert. Returns `isDuplicate: false` when the invoice is clean.
 */
export async function verifyInvoiceDuplicate(
  supabase: SupabaseClient,
  input: DuplicateVerificationInput,
): Promise<DuplicateVerificationResult> {
  const { employeeId, senderPhone, taxId, invoiceNumber, totalAmount, merchantName, currency } = input;

  // Guard: if we don't have enough fiscal data, we cannot generate a reliable hash
  if (!hasSufficientFiscalData(taxId, invoiceNumber, totalAmount)) {
    return {
      isDuplicate: false,
      duplicateHash: null,
      blockMessage: null,
      originalExpenseId: null,
    };
  }

  // At this point, TypeScript knows all three values are defined (non-null assertion safe)
  const safeTaxId = taxId as string;
  const safeInvoice = invoiceNumber as string;
  const safeAmount = totalAmount as number;

  const hash = generateExpenseHash(safeTaxId, safeInvoice, safeAmount);

  try {
    // ───── LOCK 1: Direct hash lookup (primary, fastest) ─────
    const { data: hashMatch } = await supabase
      .from('gastos')
      .select('id, creado_en, usuario_id, usuarios(nombre)')
      .eq('hash_duplicado', hash)
      .maybeSingle();

    if (hashMatch) {
      const originalEmployeeName = ((hashMatch.usuarios as unknown) as { nombre: string } | null)?.nombre || 'Desconocido';
      const isOwnDuplicate = hashMatch.usuario_id === employeeId;
      const originalDate = hashMatch.creado_en
        ? new Date(hashMatch.creado_en).toLocaleDateString('es-VE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
        : 'Fecha desconocida';

      const blockMessage = buildDuplicateAlertMessage({
        merchantName,
        invoiceNumber: safeInvoice,
        totalAmount: safeAmount,
        currency,
        originalDate,
        originalEmployeeName,
        isOwnDuplicate,
      });

      // Register fraud/error attempt for audit trail
      await registerDuplicateAttempt(supabase, {
        employeeId,
        senderPhone,
        taxId: safeTaxId,
        invoiceNumber: safeInvoice,
        totalAmount: safeAmount,
        duplicateHash: hash,
        originalExpenseId: hashMatch.id,
      });

      return {
        isDuplicate: true,
        duplicateHash: hash,
        blockMessage,
        originalExpenseId: hashMatch.id,
      };
    }

    // ───── LOCK 2: Composite field match (defensive fallback) ─────
    const cleanTaxId = sanitizeTaxId(safeTaxId);
    const cleanInvoice = sanitizeInvoiceNumber(safeInvoice);
    const cleanAmount = sanitizeAmount(safeAmount);

    const { data: fieldMatch } = await supabase
      .from('gastos')
      .select('id, creado_en, usuario_id, usuarios(nombre)')
      .eq('rif_comercio', cleanTaxId)
      .eq('numero_factura', cleanInvoice)
      .eq('monto_total', parseFloat(cleanAmount))
      .maybeSingle();

    if (fieldMatch) {
      const originalEmployeeName = ((fieldMatch.usuarios as unknown) as { nombre: string } | null)?.nombre || 'Desconocido';
      const isOwnDuplicate = fieldMatch.usuario_id === employeeId;
      const originalDate = fieldMatch.creado_en
        ? new Date(fieldMatch.creado_en).toLocaleDateString('es-VE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
        : 'Fecha desconocida';

      const blockMessage = buildDuplicateAlertMessage({
        merchantName,
        invoiceNumber: safeInvoice,
        totalAmount: safeAmount,
        currency,
        originalDate,
        originalEmployeeName,
        isOwnDuplicate,
      });

      await registerDuplicateAttempt(supabase, {
        employeeId,
        senderPhone,
        taxId: safeTaxId,
        invoiceNumber: safeInvoice,
        totalAmount: safeAmount,
        duplicateHash: hash,
        originalExpenseId: fieldMatch.id,
      });

      return {
        isDuplicate: true,
        duplicateHash: hash,
        blockMessage,
        originalExpenseId: fieldMatch.id,
      };
    }

    // Clean — no duplicate found
    return {
      isDuplicate: false,
      duplicateHash: hash,
      blockMessage: null,
      originalExpenseId: null,
    };
  } catch (error) {
    console.error('❌ [Anti-Fraud] Error during duplicate verification:', error);
    // Fail-open: if the verification itself crashes, do NOT block the user
    return {
      isDuplicate: false,
      duplicateHash: hash,
      blockMessage: null,
      originalExpenseId: null,
    };
  }
}

/* ─────────────────────────────────────────────────────────
 * AUDIT TRAIL – intentos_duplicados
 * ───────────────────────────────────────────────────────── */

interface DuplicateAttemptPayload {
  employeeId: string;
  senderPhone: string;
  taxId: string;
  invoiceNumber: string;
  totalAmount: number;
  duplicateHash: string;
  originalExpenseId: string;
}

/**
 * @name registerDuplicateAttempt
 * @description [Audit / Compliance]: Inserts a record into the `intentos_duplicados`
 * table every time a duplicate invoice is detected. This creates a tamper-proof
 * audit trail for fraud investigation without polluting the main `gastos` table.
 */
async function registerDuplicateAttempt(
  supabase: SupabaseClient,
  payload: DuplicateAttemptPayload,
): Promise<void> {
  try {
    const { error } = await supabase.from('intentos_duplicados').insert({
      empleado_id: payload.employeeId,
      telefono_remitente: payload.senderPhone,
      rif_comercio: payload.taxId,
      numero_factura: payload.invoiceNumber,
      monto_total: payload.totalAmount,
      hash_duplicado: payload.duplicateHash,
      gasto_original_id: payload.originalExpenseId,
    });

    if (error) {
      console.error('❌ [Anti-Fraud] Failed to log duplicate attempt:', error);
    }
  } catch (err) {
    // Non-critical: if audit logging fails, the block still applies
    console.error('❌ [Anti-Fraud] Exception logging duplicate attempt:', err);
  }
}
