/**
 * @name NotificacionesReembolsoService
 * @description [Business Logic]: Dispatches automated WhatsApp transactional notifications
 * to employees upon changes in their expense reimbursement lifecycle (PROCESADO, TRANSFERIDO, RECHAZADO).
 * Complies with international multi-currency rules, formatting amounts accurately according to the original currency.
 */

import { enviarMensajeWhatsApp } from '@/app/lib/whatsapp';

export type TipoNotificacionReembolso = 'PROCESADO' | 'TRANSFERIDO' | 'RECHAZADO';

export interface EnviarNotificacionReembolsoParams {
  telefono: string;
  nombreEmpleado: string;
  tipo: TipoNotificacionReembolso;
  comercio: string;
  montoUsd: number;
  monedaOriginal?: string;
  montoOriginal?: number;
  montoVes?: number;
  fechaTransferencia?: string;
  motivoRechazo?: string;
}

/**
 * @name formatNotificationAmount
 * @description [Business Logic]: Formats the amount string respecting international multi-currency rules.
 * Does not compare foreign currencies to VES, comparing only to USD.
 */
function formatNotificationAmount(
  montoUsd: number,
  monedaOriginal?: string,
  montoOriginal?: number,
  montoVes?: number
): string {
  const moneda = (monedaOriginal || 'USD').toUpperCase();
  const formatNum = (val: number) =>
    val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (moneda === 'VES') {
    const ves = montoVes && montoVes > 0 ? montoVes : (montoOriginal || 0);
    return `*${formatNum(ves)} Bs* (equiv. $${formatNum(montoUsd)} USD)`;
  }

  if (moneda === 'USD') {
    return `*$${formatNum(montoUsd)} USD*`;
  }

  // Any other international currency (MXN, COP, EUR, etc.)
  const nominal = montoOriginal && montoOriginal > 0 ? montoOriginal : montoUsd;
  return `*${formatNum(nominal)} ${moneda}* (equiv. $${formatNum(montoUsd)} USD)`;
}

/**
 * @name enviarNotificacionWhatsAppReembolso
 * @description [Business Logic]: Sends an automated, formatted WhatsApp notification to the employee
 * detailing the status change of their expense reimbursement claim.
 */
export async function enviarNotificacionWhatsAppReembolso({
  telefono,
  nombreEmpleado,
  tipo,
  comercio,
  montoUsd,
  monedaOriginal,
  montoOriginal,
  montoVes,
  fechaTransferencia,
  motivoRechazo,
}: EnviarNotificacionReembolsoParams): Promise<{ success: boolean; data?: unknown }> {
  try {
    if (!telefono) {
      console.warn('⚠️ [NotificacionesReembolso] Cannot send WhatsApp: missing phone number.');
      return { success: false };
    }

    const textoMonto = formatNotificationAmount(montoUsd, monedaOriginal, montoOriginal, montoVes);
    const primerNombre = nombreEmpleado.trim().split(/\s+/)[0] || 'colaborador';
    let mensaje = '';

    switch (tipo) {
      case 'PROCESADO':
        mensaje =
          `✅ *Reembolso Aprobado*\n\n` +
          `Hola ${primerNombre}, tu comprobante en *${comercio}* por ${textoMonto} ha sido validado contablemente.\n\n` +
          `⏳ Tu pago se encuentra en cola de transferencia. Te notificaremos por aquí en cuanto sea emitido.`;
        break;

      case 'TRANSFERIDO': {
        const fechaTxt = fechaTransferencia
          ? new Date(fechaTransferencia).toLocaleDateString('es-VE', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })
          : new Date().toLocaleDateString('es-VE', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            });

        mensaje =
          `💸 *¡Reembolso Transferido!*\n\n` +
          `Hola ${primerNombre}, se ha realizado con éxito la transferencia de tu reembolso:\n` +
          `• *Comercio:* ${comercio}\n` +
          `• *Monto Pagado:* ${textoMonto}\n` +
          `• *Fecha:* ${fechaTxt}\n\n` +
          `📎 Puedes ingresar a la plataforma web para revisar el comprobante bancario de la transacción.`;
        break;
      }

      case 'RECHAZADO':
        mensaje =
          `❌ *Reembolso No Aprobado*\n\n` +
          `Hola ${primerNombre}, tu comprobante en *${comercio}* por ${textoMonto} ha sido rechazado.\n\n` +
          `📝 *Motivo del rechazo:*\n"${motivoRechazo || 'Comprobante no cumple con las políticas fiscales requeridas.'}"\n\n` +
          `Por favor comunícate con el departamento de administración si requieres corregir este registro.`;
        break;
    }

    const res = await enviarMensajeWhatsApp(telefono, mensaje);
    return { success: true, data: res };
  } catch (error) {
    console.error('❌ [NotificacionesReembolso] Error sending WhatsApp notification:', error);
    return { success: false };
  }
}

