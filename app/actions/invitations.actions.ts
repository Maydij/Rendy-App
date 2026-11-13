'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import QRCode from 'qrcode';
import { supabaseServer } from '@/lib/supabase-server';
import { requireAdminSession } from '@/lib/auth/session-context';
import {
  encryptPII,
  computeBlindIndex,
  generateCryptographicToken,
  hashPassword,
  hashSha256,
} from '@/lib/security/crypto';
import {
  enforceRateLimit,
  RATE_LIMIT_POLICIES,
} from '@/lib/security/redis-guard';
import { createAuthenticatedSession } from '@/lib/security/session';
import { securityLogger } from '@/lib/security/logger';
import { serverEnv } from '@/lib/security/env';
import { enviarMensajeWhatsApp } from '@/app/lib/whatsapp';

/* ─────────────────────────────────────────────────────────────
 * Strict Zod Schemas (.strict() prevents Mass Assignment)
 * ───────────────────────────────────────────────────────────── */

const ExpenseCategoryPermissionsSchema = z
  .object({
    ALIMENTACION: z.boolean(),
    TRANSPORTE: z.boolean(),
    HOSPEDAJE: z.boolean(),
    REPRESENTACION: z.boolean(),
    OTROS: z.boolean(),
  })
  .strict();

export type ExpenseCategoryPermissions = z.infer<typeof ExpenseCategoryPermissionsSchema>;

const CreateEmployeeInvitationSchema = z
  .object({
    firstName: z.string().trim().min(2, 'Ingresa el nombre del empleado.').max(100),
    lastName: z.string().trim().min(2, 'Ingresa el apellido del empleado.').max(100),
    nationalIdCedula: z
      .string()
      .trim()
      .min(5, 'Ingresa una cédula o DNI válido.')
      .max(30)
      .regex(/^[A-Za-z0-9\-]+$/, 'La cédula/DNI solo admite letras, números y guiones.'),
    email: z.string().trim().toLowerCase().email('Correo electrónico inválido.').max(255),
    whatsappPhone: z
      .string()
      .trim()
      .regex(/^\+?\d{10,15}$/, 'Ingresa el número de WhatsApp con código de país (ej. +584121234567).'),
    department: z.string().trim().min(2, 'Especifica el departamento.').max(100),
    allowedCategories: ExpenseCategoryPermissionsSchema,
  })
  .strict();

const StrongEmployeePasswordSchema = z
  .string()
  .min(12, 'La contraseña debe tener al menos 12 caracteres.')
  .max(128, 'La contraseña no puede exceder 128 caracteres.')
  .regex(/[A-Z]/, 'Debe incluir al menos una letra mayúscula.')
  .regex(/[a-z]/, 'Debe incluir al menos una letra minúscula.')
  .regex(/[0-9]/, 'Debe incluir al menos un número.')
  .regex(/[^A-Za-z0-9]/, 'Debe incluir al menos un carácter especial.');

const AcceptInvitationSchema = z
  .object({
    token: z.string().min(20, 'Token de invitación inválido.').max(128),
    password: StrongEmployeePasswordSchema,
    confirmPassword: z.string(),
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword'],
  });

export interface CreatedInvitationArtifact {
  invitationId: string;
  employeeFullName: string;
  email: string;
  magicLinkUrl: string;
  qrCodeDataUrl: string;
  whatsappDispatched: boolean;
  expiresAt: string;
}

export interface InvitationPreviewData {
  valid: boolean;
  error?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  department?: string;
  companyName?: string;
  allowedCategories?: ExpenseCategoryPermissions;
  expiresAt?: string;
}

/**
 * @name normalizePhoneDigits
 * @description [Helper]: Strips '+' and whitespace from international phone numbers into canonical digits.
 */
