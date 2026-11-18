'use server';

import { supabaseServer } from '@/lib/supabase-server';
import { enviarMensajeWhatsApp, enviarArchivoWhatsApp } from '@/app/lib/whatsapp';
import { revalidatePath } from 'next/cache';

export async function aprobarSolicitud(id: string) {
  // Fetch solicitud con datos del usuario y proyecto
  const { data: sol, error: fetchErr } = await supabaseServer
    .from('solicitudes_viaticos')
    .select('monto_solicitado, moneda, usuario_id, empresa_id, proyecto_id, proyectos(nombre), usuarios(telefono_whatsapp, nombre)')
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

  // Sincronizar en tabla viaticos para viaticosEngine
  const proyectoNombre = (sol.proyectos as any)?.nombre || 'General';
  await supabaseServer.from('viaticos').upsert({
    id: id,
    empleado_id: sol.usuario_id,
    empresa_id: sol.empresa_id,
    proyecto_id: sol.proyecto_id,
    nombre_proyecto: proyectoNombre,
    monto_asignado_usd: Number(sol.monto_solicitado || 0),
    estado: 'ACTIVO',
    actualizado_en: new Date().toISOString(),
  });

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

    // Proactively send US Tax-Exempt Certificate when approving USD viáticos
    if (monedaStr.toUpperCase() === 'USD' && sol.empresa_id) {
      const { data: empData } = await supabaseServer
        .from('empresas')
        .select('us_tax_exempt, url_certificado_tax_exempt')
        .eq('id', sol.empresa_id)
        .maybeSingle();

      if (empData?.us_tax_exempt && empData?.url_certificado_tax_exempt) {
        await enviarArchivoWhatsApp(
          telefono,
          empData.url_certificado_tax_exempt,
          '📄 *Certificado Tax-Exempt Oficial*\nTu empresa está exenta de Sales Tax en EE. UU. Muéstralo en caja antes de pagar para evitar el cobro de impuestos.',
          'Certificado_Tax_Exempt.pdf'
        );
      }
    }
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

  // Sincronizar en tabla viaticos
  await supabaseServer
    .from('viaticos')
    .update({
      estado: 'RECHAZADO',
      actualizado_en: new Date().toISOString(),
    })
    .eq('id', id);

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