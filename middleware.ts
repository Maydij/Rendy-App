import { NextRequest, NextResponse } from 'next/server';
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  verifyAccessToken,
} from '@/lib/security/session';

export const runtime = 'nodejs';

/**
 * @name applySecurityHeaders
 * @description [Security]: Enforces strict OWASP HTTP hardening headers (HSTS, Anti-Clickjacking,
 * MIME-sniff protection, strict Referrer-Policy, and restrictive Permissions-Policy).
 */
function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  );
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), usb=()'
  );
  return response;
}

/**
 * @name middleware
 * @description [Business Logic]: Enforces Zero-Trust authentication and Role-Based Access Control
 * (RBAC), isolating Project Administrator views (/dashboard) from Employee views (/portal).
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  const isAdminRoute = pathname.startsWith('/dashboard');
  const isEmployeePortalRoute = pathname.startsWith('/portal');
  const isAuthPage = pathname === '/login' || pathname === '/registro';

  if (!isAdminRoute && !isEmployeePortalRoute && !isAuthPage) {
    return applySecurityHeaders(NextResponse.next());
  }

  const accessToken = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  const hasRefreshCookie = Boolean(request.cookies.get(REFRESH_COOKIE_NAME)?.value);
  const session = accessToken ? await verifyAccessToken(accessToken) : null;

  // Redirect already-authenticated users away from /login or /registro
  if (isAuthPage && session) {
    const destination = session.role === 'ADMIN' ? '/dashboard' : '/portal';
    return applySecurityHeaders(NextResponse.redirect(new URL(destination, request.url)));
  }

  // Protected routes: require valid Access Token (or allow client/API refresh flow if refresh cookie exists)
  if (isAdminRoute || isEmployeePortalRoute) {
    if (!session && !hasRefreshCookie) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return applySecurityHeaders(NextResponse.redirect(loginUrl));
    }

    // Strict RBAC Enforcement: Employees cannot access Administrator /dashboard routes
    if (session && isAdminRoute && session.role !== 'ADMIN') {
      return applySecurityHeaders(NextResponse.redirect(new URL('/portal', request.url)));
    }
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ['/dashboard/:path*', '/portal/:path*', '/login', '/registro'],
};