/**
 * @name InactivityCheckRoute
 * @description [API Route / Cron]: Endpoint to scan and enforce 2-minute warnings and 3-minute session expirations.
 * Can be triggered periodically by serverless cron jobs (e.g., Vercel Cron, Supabase pg_cron, or external HTTP monitors).
 */

import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';
import { checkInactiveSessions } from '@/lib/services/inactivityManager';

export async function GET() {
  try {
    const result = await checkInactiveSessions(supabase);
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    console.error('❌ Error executing inactivity check:', error);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const result = await checkInactiveSessions(supabase);
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    console.error('❌ Error executing inactivity check:', error);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

