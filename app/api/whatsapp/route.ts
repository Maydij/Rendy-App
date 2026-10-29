/**
 * @name WhatsAppWebhookRoute
 * @description [API Route]: Entry point for Meta WhatsApp Cloud API webhooks.
 *
 * Responsibilities:
 * - GET: Handles challenge handshake and webhook verification.
 * - POST: Deduplicates incoming message deliveries and routes events to the FSM flow engine.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';
import { routerMensajeWhatsApp } from '@/lib/whatsapp/flowEngine';

/**
 * Message ID deduplication cache to prevent handling identical webhooks repeatedly.
 * Evicts keys after 5 minutes.
 */
const processedMessages = new Set<string>();

/**
 * @name GET
 * @description Webhook subscription verification with Meta WhatsApp Cloud API.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Token incorrecto' }, { status: 403 });
}

/**
 * @name POST
 * @description Ingestion pipeline for WhatsApp events (text, images, documents, interactive clicks).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) {
      // Status updates, acknowledgments, or non-message webhook events
      return NextResponse.json({ status: 'ignored_non_message' }, { status: 200 });
    }

    const messageId = message.id;

    // Prevent duplicate webhook deliveries
    if (processedMessages.has(messageId)) {
      return NextResponse.json({ status: 'duplicado_ignorado' }, { status: 200 });
    }

    processedMessages.add(messageId);
    setTimeout(() => processedMessages.delete(messageId), 5 * 60 * 1000);

    const telefono = message.from;
    const rawType = message.type;

    let tipoMensaje: 'text' | 'image' | 'document' | 'interactive' = 'text';
    let cuerpoTexto: string | undefined;
    let mediaId: string | undefined;
    let interactiveReplyId: string | undefined;
    let interactiveReplyTitle: string | undefined;

    if (rawType === 'text') {
      tipoMensaje = 'text';
      cuerpoTexto = message.text?.body;
    } else if (rawType === 'image') {
      tipoMensaje = 'image';
      mediaId = message.image?.id;
    } else if (rawType === 'document') {
      tipoMensaje = 'document';
      mediaId = message.document?.id;
    } else if (rawType === 'interactive') {
      tipoMensaje = 'interactive';
      if (message.interactive?.type === 'button_reply') {
        interactiveReplyId = message.interactive?.button_reply?.id;
        interactiveReplyTitle = message.interactive?.button_reply?.title;
      } else if (message.interactive?.type === 'list_reply') {
        interactiveReplyId = message.interactive?.list_reply?.id;
        interactiveReplyTitle = message.interactive?.list_reply?.title;
      }
    }

    const result = await routerMensajeWhatsApp({
      supabase,
      telefono,
      tipoMensaje,
      cuerpoTexto,
      mediaId,
      interactiveReplyId,
      interactiveReplyTitle,
    });

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    console.error('❌ Error in WhatsApp webhook handler:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
