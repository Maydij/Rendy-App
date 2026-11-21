/**
 * @name Mailer
 * @description [Business Logic]: Compatibility entrypoint for Nodemailer Gmail SMTP dispatch.
 * Re-exports the primary email service functions and types for administrative and onboarding workflows.
 */
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

export { getMailTransporter } from './nodemailer-client';
