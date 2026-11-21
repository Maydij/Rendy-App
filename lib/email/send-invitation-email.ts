import { getMailTransporter } from './nodemailer-client';
import {
  buildInvitationEmailHtml,
  buildInvitationEmailSubject,
  type InvitationEmailParams,
} from './invitation-template';

export interface SendInvitationEmailResult {
  /** Whether the email was successfully accepted by Gmail SMTP */
  dispatched: boolean;
  /** SMTP Message ID for tracking (only on success) */
  messageId?: string;
  /** Human-readable error description (only on failure) */
  errorDetail?: string;
}

/**
 * @name DatosCorreoInvitacion
 * @description [Business Logic]: Spanish interface alias for invitation email parameters,
 * ensuring backwards-compatibility with staging scripts and testing harnesses.
 */
export interface DatosCorreoInvitacion {
  email: string;
  nombreEmpleado: string;
  nombreEmpresa: string;
  enlaceMagico: string;
  claveTemporal: string;
  fechaExpiracion: string;
}

/**
 * @name sendInvitationEmail
 * @description [Business Logic]: Dispatches the corporate employee onboarding invitation email
 * via Nodemailer using Gmail SMTP. Delivers the single-use magic link, temporary access code,
 * and company context to any recipient (Gmail, Outlook, corporate domains) without requiring
 * DNS domain verification on staging/preview environments (*.vercel.app).
 * Non-blocking: gracefully captures SMTP failures without throwing unhandled exceptions.
 */
export async function sendInvitationEmail(
  recipientEmail: string,
  params: InvitationEmailParams
): Promise<SendInvitationEmailResult> {
  const gmailUser = process.env.GMAIL_USER?.trim();
  const gmailPass = process.env.GMAIL_APP_PASSWORD?.trim();

  if (!gmailUser || !gmailPass) {
    console.warn(
      '⚠️ [MAILER] GMAIL_USER or GMAIL_APP_PASSWORD not configured. Invitation email skipped.'
    );
    return {
      dispatched: false,
      errorDetail: 'El servicio SMTP de Gmail no está configurado en las variables de entorno.',
    };
  }

  const transporter = getMailTransporter();
  if (!transporter) {
    return {
      dispatched: false,
      errorDetail: 'No se pudo inicializar el transporte SMTP de Gmail.',
    };
  }

  try {
    const htmlBody = buildInvitationEmailHtml(params);
    const subject = buildInvitationEmailSubject(params.companyName);
    const fromName = process.env.SMTP_FROM_NAME?.trim() || 'Rendy';

    const info = await transporter.sendMail({
      from: `"${fromName}" <${gmailUser}>`,
      to: recipientEmail,
      subject,
      html: htmlBody,
    });

    console.info(`✉️ [MAILER] Invitation email delivered to ${recipientEmail} (ID: ${info.messageId})`);

    return {
      dispatched: true,
      messageId: info.messageId,
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Error desconocido al entregar correo vía Gmail SMTP.';

    console.error('❌ [MAILER] Gmail SMTP Delivery Failed:', {
      recipient: recipientEmail,
      error: errorMessage,
    });

    return {
      dispatched: false,
      errorDetail: errorMessage,
    };
  }
}

/**
 * @name enviarCorreoInvitacionEmpleado
 * @description [Business Logic]: Spanish wrapper for sendInvitationEmail, matching the signature
 * expected by administrative actions and staging scripts.
 */
export async function enviarCorreoInvitacionEmpleado(datos: DatosCorreoInvitacion): Promise<{
  sent: boolean;
  messageId?: string;
  error?: string;
}> {
  const result = await sendInvitationEmail(datos.email, {
    firstName: datos.nombreEmpleado,
    companyName: datos.nombreEmpresa,
    magicLinkUrl: datos.enlaceMagico,
    tempPassword: datos.claveTemporal,
    expiresAt: datos.fechaExpiracion,
  });

  return {
    sent: result.dispatched,
    messageId: result.messageId,
    error: result.errorDetail,
  };
}
