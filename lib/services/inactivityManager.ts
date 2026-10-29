/**
 * @name InactivityManager
 * @description [Business Logic & Orchestration]: Manages conversation session timeouts and warning notifications
 * for the Rendy WhatsApp interface.
 *
 * Requirements:
 * 1. 2-Minute Inactivity Warning: When 2 minutes have elapsed without user interaction, notifies the user
 *    that their session will automatically close in 1 minute due to inactivity (reaching the 3-minute limit).
 * 2. 3-Minute Expiration: Closes the session if no activity occurs for 3 minutes, resetting state to 'INICIO'
 *    and sending the main navigation menu.
 * 3. Proactive In-Memory Timers: Uses high-precision Node.js timeouts for instantaneous real-time execution.
 * 4. Database-Backed Fallback: Idempotently tracks `aviso_inactividad_enviado` and `ultima_interaccion` to allow
 *    cron/worker invocations without duplicate notifications.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  enviarMensajeWhatsApp,
  enviarBotonesWhatsApp,
  enviarMenuPrincipalListMessage,
} from '@/app/lib/whatsapp';
import type { DatosTemporalesSesion, SesionWhatsAppRecord } from '@/lib/types/whatsapp';

/**
 * Inactivity warning window: 2 minutes in milliseconds.
 */
export const INACTIVITY_WARNING_MS = 2 * 60 * 1000; // 120,000 ms (2 minutes)

/**
 * Total inactivity expiration window: 3 minutes in milliseconds.
 */
export const INACTIVITY_EXPIRATION_MS = 3 * 60 * 1000; // 180,000 ms (3 minutes)

interface ActiveSessionTimers {
  warningTimer: NodeJS.Timeout;
  expirationTimer: NodeJS.Timeout;
  scheduledAt: number;
}

/**
 * In-memory map of active session timers indexed by normalized phone number.
 */
const activeTimersStore = new Map<string, ActiveSessionTimers>();

export interface ScheduleTimersParams {
  supabase: SupabaseClient;
  telefono: string;
  empleadoId?: string | null;
  employeeName?: string;
}

/**
 * @name clearInactivityTimers
 * @description [Resource Hygiene]: Clears any pending warning and expiration timers for a phone number.
 */
export function clearInactivityTimers(telefono: string): void {
  const existing = activeTimersStore.get(telefono);
  if (existing) {
    clearTimeout(existing.warningTimer);
    clearTimeout(existing.expirationTimer);
    activeTimersStore.delete(telefono);
  }
}

/**
 * @name scheduleInactivityTimers
 * @description [Business Logic]: Schedules proactive 2-minute warning and 3-minute expiration timers
 * for an active conversation flow.
 */
export function scheduleInactivityTimers({
  supabase,
  telefono,
  empleadoId,
  employeeName,
}: ScheduleTimersParams): void {
  // Clear any existing timer for this phone before setting new ones
  clearInactivityTimers(telefono);

  // 1. Warning timer at 2 minutes (120,000 ms)
  const warningTimer = setTimeout(async () => {
    try {
      await executeInactivityWarning(supabase, telefono);
    } catch (error) {
      console.error(`❌ Error executing 2-minute inactivity warning for ${telefono}:`, error);
    }
  }, INACTIVITY_WARNING_MS);

  // 2. Expiration timer at 3 minutes (180,000 ms)
  const expirationTimer = setTimeout(async () => {
    try {
      await executeSessionExpiration(supabase, telefono, empleadoId, employeeName);
    } catch (error) {
      console.error(`❌ Error executing 3-minute session expiration for ${telefono}:`, error);
    }
  }, INACTIVITY_EXPIRATION_MS);

  activeTimersStore.set(telefono, {
    warningTimer,
    expirationTimer,
    scheduledAt: Date.now(),
  });
}

/**
 * @name executeInactivityWarning
 * @description [Business Logic]: Sends the 2-minute warning message informing the employee
 * that the session will close in 1 minute unless kept active.
 */
