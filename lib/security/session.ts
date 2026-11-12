import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { supabaseServer } from '@/lib/supabase-server';
import { serverEnv } from './env';
import { generateCryptographicToken, hashSha256 } from './crypto';
import { securityLogger } from './logger';

export const ACCESS_COOKIE_NAME = 'rendy_access_token';
export const REFRESH_COOKIE_NAME = 'rendy_refresh_token';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const PKCS8_ED25519_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

export type UserRole = 'ADMIN' | 'EMPLOYEE';

export interface AuthenticatedSessionPayload {
  userId: string;
  empresaId: string;
  role: UserRole;
  familyId: string;
}

interface Ed25519KeyPair {
  privateKey: crypto.KeyObject;
  publicKey: crypto.KeyObject;
}

let cachedKeyPair: Ed25519KeyPair | null = null;

/**
 * @name getEd25519KeyPair
 * @description [Security]: Deterministically derives an asymmetric Ed25519 key pair from the
 * server signing secret so short-lived Access Tokens are signed with EdDSA (never HS256).
 */
function getEd25519KeyPair(): Ed25519KeyPair {
  if (cachedKeyPair) return cachedKeyPair;

  const seed = crypto.createHash('sha256').update(serverEnv.SESSION_SIGNING_SECRET).digest();
  const privateKey = crypto.createPrivateKey({
    key: Buffer.concat([PKCS8_ED25519_PREFIX, seed]),
    format: 'der',
    type: 'pkcs8',
  });
  const publicKey = crypto.createPublicKey(privateKey);

  cachedKeyPair = { privateKey, publicKey };
  return cachedKeyPair;
}

/**
 * @name signAccessToken
 * @description [Business Logic]: Issues a 15-minute EdDSA (Ed25519) JWT containing the
 * authenticated user's tenant ID (`empresaId`) and RBAC role (`ADMIN` or `EMPLOYEE`).
 */
export async function signAccessToken(payload: AuthenticatedSessionPayload): Promise<string> {
  const { privateKey } = getEd25519KeyPair();

  return new SignJWT({
    empresaId: payload.empresaId,
    role: payload.role,
    familyId: payload.familyId,
  })
    .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT' })
    .setSubject(payload.userId)
    .setIssuer('rendy-auth')
    .setAudience('rendy-platform')
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(privateKey);
}

/**
 * @name verifyAccessToken
 * @description [Security]: Verifies the asymmetric Ed25519 signature and expiration of an
 * incoming Access Token, returning the strictly typed tenant and role context.
 */
export async function verifyAccessToken(
  token: string
): Promise<AuthenticatedSessionPayload | null> {
  try {
    const { publicKey } = getEd25519KeyPair();
    const { payload } = await jwtVerify(token, publicKey, {
      algorithms: ['EdDSA'],
      issuer: 'rendy-auth',
      audience: 'rendy-platform',
    });

    return extractSessionFromJwtPayload(payload);
  } catch {
    return null;
  }
}

function extractSessionFromJwtPayload(
  payload: JWTPayload
): AuthenticatedSessionPayload | null {
  const userId = payload.sub;
  const empresaId = payload.empresaId;
  const role = payload.role;
  const familyId = payload.familyId;

  if (
    typeof userId !== 'string' ||
    typeof empresaId !== 'string' ||
    (role !== 'ADMIN' && role !== 'EMPLOYEE') ||
    typeof familyId !== 'string'
  ) {
    return null;
  }

  return { userId, empresaId, role, familyId };
}

/**
 * @name setSessionCookies
 * @description [Security]: Writes HttpOnly, SameSite=Strict, Secure cookies for both the
 * short-lived Access Token and the rotating Refresh Token.
 */
export async function setSessionCookies(
  accessToken: string,
  rawRefreshToken: string
): Promise<void> {
  const cookieStore = await cookies();
  const isSecure = serverEnv.NODE_ENV === 'production';

  cookieStore.set(ACCESS_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'strict',
    path: '/',
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });

  cookieStore.set(REFRESH_COOKIE_NAME, rawRefreshToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'strict',
    path: '/',
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
}

