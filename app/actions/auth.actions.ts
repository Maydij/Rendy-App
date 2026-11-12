'use server';

import { headers, cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase-server';
import {
  verifyPassword,
  hashSha256,
} from '@/lib/security/crypto';
import {
  enforceRateLimit,
  RATE_LIMIT_POLICIES,
} from '@/lib/security/redis-guard';
import {
  createAuthenticatedSession,
  clearSessionCookies,
  REFRESH_COOKIE_NAME,
  type UserRole,
} from '@/lib/security/session';
import { securityLogger } from '@/lib/security/logger';

const LoginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Ingresa un correo electrónico válido.').max(255),
    password: z.string().min(1, 'Ingresa tu contraseña.').max(128),
  })
  .strict();

// Pre-computed Argon2id dummy hash used to equalize execution timing when an email does not exist
const DUMMY_ARGON2_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHR2YWx1ZTEyMw$8x9+7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0f9e8';

const GENERIC_AUTH_ERROR = 'Credenciales inválidas. Verifica tu correo y contraseña.';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export interface LoginActionResult {
  success: boolean;
  error?: string;
  redirectTo?: string;
}

/**
 * @name loginWithCredentialsAction
 * @description [Business Logic]: Authenticates enterprise administrators and employees using
 * constant-time Argon2id verification, Redis rate-limiting, anti-enumeration timing parity,
 * and automatic role-based routing (/dashboard for ADMIN, /portal for EMPLOYEE).
 */
export async function loginWithCredentialsAction(
  rawInput: unknown
): Promise<LoginActionResult> {
  try {
    const parsed = LoginSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || GENERIC_AUTH_ERROR,
      };
    }

    const { email, password } = parsed.data;
    const headerStore = await headers();
    const forwarded = headerStore.get('x-forwarded-for');
    const rawIp = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
    const userAgent = headerStore.get('user-agent') || 'unknown';

    const ipHash = hashSha256(rawIp);
    const userAgentHash = hashSha256(userAgent);
    const bucketKey = hashSha256(`${rawIp}:${email}`);

    // 1. Enforce strict 5 attempts / 15 minutes rate limit
    const rateVerdict = await enforceRateLimit(bucketKey, RATE_LIMIT_POLICIES.AUTH_STRICT);
    if (!rateVerdict.allowed) {
      return {
        success: false,
        error: `Demasiados intentos de acceso. Intenta nuevamente en ${Math.ceil(
          rateVerdict.retryAfterSeconds / 60
        )} minutos.`,
      };
    }

    // 2. Fetch user record
    const { data: user } = await supabaseServer
      .from('usuarios')
      .select('id, empresa_id, role, status, password_hash, failed_login_attempts, locked_until')
      .eq('email', email)
      .maybeSingle();

    // 3. Anti-Enumeration: Perform dummy Argon2id verification if user does not exist
    if (!user || !user.password_hash) {
      await verifyPassword(DUMMY_ARGON2_HASH, password);
      securityLogger.warn('auth.login.unknown_account', { ipHash });
      return { success: false, error: GENERIC_AUTH_ERROR };
    }

    // 4. Check temporary account lockout
    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
      await verifyPassword(DUMMY_ARGON2_HASH, password);
      return {
        success: false,
        error: 'Cuenta temporalmente bloqueada por seguridad. Intenta nuevamente en 15 minutos.',
      };
    }

    // 5. Constant-time Argon2id Password Verification
    const isPasswordValid = await verifyPassword(user.password_hash, password);

    if (!isPasswordValid || user.status !== 'ACTIVE') {
      const nextAttempts = (user.failed_login_attempts ?? 0) + 1;
      const shouldLock = nextAttempts >= MAX_FAILED_ATTEMPTS;

      await supabaseServer
        .from('usuarios')
        .update({
          failed_login_attempts: nextAttempts,
          locked_until: shouldLock
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
            : null,
        })
        .eq('id', user.id);

      securityLogger.warn('auth.login.failed_verification', {
        userId: user.id,
        ipHash,
        locked: shouldLock,
      });

      return { success: false, error: GENERIC_AUTH_ERROR };
    }

    // 6. Reset failed attempt counters on success
    await supabaseServer
      .from('usuarios')
      .update({
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    const role = (user.role === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE') as UserRole;

    // 7. Issue Ed25519 Access Token + Rotating Refresh Token
    await createAuthenticatedSession({
      userId: user.id,
      empresaId: user.empresa_id,
      role,
      ipHash,
      userAgentHash,
    });

    securityLogger.info('auth.login.succeeded', {
      userId: user.id,
      empresaId: user.empresa_id,
      role,
    });

    return {
      success: true,
      redirectTo: role === 'ADMIN' ? '/dashboard' : '/portal',
    };
  } catch (error) {
    securityLogger.error('auth.login.unexpected_error', error);
    return {
      success: false,
      error: 'No se pudo completar el inicio de sesión. Intenta nuevamente.',
    };
  }
}

/**
 * @name logoutAction
 * @description [Business Logic]: Revokes the active Refresh Token family in PostgreSQL,
 * destroys HttpOnly session cookies, and redirects to /login.
 */
export async function logoutAction(): Promise<never> {
  try {
    const cookieStore = await cookies();
    const rawRefresh = cookieStore.get(REFRESH_COOKIE_NAME)?.value;

    if (rawRefresh) {
      const tokenHash = hashSha256(rawRefresh);
      await supabaseServer
        .from('refresh_token_families')
        .update({
          family_revoked: true,
          revoked_reason: 'USER_LOGOUT',
          updated_at: new Date().toISOString(),
        })
        .eq('current_token_hash', tokenHash);
    }
  } finally {
    await clearSessionCookies();
  }

  redirect('/login');
}