'use server';

/**
 * @name SolicitudesViaticosServerActions
 * @description [Business Logic]: Server Actions managing corporate travel allowance
 * approval lifecycle, bank transfer proof storage uploads (images/PDFs), and automated
 * WhatsApp notifications dispatch to employees.
 */

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase-server';
import { requireAdminSession } from '@/lib/auth/session-context';
import { enviarMensajeWhatsApp, enviarArchivoWhatsApp } from '@/app/lib/whatsapp';

export interface SolicitudActionResult {
  success: boolean;
  error?: string | null;
  url?: string | null;
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/jpg',
  'application/pdf',
];

/**
 * @name uploadComprobanteTransferenciaStorage
 * @description [Storage]: Helper that uploads a bank transfer proof image or PDF to
 * Supabase Storage bucket 'comprobantes_transferencias' (with defensive fallback to
 * 'comprobantes_pago' if bucket is unavailable).
 */
async function uploadComprobanteTransferenciaStorage(
  file: File,
  solicitudId: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return { url: null, error: 'El archivo excede el tamaño máximo permitido de 5MB.' };
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return {
        url: null,
        error: 'Formato no permitido. Solo se aceptan imágenes (JPG, PNG, WEBP) o documentos PDF.',
      };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const extension = file.name.split('.').pop() || (file.type === 'application/pdf' ? 'pdf' : 'jpg');
    const fileName = `viatico_transferencia_${Date.now()}_${solicitudId.substring(0, 8)}.${extension}`;

    // Attempt upload to primary bucket 'comprobantes_transferencias'
    let bucketName = 'comprobantes_transferencias';
    let { error: uploadError } = await supabaseServer.storage
      .from(bucketName)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    // Fallback to 'comprobantes_pago' if primary bucket is not provisioned
    if (uploadError) {
      console.warn('⚠️ [Storage] Could not upload to comprobantes_transferencias, falling back to comprobantes_pago:', uploadError.message);
      bucketName = 'comprobantes_pago';
      const fallbackUpload = await supabaseServer.storage
        .from(bucketName)
        .upload(fileName, buffer, {
          contentType: file.type,
          upsert: true,
        });

      if (fallbackUpload.error) {
        console.error('❌ [Storage] Fallback upload also failed:', fallbackUpload.error);
        return { url: null, error: `Error al subir el archivo: ${fallbackUpload.error.message}` };
      }
    }

    const { data: urlData } = supabaseServer.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    return { url: urlData.publicUrl, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al procesar el archivo';
    console.error('❌ [uploadComprobanteTransferenciaStorage] Exception:', err);
    return { url: null, error: msg };
  }
}

/**
 * @name aprobarSolicitudConComprobanteAction
 * @description [Business Logic]: Approves a travel allowance request, optionally attaching
 * bank transfer proof, reference number, and disbursement notes. Dispatches WhatsApp notification
 * with the bank transfer receipt attached if provided.
 */
