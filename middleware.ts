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
 * @description [Business Logic]: Enforces Zero-Trust authentication and session validation
 * for protected application routes (/dashboard), while safely redirecting legacy /portal requests
 * to the unified role-isolated /dashboard.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Legacy portal route: redirect directly to the unified dashboard
  if (pathname.startsWith('/portal')) {
    return applySecurityHeaders(NextResponse.redirect(new URL('/dashboard', request.url)));
  }

  const isDashboardRoute = pathname.startsWith('/dashboard');
  const isAuthPage = pathname === '/login' || pathname === '/registro';

  if (!isDashboardRoute && !isAuthPage) {
    return applySecurityHeaders(NextResponse.next());
  }

  const accessToken = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  const hasRefreshCookie = Boolean(request.cookies.get(REFRESH_COOKIE_NAME)?.value);
  const session = accessToken ? await verifyAccessToken(accessToken) : null;

  // Redirect already-authenticated users away from /login or /registro to /dashboard
  if (isAuthPage && session) {
    return applySecurityHeaders(NextResponse.redirect(new URL('/dashboard', request.url)));
  }

  // Protected routes: require valid Access Token (or transparently refresh via Route Handler)
  if (isDashboardRoute) {
    if (!session) {
      if (hasRefreshCookie) {
        // Transparent session refresh via Route Handler where Set-Cookie headers are supported
        const refreshUrl = new URL('/api/auth/refresh', request.url);
        refreshUrl.searchParams.set('next', pathname);
        return applySecurityHeaders(NextResponse.redirect(refreshUrl));
      }

      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return applySecurityHeaders(NextResponse.redirect(loginUrl));
    }
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ['/dashboard/:path*', '/portal', '/portal/:path*', '/login', '/registro'],
};