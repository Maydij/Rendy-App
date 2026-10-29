/**
 * @name WhatsAppApiHelper
 * @description [Infrastructure]: Client library for Meta WhatsApp Cloud API (Graph API v20.0).
 * Handles text messages, interactive list messages, and interactive button messages.
 */

export interface WhatsAppRow {
  id: string;
  title: string;
  description?: string;
}

export interface WhatsAppButton {
  id: string;
  title: string;
}

/**
 * @name enviarMensajeWhatsApp
 * @description Sends a standard Markdown-formatted text message to a WhatsApp recipient.
 */
export async function enviarMensajeWhatsApp(to: string, text: string) {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || 'tu_phone_number_id';

  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text },
        }),
      }
    );

    const data = await res.json();
    return data;
  } catch (error) {
    console.error('❌ Error sending WhatsApp text message:', error);
    return null;
  }
}

/**
 * @name enviarListaWhatsApp
 * @description Sends an interactive List Message to present up to 10 selectable items with optional descriptions.
 */
export async function enviarListaWhatsApp(
  to: string,
  bodyText: string,
  buttonText: string,
  title?: string,
  rows: WhatsAppRow[] = [],
  footerText?: string,
  sectionTitle?: string
) {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  const sanitizedRows = rows.slice(0, 10).map((r) => ({
    id: r.id.substring(0, 200),
    title: r.title.substring(0, 24),
    ...(r.description ? { description: r.description.substring(0, 72) } : {}),
  }));

  const interactivePayload: Record<string, unknown> = {
    type: 'list',
    body: {
      text: (bodyText || '').substring(0, 1024),
    },
    action: {
      button: (buttonText || 'Ver opciones').substring(0, 20),
      sections: [
        {
          title: (sectionTitle || 'Opciones disponibles').substring(0, 24),
          rows: sanitizedRows,
        },
      ],
    },
  };

  if (title && title.trim().length > 0) {
    interactivePayload.header = {
      type: 'text',
      text: title.trim().substring(0, 60),
    };
  }

  if (footerText && footerText.trim().length > 0) {
    interactivePayload.footer = { text: footerText.trim().substring(0, 60) };
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: interactivePayload,
  };

  try {
    const response = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();
    if (data?.error) {
      console.error('❌ Meta WhatsApp List API Error:', JSON.stringify(data.error));
    }
    return data;
  } catch (error) {
    console.error('❌ Error sending WhatsApp list message:', error);
    return null;
  }
}

/**
 * @name enviarBotonesWhatsApp
 * @description Sends an interactive Button Message (up to 3 action buttons) with optional header and footer.
 */
export async function enviarBotonesWhatsApp(
  to: string,
  bodyText: string,
  buttons: WhatsAppButton[],
  headerText?: string,
  footerText?: string
) {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  const interactivePayload: Record<string, unknown> = {
    type: 'button',
    body: {
      text: (bodyText || '').substring(0, 1024),
    },
    action: {
      buttons: buttons.slice(0, 3).map((btn) => ({
        type: 'reply',
        reply: {
          id: btn.id.substring(0, 256),
          title: btn.title.substring(0, 20), // Meta limit: 20 characters
        },
      })),
    },
  };

  if (headerText && headerText.trim().length > 0) {
    interactivePayload.header = {
      type: 'text',
      text: headerText.trim().substring(0, 60),
    };
  }

  if (footerText && footerText.trim().length > 0) {
    interactivePayload.footer = {
      text: footerText.trim().substring(0, 60),
    };
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: interactivePayload,
  };

  try {
    const response = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();
    if (data?.error) {
      console.error('❌ Meta WhatsApp Button API Error:', JSON.stringify(data.error));
    }
    return data;
  } catch (error) {
    console.error('❌ Error sending WhatsApp button message:', error);
    return null;
  }
}

// Aliases for alternate naming conventions
export const enviarWhatsAppTexto = enviarMensajeWhatsApp;
export const enviarWhatsAppLista = enviarListaWhatsApp;
export const enviarWhatsAppBotones = enviarBotonesWhatsApp;

/**
 * @name enviarMenuPrincipalListMessage
 * @description [Business Logic]: Sends the official 4-option Interactive List Message for Rendy main navigation.
 */
export async function enviarMenuPrincipalListMessage(to: string, nombreEmpleado?: string) {
  const saludo = nombreEmpleado ? `¡Hola, *${nombreEmpleado}*!` : '¡Hola!';
  const filas: WhatsAppRow[] = [
    {
      id: 'OPCION_PEDIR_VIATICOS',
      title: '📝 Pedir Viáticos',
      description: 'Solicitar anticipo de fondos para viaje o proyecto',
    },
    {
      id: 'OPCION_RENDIR_VIATICOS',
      title: '💼 Rendir Viáticos',
      description: 'Justificar gastos con fondos de la empresa',
    },
    {
      id: 'OPCION_PEDIR_REEMBOLSO',
      title: '💸 Pedir Reembolso',
      description: 'Reportar gasto cubierto con fondos propios',
    },
    {
      id: 'OPCION_CONSULTAR_ESTADO',
      title: '🔍 Consultar Saldos',
      description: 'Ver saldos disponibles y estado de solicitudes',
    },
  ];

  return await enviarListaWhatsApp(
    to,
    `${saludo}\n¿Qué gestión administrativa deseas realizar hoy?`,
    'Seleccionar Opción',
    '🤖 Menú Principal Rendy',
    filas,
    'Rendy • Control de Gastos',
    'Operaciones'
  );
}