async function executeInactivityWarning(
  supabase: SupabaseClient,
  telefono: string
): Promise<boolean> {
  const { data: sesionData, error } = await supabase
    .from('sesiones_whatsapp')
    .select('*')
    .eq('telefono', telefono)
    .maybeSingle();

  if (error || !sesionData) return false;

  const sesion = sesionData as SesionWhatsAppRecord;

  // Only warn if the session is currently active in a non-initial state
  if (sesion.estado === 'INICIO') {
    clearInactivityTimers(telefono);
    return false;
  }

  const elapsedMs = Date.now() - new Date(sesion.ultima_interaccion).getTime();

  // If user interacted recently, don't send warning
  if (elapsedMs < 115_000) {
    return false;
  }

  // If warning was already sent, do not duplicate
  if (sesion.datos_temporales?.aviso_inactividad_enviado) {
    return false;
  }

  const avisoTexto =
    '⚠️ *Aviso de Inactividad*\n\n' +
    'Han transcurrido 2 minutos sin actividad. En *1 minuto* se cerrará tu sesión automáticamente por inactividad (al cumplirse los 3 minutos permitidos).\n\n' +
    '¿Deseas continuar con tu gestión?';

  await enviarBotonesWhatsApp(
    telefono,
    avisoTexto,
    [
      { id: 'BTN_MANTENER_SESION', title: 'Continuar gestión' },
      { id: 'VOLVER_MENU', title: '⬅️ Cancelar gestión' },
    ],
    'Control de Tiempo Rendy'
  );

  // Persist that the warning was dispatched so it won't be repeated
  const datosActualizados: DatosTemporalesSesion = {
    ...(sesion.datos_temporales || {}),
    aviso_inactividad_enviado: true,
  };

  await supabase
    .from('sesiones_whatsapp')
    .update({
      datos_temporales: datosActualizados as unknown as Record<string, unknown>,
    })
    .eq('telefono', telefono);

  return true;
}

/**
 * @name executeSessionExpiration
 * @description [Business Logic]: Expires the session at 3 minutes of inactivity, resets DB state to 'INICIO',
 * delivers the closure notice, and re-presents the main menu.
 */
async function executeSessionExpiration(
  supabase: SupabaseClient,
  telefono: string,
  empleadoId?: string | null,
  employeeName?: string
): Promise<boolean> {
  const { data: sesionData, error } = await supabase
    .from('sesiones_whatsapp')
    .select('*')
    .eq('telefono', telefono)
    .maybeSingle();

  if (error || !sesionData) {
    clearInactivityTimers(telefono);
    return false;
  }

  const sesion = sesionData as SesionWhatsAppRecord;

  if (sesion.estado === 'INICIO') {
    clearInactivityTimers(telefono);
    return false;
  }

  const elapsedMs = Date.now() - new Date(sesion.ultima_interaccion).getTime();

  // If user interacted recently, do not expire
  if (elapsedMs < 175_000) {
    return false;
  }

  // 1. Reset session in database
  await supabase.from('sesiones_whatsapp').upsert({
    telefono,
    empleado_id: empleadoId || sesion.empleado_id || null,
    estado: 'INICIO',
    datos_temporales: null,
    ultima_interaccion: new Date().toISOString(),
  });

  // 2. Clear timer references
  clearInactivityTimers(telefono);

  // 3. Send timeout notification
  await enviarMensajeWhatsApp(
    telefono,
    '⏱️ *Sesión cerrada por inactividad.*\n\nSe han cumplido los 3 minutos de inactividad y tu gestión anterior fue cancelada por seguridad.'
  );

  // 4. Send main navigation menu
  let resolvedName = employeeName;
  if (!resolvedName && (empleadoId || sesion.empleado_id)) {
    const { data: usr } = await supabase
      .from('usuarios')
      .select('nombre')
      .eq('id', empleadoId || sesion.empleado_id)
      .maybeSingle();
    resolvedName = usr?.nombre;
  }
  await enviarMenuPrincipalListMessage(telefono, resolvedName);

  return true;
}

/**
 * @name checkInactiveSessions
 * @description [Cron/Worker]: Scans all open sessions in `sesiones_whatsapp` to enforce 2-minute warnings
 * and 3-minute expirations. Can be triggered periodically by serverless cron jobs or health check tasks.
 */
export async function checkInactiveSessions(
  supabase: SupabaseClient
): Promise<{ warned: number; expired: number }> {
  const { data: sesiones, error } = await supabase
    .from('sesiones_whatsapp')
    .select('telefono, empleado_id, estado, datos_temporales, ultima_interaccion')
    .neq('estado', 'INICIO');

  if (error || !sesiones || sesiones.length === 0) {
    return { warned: 0, expired: 0 };
  }

  const now = Date.now();
  let warnedCount = 0;
  let expiredCount = 0;

  for (const item of sesiones) {
    const sesion = item as SesionWhatsAppRecord;
    const elapsed = now - new Date(sesion.ultima_interaccion).getTime();

    // 1. Expiration check (>= 3 minutes)
    if (elapsed >= INACTIVITY_EXPIRATION_MS) {
      const expired = await executeSessionExpiration(supabase, sesion.telefono, sesion.empleado_id);
      if (expired) expiredCount++;
    }
    // 2. Warning check (>= 2 minutes and warning not yet sent)
    else if (elapsed >= INACTIVITY_WARNING_MS && !sesion.datos_temporales?.aviso_inactividad_enviado) {
      const warned = await executeInactivityWarning(supabase, sesion.telefono);
      if (warned) warnedCount++;
    }
  }

  return { warned: warnedCount, expired: expiredCount };
}

