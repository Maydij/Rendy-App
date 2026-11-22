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
 * `role`) on the server. If the Access Token is valid, returns the verified payload immediately.
 * In Server Actions (POST), will attempt Refresh Token Rotation if expired. In Server Components (GET),
 * safely redirects to /login if unauthenticated without crashing on read-only cookie stores.
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
    try {
      const rotated = await rotateRefreshTokenSession(refreshToken);
      if (rotated) return rotated;
    } catch {
      // In Next.js Server Components, cookies cannot be modified during rendering.
      // Transparent session refresh is orchestrated at the Middleware and Route Handler layers.
    }
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
    redirect('/dashboard');
  }
  return session;
}