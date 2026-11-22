import { NextRequest, NextResponse } from 'next/server';
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  rotateRefreshTokenSession,
} from '@/lib/security/session';
import { serverEnv } from '@/lib/security/env';

/**
 * @name sanitizeNextPath
 * @description [Security]: Validates and sanitizes the redirect destination path to prevent
 * Open Redirect and SSRF attacks (OWASP A01:2021).
 */
function sanitizeNextPath(rawNext: string | null): string {
  if (!rawNext || !rawNext.startsWith('/') || rawNext.startsWith('//')) {
    return '/dashboard';
  }
  return rawNext;
}

/**
 * @name GET /api/auth/refresh
 * @description [Security]: Transparently rotates an expired Access Token using the HttpOnly
 * Refresh Token cookie during page navigation, issuing new cookies and redirecting back to the destination.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const isSecure = serverEnv.NODE_ENV === 'production';
  const targetNext = sanitizeNextPath(request.nextUrl.searchParams.get('next'));
  const rawRefresh = request.cookies.get(REFRESH_COOKIE_NAME)?.value;

  if (!rawRefresh) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', targetNext);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set(ACCESS_COOKIE_NAME, '', {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    });
    response.cookies.set(REFRESH_COOKIE_NAME, '', {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    });
    return response;
  }

  const rotated = await rotateRefreshTokenSession(rawRefresh);

  if (!rotated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', targetNext);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set(ACCESS_COOKIE_NAME, '', {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    });
    response.cookies.set(REFRESH_COOKIE_NAME, '', {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    });
    return response;
  }

  // Redirect legacy /portal queries to unified /dashboard
  const destination = targetNext.startsWith('/portal') ? '/dashboard' : targetNext;

  const response = NextResponse.redirect(new URL(destination, request.url));

  response.cookies.set(ACCESS_COOKIE_NAME, rotated.accessToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'strict',
    path: '/',
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });

  response.cookies.set(REFRESH_COOKIE_NAME, rotated.refreshToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'strict',
    path: '/',
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });

  return response;
}

/**
 * @name POST /api/auth/refresh
 * @description [Security]: Rotates an expired 15-minute Access Token using the HttpOnly
 * Refresh Token cookie for AJAX / background client requests, enforcing single-use RTR.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const isSecure = serverEnv.NODE_ENV === 'production';
  const rawRefresh = request.cookies.get(REFRESH_COOKIE_NAME)?.value;

  if (!rawRefresh) {
    const response = NextResponse.json({ authenticated: false }, { status: 401 });
    response.cookies.set(ACCESS_COOKIE_NAME, '', {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    });
    response.cookies.set(REFRESH_COOKIE_NAME, '', {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    });
    return response;
  }

  const rotated = await rotateRefreshTokenSession(rawRefresh);

  if (!rotated) {
    const response = NextResponse.json({ authenticated: false }, { status: 401 });
    response.cookies.set(ACCESS_COOKIE_NAME, '', {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    });
    response.cookies.set(REFRESH_COOKIE_NAME, '', {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    });
    return response;
  }

  const response = NextResponse.json(
    {
      authenticated: true,
      role: rotated.role,
    },
    { status: 200 }
  );

  response.cookies.set(ACCESS_COOKIE_NAME, rotated.accessToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'strict',
    path: '/',
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });

  response.cookies.set(REFRESH_COOKIE_NAME, rotated.refreshToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'strict',
    path: '/',
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });

  return response;
}
