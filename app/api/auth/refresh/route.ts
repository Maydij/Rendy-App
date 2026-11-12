import { NextRequest, NextResponse } from 'next/server';
import {
  REFRESH_COOKIE_NAME,
  rotateRefreshTokenSession,
} from '@/lib/security/session';

/**
 * @name POST /api/auth/refresh
 * @description [Security]: Rotates an expired 15-minute Access Token using the HttpOnly
 * Refresh Token cookie, enforcing single-use Refresh Token Rotation (RTR).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawRefresh = request.cookies.get(REFRESH_COOKIE_NAME)?.value;

  if (!rawRefresh) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const rotatedSession = await rotateRefreshTokenSession(rawRefresh);

  if (!rotatedSession) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json(
    {
      authenticated: true,
      role: rotatedSession.role,
    },
    { status: 200 }
  );
}