function normalizePhoneDigits(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

/**
 * @name createEmployeeInvitationAction
 * @description [Business Logic]: Registers a new corporate employee with AES-256-GCM encrypted PII
 * (National ID & WhatsApp number), configurable expense category toggles, generates a 256-bit
 * single-use Magic Link + QR Code, dispatches an automated WhatsApp invitation, and updates FTUX progress.
 */
export async function createEmployeeInvitationAction(
  rawInput: unknown
): Promise<{ success: boolean; error?: string; data?: CreatedInvitationArtifact }> {
  try {
    const session = await requireAdminSession();

    const parsed = CreateEmployeeInvitationSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || 'Datos del empleado inválidos.',
      };
    }

    const {
      firstName,
      lastName,
      nationalIdCedula,
      email,
      whatsappPhone,
      department,
      allowedCategories,
    } = parsed.data;

    const canonicalCedula = nationalIdCedula.toUpperCase();
    const canonicalWhatsapp = normalizePhoneDigits(whatsappPhone);

    const cedulaBlindIndex = computeBlindIndex(canonicalCedula);
    const whatsappBlindIndex = computeBlindIndex(canonicalWhatsapp);

    // Check if employee email or national ID already exists in this tenant
    const { data: existingUser } = await supabaseServer
      .from('usuarios')
      .select('id')
      .eq('empresa_id', session.empresaId)
      .or(`email.eq.${email},cedula_blind_index.eq.${cedulaBlindIndex}`)
      .maybeSingle();

    if (existingUser) {
      return {
        success: false,
        error: 'Ya existe un colaborador registrado con este correo o cédula en tu empresa.',
      };
    }

    // Encrypt sensitive PII at rest using AES-256-GCM with unique IVs
    const cedulaEncrypted = encryptPII(canonicalCedula);
    const whatsappEncrypted = encryptPII(canonicalWhatsapp);

    // Generate 256-bit cryptographic invitation token
    const { rawToken, tokenHash } = generateCryptographicToken(32);
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(); // 72 hours

    const { data: invitation, error: insertErr } = await supabaseServer
      .from('employee_invitations')
      .insert({
        empresa_id: session.empresaId,
        invited_by_user_id: session.userId,
        token_hash: tokenHash,
        first_name: firstName,
        last_name: lastName,
        email,
        cedula_encrypted: cedulaEncrypted,
        cedula_blind_index: cedulaBlindIndex,
        whatsapp_encrypted: whatsappEncrypted,
        whatsapp_blind_index: whatsappBlindIndex,
        department,
        allowed_expense_categories: allowedCategories,
        status: 'PENDING',
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (insertErr || !invitation) {
      securityLogger.error('invitations.create.insert_failed', insertErr, {
        empresaId: session.empresaId,
      });
      return { success: false, error: 'No se pudo generar la invitación del empleado.' };
    }

    // Fetch company name and FTUX state
    const { data: company } = await supabaseServer
      .from('empresas')
      .select('nombre, ftux_state')
      .eq('id', session.empresaId)
      .single();

    const companyName = company?.nombre || 'tu empresa';
    const magicLinkUrl = `${serverEnv.NEXT_PUBLIC_APP_URL}/invitacion/${rawToken}`;

    // Generate high-contrast QR Code Data URL for instant mobile onboarding
    const qrCodeDataUrl = await QRCode.toDataURL(magicLinkUrl, {
      width: 280,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });

    // Mark FTUX step 2 (first_employee_invited) as completed
    const currentFtux = (company?.ftux_state as Record<string, unknown> | null) ?? {};
    await supabaseServer
      .from('empresas')
      .update({
        ftux_state: {
          ...currentFtux,
          first_employee_invited: true,
        },
      })
      .eq('id', session.empresaId);

    // Attempt automated WhatsApp invitation delivery (non-blocking if WhatsApp sandbox limits apply)
    let whatsappDispatched = false;
    try {
      const inviteMessage =
        `👋 *¡Hola ${firstName}!*\n\n` +
        `Has sido invitado a unirte a *${companyName}* en *Rendy* para gestionar tus viáticos y reembolsos corporativos.\n\n` +
        `🔐 *Activa tu cuenta aquí (enlace único):*\n${magicLinkUrl}\n\n` +
        `Una vez creada tu contraseña, podrás enviarnos fotos de tus facturas directamente por este chat.`;

      await enviarMensajeWhatsApp(canonicalWhatsapp, inviteMessage);
      whatsappDispatched = true;
    } catch {
      whatsappDispatched = false;
    }

    securityLogger.info('invitations.create.succeeded', {
      invitationId: invitation.id,
      empresaId: session.empresaId,
      whatsappDispatched,
    });

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/configuracion');

    return {
      success: true,
      data: {
        invitationId: invitation.id,
        employeeFullName: `${firstName} ${lastName}`,
        email,
        magicLinkUrl,
        qrCodeDataUrl,
        whatsappDispatched,
        expiresAt,
      },
    };
  } catch (error) {
    securityLogger.error('invitations.create.unexpected_error', error);
    return { success: false, error: 'Error inesperado al crear la invitación.' };
  }
}

/**
 * @name getInvitationPreviewAction
 * @description [Business Logic]: Validates a magic link invitation token and returns non-sensitive
 * onboarding context (company name, employee first name, department, and allowed expense categories)
 * for the employee activation screen.
 */
export async function getInvitationPreviewAction(
  rawToken: string
): Promise<InvitationPreviewData> {
  try {
    if (!rawToken || rawToken.length < 20) {
      return { valid: false, error: 'El enlace de invitación es inválido.' };
    }

    const tokenHash = hashSha256(rawToken);

    const { data: invitation } = await supabaseServer
      .from('employee_invitations')
      .select(`
        id,
        first_name,
        last_name,
        email,
        department,
        allowed_expense_categories,
        status,
        expires_at,
        empresas!empresa_id ( nombre )
      `)
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (!invitation) {
      return { valid: false, error: 'Esta invitación no existe o ya fue utilizada.' };
    }

    if (invitation.status !== 'PENDING') {
      return {
        valid: false,
        error:
          invitation.status === 'ACCEPTED'
            ? 'Esta invitación ya fue aceptada. Inicia sesión con tu correo y contraseña.'
            : 'Esta invitación ha sido revocada o expiró.',
      };
    }

    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      await supabaseServer
        .from('employee_invitations')
        .update({ status: 'EXPIRED' })
        .eq('id', invitation.id);
      return { valid: false, error: 'Este enlace de invitación ha expirado. Solicita uno nuevo.' };
    }

    const empresaRel = invitation.empresas as unknown as { nombre?: string } | null;

    return {
      valid: true,
      firstName: invitation.first_name,
      lastName: invitation.last_name,
      email: invitation.email,
      department: invitation.department,
      companyName: empresaRel?.nombre || 'Organización Corporativa',
      allowedCategories: invitation.allowed_expense_categories as ExpenseCategoryPermissions,
      expiresAt: invitation.expires_at,
    };
  } catch {
    return { valid: false, error: 'No se pudo verificar el enlace de invitación.' };
  }
}

