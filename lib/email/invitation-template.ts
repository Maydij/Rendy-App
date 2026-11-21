/**
 * @name InvitationEmailTemplate
 * @description [Business Logic]: Generates a branded HTML email body for employee invitation delivery.
 * Includes the activation magic link, temporary password, company branding, and security disclaimers.
 * Uses inline CSS for maximum email client compatibility (Gmail, Outlook, Apple Mail, mobile).
 */

export interface InvitationEmailParams {
  /** Employee first name for personalized greeting */
  firstName: string;
  /** Company / organization display name */
  companyName: string;
  /** Single-use magic link URL for account activation */
  magicLinkUrl: string;
  /** Temporary alphanumeric access code (e.g. TMP-9831-KX) */
  tempPassword: string;
  /** ISO 8601 expiration timestamp for the invitation link */
  expiresAt: string;
}

/**
 * @name buildInvitationEmailHtml
 * @description [Business Logic]: Renders the HTML body of the employee onboarding invitation email,
 * matching Rendy's dark UI theme with emerald accent branding. Compatible with all major email clients.
 */
export function buildInvitationEmailHtml(params: InvitationEmailParams): string {
  const { firstName, companyName, magicLinkUrl, tempPassword, expiresAt } = params;

  const expirationDate = new Date(expiresAt);
  const formattedExpiration = expirationDate.toLocaleDateString('es-VE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `
<!DOCTYPE html>
<html lang="es" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>Invitación a ${escapeHtml(companyName)} en Rendy</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0; padding:0; background-color:#0b0f19; font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale;">
  
  <!-- Outer Container -->
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0b0f19;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        
        <!-- Inner Card -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px; background-color:#0f172a; border-radius:16px; border:1px solid #1e293b; overflow:hidden;">
          
          <!-- Logo Header -->
          <tr>
            <td align="center" style="padding:32px 24px 16px;">
              <div style="font-size:24px; font-weight:800; color:#ffffff; letter-spacing:-0.5px;">
                <span style="color:#10b981;">●</span>&nbsp;Rendy
              </div>
            </td>
          </tr>

          <!-- Activation Badge -->
          <tr>
            <td align="center" style="padding:0 24px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.25); border-radius:20px; padding:6px 16px;">
                    <span style="font-size:12px; font-weight:700; color:#34d399; text-transform:uppercase; letter-spacing:1px;">
                      🔓 Activación de Cuenta
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Heading -->
          <tr>
            <td align="center" style="padding:16px 24px 8px;">
              <h1 style="margin:0; font-size:22px; font-weight:800; color:#ffffff; line-height:1.3;">
                ¡Hola ${escapeHtml(firstName)}, ya casi formas parte del equipo!
              </h1>
            </td>
          </tr>

          <!-- Subheading -->
          <tr>
            <td align="center" style="padding:0 24px 24px;">
              <p style="margin:0; font-size:14px; color:#94a3b8; line-height:1.6;">
                Has sido invitado a unirte a <strong style="color:#ffffff;">${escapeHtml(companyName)}</strong> en Rendy para gestionar tus viáticos y reembolsos corporativos.
              </p>
            </td>
          </tr>

          <!-- Temporary Password Box -->
          <tr>
            <td style="padding:0 24px 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0c1222; border:1px solid #1e293b; border-radius:12px; overflow:hidden;">
                <tr>
                  <td style="padding:16px 20px 8px;">
                    <span style="font-size:11px; font-weight:700; color:#34d399; text-transform:uppercase; letter-spacing:0.8px;">
                      🔑 Tu Contraseña Temporal
                    </span>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:4px 20px 12px;">
                    <div style="background-color:#020617; border:1px solid #334155; border-radius:8px; padding:14px 20px; display:inline-block;">
                      <span style="font-family:'Courier New',Courier,monospace; font-size:22px; font-weight:800; letter-spacing:3px; color:#34d399;">
                        ${escapeHtml(tempPassword)}
                      </span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 20px 16px;">
                    <p style="margin:0; font-size:12px; color:#64748b; line-height:1.5; text-align:center;">
                      Ingresa esta clave en la pantalla de activación para configurar tu contraseña personal.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding:0 24px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:12px; background:linear-gradient(135deg,#059669,#10b981);">
                    <a href="${escapeHtml(magicLinkUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block; padding:14px 36px; font-size:15px; font-weight:700; color:#ffffff; text-decoration:none; letter-spacing:0.3px;">
                      Activar mi cuenta en Rendy &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Fallback Link -->
          <tr>
            <td style="padding:0 24px 20px;">
              <p style="margin:0; font-size:12px; color:#64748b; line-height:1.6; text-align:center;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:
              </p>
              <p style="margin:8px 0 0; font-size:11px; color:#38bdf8; word-break:break-all; text-align:center; line-height:1.5;">
                <a href="${escapeHtml(magicLinkUrl)}" style="color:#38bdf8; text-decoration:underline;">
                  ${escapeHtml(magicLinkUrl)}
                </a>
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 24px;">
              <div style="border-top:1px solid #1e293b;"></div>
            </td>
          </tr>

          <!-- Expiration Warning -->
          <tr>
            <td style="padding:16px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:rgba(234,179,8,0.06); border:1px solid rgba(234,179,8,0.15); border-radius:8px;">
                <tr>
                  <td style="padding:12px 16px;">
                    <p style="margin:0; font-size:12px; color:#fbbf24; line-height:1.5;">
                      ⏳ <strong>Este enlace expira el ${escapeHtml(formattedExpiration)}.</strong>
                      Después de esa fecha, necesitarás solicitar una nueva invitación a tu administrador.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Security Footer -->
          <tr>
            <td style="padding:12px 24px 24px;">
              <p style="margin:0; font-size:11px; color:#475569; line-height:1.6; text-align:center;">
                🔒 Tu cuenta está protegida con cifrado AES-256-GCM y autenticación Ed25519.<br/>
                Si no solicitaste esta invitación, ignora este correo de forma segura.
              </p>
            </td>
          </tr>

          <!-- Bottom Divider -->
          <tr>
            <td style="padding:0 24px;">
              <div style="border-top:1px solid #1e293b;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:20px 24px;">
              <p style="margin:0; font-size:11px; color:#334155; line-height:1.5;">
                © ${new Date().getFullYear()} Rendy Financial Technologies Inc.<br/>
                Todos los derechos reservados.
              </p>
            </td>
          </tr>

        </table>
        <!-- End Inner Card -->

      </td>
    </tr>
  </table>
  <!-- End Outer Container -->

</body>
</html>`.trim();
}

/**
 * @name buildInvitationEmailSubject
 * @description [Business Logic]: Generates the email subject line with the company name for context.
 */
export function buildInvitationEmailSubject(companyName: string): string {
  return `🔓 ${companyName} te invita a unirte a Rendy — Activa tu cuenta`;
}

/**
 * @name generarHtmlInvitacionEmpleado
 * @description [Business Logic]: Spanish compatibility wrapper for buildInvitationEmailHtml.
 */
export function generarHtmlInvitacionEmpleado(datos: {
  nombreEmpleado?: string;
  nombreEmpresa?: string;
  enlaceMagico?: string;
  claveTemporal?: string;
  fechaExpiracion?: string;
  firstName?: string;
  companyName?: string;
  magicLinkUrl?: string;
  tempPassword?: string;
  expiresAt?: string;
}): string {
  return buildInvitationEmailHtml({
    firstName: datos.nombreEmpleado || datos.firstName || 'Colaborador',
    companyName: datos.nombreEmpresa || datos.companyName || 'tu empresa',
    magicLinkUrl: datos.enlaceMagico || datos.magicLinkUrl || '#',
    tempPassword: datos.claveTemporal || datos.tempPassword || '',
    expiresAt: datos.fechaExpiracion || datos.expiresAt || new Date().toISOString(),
  });
}

/**
 * @name escapeHtml
 * @description [Security]: Prevents XSS injection in HTML email templates by escaping
 * dangerous characters from user-supplied content.
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
