'use server';

/**
 * @name ReembolsosServerActions
 * @description [Business Logic]: Server Actions handling corporate employee reimbursement
 * audit lifecycle transitions ('PENDIENTE' -> 'PROCESADO' -> 'TRANSFERIDO' / 'RECHAZADO'),
 * storage uploads for bank transfer receipts, and automated WhatsApp transactional notifications.
 */

import { revalidatePath } from 'next/cache';
import { supabaseServer, EMPRESA_ID } from '@/lib/supabase-server';
import type { EstadoReembolso } from '@/lib/services/reembolsos.service';
import { enviarNotificacionWhatsAppReembolso } from '@/lib/services/notificacionesReembolso';

export interface ActionResult {
  success: boolean;
  error?: string;
  url?: string;
}

/**
 * @name marcarReembolsoComoProcesadoAction
 * @description [Business Logic]: Advances a reimbursement to 'PROCESADO' (accounting approval)
 * and dispatches a WhatsApp notification to the employee indicating payment is queued.
 */
export async function marcarReembolsoComoProcesadoAction(gastoId: string): Promise<ActionResult> {
  try {
    if (!gastoId) return { success: false, error: 'Identificador de gasto inválido.' };

    const { data: gasto, error } = await supabaseServer
      .from('gastos')
      .update({
        estado: 'PROCESADO',
        comentario_rechazo: null,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', gastoId)
      .eq('empresa_id', EMPRESA_ID)
      .eq('es_reembolso', true)
      .select(`
        id,
        comercio,
        monto,
        moneda,
        monto_usd,
        monto_ves,
        usuarios!usuario_id (
          id,
          nombre,
          telefono_whatsapp
        )
      `)
      .single();

    if (error || !gasto) {
      console.error('❌ [marcarReembolsoComoProcesadoAction] Supabase error:', error);
      return { success: false, error: error?.message || 'Gasto no encontrado.' };
    }

    // Dispatch WhatsApp notification to employee
    const usuario = gasto.usuarios as unknown as { nombre?: string; telefono_whatsapp?: string } | null;
    if (usuario?.telefono_whatsapp) {
      await enviarNotificacionWhatsAppReembolso({
        telefono: usuario.telefono_whatsapp,
        nombreEmpleado: usuario.nombre || 'Colaborador',
        tipo: 'PROCESADO',
        comercio: gasto.comercio || 'Comercio',
        montoUsd: Number(gasto.monto_usd || gasto.monto || 0),
        monedaOriginal: gasto.moneda || 'USD',
        montoOriginal: Number(gasto.monto || 0),
        montoVes: Number(gasto.monto_ves || 0),
      });
    }

    revalidatePath('/dashboard/reembolsos');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al procesar el reembolso';
    console.error('❌ [marcarReembolsoComoProcesadoAction] Exception:', err);
    return { success: false, error: message };
  }
}

/**
 * @name marcarReembolsoComoTransferidoAction
 * @description [Business Logic]: Settles a reimbursement as 'TRANSFERIDO' with its bank payment proof URL,
 * recording the transfer timestamp and notifying the employee via WhatsApp.
 */
export async function marcarReembolsoComoTransferidoAction({
  gastoId,
  urlComprobantePago,
}: {
  gastoId: string;
  urlComprobantePago?: string | null;
}): Promise<ActionResult> {
  try {
    if (!gastoId) return { success: false, error: 'Identificador de gasto inválido.' };

    const fechaTransferencia = new Date().toISOString();

    const { data: gasto, error } = await supabaseServer
      .from('gastos')
      .update({
        estado: 'TRANSFERIDO',
        url_comprobante_pago: urlComprobantePago || null,
        fecha_transferencia: fechaTransferencia,
        comentario_rechazo: null,
        actualizado_en: fechaTransferencia,
      })
      .eq('id', gastoId)
      .eq('empresa_id', EMPRESA_ID)
      .eq('es_reembolso', true)
      .select(`
        id,
        comercio,
        monto,
        moneda,
        monto_usd,
        monto_ves,
        usuarios!usuario_id (
          id,
          nombre,
          telefono_whatsapp
        )
      `)
      .single();

    if (error || !gasto) {
      console.error('❌ [marcarReembolsoComoTransferidoAction] Supabase error:', error);
      return { success: false, error: error?.message || 'Gasto no encontrado.' };
    }

    // Dispatch WhatsApp notification to employee
    const usuario = gasto.usuarios as unknown as { nombre?: string; telefono_whatsapp?: string } | null;
    if (usuario?.telefono_whatsapp) {
      await enviarNotificacionWhatsAppReembolso({
        telefono: usuario.telefono_whatsapp,
        nombreEmpleado: usuario.nombre || 'Colaborador',
        tipo: 'TRANSFERIDO',
        comercio: gasto.comercio || 'Comercio',
        montoUsd: Number(gasto.monto_usd || gasto.monto || 0),
        monedaOriginal: gasto.moneda || 'USD',
        montoOriginal: Number(gasto.monto || 0),
        montoVes: Number(gasto.monto_ves || 0),
        fechaTransferencia,
      });
    }

    revalidatePath('/dashboard/reembolsos');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al transferir el reembolso';
    console.error('❌ [marcarReembolsoComoTransferidoAction] Exception:', err);
    return { success: false, error: message };
  }
}

/**
 * @name rechazarReembolsoAction
 * @description [Business Logic]: Invalidates a reimbursement claim with an administrative audit comment
 * and dispatches a rejection explanation to the employee via WhatsApp.
 */
export async function rechazarReembolsoAction({
  gastoId,
  motivo,
}: {
  gastoId: string;
  motivo: string;
}): Promise<ActionResult> {
  try {
    if (!gastoId) return { success: false, error: 'Identificador de gasto inválido.' };
    if (!motivo.trim()) return { success: false, error: 'Debe especificar el motivo del rechazo.' };

    const motivoLimpio = motivo.trim();

    const { data: gasto, error } = await supabaseServer
      .from('gastos')
      .update({
        estado: 'RECHAZADO',
        comentario_rechazo: motivoLimpio,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', gastoId)
      .eq('empresa_id', EMPRESA_ID)
      .eq('es_reembolso', true)
      .select(`
        id,
        comercio,
        monto,
        moneda,
        monto_usd,
        monto_ves,
        usuarios!usuario_id (
          id,
          nombre,
          telefono_whatsapp
        )
      `)
      .single();

    if (error || !gasto) {
      console.error('❌ [rechazarReembolsoAction] Supabase error:', error);
      return { success: false, error: error?.message || 'Gasto no encontrado.' };
    }

    // Dispatch WhatsApp notification to employee
    const usuario = gasto.usuarios as unknown as { nombre?: string; telefono_whatsapp?: string } | null;
    if (usuario?.telefono_whatsapp) {
      await enviarNotificacionWhatsAppReembolso({
        telefono: usuario.telefono_whatsapp,
        nombreEmpleado: usuario.nombre || 'Colaborador',
        tipo: 'RECHAZADO',
        comercio: gasto.comercio || 'Comercio',
        montoUsd: Number(gasto.monto_usd || gasto.monto || 0),
        monedaOriginal: gasto.moneda || 'USD',
        montoOriginal: Number(gasto.monto || 0),
        montoVes: Number(gasto.monto_ves || 0),
        motivoRechazo: motivoLimpio,
      });
    }

    revalidatePath('/dashboard/reembolsos');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al rechazar el reembolso';
    console.error('❌ [rechazarReembolsoAction] Exception:', err);
    return { success: false, error: message };
  }
}

/**
 * @name subirComprobanteYTransferirAction
 * @description [Business Logic]: Uploads a bank transfer proof image/PDF to Supabase Storage
 * bucket 'comprobantes_pago', marks the reimbursement as 'TRANSFERIDO', and notifies the employee.
 */
export async function subirComprobanteYTransferirAction(formData: FormData): Promise<ActionResult> {
  try {
    const gastoId = formData.get('gastoId') as string;
    const file = formData.get('file') as File | null;

    if (!gastoId) {
      return { success: false, error: 'Identificador de reembolso inválido.' };
    }

    let urlComprobantePago: string | null = null;

    if (file && file.size > 0) {
      // Validate file size (max 5MB)
      const maxSizeBytes = 5 * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        return { success: false, error: 'El archivo excede el límite máximo de 5MB.' };
      }

      // Validate allowed mime types
      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/jpg',
        'application/pdf',
      ];
      if (!allowedTypes.includes(file.type)) {
        return {
          success: false,
          error: 'Tipo de archivo no permitido. Solo se aceptan imágenes (JPG, PNG, WEBP) o documentos PDF.',
        };
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const extension = file.name.split('.').pop() || (file.type === 'application/pdf' ? 'pdf' : 'jpg');
      const fileName = `pago_${Date.now()}_${gastoId.substring(0, 8)}.${extension}`;

      const { error: uploadError } = await supabaseServer.storage
        .from('comprobantes_pago')
        .upload(fileName, buffer, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        console.error('❌ [subirComprobanteYTransferirAction] Storage upload error:', uploadError);
        return { success: false, error: `Error al subir el comprobante: ${uploadError.message}` };
      }

      const { data: urlData } = supabaseServer.storage
        .from('comprobantes_pago')
        .getPublicUrl(fileName);

      urlComprobantePago = urlData.publicUrl;
    }

    // Proceed to transition to TRANSFERIDO and dispatch notification
    const res = await marcarReembolsoComoTransferidoAction({
      gastoId,
      urlComprobantePago,
    });

    if (!res.success) return res;

    return { success: true, url: urlComprobantePago || undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al registrar la transferencia';
    console.error('❌ [subirComprobanteYTransferirAction] Exception:', err);
    return { success: false, error: message };
  }
}

/**
 * @name revertirEstadoReembolsoAction
 * @description [Business Logic]: Reverts a settled or rejected reimbursement back to previous lifecycle stage.
 */
export async function revertirEstadoReembolsoAction({
  gastoId,
  nuevoEstado,
}: {
  gastoId: string;
  nuevoEstado: EstadoReembolso;
}): Promise<ActionResult> {
  try {
    if (!gastoId) return { success: false, error: 'Identificador de gasto inválido.' };

    const updatePayload: {
      estado: EstadoReembolso;
      actualizado_en: string;
      comentario_rechazo?: string | null;
      url_comprobante_pago?: string | null;
      fecha_transferencia?: string | null;
    } = {
      estado: nuevoEstado,
      actualizado_en: new Date().toISOString(),
    };

    if (nuevoEstado === 'PENDIENTE') {
      updatePayload.comentario_rechazo = null;
    }

    const { error } = await supabaseServer
      .from('gastos')
      .update(updatePayload)
      .eq('id', gastoId)
      .eq('empresa_id', EMPRESA_ID)
      .eq('es_reembolso', true);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/reembolsos');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al revertir el estado';
    return { success: false, error: message };
  }
}
