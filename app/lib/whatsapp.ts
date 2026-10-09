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
          to: to,
          type: 'text',
          text: { body: text },
        }),
      }
    );

    const data = await res.json();
    return data;
  } catch (error) {
    console.error('❌ Error enviando mensaje por WhatsApp:', error);
    return null;
  }
}

export async function enviarListaWhatsApp(
  to: string,
  bodyText: string,
  buttonText: string,
  title: string,
  rows: { id: string; title: string; description?: string }[]
) {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: 'interactive',
    interactive: {
      type: 'list',
      header: {
        type: 'text',
        text: title,
      },
      body: {
        text: bodyText,
      },
      action: {
        button: buttonText,
        sections: [
          {
            title: 'Opciones disponibles',
            rows: rows,
          },
        ],
      },
    },
  };

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
  return data;
}

// NUEVA FUNCIÓN: Enviar Botones Interactivos de Respuesta Rápida
export async function enviarBotonesWhatsApp(
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[]
) {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: bodyText,
      },
      action: {
        buttons: buttons.map((btn) => ({
          type: 'reply',
          reply: {
            id: btn.id,
            title: btn.title,
          },
        })),
      },
    },
  };

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
  return data;
}