export async function aprobarSolicitudConComprobanteAction(
  formData: FormData
): Promise<SolicitudActionResult> {
  try {
    const solicitudId = formData.get('solicitudId') as string;
    const file = formData.get('file') as File | null;
    const referenciaTransferencia = (formData.get('referenciaTransferencia') as string | null)?.trim() || null;
    const notasDesembolso = (formData.get('notasDesembolso') as string | null)?.trim() || null;

    if (!solicitudId) {
      return { success: false, error: 'Identificador de solicitud inválido.' };
    }

    const session = await requireAdminSession();

    // 1. Fetch solicitud details strictly scoped to admin's tenant
    const { data: sol, error: fetchErr } = await supabaseServer
      .from('solicitudes_viaticos')
      .select('id, monto_solicitado, moneda, usuario_id, empresa_id, proyecto_id, proyectos(nombre), usuarios(telefono_whatsapp, nombre)')
      .eq('id', solicitudId)
      .eq('empresa_id', session.empresaId)
      .maybeSingle();

    if (fetchErr || !sol) {
      return { success: false, error: 'No se pudo encontrar la solicitud de viáticos en su organización.' };
    }

    // 2. Upload file if provided
    let urlComprobanteTransferencia: string | null = null;
    const hasFile = file && file.size > 0;
    if (hasFile) {
      const uploadResult = await uploadComprobanteTransferenciaStorage(file, solicitudId);
      if (uploadResult.error) {
        return { success: false, error: uploadResult.error };
      }
      urlComprobanteTransferencia = uploadResult.url;
    }

    // 3. Update solicitudes_viaticos record strictly scoped to admin's tenant
    const nowIso = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      estado: 'APROBADO',
      monto_aprobado: sol.monto_solicitado,
    };

    if (urlComprobanteTransferencia) {
      updatePayload.url_comprobante_transferencia = urlComprobanteTransferencia;
      updatePayload.referencia_transferencia = referenciaTransferencia;
      updatePayload.notas_desembolso = notasDesembolso;
      updatePayload.fecha_transferencia = nowIso;
    }

    let { error: updateError } = await supabaseServer
      .from('solicitudes_viaticos')
      .update(updatePayload)
      .eq('id', solicitudId)
      .eq('empresa_id', session.empresaId);

    // Defensive fallback: if migration 013 is not yet applied, retry without new columns
    if (updateError && updateError.code === '42703') {
      console.warn('⚠️ [aprobarSolicitud] Transfer columns not in table yet (Migration 013 pending). Retrying without transfer audit columns...');
      const fallbackPayload = {
        estado: 'APROBADO',
        monto_aprobado: sol.monto_solicitado,
      };
      const retryResult = await supabaseServer
        .from('solicitudes_viaticos')
        .update(fallbackPayload)
        .eq('id', solicitudId)
        .eq('empresa_id', session.empresaId);

      updateError = retryResult.error;
    }

    if (updateError) {
      console.error('❌ [aprobarSolicitud] Error updating solicitudes_viaticos:', updateError);
      return { success: false, error: updateError.message };
    }

    // 4. Synchronize into viaticos table for viaticosEngine
    const rawProyecto = (Array.isArray(sol.proyectos) ? sol.proyectos[0] : sol.proyectos) as
      | { nombre?: string }
      | null
      | undefined;
    const proyectoNombre = rawProyecto?.nombre || 'General';
    const viaticosPayload: Record<string, unknown> = {
      id: solicitudId,
      empleado_id: sol.usuario_id,
      empresa_id: session.empresaId,
      proyecto_id: sol.proyecto_id,
      nombre_proyecto: proyectoNombre,
      monto_asignado_usd: Number(sol.monto_solicitado || 0),
      estado: 'ACTIVO',
      actualizado_en: nowIso,
    };

    if (urlComprobanteTransferencia) {
      viaticosPayload.url_comprobante_transferencia = urlComprobanteTransferencia;
      viaticosPayload.referencia_transferencia = referenciaTransferencia;
      viaticosPayload.notas_desembolso = notasDesembolso;
      viaticosPayload.fecha_transferencia = nowIso;
    }

    let { error: viatErr } = await supabaseServer.from('viaticos').upsert(viaticosPayload);
    if (viatErr && viatErr.code === '42703') {
      // Retry without transfer columns if viaticos table doesn't have them yet
      delete viaticosPayload.url_comprobante_transferencia;
      delete viaticosPayload.referencia_transferencia;
      delete viaticosPayload.notas_desembolso;
      delete viaticosPayload.fecha_transferencia;
      await supabaseServer.from('viaticos').upsert(viaticosPayload);
    }

    // 5. Notify employee via WhatsApp
    const rawUsuario = (Array.isArray(sol.usuarios) ? sol.usuarios[0] : sol.usuarios) as
      | { telefono_whatsapp?: string; nombre?: string }
      | null
      | undefined;
    const telefono = rawUsuario?.telefono_whatsapp;

    if (telefono) {
      const monedaStr = sol.moneda || 'USD';
      const montoFormateado = Number(sol.monto_solicitado || 0).toLocaleString('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      const refTexto = referenciaTransferencia ? `\n🔢 *Referencia:* ${referenciaTransferencia}` : '';
      const notaTexto = notasDesembolso ? `\n📝 *Nota:* ${notasDesembolso}` : '';

      if (urlComprobanteTransferencia) {
        const caption =
          `✅ *¡Viático Aprobado y Transferido!*\n\n` +
          `📌 *Proyecto:* ${proyectoNombre}\n` +
          `💵 *Monto Desembolsado:* ${montoFormateado} ${monedaStr}` +
          `${refTexto}${notaTexto}\n\n` +
          `Adjunto encontrarás el comprobante bancario de la transferencia. Ya puedes rendir tus gastos enviando fotos de tus comprobantes por aquí.`;

        const isPdf = /\.(pdf)$/i.test(urlComprobanteTransferencia.split('?')[0]);
        const filename = isPdf ? 'Comprobante_Transferencia.pdf' : 'Comprobante_Transferencia.jpg';

        await enviarArchivoWhatsApp(telefono, urlComprobanteTransferencia, caption, filename);
      } else {
        const mensajeWA =
          `✅ *¡SOLICITUD DE VIÁTICOS APROBADA!*\n\n` +
          `📌 *Solicitud #:* ${solicitudId.slice(0, 8)}…\n` +
          `📁 *Proyecto:* ${proyectoNombre}\n` +
          `💵 *Monto Aprobado:* ${montoFormateado} ${monedaStr}\n\n` +
          `_Los fondos han sido autorizados por la administración y estarán disponibles a la brevedad._`;

        await enviarMensajeWhatsApp(telefono, mensajeWA);
      }

      // Proactively send US Tax-Exempt Certificate when approving USD viático (if configured)
      if (monedaStr.toUpperCase() === 'USD' && sol.empresa_id) {
        const { data: empDataRaw } = await supabaseServer
          .from('empresas')
          .select('*')
          .eq('id', sol.empresa_id)
          .maybeSingle();

        const empData = empDataRaw as Record<string, unknown> | null;
        const certUrl = (empData?.url_certificado_usa as string | undefined) || (empData?.url_certificado_tax_exempt as string | undefined);
        const certNombre = (empData?.nombre_certificado_usa as string | undefined) || 'Certificado Fiscal EE. UU.';

        if (certUrl) {
          await enviarArchivoWhatsApp(
            telefono,
            certUrl,
            `📄 *${certNombre}*\nDocumento fiscal de la empresa para compras en EE. UU. Puedes presentarlo en caja si la compra califica para tratamiento fiscal especial o exención.`,
            'Certificado_Fiscal_USA.pdf'
          );
        }
      }
    }

    revalidatePath('/dashboard/solicitudes');
    revalidatePath('/dashboard/justificacion');
    revalidatePath('/dashboard');

    return {
      success: true,
      url: urlComprobanteTransferencia,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al aprobar la solicitud';
    console.error('❌ [aprobarSolicitudConComprobanteAction] Exception:', err);
    return { success: false, error: msg };
  }
}

/**
 * @name adjuntarComprobanteTransferenciaPosteriorAction
 * @description [Business Logic]: Attaches a bank transfer receipt to an already approved travel
 * allowance and immediately sends the proof to the employee via WhatsApp.
 */
export async function adjuntarComprobanteTransferenciaPosteriorAction(
  formData: FormData
): Promise<SolicitudActionResult> {
  try {
    const solicitudId = formData.get('solicitudId') as string;
    const file = formData.get('file') as File | null;
    const referenciaTransferencia = (formData.get('referenciaTransferencia') as string | null)?.trim() || null;
    const notasDesembolso = (formData.get('notasDesembolso') as string | null)?.trim() || null;

    if (!solicitudId) {
      return { success: false, error: 'Identificador de solicitud inválido.' };
    }

    if (!file || file.size === 0) {
      return { success: false, error: 'Debes seleccionar el comprobante de transferencia bancaria.' };
    }

    const session = await requireAdminSession();

    // 1. Fetch solicitud details strictly scoped to admin's tenant
    const { data: sol, error: fetchErr } = await supabaseServer
      .from('solicitudes_viaticos')
      .select('id, monto_solicitado, monto_aprobado, moneda, usuario_id, empresa_id, proyecto_id, proyectos(nombre), usuarios(telefono_whatsapp, nombre)')
      .eq('id', solicitudId)
      .eq('empresa_id', session.empresaId)
      .maybeSingle();

    if (fetchErr || !sol) {
      return { success: false, error: 'No se pudo encontrar la solicitud de viáticos en su organización.' };
    }

    // 2. Upload file
    const uploadResult = await uploadComprobanteTransferenciaStorage(file, solicitudId);
    if (uploadResult.error || !uploadResult.url) {
      return { success: false, error: uploadResult.error || 'Error al subir el comprobante.' };
    }

    const urlComprobante = uploadResult.url;
    const nowIso = new Date().toISOString();

    // 3. Update solicitudes_viaticos strictly scoped to admin's tenant
    const updatePayload: Record<string, unknown> = {
      url_comprobante_transferencia: urlComprobante,
      referencia_transferencia: referenciaTransferencia,
      notas_desembolso: notasDesembolso,
      fecha_transferencia: nowIso,
    };

    let { error: updateError } = await supabaseServer
      .from('solicitudes_viaticos')
      .update(updatePayload)
      .eq('id', solicitudId)
      .eq('empresa_id', session.empresaId);

    if (updateError && updateError.code === '42703') {
      return {
        success: false,
        error: 'Las columnas de transferencia no existen aún en la base de datos. Por favor ejecuta la migración 013 en Supabase.',
      };
    }

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // 4. Also update viaticos table strictly scoped to admin's tenant
    await supabaseServer
      .from('viaticos')
      .update(updatePayload)
      .eq('id', solicitudId)
      .eq('empresa_id', session.empresaId);

    // 5. Send WhatsApp notification with the attachment
    const rawUsuario = (Array.isArray(sol.usuarios) ? sol.usuarios[0] : sol.usuarios) as
      | { telefono_whatsapp?: string; nombre?: string }
      | null
      | undefined;
    const telefono = rawUsuario?.telefono_whatsapp;

    if (telefono) {
      const rawProyecto = (Array.isArray(sol.proyectos) ? sol.proyectos[0] : sol.proyectos) as
        | { nombre?: string }
        | null
        | undefined;
      const proyectoNombre = rawProyecto?.nombre || 'General';
      const monedaStr = sol.moneda || 'USD';
      const montoEfectivo = Number(sol.monto_aprobado ?? sol.monto_solicitado ?? 0);
      const montoFormateado = montoEfectivo.toLocaleString('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      const refTexto = referenciaTransferencia ? `\n🔢 *Referencia:* ${referenciaTransferencia}` : '';
      const notaTexto = notasDesembolso ? `\n📝 *Nota:* ${notasDesembolso}` : '';

      const caption =
        `💸 *Comprobante de Transferencia de Viático*\n\n` +
        `📌 *Proyecto:* ${proyectoNombre}\n` +
        `💵 *Monto Transferido:* ${montoFormateado} ${monedaStr}` +
        `${refTexto}${notaTexto}\n\n` +
        `Aquí tienes el soporte bancario de tu transferencia. Ya puedes comenzar a rendir tus gastos.`;

      const isPdf = /\.(pdf)$/i.test(urlComprobante.split('?')[0]);
      const filename = isPdf ? 'Comprobante_Transferencia.pdf' : 'Comprobante_Transferencia.jpg';

      await enviarArchivoWhatsApp(telefono, urlComprobante, caption, filename);
    }

    revalidatePath('/dashboard/solicitudes');
    revalidatePath('/dashboard/justificacion');
    revalidatePath('/dashboard');

    return {
      success: true,
      url: urlComprobante,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al registrar el comprobante';
    console.error('❌ [adjuntarComprobanteTransferenciaPosteriorAction] Exception:', err);
    return { success: false, error: msg };
  }
}

/**
 * @name aprobarSolicitud
 * @description [Backwards Compatibility]: Direct approval without transfer proof.
 */
export async function aprobarSolicitud(id: string): Promise<{ error: string | null }> {
  const formData = new FormData();
  formData.append('solicitudId', id);
  const result = await aprobarSolicitudConComprobanteAction(formData);
  return { error: result.success ? null : (result.error || 'Error al aprobar') };
}

/**
 * @name rechazarSolicitud
 * @description [Business Logic]: Rejects a travel allowance request and sends an explanation note to the employee via WhatsApp.
 */
export async function rechazarSolicitud(id: string, motivo: string): Promise<{ error: string | null }> {
  try {
    const session = await requireAdminSession();

    const { data: sol, error: fetchErr } = await supabaseServer
      .from('solicitudes_viaticos')
      .select('monto_solicitado, moneda, usuario_id, proyecto_id, proyectos(nombre), usuarios(telefono_whatsapp)')
      .eq('id', id)
      .eq('empresa_id', session.empresaId)
      .maybeSingle();

    if (fetchErr || !sol) return { error: 'No se pudo encontrar la solicitud en su organización' };

    const { error } = await supabaseServer
      .from('solicitudes_viaticos')
      .update({
        estado: 'RECHAZADO',
        motivo_rechazo: motivo || null,
      })
      .eq('id', id)
      .eq('empresa_id', session.empresaId);

    if (error) return { error: error.message };

    // Sincronizar en tabla viaticos
    await supabaseServer
      .from('viaticos')
      .update({
        estado: 'RECHAZADO',
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('empresa_id', session.empresaId);

    // Notificar por WhatsApp al empleado
    const rawUsuario = (Array.isArray(sol.usuarios) ? sol.usuarios[0] : sol.usuarios) as
      | { telefono_whatsapp?: string; nombre?: string }
      | null
      | undefined;
    const telefono = rawUsuario?.telefono_whatsapp;

    if (telefono) {
      const rawProyecto = (Array.isArray(sol.proyectos) ? sol.proyectos[0] : sol.proyectos) as
        | { nombre?: string }
        | null
        | undefined;
      const proyectoNombre = rawProyecto?.nombre || 'General';
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error inesperado';
    return { error: msg };
  }
}