/**
 * @name clearSessionCookies
 * @description [Security]: Immediately expires and clears all authentication cookies on logout
 * or security revocation.
 */
export async function clearSessionCookies(): Promise<void> {
  const cookieStore = await cookies();
  const isSecure = serverEnv.NODE_ENV === 'production';

  cookieStore.set(ACCESS_COOKIE_NAME, '', {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });

  cookieStore.set(REFRESH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
}

/**
 * @name createAuthenticatedSession
 * @description [Business Logic]: Creates a new Refresh Token family in PostgreSQL, signs an
 * Ed25519 Access Token, and binds both to strict HttpOnly cookies upon successful login or onboarding.
 */
export async function createAuthenticatedSession(params: {
  userId: string;
  empresaId: string;
  role: UserRole;
  ipHash: string;
  userAgentHash: string;
}): Promise<void> {
  const { rawToken: rawRefreshToken, tokenHash: refreshTokenHash } = generateCryptographicToken(48);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString();

  const { data: family, error } = await supabaseServer
    .from('refresh_token_families')
    .insert({
      user_id: params.userId,
      empresa_id: params.empresaId,
      current_token_hash: refreshTokenHash,
      family_revoked: false,
      ip_hash: params.ipHash,
      user_agent_hash: params.userAgentHash,
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  if (error || !family) {
    throw new Error('Failed to create refresh token family.');
  }

  const accessToken = await signAccessToken({
    userId: params.userId,
    empresaId: params.empresaId,
    role: params.role,
    familyId: family.id,
  });

  await setSessionCookies(accessToken, rawRefreshToken);
}

/**
 * @name rotateRefreshTokenSession
 * @description [Security]: Executes Refresh Token Rotation (RTR). If an already-used or revoked
 * refresh token is presented, it immediately revokes the entire token family (compromise detection)
 * and destroys the session.
 */
export async function rotateRefreshTokenSession(
  rawRefreshToken: string
): Promise<AuthenticatedSessionPayload | null> {
  const presentedHash = hashSha256(rawRefreshToken);

  const { data: family } = await supabaseServer
    .from('refresh_token_families')
    .select('id, user_id, empresa_id, family_revoked, expires_at')
    .eq('current_token_hash', presentedHash)
    .maybeSingle();

  if (!family) {
    securityLogger.warn('auth.rtr.unrecognized_or_reused_token');
    await clearSessionCookies();
    return null;
  }

  if (family.family_revoked || new Date(family.expires_at).getTime() <= Date.now()) {
    await supabaseServer
      .from('refresh_token_families')
      .update({
        family_revoked: true,
        revoked_reason: 'TOKEN_REUSE_OR_EXPIRED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', family.id);

    await clearSessionCookies();
    securityLogger.warn('auth.rtr.family_revoked', { familyId: family.id });
    return null;
  }

  // Verify user is still ACTIVE
  const { data: user } = await supabaseServer
    .from('usuarios')
    .select('id, empresa_id, role, status')
    .eq('id', family.user_id)
    .single();

  if (!user || user.status !== 'ACTIVE') {
    await supabaseServer
      .from('refresh_token_families')
      .update({ family_revoked: true, revoked_reason: 'USER_INACTIVE' })
      .eq('id', family.id);
    await clearSessionCookies();
    return null;
  }

  const role = (user.role === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE') as UserRole;
  const { rawToken: nextRawRefresh, tokenHash: nextRefreshHash } = generateCryptographicToken(48);

  const { error: rotateErr } = await supabaseServer
    .from('refresh_token_families')
    .update({
      current_token_hash: nextRefreshHash,
      updated_at: new Date().toISOString(),
    })
    .eq('id', family.id)
    .eq('current_token_hash', presentedHash);

  if (rotateErr) {
    await clearSessionCookies();
    return null;
  }

  const sessionPayload: AuthenticatedSessionPayload = {
    userId: user.id,
    empresaId: user.empresa_id,
    role,
    familyId: family.id,
  };

  const nextAccessToken = await signAccessToken(sessionPayload);
  await setSessionCookies(nextAccessToken, nextRawRefresh);

  return sessionPayload;
}