/**
 * @name EmailModule
 * @description [Infrastructure]: Barrel export for the Rendy transactional email service.
 * Supports Gmail SMTP via Nodemailer without requiring custom domain DNS verification on staging.
 */
export { getMailTransporter } from './nodemailer-client';
export {
  sendInvitationEmail,
  enviarCorreoInvitacionEmpleado,
  type SendInvitationEmailResult,
  type DatosCorreoInvitacion,
} from './send-invitation-email';
export {
  buildInvitationEmailHtml,
  generarHtmlInvitacionEmpleado,
  buildInvitationEmailSubject,
  type InvitationEmailParams,
} from './invitation-template';
