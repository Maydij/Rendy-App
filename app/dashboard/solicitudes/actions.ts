'use server';

import { supabaseServer } from '@/lib/supabase-server';
import { enviarMensajeWhatsApp } from '@/app/lib/whatsapp';
import { revalidatePath } from 'next/cache';

export async function aprobarSolicitud(id: string) {
  // Fetch solicitud con datos del usuario y proyecto
  const { data: sol, error: fetchErr } = await supabaseServer
    .from('solicitudes_viaticos')
    .select('monto_solicitado, moneda, usuario_id, proyecto_id, proyectos(nombre), usuarios(telefono_whatsapp, nombre)')
    .eq('id', id)
    .single();

  if (fetchErr || !sol) return { error: 'No se pudo encontrar la solicitud' };

  const { error } = await supabaseServer
    .from('solicitudes_viaticos')
    .update({ 
      estado: 'APROBADO', 
      monto_aprobado: sol.monto_solicitado 
    })
    .eq('id', id);

  if (error) return { error: error.message };

  // Notificar por WhatsApp al empleado
  const telefono = (sol.usuarios as any)?.telefono_whatsapp;
  if (telefono) {
    const proyectoNombre = (sol.proyectos as any)?.nombre || 'General';
    const monedaStr = sol.moneda || 'USD';
    const mensajeWA = 
`✅ *¡SOLICITUD DE VIÁTICOS APROBADA!*

📌 *Solicitud #:* ${id.slice(0, 8)}…
📁 *Proyecto:* ${proyectoNombre}
💵 *Monto Aprobado:* ${sol.monto_solicitado} ${monedaStr}

_Los fondos han sido autorizados por la administración y estarán disponibles a la brevedad._`;

    await enviarMensajeWhatsApp(telefono, mensajeWA);
  }

  revalidatePath('/dashboard/solicitudes');
  revalidatePath('/dashboard/justificacion');
  revalidatePath('/dashboard');
  return { error: null };
}

export async function rechazarSolicitud(id: string, motivo: string) {
  const { data: sol, error: fetchErr } = await supabaseServer
    .from('solicitudes_viaticos')
    .select('monto_solicitado, moneda, usuario_id, proyecto_id, proyectos(nombre), usuarios(telefono_whatsapp)')
    .eq('id', id)
    .single();

  if (fetchErr || !sol) return { error: 'No se pudo encontrar la solicitud' };

  const { error } = await supabaseServer
    .from('solicitudes_viaticos')
    .update({ 
      estado: 'RECHAZADO', 
      motivo_rechazo: motivo || null 
    })
    .eq('id', id);

  if (error) return { error: error.message };

  // Notificar por WhatsApp al empleado
  const telefono = (sol.usuarios as any)?.telefono_whatsapp;
  if (telefono) {
    const proyectoNombre = (sol.proyectos as any)?.nombre || 'General';
    const monedaStr = sol.moneda || 'USD';
    const motivoTexto = motivo ? `\n💬 *Motivo:* ${motivo}` : '';
    const mensajeWA = 
`❌ *SOLICITUD DE VIÁTICOS RECHAZADA*

📌 *Solicitud #:* ${id.slice(0, 8)}…
📁 *Proyecto:* ${proyectoNombre}
💵 *Monto Solicitado:* ${sol.monto_solicitado} ${monedaStr}${motivoTexto}

_Por favor contacta a tu administración para más detalles._`;

    await enviarMensajeWhatsApp(telefono, mensajeWA);
  }

  revalidatePath('/dashboard/solicitudes');
  revalidatePath('/dashboard/justificacion');
  revalidatePath('/dashboard');
  return { error: null };
}