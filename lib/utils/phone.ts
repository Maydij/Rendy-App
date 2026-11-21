/**
 * @name PhoneUtilities
 * @description [Business Logic]: Utilities for normalizing, sanitizing, and validating
 * international phone numbers to the E.164 standard (+[country][national_number]).
 * Ensures consistent phone hashing and uniqueness checks across WhatsApp, DB queries,
 * and user onboarding.
 */

/**
 * @name normalizarTelefonoE164
 * @description [Business Logic]: Strips all non-digit characters except an optional leading plus,
 * and guarantees a leading '+' symbol.
 * Example: "0412 123 4567" -> "+04121234567", "+58 (412) 123-4567" -> "+584121234567".
 * If Venezuelan national format "0414...", "0424...", "0412..." is provided without country code,
 * converts to +58414...
 *
 * @param phone Raw phone string provided by user or webhook.
 * @returns Normalized E.164 phone string.
 */
export function normalizarTelefonoE164(phone: string): string {
  if (!phone || typeof phone !== 'string') {
    return '';
  }

  // Remove spaces, hyphens, parentheses, and dots
  let cleaned = phone.replace(/[^\d+]/g, '').trim();

  // If local Venezuelan mobile format (0412..., 0414..., 0424..., 0416..., 0426...)
  if (/^04(12|14|24|16|26)\d{7}$/.test(cleaned)) {
    cleaned = `+58${cleaned.substring(1)}`;
  } else if (!cleaned.startsWith('+')) {
    cleaned = `+${cleaned}`;
  }

  return cleaned;
}

/**
 * @name validarTelefonoE164
 * @description [Business Logic]: Validates whether a phone number strictly matches E.164 format:
 * starts with '+', followed by 8 to 15 digits.
 *
 * @param phone Normalized or raw phone string.
 * @returns True if valid E.164, false otherwise.
 */
export function validarTelefonoE164(phone: string): boolean {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  const normalized = normalizarTelefonoE164(phone);
  // ITU-T E.164 specifies maximum 15 digits (excluding the plus)
  return /^\+[1-9]\d{7,14}$/.test(normalized);
}