/**
 * @name acceptEmployeeInvitationAction
 * @description [Business Logic]: Completes employee onboarding by verifying the single-use token,
 * hashing the chosen password with Argon2id, provisioning the EMPLOYEE account with encrypted PII
 * and category permissions, establishing an authenticated Ed25519 + RTR session, and returning
 * the official WhatsApp bot deep link.
 */
export async function acceptEmployeeInvitationAction(
  rawInput: unknown
): Promise<{
  success: boolean;
  error?: string;
  whatsappBotUrl?: string;
  companyName?: string;
}> {
  try {
    const headerStore = await headers();
    const forwarded = headerStore.get('x-forwarded-for');
    const rawIp = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
    const userAgent = headerStore.get('user-agent') || 'unknown';
    const ipHash = hashSha256(rawIp);
    const userAgentHash = hashSha256(userAgent);

    const rateVerdict = await enforceRateLimit(ipHash, RATE_LIMIT_POLICIES.AUTH_STRICT);
    if (!rateVerdict.allowed) {
      return {
        success: false,
        error: `Demasiados intentos. Espera ${rateVerdict.retryAfterSeconds} segundos.`,
      };
    }

    const parsed = AcceptInvitationSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || 'Datos de activación inválidos.',
      };
    }

    const { token, password } = parsed.data;
    const tokenHash = hashSha256(token);

    const { data: invitation } = await supabaseServer
      .from('employee_invitations')
      .select(`
        *,
        empresas!empresa_id ( nombre )
      `)
      .eq('token_hash', tokenHash)
      .eq('status', 'PENDING')
      .maybeSingle();

    if (!invitation || new Date(invitation.expires_at).getTime() <= Date.now()) {
      return {
        success: false,
        error: 'El enlace de invitación es inválido o ha expirado.',
      };
    }

    const passwordHash = await hashPassword(password);
    const fullName = `${invitation.first_name} ${invitation.last_name}`.trim();

    // 1. Provision Active Employee Account
    const { data: createdEmployee, error: userErr } = await supabaseServer
      .from('usuarios')
      .insert({
        empresa_id: invitation.empresa_id,
        nombre: fullName,
        email: invitation.email,
        telefono_whatsapp: '',
        rol: 'EMPLEADO',
        role: 'EMPLOYEE',
        status: 'ACTIVE',
        password_hash: passwordHash,
        cedula_encrypted: invitation.cedula_encrypted,
        cedula_blind_index: invitation.cedula_blind_index,
        whatsapp_encrypted: invitation.whatsapp_encrypted,
        whatsapp_blind_index: invitation.whatsapp_blind_index,
        department: invitation.department,
        allowed_expense_categories: invitation.allowed_expense_categories,
      })
      .select('id')
      .single();

    if (userErr || !createdEmployee) {
      securityLogger.error('invitations.accept.user_insert_failed', userErr, {
        invitationId: invitation.id,
      });
      return {
        success: false,
        error: 'No se pudo activar tu perfil de empleado. Verifica si ya tienes una cuenta.',
      };
    }

    // 2. Mark Invitation as ACCEPTED (Single-Use Enforcement)
    await supabaseServer
      .from('employee_invitations')
      .update({
        status: 'ACCEPTED',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invitation.id);

    // 3. Issue Authenticated Ed25519 + RTR Session Cookies
    await createAuthenticatedSession({
      userId: createdEmployee.id,
      empresaId: invitation.empresa_id,
      role: 'EMPLOYEE',
      ipHash,
      userAgentHash,
    });

    const empresaRel = invitation.empresas as unknown as { nombre?: string } | null;
    const companyName = empresaRel?.nombre || 'tu empresa';
    const whatsappBotUrl = `https://wa.me/${serverEnv.NEXT_PUBLIC_WHATSAPP_BOT_NUMBER}?text=${encodeURIComponent(
      `Hola Rendy, acabo de activar mi cuenta en ${companyName}`
    )}`;

    securityLogger.info('invitations.accept.succeeded', {
      userId: createdEmployee.id,
      empresaId: invitation.empresa_id,
    });

    return {
      success: true,
      whatsappBotUrl,
      companyName,
    };
  } catch (error) {
    securityLogger.error('invitations.accept.unexpected_error', error);
    return {
      success: false,
      error: 'Error interno al activar la cuenta del colaborador.',
    };
  }
}