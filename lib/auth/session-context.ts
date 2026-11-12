import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  verifyAccessToken,
  rotateRefreshTokenSession,
  type AuthenticatedSessionPayload,
} from '@/lib/security/session';

/**
 * @name requireAuthenticatedSession
 * @description [Business Logic]: Resolves the active multi-tenant session (`userId`, `empresaId`,
 * `role`) on the server, rotating the Refresh Token if the 15-minute Access Token expired,
 * or redirecting to /login if unauthenticated.
 */
export async function requireAuthenticatedSession(): Promise<AuthenticatedSessionPayload> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value;

  if (accessToken) {
    const verified = await verifyAccessToken(accessToken);
    if (verified) return verified;
  }

  const refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value;
  if (refreshToken) {
    const rotated = await rotateRefreshTokenSession(refreshToken);
    if (rotated) return rotated;
  }

  redirect('/login');
}

/**
 * @name requireAdminSession
 * @description [Security]: Enforces that the current server action or page is executed strictly
 * by an authenticated Project Administrator (`role === 'ADMIN'`).
 */
export async function requireAdminSession(): Promise<AuthenticatedSessionPayload> {
  const session = await requireAuthenticatedSession();
  if (session.role !== 'ADMIN') {
    redirect('/portal');
  }
  return session;
}