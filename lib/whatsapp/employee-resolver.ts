import { supabaseServer } from '@/lib/supabase-server';
import { computeBlindIndex } from '@/lib/security/crypto';
import type { ExpenseCategoryPermissions } from '@/app/actions/invitations.actions';

export interface ResolvedWhatsAppEmployee {
  id: string;
  empresaId: string;
  nombre: string;
  department: string | null;
  allowedCategories: ExpenseCategoryPermissions;
}

/**
 * @name resolveEmployeeByWhatsAppPhone
 * @description [Business Logic & Security]: Locates an active employee via deterministic
 * HMAC-SHA256 Blind Index lookup on their incoming WhatsApp phone number, returning their
 * multi-tenant organization ID and granular category permissions without storing plaintext phones.
 */
export async function resolveEmployeeByWhatsAppPhone(
  incomingPhone: string
): Promise<ResolvedWhatsAppEmployee | null> {
  const digits = incomingPhone.replace(/[^\d]/g, '');
  if (!digits) return null;

  const blindIndex = computeBlindIndex(digits);

  // 1. Primary lookup via encrypted Blind Index
  const { data: userByBlind } = await supabaseServer
    .from('usuarios')
    .select('id, empresa_id, nombre, department, allowed_expense_categories, status')
    .eq('whatsapp_blind_index', blindIndex)
    .eq('status', 'ACTIVE')
    .maybeSingle();

  if (userByBlind) {
    return {
      id: userByBlind.id,
      empresaId: userByBlind.empresa_id,
      nombre: userByBlind.nombre,
      department: userByBlind.department ?? null,
      allowedCategories: (userByBlind.allowed_expense_categories as ExpenseCategoryPermissions) ?? {
        ALIMENTACION: true,
        TRANSPORTE: true,
        HOSPEDAJE: true,
        REPRESENTACION: false,
        OTROS: true,
      },
    };
  }

  // 2. Legacy fallback for pre-migration records
  const { data: legacyUser } = await supabaseServer
    .from('usuarios')
    .select('id, empresa_id, nombre, department, allowed_expense_categories')
    .eq('telefono_whatsapp', digits)
    .maybeSingle();

  if (!legacyUser) return null;

  return {
    id: legacyUser.id,
    empresaId: legacyUser.empresa_id,
    nombre: legacyUser.nombre,
    department: legacyUser.department ?? null,
    allowedCategories: (legacyUser.allowed_expense_categories as ExpenseCategoryPermissions) ?? {
      ALIMENTACION: true,
      TRANSPORTE: true,
      HOSPEDAJE: true,
      REPRESENTACION: false,
      OTROS: true,
    },
  };
}

/**
 * @name isExpenseCategoryAllowedForEmployee
 * @description [Business Logic]: Enforces the administrator's category permission switches
 * when an employee submits a receipt via WhatsApp.
 */
export function isExpenseCategoryAllowedForEmployee(
  permissions: ExpenseCategoryPermissions,
  normalizedCategory: string
): boolean {
  const key = normalizedCategory.toUpperCase() as keyof ExpenseCategoryPermissions;
  if (!(key in permissions)) return Boolean(permissions.OTROS);
  return Boolean(permissions[key]);
}