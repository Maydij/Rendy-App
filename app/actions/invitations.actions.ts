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
import { sendInvitationEmail } from '@/lib/email';
import { buildInvitationMagicLinkUrl } from '@/lib/utils/url';

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
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(128, 'La contraseña no puede exceder 128 caracteres.')
  .regex(/[A-Z]/, 'Debe incluir al menos una letra mayúscula.')
  .regex(/[0-9]/, 'Debe incluir al menos un número.');

const AcceptInvitationSchema = z
  .object({
    token: z.string().min(20, 'Token de invitación inválido.').max(128),
    tempPassword: z.string().trim().min(1, 'Ingresa la contraseña temporal enviada a tu correo.'),
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
  tempPassword: string;
  whatsappDispatched: boolean;
  emailDispatched: boolean;
  expiresAt: string;
}

export interface InvitationPreviewData {
  valid: boolean;
  statusReason?: 'ACTIVE' | 'EXPIRED' | 'ALREADY_ACTIVATED' | 'INVALID';
  error?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  department?: string;
  companyName?: string;
  allowedCategories?: ExpenseCategoryPermissions;
  expiresAt?: string;
  tempPasswordSample?: string;
}

/**
 * @name generateTemporaryPassword
 * @description [Helper]: Generates an unambiguous alphanumeric temporary access code (e.g. TMP-9831-KX)
 * excluding easily confused characters (0, O, 1, I).
 */
function generateTemporaryPassword(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part2 = Array.from({ length: 2 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `TMP-${part1}-${part2}`;
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
    const headerStore = await headers();

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

    // Generate 256-bit cryptographic invitation token and temporary access password
    const { rawToken, tokenHash } = generateCryptographicToken(32);
    const tempPassword = generateTemporaryPassword();
    const tempPasswordHash = hashSha256(tempPassword.toUpperCase().trim());
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(); // 72 hours

    // Try inserting with temp_password and temp_password_hash; fall back if migration 015 is pending
    let invitationId: string | null = null;
    const insertPayloadWithTemp = {
      empresa_id: session.empresaId,
      invited_by_user_id: session.userId,
      token_hash: tokenHash,
      temp_password: tempPassword,
      temp_password_hash: tempPasswordHash,
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
    };

    const { data: invitation, error: insertErr } = await supabaseServer
      .from('employee_invitations')
      .insert(insertPayloadWithTemp)
      .select('id')
      .single();

    if (insertErr || !invitation) {
      if (insertErr?.code === '42703' || insertErr?.message?.includes('temp_password')) {
        const { temp_password: _tp, temp_password_hash: _tph, ...legacyPayload } = insertPayloadWithTemp;
        const { data: fallbackInvitation, error: fallbackErr } = await supabaseServer
          .from('employee_invitations')
          .insert(legacyPayload)
          .select('id')
          .single();

        if (fallbackErr || !fallbackInvitation) {
          securityLogger.error('invitations.create.fallback_insert_failed', fallbackErr, {
            empresaId: session.empresaId,
          });
          return { success: false, error: 'No se pudo generar la invitación del empleado.' };
        }
        invitationId = fallbackInvitation.id;
      } else {
        securityLogger.error('invitations.create.insert_failed', insertErr, {
          empresaId: session.empresaId,
        });
        return { success: false, error: 'No se pudo generar la invitación del empleado.' };
      }
    } else {
      invitationId = invitation.id;
    }

    // Fetch company name and FTUX state
    const { data: company } = await supabaseServer
      .from('empresas')
      .select('nombre, ftux_state')
      .eq('id', session.empresaId)
      .single();

    const companyName = company?.nombre || 'tu empresa';
    const magicLinkUrl = buildInvitationMagicLinkUrl(rawToken, tempPassword, headerStore);

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
        `🔑 *Tu clave temporal de activación:* \`${tempPassword}\`\n\n` +
        `🔐 *Activa tu cuenta aquí (enlace único):*\n${magicLinkUrl}\n\n` +
        `Al abrir el enlace, ingresa tu clave temporal y define tu contraseña personal para acceder de inmediato a tu dashboard.`;

      await enviarMensajeWhatsApp(canonicalWhatsapp, inviteMessage);
      whatsappDispatched = true;
    } catch {
      whatsappDispatched = false;
    }

    // Attempt automated email invitation delivery (non-blocking: graceful degradation if Gmail SMTP is not configured)
    let emailDispatched = false;
    try {
      const emailResult = await sendInvitationEmail(email, {
        firstName,
        companyName,
        magicLinkUrl,
        tempPassword,
        expiresAt,
      });
      emailDispatched = emailResult.dispatched;
      if (!emailResult.dispatched) {
        securityLogger.warn('invitations.create.email_failed', {
          invitationId,
          errorDetail: emailResult.errorDetail,
        });
      }
    } catch {
      emailDispatched = false;
    }

    securityLogger.info('invitations.create.succeeded', {
      invitationId,
      empresaId: session.empresaId,
      whatsappDispatched,
      emailDispatched,
    });

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/configuracion');

    return {
      success: true,
      data: {
        invitationId: invitationId!,
        employeeFullName: `${firstName} ${lastName}`,
        email,
        magicLinkUrl,
        qrCodeDataUrl,
        tempPassword,
        whatsappDispatched,
        emailDispatched,
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
 * onboarding context (company name, employee first name, department, allowed expense categories,
 * and token expiration status) for the employee password configuration screen.
 */
export async function getInvitationPreviewAction(
  rawToken: string
): Promise<InvitationPreviewData> {
  try {
    if (!rawToken || rawToken.length < 20) {
      return { valid: false, statusReason: 'INVALID', error: 'El enlace de invitación es inválido.' };
    }

    const tokenHash = hashSha256(rawToken);

    const { data: invitation } = await supabaseServer
      .from('employee_invitations')
      .select(`
        *,
        empresas!empresa_id ( nombre )
      `)
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (!invitation) {
      return { valid: false, statusReason: 'INVALID', error: 'Esta invitación no existe o ya fue utilizada.' };
    }

    const empresaRel = invitation.empresas as unknown as { nombre?: string } | null;
    const companyName = empresaRel?.nombre || 'tu empresa';

    if (invitation.status !== 'PENDING') {
      return {
        valid: false,
        statusReason: invitation.status === 'ACCEPTED' ? 'ALREADY_ACTIVATED' : 'EXPIRED',
        error:
          invitation.status === 'ACCEPTED'
            ? 'Esta invitación ya fue aceptada. Inicia sesión con tu correo y contraseña.'
            : 'Esta invitación ha sido revocada o expiró.',
        email: invitation.email,
        companyName,
      };
    }

    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      await supabaseServer
        .from('employee_invitations')
        .update({ status: 'EXPIRED' })
        .eq('id', invitation.id);
      return {
        valid: false,
        statusReason: 'EXPIRED',
        error: 'Este enlace de invitación ha expirado. Solicita a un administrador de tu empresa que te reenvíe una nueva invitación.',
        email: invitation.email,
        companyName,
      };
    }

    return {
      valid: true,
      statusReason: 'ACTIVE',
      firstName: invitation.first_name,
      lastName: invitation.last_name,
      email: invitation.email,
      department: invitation.department,
      companyName,
      allowedCategories: invitation.allowed_expense_categories as ExpenseCategoryPermissions,
      expiresAt: invitation.expires_at,
      tempPasswordSample: (invitation as { temp_password?: string }).temp_password || undefined,
    };
  } catch {
    return { valid: false, statusReason: 'INVALID', error: 'No se pudo verificar el enlace de invitación.' };
  }
}

/**
 * @name acceptEmployeeInvitationAction
 * @description [Business Logic]: Completes employee onboarding by verifying the single-use token,
 * validating the temporary activation password, hashing the chosen password with Argon2id,
 * provisioning the EMPLOYEE account with encrypted PII, establishing an authenticated Ed25519 + RTR session,
 * and returning the redirect target to the employee dashboard.
 */
export async function acceptEmployeeInvitationAction(
  rawInput: unknown
): Promise<{
  success: boolean;
  error?: string;
  errorType?: 'INVALID_TEMP_PASSWORD' | 'MATCH_ERROR' | 'GENERIC';
  redirectUrl?: string;
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

    const { token, tempPassword, password } = parsed.data;
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

    // Validate temporary password if registered on the invitation
    const storedTemp = (invitation as { temp_password?: string }).temp_password;
    if (storedTemp && storedTemp.trim().length > 0) {
      const cleanStored = storedTemp.trim().toUpperCase();
      const cleanInput = tempPassword.trim().toUpperCase();
      if (cleanStored !== cleanInput) {
        return {
          success: false,
          errorType: 'INVALID_TEMP_PASSWORD',
          error: 'Contraseña temporal inválida. Verifica los datos del correo de invitación e inténtalo nuevamente.',
        };
      }
    }

    const passwordHash = await hashPassword(password);
    const fullName = `${invitation.first_name} ${invitation.last_name}`.trim();

    // 1. Provision Active Employee Account with role 'EMPLOYEE' and rol 'EMPLEADO'
    const userPayloadWithActivo = {
      empresa_id: invitation.empresa_id,
      nombre: fullName,
      email: invitation.email,
      telefono_whatsapp: '',
      rol: 'EMPLEADO',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      activo: true,
      password_hash: passwordHash,
      cedula_encrypted: invitation.cedula_encrypted,
      cedula_blind_index: invitation.cedula_blind_index,
      whatsapp_encrypted: invitation.whatsapp_encrypted,
      whatsapp_blind_index: invitation.whatsapp_blind_index,
      department: invitation.department,
      allowed_expense_categories: invitation.allowed_expense_categories,
    };

    let createdEmployee: { id: string } | null = null;
    const { data: insertedUser, error: userErr } = await supabaseServer
      .from('usuarios')
      .insert(userPayloadWithActivo)
      .select('id')
      .single();

    if (userErr || !insertedUser) {
      // Defensive fallback if migration 014 (column 'activo') has not been applied to Supabase
      const isMissingActivo =
        userErr?.code === 'PGRST204' ||
        userErr?.code === '42703' ||
        userErr?.message?.includes('activo');

      if (isMissingActivo) {
        const { activo: _unused, ...legacyPayload } = userPayloadWithActivo;
        const { data: fallbackUser, error: fallbackErr } = await supabaseServer
          .from('usuarios')
          .insert(legacyPayload)
          .select('id')
          .single();

        if (fallbackErr || !fallbackUser) {
          securityLogger.error('invitations.accept.user_fallback_insert_failed', fallbackErr, {
            invitationId: invitation.id,
          });
          return {
            success: false,
            error: 'No se pudo activar tu perfil de empleado. Verifica si ya tienes una cuenta.',
          };
        }
        createdEmployee = fallbackUser;
      } else {
        securityLogger.error('invitations.accept.user_insert_failed', userErr, {
          invitationId: invitation.id,
        });
        return {
          success: false,
          error: 'No se pudo activar tu perfil de empleado. Verifica si ya tienes una cuenta.',
        };
      }
    } else {
      createdEmployee = insertedUser;
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
      redirectUrl: '/dashboard',
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