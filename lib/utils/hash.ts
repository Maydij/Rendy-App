/**
 * @name ExpenseHashUtilities
 * @description [Anti-Fraud Module]: Provides deterministic sanitization and SHA-256
 * hashing utilities for invoice deduplication. By normalizing tax IDs (RIF/NIT/CTI),
 * invoice numbers, and amounts before hashing, we eliminate false negatives caused
 * by formatting inconsistencies (leading zeros, dashes, casing differences) and
 * guarantee that two records from the same physical invoice always produce the
 * same hash — regardless of who uploads it or when.
 */

import { createHash } from 'crypto';

/* ─────────────────────────────────────────────────────────
 * TYPES
 * ───────────────────────────────────────────────────────── */

/**
 * @description Raw fiscal data fields extracted by the OCR/Gemini layer.
 * These are the mandatory inputs for generating the deduplication hash.
 */
export interface InvoiceFiscalData {
  taxId: string;
  invoiceNumber: string;
  totalAmount: number;
}

/**
 * @description Sanitized (clean) fiscal data ready for hashing.
 */
export interface SanitizedFiscalData {
  cleanTaxId: string;
  cleanInvoiceNumber: string;
  cleanAmount: string;
}

/**
 * @description Result of a duplicate check performed against Supabase.
 */
export interface DuplicateCheckResult {
  isDuplicate: boolean;
  originalExpenseId: string | null;
  originalCreatedAt: string | null;
  originalEmployeeName: string | null;
  originalEmployeeId: string | null;
}

/* ─────────────────────────────────────────────────────────
 * STEP 1 – SANITIZATION FUNCTIONS
 * ───────────────────────────────────────────────────────── */

/**
 * @name sanitizeTaxId
 * @description [Business Logic]: Strips dashes, dots, spaces and converts to
 * uppercase so that "j-12345678.9" and "J 12345678 9" both resolve to "J123456789".
 */
export function sanitizeTaxId(rawTaxId: string): string {
  return rawTaxId.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * @name sanitizeInvoiceNumber
 * @description [Business Logic]: Removes non-alphanumeric chars (dashes, slashes)
 * and strips leading zeros so "FAC-0004592" and "fac0004592" both resolve to "FAC4592".
 */
export function sanitizeInvoiceNumber(rawInvoice: string): string {
  const alphanumericOnly = rawInvoice.toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Separate any leading alphabetic prefix from the numeric part
  const match = alphanumericOnly.match(/^([A-Z]*)(\d+)(.*)$/);
  if (match) {
    const prefix = match[1]; // e.g. "FAC"
    const numericPart = match[2].replace(/^0+/, '') || '0'; // strip leading zeros, keep at least "0"
    const suffix = match[3]; // anything after
    return `${prefix}${numericPart}${suffix}`;
  }

  // Fallback: just strip leading zeros from the entire string
  return alphanumericOnly.replace(/^0+/, '') || '0';
}

/**
 * @name sanitizeAmount
 * @description [Business Logic]: Normalizes the monetary amount to a string with
 * exactly 2 decimal places so 150.5 and 150.50 always yield "150.50".
 */
export function sanitizeAmount(amount: number): string {
  return Number(amount).toFixed(2);
}

/**
 * @name sanitizeFiscalData
 * @description [Business Logic]: Applies all three sanitization steps to raw fiscal data
 * and returns a clean, normalized object ready for hashing.
 */
export function sanitizeFiscalData(data: InvoiceFiscalData): SanitizedFiscalData {
  return {
    cleanTaxId: sanitizeTaxId(data.taxId),
    cleanInvoiceNumber: sanitizeInvoiceNumber(data.invoiceNumber),
    cleanAmount: sanitizeAmount(data.totalAmount),
  };
}

/* ─────────────────────────────────────────────────────────
 * STEP 2 – DETERMINISTIC HASH GENERATION (SHA-256)
 * ───────────────────────────────────────────────────────── */

/**
 * @name generateExpenseHash
 * @description [Anti-Fraud Core]: Generates a deterministic SHA-256 hex digest from
 * the concatenation of sanitized tax_id, invoice_number, and total_amount.
 * Two invoices with the same fiscal identity will ALWAYS produce the same hash,
 * regardless of formatting differences in the original data.
 *
 * @example
 * generateExpenseHash("j-12345678.9", "FAC-0004592", 150.5)
 * // => sha256("J123456789_FAC4592_150.50")
 */
export function generateExpenseHash(
  taxId: string,
  invoiceNumber: string,
  totalAmount: number,
): string {
  const sanitized = sanitizeFiscalData({ taxId, invoiceNumber, totalAmount });
  const rawString = `${sanitized.cleanTaxId}_${sanitized.cleanInvoiceNumber}_${sanitized.cleanAmount}`;

  return createHash('sha256').update(rawString).digest('hex');
}

/* ─────────────────────────────────────────────────────────
 * STEP 3 – VALIDATION HELPERS
 * ───────────────────────────────────────────────────────── */

/**
 * @name hasSufficientFiscalData
 * @description [Business Logic]: Determines whether the OCR extraction returned
 * enough fiscal data to compute a meaningful dedup hash. If any of the three
 * core fields is missing or empty, the hash would be unreliable and should not
 * be used as a hard blocker.
 */
export function hasSufficientFiscalData(
  taxId: string | null | undefined,
  invoiceNumber: string | null | undefined,
  totalAmount: number | null | undefined,
): boolean {
  if (!taxId || taxId.trim().length === 0) return false;
  if (!invoiceNumber || invoiceNumber.trim().length === 0) return false;
  if (totalAmount === null || totalAmount === undefined || totalAmount <= 0) return false;
  return true;
}

/**
 * @name buildDuplicateAlertMessage
 * @description [WhatsApp UX]: Formats the anti-fraud alert message sent via
 * WhatsApp Cloud API when a duplicate invoice is detected. This message is
 * designed to be clear, non-aggressive, and actionable for the employee.
 */
export function buildDuplicateAlertMessage(params: {
  merchantName: string | null;
  invoiceNumber: string;
  totalAmount: number;
  currency: string;
  originalDate: string;
  originalEmployeeName: string;
  isOwnDuplicate: boolean;
}): string {
  const employeeRef = params.isOwnDuplicate
    ? 'ti mismo/a'
    : params.originalEmployeeName;

  return [
    `⚠️ *Factura Ya Registrada*`,
    ``,
    `Hola, la factura que acabas de enviar ya fue procesada anteriormente en el sistema.`,
    ``,
    `📄 *Comercio:* ${params.merchantName || 'No identificado'}`,
    `🔢 *Nº Factura:* ${params.invoiceNumber}`,
    `💵 *Monto:* ${params.totalAmount} ${params.currency}`,
    `📅 *Cargada previamente el:* ${params.originalDate} por *${employeeRef}*.`,
    ``,
    `_Si crees que esto es un error o necesitas aclaración, contacta al departamento de administración._`,
  ].join('\n');
}
