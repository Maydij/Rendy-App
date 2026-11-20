/**
 * @name WhatsAppFlowEngine
 * @description [Business Logic & Orchestration]: Core finite state machine (FSM) and dual-routing controller
 * for the Rendy WhatsApp interface.
 *
 * Implements:
 * 1. Dual Ingestion Routing:
 *    - Quick Route (Cold Ingestion): Ingest receipts sent directly without prior conversation.
 *      Auto-resolves based on employee's active viático allocations (0 -> Reembolso, 1 -> Auto-assign, 2+ -> Disambiguation).
 *    - Guided Route (Assisted Navigation): Interactive 4-option menu (Pedir Viáticos, Rendir Viáticos, Reembolso, Consultar Saldos).
 * 2. Multi-step Viático Request Flow:
 *    - Dropdown list of active company projects from `proyectos` table.
 *    - Amount, currency, date, and estimated usage specification.
 *    - Dual-write persistence to `solicitudes_viaticos` (Web Dashboard) and `viaticos` (Budget Engine).
 * 3. Persistent State Machine: Backed by `sesiones_whatsapp` table with 3-minute idle timeout.
 * 4. Anti-Fraud Double Lock: Automatic fiscal and binary hash deduplication.
 * 5. Real-time Budget & Overdraft Engine: Evaluates allocation balances against live expenses.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  procesarFacturaConIA,
  guardarImagenEnSupabase,
  procesarFacturaPDFConIA,
  guardarPDFEnSupabase,
  verificarGastoDuplicado,
  aplicarCorreccionConIA,
  calcularHashBuffer,
} from '@/app/lib/ocr';
import {
  enviarMensajeWhatsApp,
  enviarListaWhatsApp,
  enviarBotonesWhatsApp,
  enviarMenuPrincipalListMessage,
  enviarArchivoWhatsApp,
  type WhatsAppRow,
} from '@/app/lib/whatsapp';
import { auditarGastoUSA } from '@/lib/services/usaTaxEngine';
import {
  scheduleInactivityTimers,
  clearInactivityTimers,
} from '@/lib/services/inactivityManager';
import { verifyInvoiceDuplicate } from '@/lib/services/duplicate-detection.service';
import {
  normalizarGastoFiscal,
  type GeminiFiscalExtraction,
} from '@/lib/services/procesadorFiscal';
import {
  calcularSaldoViatico,
  obtenerViaticosActivosEmpleado,
  obtenerResumenSaldosEmpleado,
  formatearResumenSaldosWhatsApp,
  type EvaluacionSobregiro,
  type ViaticoActivo,
} from '@/lib/services/viaticosEngine';
import {
  normalizeCategory,
  evaluarLimiteDiarioCategoria,
  type EvaluacionLimiteDiario,
} from '@/lib/services/politicasGastos';
import { DEFAULT_OFFICIAL_CATEGORIES } from '@/lib/types/categoria';
import { normalizeMoneda } from '@/lib/currency';
import type {
  EstadoConversacion,
  DatosTemporalesSesion,
  ExtraccionOcrSesion,
  SesionWhatsAppRecord,
  NuevoViaticoDraft,
} from '@/lib/types/whatsapp';

/**
 * 3-minute inactivity timeout window in milliseconds.
 */
const TIMEOUT_SESION_MS = 3 * 60 * 1000;

/**
 * Global manual escape words that immediately abort the active flow.
 */
const COMANDOS_ESCAPE = ['volver', 'cancelar', 'inicio', 'menu', 'menú', 'atras', 'atrás'];

/**
 * @name FlowEngineParams
 * @description Input context passed to the router on every incoming WhatsApp webhook message.
 */
export interface FlowEngineParams {
  supabase: SupabaseClient;
  telefono: string;
  tipoMensaje: 'text' | 'image' | 'document' | 'interactive';
  cuerpoTexto?: string;
  mediaId?: string;
  interactiveReplyId?: string;
  interactiveReplyTitle?: string;
}

/**
 * @name routerMensajeWhatsApp
 * @description [Business Logic]: Primary orchestrator for all WhatsApp interactions in Rendy.
 */
export async function routerMensajeWhatsApp({
  supabase,
  telefono,
  tipoMensaje,
  cuerpoTexto,
  mediaId,
  interactiveReplyId,
  interactiveReplyTitle,
}: FlowEngineParams): Promise<{ status: string }> {
  // ───────────────────────────────────────────────────────────────────────────
  // 1. Identity & Account Resolution
  // ───────────────────────────────────────────────────────────────────────────
  const { data: usuario, error: errUsuario } = await supabase
    .from('usuarios')
    .select('id, empresa_id, nombre, empresas(moneda)')
    .eq('telefono_whatsapp', telefono)
    .maybeSingle();

  if (errUsuario || !usuario || !usuario.empresa_id) {
    await enviarMensajeWhatsApp(
      telefono,
      '⚠️ *Número no registrado*\nTu número de WhatsApp no está vinculado a ninguna empresa en *Rendy*. Por favor, contacta al administrador de tu organización.'
    );
    return { status: 'usuario_no_registrado' };
  }

  const empleadoId = usuario.id;
  const empresaId = usuario.empresa_id;
  const monedaEmpresa = (usuario.empresas as unknown as { moneda?: string })?.moneda || 'VES';

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Load Persistent Session from Database
  // ───────────────────────────────────────────────────────────────────────────
  let { data: sesionData } = await supabase
    .from('sesiones_whatsapp')
    .select('*')
    .eq('telefono', telefono)
    .maybeSingle();

  let sesion: SesionWhatsAppRecord = {
    telefono,
    empleado_id: empleadoId,
    estado: (sesionData?.estado as EstadoConversacion) || 'INICIO',
    datos_temporales: (sesionData?.datos_temporales as DatosTemporalesSesion | null) || null,
    ultima_interaccion: sesionData?.ultima_interaccion || new Date().toISOString(),
  };

  // Clear pending timers while processing the new interaction
  clearInactivityTimers(telefono);

  const ahora = Date.now();

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Global Rule: Inactivity Timeout (3 Minutes)
  // ───────────────────────────────────────────────────────────────────────────
  if (sesion.estado !== 'INICIO') {
    const ultima = new Date(sesion.ultima_interaccion).getTime();
    const delta = ahora - ultima;

    if (delta > TIMEOUT_SESION_MS) {
      await resetearSesion(supabase, telefono, empleadoId);
      await enviarMensajeWhatsApp(
        telefono,
        '⏱️ *Sesión expirada por inactividad.*\nTu gestión anterior fue cancelada por seguridad. ¿Qué deseas hacer ahora?'
      );
      await enviarMenuPrincipalListMessage(telefono, usuario.nombre);
      return { status: 'sesion_expirada' };
    }
  }

  const textoLimpio = cuerpoTexto?.trim().toLowerCase() || '';

  // ───────────────────────────────────────────────────────────────────────────
  // 3.1. On-Demand Keyword: Tax-Exempt / Fiscal Certificate Dispatch
  // ───────────────────────────────────────────────────────────────────────────
  const TAX_EXEMPT_KEYWORDS = ['certificado', 'tax exempt', 'tax-exempt', 'exencion', 'exención', 'resale', 'reventa'];
  if (tipoMensaje === 'text' && TAX_EXEMPT_KEYWORDS.some((kw) => textoLimpio.includes(kw))) {
    const { data: empresaData } = await supabase
      .from('empresas')
      .select('*')
      .eq('id', empresaId)
      .maybeSingle();

    const emp = empresaData as Record<string, unknown> | null;
    const certUrl = (emp?.url_certificado_usa as string | undefined) || (emp?.url_certificado_tax_exempt as string | undefined);
    const certNombre = (emp?.nombre_certificado_usa as string | undefined) || 'Certificado Fiscal EE. UU.';

    if (certUrl) {
      await enviarArchivoWhatsApp(
        telefono,
        certUrl,
        `📄 *${certNombre}*\nDocumento fiscal de la empresa para compras en EE. UU.`,
        'Certificado_Fiscal_USA.pdf'
      );
    } else {
      await enviarMensajeWhatsApp(
        telefono,
        'ℹ️ Tu empresa no tiene un certificado fiscal de EE. UU. cargado en el sistema.'
      );
    }
    return { status: 'certificado_usa_despachado' };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Global Rule: Manual Escape Commands (Cancelar / Volver / Menú)
  // ───────────────────────────────────────────────────────────────────────────
  if (tipoMensaje === 'text' && COMANDOS_ESCAPE.includes(textoLimpio)) {
    await resetearSesion(supabase, telefono, empleadoId);
    await enviarMensajeWhatsApp(
      telefono,
      '🔄 *Operación cancelada.*\nHas vuelto al inicio. Envía un comprobante directamente o selecciona una opción del menú.'
    );
    await enviarMenuPrincipalListMessage(telefono, usuario.nombre);
    return { status: 'operacion_cancelada' };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Global Rule: Universal "Volver al Menú" or "Cancelar" Button/List Action
  // ───────────────────────────────────────────────────────────────────────────
  if (
    interactiveReplyId === 'VOLVER_MENU' ||
    interactiveReplyId === 'BTN_VOLVER_MENU' ||
    interactiveReplyId === 'CANCELAR_GASTO' ||
    interactiveReplyId === 'CANCELAR_SOLICITUD_VIATICO' ||
    interactiveReplyId === 'CANCELAR_SOLICITUD'
  ) {
    await resetearSesion(supabase, telefono, empleadoId);
    await enviarMensajeWhatsApp(
      telefono,
      '🔄 *Operación cancelada.* No se guardaron cambios.'
    );
    await enviarMenuPrincipalListMessage(telefono, usuario.nombre);
    return { status: 'cancelado_por_boton' };
  }

  // ===========================================================================
  // ENTRADA B: RUTA RÁPIDA (Ingesta en Frío / Foto Directa)
  // ===========================================================================
  if (
    (tipoMensaje === 'image' || tipoMensaje === 'document') &&
    mediaId &&
    (!sesion || sesion.estado === 'INICIO')
  ) {
    return await manejarIngestaComprobanteEnFrio({
      supabase,
      telefono,
      empleadoId,
      empresaId,
      mediaId,
      esPdf: tipoMensaje === 'document',
    });
  }

  // ===========================================================================
  // ENTRADA A: RUTA GUIADA (Comprobantes en estado esperando foto)
  // ===========================================================================
  if (
    (tipoMensaje === 'image' || tipoMensaje === 'document') &&
    mediaId &&
    (sesion.estado === 'ESPERANDO_FOTO_VIATICO' || sesion.estado === 'ESPERANDO_FOTO_REEMBOLSO')
  ) {
    return await manejarComprobanteEnRutaGuiada({
      supabase,
      telefono,
      empleadoId,
      empresaId,
      mediaId,
      esPdf: tipoMensaje === 'document',
      sesion,
    });
  }

  // ===========================================================================
  // MANEJO DE MENSAJES DE TEXTO (Navegación, Solicitud y Correcciones)
  // ===========================================================================
  if (tipoMensaje === 'text') {
    // A. Saludos y Detección de Intenciones en estado INICIO
    if (sesion.estado === 'INICIO') {
      // 1. Despedida o finalizar sesión ("no", "finalizar", "terminar", "salir", etc.)
      const despedidas = [
        'no',
        'no gracias',
        'no, gracias',
        'finalizar',
        'terminar',
        'salir',
        'chao',
        'adios',
        'adiós',
        'hasta luego',
        'listo gracias',
        'nada mas',
        'nada más',
      ];
      if (despedidas.includes(textoLimpio)) {
        await resetearSesion(supabase, telefono, empleadoId);
        await enviarMensajeWhatsApp(
          telefono,
          '🙌 ¡Muchas gracias por usar *Rendy*! Quedo a tu disposición si necesitas algo más tarde. ¡Que tengas un excelente día!'
        );
        return { status: 'conversacion_finalizada' };
      }

      // 2. Continuar con otra gestión ("si", "otra gestion", etc.)
      const continuaciones = [
        'si',
        'sí',
        'otra gestion',
        'otra gestión',
        'otra',
        'si por favor',
        'sí por favor',
        'continuar',
      ];
      if (continuaciones.includes(textoLimpio)) {
        await resetearSesion(supabase, telefono, empleadoId);
        await enviarBotonesWhatsApp(
          telefono,
          '👍 ¡Claro! ¿Qué otra gestión deseas realizar?',
          [
            { id: 'BTN_SOLICITAR_VIATICOS', title: '📝 Pedir Viáticos' },
            { id: 'BTN_JUSTIFICAR_VIATICOS', title: '📄 Rendir Viáticos' },
            { id: 'BTN_SOLICITAR_REEMBOLSO', title: '💸 Pedir Reembolso' },
          ]
        );
        return { status: 'menu_reabierto' };
      }

      // 3. Intenciones de navegación directa por texto
      if (
        textoLimpio.includes('pedir viatico') ||
        textoLimpio.includes('pedir viático') ||
        textoLimpio.includes('solicitar viatico') ||
        textoLimpio.includes('solicitar viático') ||
        textoLimpio === '1'
      ) {
        return await iniciarFlujoPedirViaticos({
          supabase,
          telefono,
          empleadoId,
          empresaId,
        });
      }

      if (
        textoLimpio.includes('rendir viatico') ||
        textoLimpio.includes('rendir viático') ||
        textoLimpio.includes('justificar viatico') ||
        textoLimpio.includes('justificar viático') ||
        textoLimpio === '2'
      ) {
        return await routerMensajeWhatsApp({
          supabase,
          telefono,
          tipoMensaje: 'interactive',
          interactiveReplyId: 'OPCION_RENDIR_VIATICOS',
        });
      }

      if (
        textoLimpio.includes('reembolso') ||
        textoLimpio.includes('pedir reembolso') ||
        textoLimpio === '3'
      ) {
        return await routerMensajeWhatsApp({
          supabase,
          telefono,
          tipoMensaje: 'interactive',
          interactiveReplyId: 'OPCION_PEDIR_REEMBOLSO',
        });
      }

      if (
        textoLimpio.includes('saldo') ||
        textoLimpio.includes('consultar') ||
        textoLimpio.includes('estado') ||
        textoLimpio === '4'
      ) {
        return await routerMensajeWhatsApp({
          supabase,
          telefono,
          tipoMensaje: 'interactive',
          interactiveReplyId: 'OPCION_CONSULTAR_ESTADO',
        });
      }

      const saludos = ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'start', 'ayuda', 'rendy', 'menu', 'menú'];
      if (saludos.some((s) => textoLimpio.includes(s)) || textoLimpio.length <= 15) {
        await enviarMenuPrincipalListMessage(telefono, usuario.nombre);
        return { status: 'menu_enviado' };
      }
    }

    // Renovación explícita de sesión activa por texto ("seguir", "continuar", "aquí", etc.)
    if (sesion.estado !== 'INICIO') {
      const renovaciones = [
        'seguir',
        'continuar',
        'continuar gestion',
        'continuar gestión',
        'aqui',
        'aquí',
        'aqui estoy',
        'aquí estoy',
        'mantener',
        'espera',
        'esperame',
        'espérame',
      ];
      if (renovaciones.includes(textoLimpio)) {
        return await routerMensajeWhatsApp({
          supabase,
          telefono,
          tipoMensaje: 'interactive',
          interactiveReplyId: 'BTN_MANTENER_SESION',
        });
      }
    }

    // B. Subflujo: Pedir Viático - Selección de Proyecto por Texto
    if (sesion.estado === 'SOLICITANDO_VIATICO_PROYECTO') {
      const { data: proyectos } = await supabase
        .from('proyectos')
        .select('id, nombre')
        .eq('empresa_id', empresaId)
        .eq('activo', true)
        .order('nombre');

      const matched = (proyectos ?? []).find(
        (p, idx) =>
          p.nombre.toLowerCase().includes(textoLimpio) ||
          String(idx + 1) === textoLimpio
      );

      if (matched) {
        const draft: NuevoViaticoDraft = {
          proyecto_id: matched.id,
          proyecto: matched.nombre,
        };

        await actualizarSesion(
          supabase,
          telefono,
          'SOLICITANDO_VIATICO_MONTO',
          { nuevo_viatico: draft },
          empleadoId
        );

        await enviarBotonesWhatsApp(
          telefono,
          `✅ Proyecto seleccionado: *${matched.nombre}*\n\nIndica el *monto estimado* que requieres de anticipo (Ej: 150.00):`,
          [{ id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' }]
        );
        return { status: 'solicitud_monto_solicitado' };
      } else {
        scheduleInactivityTimers({
          supabase,
          telefono,
          empleadoId,
          employeeName: usuario.nombre,
        });
        await enviarBotonesWhatsApp(
          telefono,
          '⚠️ No reconocí ese proyecto. Por favor selecciona una opción de la lista de proyectos o escribe parte del nombre:',
          [{ id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' }]
        );
        return { status: 'proyecto_no_reconocido' };
      }
    }

    // B.2 Subflujo: Rendir Viático - Selección de Proyecto Activo por Texto
    if (sesion.estado === 'SELECCIONANDO_VIATICO_PREVIO') {
      const viaticosDisponibles = await obtenerViaticosActivosEmpleado(supabase, empleadoId, {
        soloPendientesJustificar: true,
      });

      const matched = viaticosDisponibles.find(
        (v, idx) =>
          v.nombre_proyecto.toLowerCase().includes(textoLimpio) ||
          String(idx + 1) === textoLimpio
      );

      if (matched) {
        await actualizarSesion(
          supabase,
          telefono,
          'ESPERANDO_FOTO_VIATICO',
          {
            viatico_id: matched.id,
            es_reembolso: false,
          },
          empleadoId,
          usuario.nombre
        );

        await enviarBotonesWhatsApp(
          telefono,
          `💼 Has seleccionado: *${matched.nombre_proyecto}* (Saldo disponible: $${matched.saldo_disponible_usd.toFixed(2)} USD).\n\n📸 Por favor adjunta la imagen o PDF del comprobante:`,
          [{ id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' }]
        );
        return { status: 'viatico_seleccionado_esperando_foto' };
      } else {
        scheduleInactivityTimers({
          supabase,
          telefono,
          empleadoId,
          employeeName: usuario.nombre,
        });
        await enviarBotonesWhatsApp(
          telefono,
          '⚠️ No reconocí ese viático o proyecto pendiente. Por favor selecciona una opción de la lista desplegable o escribe parte del nombre:',
          [{ id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' }]
        );
        return { status: 'viatico_no_reconocido' };
      }
    }

    // C. Subflujo: Pedir Viático - Monto Requerido (Texto)
    if (sesion.estado === 'SOLICITANDO_VIATICO_MONTO') {
      const montoParsed = parseFloat((cuerpoTexto || '').replace(/[^0-9.]/g, '').replace(',', '.'));

      if (isNaN(montoParsed) || montoParsed <= 0) {
        scheduleInactivityTimers({
          supabase,
          telefono,
          empleadoId,
          employeeName: usuario.nombre,
        });
        await enviarBotonesWhatsApp(
          telefono,
          '⚠️ Por favor ingresa un monto numérico válido mayor a 0 (Ej: 150.00):',
          [{ id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' }]
        );
        return { status: 'monto_invalido' };
      }

      const draft: NuevoViaticoDraft = sesion.datos_temporales?.nuevo_viatico || {};
      draft.monto_estimado = montoParsed;

      await actualizarSesion(
        supabase,
        telefono,
        'SOLICITANDO_VIATICO_MONEDA',
        { nuevo_viatico: draft },
        empleadoId
      );

      const labelMonedaLocal = monedaEmpresa === 'VES' ? 'Bolívares (VES)' : `Local (${monedaEmpresa})`;

      await enviarBotonesWhatsApp(
        telefono,
        `✅ Monto ingresado: *$${montoParsed.toFixed(2)}*\n\n¿En qué moneda requieres este anticipo?`,
        [
          { id: 'SOL_MONEDA_LOCAL', title: labelMonedaLocal.substring(0, 20) },
          { id: 'SOL_MONEDA_USD', title: 'Dólares (USD)' },
          { id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' },
        ]
      );
      return { status: 'solicitud_moneda_enviada' };
    }

    // C. Subflujo: Pedir Viático - Fecha Requerida (Texto libre tipo AAAA-MM-DD)
    if (sesion.estado === 'SOLICITANDO_VIATICO_FECHA') {
      const fechaTexto = cuerpoTexto?.trim() || new Date().toISOString().split('T')[0];
      const draft: NuevoViaticoDraft = sesion.datos_temporales?.nuevo_viatico || {};
      draft.fecha_requerida = fechaTexto;

      await actualizarSesion(
        supabase,
        telefono,
        'SOLICITANDO_VIATICO_USO',
        { nuevo_viatico: draft },
        empleadoId
      );

      const categoriasUso: WhatsAppRow[] = [
        { id: 'SOL_CAT_Alimentacion', title: 'Alimentación / Comida' },
        { id: 'SOL_CAT_Transporte', title: 'Transporte / Gasolina' },
        { id: 'SOL_CAT_Hospedaje', title: 'Hospedaje / Hotel' },
        { id: 'SOL_CAT_Materiales', title: 'Materiales / Equipos' },
        { id: 'SOL_CAT_Varios', title: 'Gastos Varios' },
        { id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' },
      ];

      await enviarListaWhatsApp(
        telefono,
        `✅ Fecha requerida: *${fechaTexto}*\n\nSelecciona el uso principal estimado para este viático:`,
        'Ver Opciones',
        '🏷️ Uso Estimado',
        categoriasUso,
        'Rendy • Control de Gastos',
        'Categorías'
      );
      return { status: 'solicitud_uso_enviada' };
    }

    // C.2 Subflujo: Pedir Viático - Uso Principal Escrito por Texto Libre
    if (sesion.estado === 'SOLICITANDO_VIATICO_USO') {
      const draft: NuevoViaticoDraft = sesion.datos_temporales?.nuevo_viatico || {};
      draft.uso_estimado = cuerpoTexto?.trim() || 'Gastos Operativos';

      await actualizarSesion(
        supabase,
        telefono,
        'SOLICITANDO_VIATICO_CONFIRMACION',
        { nuevo_viatico: draft },
        empleadoId
      );

      const mensajeResumen =
        `📌 *Resumen de Solicitud de Viáticos:*\n\n` +
        `📁 *Proyecto:* ${draft.proyecto || 'General'}\n` +
        `💵 *Monto Solicitado:* ${draft.monto_estimado} ${draft.moneda || 'USD'}\n` +
        `📅 *Fecha Requerida:* ${draft.fecha_requerida}\n` +
        `🏷️ *Uso Principal:* ${draft.uso_estimado}\n\n` +
        `_¿Deseas enviar esta solicitud para aprobación?_\n` +
        `Presiona *Confirmar* para enviar o *Volver al Menú* para cancelar.`;

      await enviarBotonesWhatsApp(
        telefono,
        mensajeResumen,
        [
          { id: 'CONFIRMAR_SOLICITUD_VIATICO', title: '✅ Confirmar' },
          { id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' },
        ]
      );
      return { status: 'solicitud_resumen_enviado' };
    }

    // D. Subflujo: Pedir Viático - Confirmación por Texto ("SI", "CONFIRMAR")
    if (sesion.estado === 'SOLICITANDO_VIATICO_CONFIRMACION') {
      const afirmaciones = ['si', 'sí', 'confirmar', 'confirmo', 'guardar', 'ok', 'dale', 'listo'];
      if (afirmaciones.includes(textoLimpio)) {
        return await confirmarYPersistirSolicitudViatico({
          supabase,
          telefono,
          empleadoId,
          empresaId,
          draft: sesion.datos_temporales?.nuevo_viatico,
        });
      }
    }

    // D.1. Subflujo: Selección de Destino de Comprobante por Texto ("reembolso" o "viatico")
    if (sesion.estado === 'RESOLVIENDO_DESTINO_FOTO' && sesion.datos_temporales?.extraccion_ocr) {
      const viaticosActivos = await obtenerViaticosActivosEmpleado(supabase, empleadoId, {
        soloPendientesJustificar: true,
      });

      const esIntencionReembolso = [
        'reembolso',
        'reembolsar',
        'pedir reembolso',
        'fondos propios',
        'bolsillo',
        'mi dinero',
        '2',
      ].some((term) => textoLimpio === term || textoLimpio.includes(term));

      if (esIntencionReembolso) {
        return await routerMensajeWhatsApp({
          supabase,
          telefono,
          tipoMensaje: 'interactive',
          interactiveReplyId: 'DESTINO_REEMBOLSO',
          interactiveReplyTitle: '💸 Pedir Reembolso',
        });
      }

      const esIntencionViatico = [
        'viatico',
        'viático',
        'viaticos',
        'viáticos',
        'rendir',
        'rendir viatico',
        'rendir viático',
        'proyecto',
        '1',
      ].some((term) => textoLimpio === term || textoLimpio.includes(term));

      if (esIntencionViatico && viaticosActivos.length === 1) {
        return await routerMensajeWhatsApp({
          supabase,
          telefono,
          tipoMensaje: 'interactive',
          interactiveReplyId: `DESTINO_VIATICO_${viaticosActivos[0].id}`,
          interactiveReplyTitle: viaticosActivos[0].nombre_proyecto,
        });
      }
    }

    // D.2. Subflujo: Selección de Categoría por Texto (match parcial contra nombres de categorías activas)
    if (sesion.estado === 'ESPERANDO_CATEGORIA' && sesion.datos_temporales?.extraccion_ocr) {
      const { data: catActivas } = await supabase
        .from('categorias_gastos')
        .select('codigo, nombre')
        .eq('empresa_id', empresaId)
        .eq('activa', true);

      if (catActivas && catActivas.length > 0) {
        const matchedCat = catActivas.find(
          (c) =>
            c.nombre.toLowerCase() === textoLimpio ||
            c.codigo.toLowerCase() === textoLimpio ||
            c.nombre.toLowerCase().includes(textoLimpio) ||
            textoLimpio.includes(c.nombre.toLowerCase())
        );

        if (matchedCat) {
          return await routerMensajeWhatsApp({
            supabase,
            telefono,
            tipoMensaje: 'interactive',
            interactiveReplyId: `CAT_SEL_${matchedCat.codigo}`,
            interactiveReplyTitle: matchedCat.nombre,
          });
        }
      }

      // No match found — re-send the category list
      await enviarMensajeWhatsApp(
        telefono,
        '🏷️ No reconocí esa categoría. Por favor selecciona una de la lista:'
      );
      await enviarSelectorCategoriasWhatsApp(
        supabase,
        telefono,
        empresaId,
        sesion.datos_temporales.categoria_page || 1
      );
      return { status: 'categoria_texto_no_reconocido' };
    }

    // E. Subflujo: Confirmación de Gasto por Texto ("SI", "CONFIRMAR", "OK")
    if (sesion.estado === 'ESPERANDO_CONFIRMACION') {
      const afirmaciones = ['si', 'sí', 'confirmar', 'confirmo', 'guardar', 'ok', 'dale', 'listo'];
      if (afirmaciones.includes(textoLimpio)) {
        return await persistirGastoDefinitivo(supabase, telefono, empleadoId, empresaId, sesion.datos_temporales);
      }

      // F. Si el usuario escribe una corrección por texto (ej. "el monto es 45")
      if (sesion.datos_temporales?.extraccion_ocr) {
        return await manejarCorreccionTextoComprobante({
          supabase,
          telefono,
          empleadoId,
          textoCorreccion: cuerpoTexto || '',
          sesion,
        });
      }
    }
  }

  // ===========================================================================
  // MANEJO DE INTERACCIONES DE MENÚ / LISTAS / BOTONES
  // ===========================================================================
  if (tipoMensaje === 'interactive' && interactiveReplyId) {
    // ─── 0. CONTINUAR O FINALIZAR SESIÓN (Flujo Post-Operación) ───
    if (interactiveReplyId === 'BTN_CONTINUAR_SI') {
      await resetearSesion(supabase, telefono, empleadoId);
      await enviarBotonesWhatsApp(
        telefono,
        '👍 ¡Claro! ¿Qué otra gestión deseas realizar?',
        [
          { id: 'BTN_SOLICITAR_VIATICOS', title: '📝 Pedir Viáticos' },
          { id: 'BTN_JUSTIFICAR_VIATICOS', title: '📄 Rendir Viáticos' },
          { id: 'BTN_SOLICITAR_REEMBOLSO', title: '💸 Pedir Reembolso' },
        ]
      );
      return { status: 'menu_reabierto' };
    }

    if (interactiveReplyId === 'BTN_CONTINUAR_NO') {
      await resetearSesion(supabase, telefono, empleadoId);
      await enviarMensajeWhatsApp(
        telefono,
        '🙌 ¡Muchas gracias por usar *Rendy*! Quedo a tu disposición si necesitas algo más tarde. ¡Que tengas un excelente día!'
      );
      return { status: 'conversacion_finalizada' };
    }

    // ─── 0.1 MANTENER SESIÓN ACTIVA TRAS AVISO DE INACTIVIDAD ───
    if (interactiveReplyId === 'BTN_MANTENER_SESION') {
      const datosActualizados: DatosTemporalesSesion = {
        ...(sesion.datos_temporales || {}),
        aviso_inactividad_enviado: false,
      };

      await actualizarSesion(
        supabase,
        telefono,
        sesion.estado,
        datosActualizados,
        empleadoId,
        usuario.nombre
      );

      let recordatorio = 'Por favor, continúa con tu gestión pendiente:';
      switch (sesion.estado) {
        case 'SOLICITANDO_VIATICO_PROYECTO':
          recordatorio = 'Por favor selecciona el *proyecto* al que destinarás los fondos.';
          break;
        case 'SOLICITANDO_VIATICO_MONTO':
          recordatorio = 'Por favor indica el *monto estimado* que requieres de anticipo (Ej: 150.00).';
          break;
        case 'SOLICITANDO_VIATICO_MONEDA':
          recordatorio = 'Por favor selecciona la *moneda* requerida.';
          break;
        case 'SOLICITANDO_VIATICO_FECHA':
          recordatorio = 'Por favor selecciona o escribe la *fecha requerida* (AAAA-MM-DD).';
          break;
        case 'SOLICITANDO_VIATICO_USO':
          recordatorio = 'Por favor selecciona el *uso principal estimado* de los viáticos.';
          break;
        case 'SOLICITANDO_VIATICO_CONFIRMACION':
          recordatorio = 'Por favor presiona *Confirmar* para enviar tu solicitud de viáticos.';
          break;
        case 'SELECCIONANDO_VIATICO_PREVIO':
          recordatorio = 'Por favor selecciona el *proyecto* para el cual vas a rendir viáticos.';
          break;
        case 'ESPERANDO_FOTO_VIATICO':
        case 'ESPERANDO_FOTO_REEMBOLSO':
          recordatorio = 'Por favor adjunta la *foto o documento PDF* de tu comprobante.';
          break;
        case 'RESOLVIENDO_DESTINO_FOTO':
          recordatorio = 'Por favor selecciona a cuál de tus viáticos o si es reembolso personal asignar la factura.';
          break;
        case 'ESPERANDO_CATEGORIA':
          recordatorio = 'Por favor selecciona la *categoría* de gasto de la lista interactiva.';
          break;
        case 'ESPERANDO_CONFIRMACION':
          recordatorio = 'Por favor presiona *Confirmar* para guardar el comprobante o escribe cualquier corrección.';
          break;
        default:
          recordatorio = 'Por favor, continúa con tu paso pendiente o escribe *cancelar* para volver al inicio.';
      }

      await enviarBotonesWhatsApp(
        telefono,
        `👍 *Sesión renovada con éxito*\nTienes 3 minutos más activos.\n\n${recordatorio}`,
        [{ id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' }]
      );
      return { status: 'sesion_renovada' };
    }

    // ─── 1. PEDIR VIÁTICOS: Lista Desplegable de Proyectos Activos de la Empresa ───
    if (
      interactiveReplyId === 'OPCION_PEDIR_VIATICOS' ||
      interactiveReplyId === 'BTN_SOLICITAR_VIATICOS'
    ) {
      return await iniciarFlujoPedirViaticos({
        supabase,
        telefono,
        empleadoId,
        empresaId,
      });
    }

    // ─── 2. SELECCIÓN DE PROYECTO PARA SOLICITUD DE VIÁTICO ───
    if (interactiveReplyId.startsWith('SOL_PROY_')) {
      const proyId = interactiveReplyId.replace('SOL_PROY_', '');
      const proyTitle = interactiveReplyTitle || 'Proyecto';

      const draft: NuevoViaticoDraft = {
        proyecto_id: proyId,
        proyecto: proyTitle,
      };

      await actualizarSesion(
        supabase,
        telefono,
        'SOLICITANDO_VIATICO_MONTO',
        { nuevo_viatico: draft },
        empleadoId
      );

      await enviarBotonesWhatsApp(
        telefono,
        `✅ Proyecto seleccionado: *${proyTitle}*\n\nIndica el *monto estimado* que requieres de anticipo (Ej: 150.00):`,
        [{ id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' }]
      );
      return { status: 'solicitud_monto_solicitado' };
    }

    // ─── 3. SELECCIÓN DE MONEDA PARA SOLICITUD DE VIÁTICO ───
    if (
      interactiveReplyId === 'SOL_MONEDA_LOCAL' ||
      interactiveReplyId === 'SOL_MONEDA_USD' ||
      interactiveReplyId === 'BTN_MONEDA_LOCAL' ||
      interactiveReplyId === 'BTN_MONEDA_USD'
    ) {
      const monedaSeleccionada = (interactiveReplyId === 'SOL_MONEDA_LOCAL' || interactiveReplyId === 'BTN_MONEDA_LOCAL')
        ? monedaEmpresa
        : 'USD';

      const draft: NuevoViaticoDraft = sesion.datos_temporales?.nuevo_viatico || {};
      draft.moneda = monedaSeleccionada;

      await actualizarSesion(
        supabase,
        telefono,
        'SOLICITANDO_VIATICO_FECHA',
        { nuevo_viatico: draft },
        empleadoId
      );

      const fechasRapidas: WhatsAppRow[] = [
        { id: 'SOL_FECHA_HOY', title: 'Para HOY' },
        { id: 'SOL_FECHA_MANANA', title: 'Para MAÑANA' },
        { id: 'SOL_FECHA_3DIAS', title: 'En 3 días' },
        { id: 'SOL_FECHA_1SEMANA', title: 'En 1 semana' },
        { id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' },
      ];

      await enviarListaWhatsApp(
        telefono,
        `✅ Moneda: *${monedaSeleccionada}*\n\n¿Para qué fecha requieres los fondos? Selecciona o escribe la fecha (AAAA-MM-DD):`,
        'Ver Fechas',
        '📅 Fecha Requerida',
        fechasRapidas,
        'Rendy • Control de Gastos',
        'Fechas Sugeridas'
      );
      return { status: 'solicitud_fecha_enviada' };
    }

    // ─── 4. SELECCIÓN DE FECHA RÁPIDA PARA SOLICITUD ───
    if (interactiveReplyId.startsWith('SOL_FECHA_')) {
      const hoy = new Date();
      const fechaCalc = new Date();
      if (interactiveReplyId === 'SOL_FECHA_MANANA') fechaCalc.setDate(hoy.getDate() + 1);
      else if (interactiveReplyId === 'SOL_FECHA_3DIAS') fechaCalc.setDate(hoy.getDate() + 3);
      else if (interactiveReplyId === 'SOL_FECHA_1SEMANA') fechaCalc.setDate(hoy.getDate() + 7);
      const fechaSeleccionada = fechaCalc.toISOString().split('T')[0];

      const draft: NuevoViaticoDraft = sesion.datos_temporales?.nuevo_viatico || {};
      draft.fecha_requerida = fechaSeleccionada;

      await actualizarSesion(
        supabase,
        telefono,
        'SOLICITANDO_VIATICO_USO',
        { nuevo_viatico: draft },
        empleadoId
      );

      const categoriasUso: WhatsAppRow[] = [
        { id: 'SOL_CAT_Alimentacion', title: 'Alimentación / Comida' },
        { id: 'SOL_CAT_Transporte', title: 'Transporte / Gasolina' },
        { id: 'SOL_CAT_Hospedaje', title: 'Hospedaje / Hotel' },
        { id: 'SOL_CAT_Materiales', title: 'Materiales / Equipos' },
        { id: 'SOL_CAT_Varios', title: 'Gastos Varios' },
        { id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' },
      ];

      await enviarListaWhatsApp(
        telefono,
        `✅ Fecha requerida: *${fechaSeleccionada}*\n\nSelecciona el uso principal estimado para este viático:`,
        'Ver Opciones',
        '🏷️ Uso Estimado',
        categoriasUso,
        'Rendy • Control de Gastos',
        'Categorías'
      );
      return { status: 'solicitud_uso_enviada' };
    }

    // ─── 5. SELECCIÓN DE USO ESTIMADO PARA SOLICITUD ───
    if (interactiveReplyId.startsWith('SOL_CAT_')) {
      const usoEstimado = interactiveReplyTitle || interactiveReplyId.replace('SOL_CAT_', '');
      const draft: NuevoViaticoDraft = sesion.datos_temporales?.nuevo_viatico || {};
      draft.uso_estimado = usoEstimado;

      await actualizarSesion(
        supabase,
        telefono,
        'SOLICITANDO_VIATICO_CONFIRMACION',
        { nuevo_viatico: draft },
        empleadoId
      );

      const mensajeResumen =
        `📌 *Resumen de Solicitud de Viáticos:*\n\n` +
        `📁 *Proyecto:* ${draft.proyecto || 'General'}\n` +
        `💵 *Monto Solicitado:* ${draft.monto_estimado} ${draft.moneda || 'USD'}\n` +
        `📅 *Fecha Requerida:* ${draft.fecha_requerida}\n` +
        `🏷️ *Uso Principal:* ${draft.uso_estimado}\n\n` +
        `_¿Deseas enviar esta solicitud para aprobación?_\n` +
        `Presiona *Confirmar* para enviar o *Volver al Menú* para cancelar.`;

      await enviarBotonesWhatsApp(
        telefono,
        mensajeResumen,
        [
          { id: 'CONFIRMAR_SOLICITUD_VIATICO', title: '✅ Confirmar' },
          { id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' },
        ]
      );
      return { status: 'solicitud_resumen_enviado' };
    }

    // ─── 6. CONFIRMAR Y GUARDAR SOLICITUD DE VIÁTICO EN BD ───
    if (
      interactiveReplyId === 'CONFIRMAR_SOLICITUD_VIATICO' ||
      interactiveReplyId === 'BTN_CONFIRMAR_SOL'
    ) {
      return await confirmarYPersistirSolicitudViatico({
        supabase,
        telefono,
        empleadoId,
        empresaId,
        draft: sesion.datos_temporales?.nuevo_viatico,
      });
    }

    // ─── 7. OPCIÓN RENDIR VIÁTICOS (Ruta Guiada) ───
    if (
      interactiveReplyId === 'OPCION_RENDIR_VIATICOS' ||
      interactiveReplyId === 'BTN_JUSTIFICAR_VIATICOS'
    ) {
      const activos = await obtenerViaticosActivosEmpleado(supabase, empleadoId, {
        soloPendientesJustificar: true,
      });

      if (activos.length === 0) {
        await enviarBotonesWhatsApp(
          telefono,
          '⚠️ *No posees bolsas de viáticos pendientes por justificar.*\nTodas tus solicitudes aprobadas ya se encuentran al 100% justificadas.\n\nSi realizaste un gasto con tu dinero personal, selecciona *Pedir Reembolso*.',
          [
            { id: 'OPCION_PEDIR_REEMBOLSO', title: '💸 Pedir Reembolso' },
            { id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' },
          ]
        );
        return { status: 'sin_viaticos_activos' };
      }

      if (activos.length === 1) {
        const unico = activos[0];
        await actualizarSesion(
          supabase,
          telefono,
          'ESPERANDO_FOTO_VIATICO',
          {
            viatico_id: unico.id,
            es_reembolso: false,
          },
          empleadoId,
          usuario.nombre
        );
        await enviarBotonesWhatsApp(
          telefono,
          `💼 Rindiendo para: *${unico.nombre_proyecto}* (Saldo disponible: $${unico.saldo_disponible_usd.toFixed(2)} USD de $${unico.monto_asignado_usd.toFixed(2)} USD).\n\n📸 Por favor, adjunta la imagen o PDF del comprobante/factura:`,
          [{ id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' }]
        );
        return { status: 'esperando_foto_viatico_unico' };
      }

      // 2+ Viáticos pendientes: Selector interactivo
      await actualizarSesion(supabase, telefono, 'SELECCIONANDO_VIATICO_PREVIO', {}, empleadoId, usuario.nombre);
      const filasViaticos: WhatsAppRow[] = activos.slice(0, 9).map((v) => ({
        id: `SEL_VIAT_${v.id}`,
        title: v.nombre_proyecto.substring(0, 24),
        description: `Disponible: $${v.saldo_disponible_usd.toFixed(2)} USD`,
      }));

      await enviarListaWhatsApp(
        telefono,
        '💼 *Rendir Viáticos*\n\nSelecciona el proyecto al que corresponde tu gasto (mostrando sólo viáticos con saldo pendiente):',
        'Ver Viáticos',
        '📁 Seleccionar Proyecto',
        [...filasViaticos, { id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' }],
        'Rendy • Control de Gastos',
        'Viáticos por Rendir'
      );
      return { status: 'lista_proyectos_enviada' };
    }

    // ─── 8. OPCIÓN PEDIR REEMBOLSO (Ruta Guiada) ───
    if (
      interactiveReplyId === 'OPCION_PEDIR_REEMBOLSO' ||
      interactiveReplyId === 'BTN_SOLICITAR_REEMBOLSO'
    ) {
      await actualizarSesion(
        supabase,
        telefono,
        'ESPERANDO_FOTO_REEMBOLSO',
        {
          es_reembolso: true,
          viatico_id: null,
        },
        empleadoId
      );
      await enviarBotonesWhatsApp(
        telefono,
        '💸 *Solicitud de Reembolso*\n\nPor favor envía la foto o PDF de la factura que pagaste con tus *fondos personales*:',
        [{ id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' }]
      );
      return { status: 'esperando_foto_reembolso' };
    }

    // ─── 9. OPCIÓN CONSULTAR SALDOS (Centro de Consultas) ───
    if (interactiveReplyId === 'OPCION_CONSULTAR_ESTADO') {
      const resumen = await obtenerResumenSaldosEmpleado(supabase, empleadoId);
      const textoResumen = formatearResumenSaldosWhatsApp(resumen, usuario.nombre);

      await resetearSesion(supabase, telefono, empleadoId);
      await enviarMensajeWhatsApp(telefono, textoResumen);
      await enviarPreguntaContinuarSesion(telefono);
      return { status: 'consulta_saldos_enviada' };
    }

    // ─── 10. SELECCIÓN DE PROYECTO PARA RENDIR VIÁTICO (SELECCIONANDO_VIATICO_PREVIO) ───
    if (sesion.estado === 'SELECCIONANDO_VIATICO_PREVIO' && interactiveReplyId.startsWith('SEL_VIAT_')) {
      const viaticoId = interactiveReplyId.replace('SEL_VIAT_', '');
      const tituloProy = interactiveReplyTitle || 'Proyecto';

      await actualizarSesion(
        supabase,
        telefono,
        'ESPERANDO_FOTO_VIATICO',
        {
          viatico_id: viaticoId,
          es_reembolso: false,
        },
        empleadoId
      );

      await enviarBotonesWhatsApp(
        telefono,
        `💼 Has seleccionado: *${tituloProy}*.\n\n📸 Por favor adjunta la imagen o PDF del comprobante:`,
        [{ id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' }]
      );
      return { status: 'viatico_seleccionado_esperando_foto' };
    }

    // ─── 11. RESOLUCIÓN DE DESTINO DE FOTO (Viene de Ruta Rápida) ───
    if (sesion.estado === 'RESOLVIENDO_DESTINO_FOTO' && sesion.datos_temporales?.extraccion_ocr) {
      const extraccion = sesion.datos_temporales.extraccion_ocr;

      if (interactiveReplyId === 'DESTINO_REEMBOLSO') {
        sesion.datos_temporales.es_reembolso = true;
        sesion.datos_temporales.viatico_id = null;
        sesion.datos_temporales.evaluacion_saldo = undefined;
        sesion.datos_temporales.excess_detail = null;

        await actualizarSesion(
          supabase,
          telefono,
          'ESPERANDO_CATEGORIA',
          sesion.datos_temporales,
          empleadoId
        );

        await enviarSelectorCategoriasWhatsApp(supabase, telefono, empresaId);
        return { status: 'resolucion_reembolso_esperando_categoria' };
      }

      if (interactiveReplyId.startsWith('DESTINO_VIATICO_')) {
        const viaticoId = interactiveReplyId.replace('DESTINO_VIATICO_', '');
        const evaluacion = await calcularSaldoViatico(supabase, viaticoId, extraccion.monto_usd);

        const nombreProyFinal =
          evaluacion.nombre_proyecto ||
          (interactiveReplyTitle && !interactiveReplyTitle.includes('Rendir Viático')
            ? interactiveReplyTitle
            : 'Proyecto');

        sesion.datos_temporales.es_reembolso = false;
        sesion.datos_temporales.viatico_id = viaticoId;
        sesion.datos_temporales.evaluacion_saldo = {
          ...evaluacion,
          nombre_proyecto: nombreProyFinal,
        };
        sesion.datos_temporales.excess_detail = null;

        await actualizarSesion(
          supabase,
          telefono,
          'ESPERANDO_CATEGORIA',
          sesion.datos_temporales,
          empleadoId
        );

        await enviarSelectorCategoriasWhatsApp(supabase, telefono, empresaId);
        return { status: 'resolucion_viatico_esperando_categoria' };
      }
    }

    // ─── 11b. SELECCIÓN DE CATEGORÍA DINÁMICA ───
    if (sesion.estado === 'ESPERANDO_CATEGORIA' && sesion.datos_temporales?.extraccion_ocr) {
      const extraccion = sesion.datos_temporales.extraccion_ocr;

      // Category selected: `CAT_SEL_${codigo}`
      if (interactiveReplyId.startsWith('CAT_SEL_')) {
        const codigoCategoria = interactiveReplyId.replace('CAT_SEL_', '');
        const nombreCategoria = interactiveReplyTitle
          ? interactiveReplyTitle.replace(/^[^\w]+\s*/, '').trim()
          : codigoCategoria;

        extraccion.categoria = nombreCategoria || codigoCategoria;

        // Evaluate daily spending limit for the selected category
        const evalLimite = await evaluarLimiteDiarioCategoria({
          supabase,
          empresaId,
          employeeId: empleadoId,
          codigoCategoria,
          nombreCategoria,
          montoUsd: extraccion.monto_usd,
          fechaGasto: extraccion.fecha_emision,
        });

        // Store daily limit results in session
        sesion.datos_temporales.excede_limite =
          sesion.datos_temporales.excede_limite || evalLimite.excede_limite;
        sesion.datos_temporales.alerta_limite_diario = evalLimite.alerta_whatsapp;

        if (evalLimite.excede_limite && evalLimite.excess_detail) {
          sesion.datos_temporales.excess_detail =
            sesion.datos_temporales.excess_detail || evalLimite.excess_detail;
        }

        sesion.datos_temporales.extraccion_ocr = extraccion;

        await actualizarSesion(
          supabase,
          telefono,
          'ESPERANDO_CONFIRMACION',
          sesion.datos_temporales,
          empleadoId
        );

        const confirmType = sesion.datos_temporales.es_reembolso
          ? 'REEMBOLSO_DIRECTO'
          : 'VIATICO_ASIGNADO';

        await enviarConfirmacionGastoInteractiva(telefono, extraccion, {
          tipo: confirmType,
          nombreProyecto: sesion.datos_temporales.evaluacion_saldo?.nombre_proyecto,
          evaluacion: sesion.datos_temporales.evaluacion_saldo as EvaluacionSobregiro | undefined,
          dailyLimitAlert: evalLimite.alerta_whatsapp,
        });

        return { status: 'categoria_seleccionada' };
      }

      // Pagination: `CAT_PAGE_${page}`
      if (interactiveReplyId.startsWith('CAT_PAGE_')) {
        const page = parseInt(interactiveReplyId.replace('CAT_PAGE_', ''), 10) || 1;
        sesion.datos_temporales.categoria_page = page;
        await actualizarSesion(supabase, telefono, 'ESPERANDO_CATEGORIA', sesion.datos_temporales, empleadoId);
        await enviarSelectorCategoriasWhatsApp(supabase, telefono, empresaId, page);
        return { status: 'categoria_paginacion' };
      }
    }

    // ─── 12. CONFIRMACIÓN FINAL DE REGISTRO DE COMPROBANTE ───
    if (sesion.estado === 'ESPERANDO_CONFIRMACION') {
      if (
        interactiveReplyId === 'CONFIRMAR_GUARDAR_GASTO' ||
        interactiveReplyId === 'BTN_CONFIRMAR_GASTO'
      ) {
        return await persistirGastoDefinitivo(supabase, telefono, empleadoId, empresaId, sesion.datos_temporales);
      }
    }
  }

  if (sesion.estado !== 'INICIO') {
    scheduleInactivityTimers({
      supabase,
      telefono,
      empleadoId,
      employeeName: usuario.nombre,
    });

    let mensajeAyuda = 'Estoy esperando tu respuesta para completar la gestión actual.';
    if (sesion.estado === 'ESPERANDO_FOTO_VIATICO' || sesion.estado === 'ESPERANDO_FOTO_REEMBOLSO') {
      mensajeAyuda = '📸 Por favor envía la *foto o documento PDF* de tu comprobante.';
    } else if (sesion.estado === 'SOLICITANDO_VIATICO_PROYECTO' || sesion.estado === 'SELECCIONANDO_VIATICO_PREVIO') {
      mensajeAyuda = '📁 Por favor selecciona un *proyecto* de la lista o escribe parte de su nombre.';
    } else if (sesion.estado === 'SOLICITANDO_VIATICO_MONTO') {
      mensajeAyuda = '💰 Por favor escribe el *monto numérico* que requieres solicitar (Ej: 150.00).';
    } else if (sesion.estado === 'SOLICITANDO_VIATICO_MONEDA') {
      mensajeAyuda = '💵 Por favor selecciona la *moneda* para tu solicitud de viáticos.';
    } else if (sesion.estado === 'SOLICITANDO_VIATICO_FECHA') {
      mensajeAyuda = '📅 Por favor indica la *fecha* requerida para los fondos (ej: AAAA-MM-DD o "mañana").';
    } else if (sesion.estado === 'SOLICITANDO_VIATICO_USO') {
      mensajeAyuda = '🏷️ Por favor selecciona o describe el *uso principal* estimado del viático.';
    } else if (sesion.estado === 'SOLICITANDO_VIATICO_CONFIRMACION') {
      mensajeAyuda = '📌 Por favor presiona *Confirmar* para enviar tu solicitud o *Volver al Menú* para cancelar.';
    } else if (sesion.estado === 'RESOLVIENDO_DESTINO_FOTO') {
      mensajeAyuda = '📁 Por favor selecciona a cuál de tus viáticos o reembolso asignar la factura recibida.';
    } else if (sesion.estado === 'ESPERANDO_CATEGORIA') {
      mensajeAyuda = '🏷️ Por favor selecciona la *categoría* de gasto de la lista interactiva.';
    } else if (sesion.estado === 'ESPERANDO_CONFIRMACION') {
      mensajeAyuda = '📄 Por favor presiona *Confirmar* para guardar el comprobante o *Volver al Menú* para cancelarlo.';
    }

    await enviarBotonesWhatsApp(
      telefono,
      `ℹ️ ${mensajeAyuda}\n\nSi prefieres salir de esta operación, puedes volver al menú principal:`,
      [{ id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' }]
    );
    return { status: 'ayuda_estado_enviada' };
  }

  return { status: 'mensaje_no_procesado' };
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBROUTINES: SOLICITUD DE VIÁTICOS Y COMPROBANTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @name iniciarFlujoPedirViaticos
 * @description [Business Logic]: Initiates the "Pedir Viáticos" workflow by querying active company projects
 * and presenting them in an interactive list message.
 */
async function iniciarFlujoPedirViaticos({
  supabase,
  telefono,
  empleadoId,
  empresaId,
}: {
  supabase: SupabaseClient;
  telefono: string;
  empleadoId: string;
  empresaId: string;
}): Promise<{ status: string }> {
  const { data: proyectos, error: errProy } = await supabase
    .from('proyectos')
    .select('id, nombre')
    .eq('empresa_id', empresaId)
    .eq('activo', true)
    .order('nombre');

  if (errProy || !proyectos || proyectos.length === 0) {
    await enviarBotonesWhatsApp(
      telefono,
      '⚠️ *No hay proyectos activos configurados en tu empresa.*\nContacta a tu administrador para registrar proyectos.',
      [{ id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' }]
    );
    return { status: 'sin_proyectos_activos' };
  }

  await actualizarSesion(supabase, telefono, 'SOLICITANDO_VIATICO_PROYECTO', {}, empleadoId);

  const filasProyectos: WhatsAppRow[] = proyectos.slice(0, 9).map((p) => ({
    id: `SOL_PROY_${p.id}`,
    title: p.nombre.substring(0, 24),
  }));

  await enviarListaWhatsApp(
    telefono,
    '📝 *Solicitud de Viáticos*\n\nSelecciona el proyecto al cual estarán destinados los fondos:',
    'Ver Proyectos',
    '📁 Asignar Proyecto',
    [...filasProyectos, { id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' }],
    'Rendy • Control de Gastos',
    'Proyectos Activos'
  );
  return { status: 'solicitud_proyecto_enviada' };
}

/**
 * @name confirmarYPersistirSolicitudViatico
 * @description [Persistence]: Stores a new viático request in `solicitudes_viaticos` (for Web Dashboard display
 * and administrator approval) and mirrors it in `viaticos` (for real-time balance calculations).
 */
async function confirmarYPersistirSolicitudViatico({
  supabase,
  telefono,
  empleadoId,
  empresaId,
  draft,
}: {
  supabase: SupabaseClient;
  telefono: string;
  empleadoId: string;
  empresaId: string;
  draft?: NuevoViaticoDraft;
}): Promise<{ status: string }> {
  if (!draft || !draft.monto_estimado) {
    await enviarMensajeWhatsApp(telefono, '⚠️ No se encontraron datos para procesar la solicitud.');
    await resetearSesion(supabase, telefono, empleadoId);
    return { status: 'sin_datos_solicitud' };
  }

  const fechaHoy = new Date().toISOString().split('T')[0];
  const fechaReq = draft.fecha_requerida || fechaHoy;
  const moneda = draft.moneda || 'USD';

  // 1. Primary write to `solicitudes_viaticos` for the web dashboard platform
  const { data: nuevaSol, error: errSol } = await supabase
    .from('solicitudes_viaticos')
    .insert({
      usuario_id: empleadoId,
      empresa_id: empresaId,
      proyecto_id: draft.proyecto_id || null,
      monto_solicitado: draft.monto_estimado,
      moneda,
      monto_asignado: 0,
      monto_aprobado: 0,
      monto_gastado: 0,
      fecha_inicio: fechaHoy,
      fecha_fin: fechaReq,
      fecha_requerida: fechaReq,
      titulo_viaje: `Solicitud Viáticos - ${draft.proyecto || 'General'}`,
      estado: 'PENDIENTE',
    })
    .select('id')
    .single();

  if (errSol) {
    console.error('❌ Error saving solicitudes_viaticos:', errSol);
    await enviarBotonesWhatsApp(
      telefono,
      '❌ Ocurrió un error al registrar la solicitud en el sistema.',
      [{ id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' }]
    );
    await resetearSesion(supabase, telefono, empleadoId);
    return { status: 'error_supabase_solicitud' };
  }

  // 2. Correlation write to `viaticos` table
  await supabase.from('viaticos').upsert({
    id: nuevaSol?.id,
    empleado_id: empleadoId,
    empresa_id: empresaId,
    proyecto_id: draft.proyecto_id || null,
    nombre_proyecto: draft.proyecto || 'General',
    monto_asignado_usd: draft.monto_estimado,
    estado: 'PENDIENTE_APROBACION',
    fecha_inicio: fechaHoy,
  });

  await resetearSesion(supabase, telefono, empleadoId);

  await enviarMensajeWhatsApp(
    telefono,
    `🎉 *¡Solicitud de Viáticos Enviada!*\n\n` +
    `📁 *Proyecto:* ${draft.proyecto}\n` +
    `💵 *Monto:* ${draft.monto_estimado} ${moneda}\n` +
    `📅 *Requerido:* ${fechaReq}\n\n` +
    `Tu solicitud ya aparece en la plataforma web de Rendy. Tu administrador la revisará a la brevedad.`
  );

  await enviarPreguntaContinuarSesion(telefono);

  return { status: 'solicitud_viatico_completada' };
}

/**
 * @name manejarIngestaComprobanteEnFrio
 * @description [Quick Route / Ruta Rápida]: Ingests an invoice cold with zero previous conversation.
 */
async function manejarIngestaComprobanteEnFrio({
  supabase,
  telefono,
  empleadoId,
  empresaId,
  mediaId,
  esPdf,
}: {
  supabase: SupabaseClient;
  telefono: string;
  empleadoId: string;
  empresaId: string;
  mediaId: string;
  esPdf: boolean;
}): Promise<{ status: string }> {
  await enviarMensajeWhatsApp(telefono, '⏳ Estoy procesando tu factura, dame un momento por favor...');

  const [resultadoOcr, urlComprobante] = await Promise.all([
    esPdf ? procesarFacturaPDFConIA(mediaId) : procesarFacturaConIA(mediaId),
    esPdf ? guardarPDFEnSupabase(mediaId) : guardarImagenEnSupabase(mediaId),
  ]);

  if (!resultadoOcr || typeof resultadoOcr !== 'object') {
    await enviarBotonesWhatsApp(
      telefono,
      '⚠️ No se pudo extraer la información del comprobante. Por favor, asegúrate de que la imagen sea clara y legible:',
      [{ id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' }]
    );
    await resetearSesion(supabase, telefono, empleadoId);
    return { status: 'error_ocr' };
  }

  const raw = resultadoOcr as unknown as GeminiFiscalExtraction & Record<string, unknown>;

  const fiscalResult = await normalizarGastoFiscal({
    nombre_comercio: raw.nombre_comercio || 'No detectado',
    rif_comercio: raw.rif_comercio || '',
    numero_factura: raw.numero_factura || '',
    fecha_emision: raw.fecha_emision || new Date().toISOString().split('T')[0],
    moneda: normalizeMoneda(raw.moneda),
    tasa_impresa: raw.tasa_impresa ?? null,
    base_imponible: Number(raw.base_imponible || 0),
    iva: Number(raw.iva || 0),
    exento: Number(raw.exento || 0),
    igtf: Number(raw.igtf || 0),
    total: Number(raw.total || 0),
    pais_detectado: raw.pais_detectado,
    estado_region: raw.estado_region,
    ciudad: raw.ciudad,
    codigo_postal: raw.codigo_postal,
    subtotal_usd: Number(raw.subtotal_usd || 0),
    sales_tax_usd: Number(raw.sales_tax_usd || 0),
    propina_usd: Number(raw.propina_usd || 0),
  });

  const { data: empTaxData } = await supabase
    .from('empresas')
    .select('us_tax_exempt')
    .eq('id', empresaId)
    .maybeSingle();

  const auditoriaUSA = auditarGastoUSA({
    esEmpresaTaxExempt: Boolean(empTaxData?.us_tax_exempt),
    estadoUs: fiscalResult.estado_region,
    salesTaxUsd: fiscalResult.sales_tax_usd,
    paisGasto: fiscalResult.pais_gasto,
  });

  let hashArchivo: string | null = null;
  if (urlComprobante) {
    try {
      const resFile = await fetch(urlComprobante);
      const arrayBuf = await resFile.arrayBuffer();
      hashArchivo = calcularHashBuffer(Buffer.from(arrayBuf));
    } catch (e) {
      console.error('❌ Error calculating buffer hash:', e);
    }
  }

  const fiscalDupResult = await verifyInvoiceDuplicate(supabase, {
    employeeId: empleadoId,
    senderPhone: telefono,
    taxId: raw.rif_comercio,
    invoiceNumber: raw.numero_factura,
    totalAmount: raw.total,
    merchantName: raw.nombre_comercio,
    currency: raw.moneda,
  });

  if (fiscalDupResult.isDuplicate) {
    await resetearSesion(supabase, telefono, empleadoId);
    await enviarBotonesWhatsApp(
      telefono,
      fiscalDupResult.blockMessage || '🚫 *Comprobante Duplicado Detectado.* Esta factura ya fue registrada previamente.',
      [{ id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' }]
    );
    return { status: 'duplicado_fiscal_bloqueado' };
  }

  const legacyDupResult = await verificarGastoDuplicado(
    empresaId,
    raw.nombre_comercio,
    raw.total,
    raw.fecha_emision,
    hashArchivo
  );

  if (legacyDupResult.esHashDuplicado) {
    await resetearSesion(supabase, telefono, empleadoId);
    await enviarBotonesWhatsApp(
      telefono,
      legacyDupResult.mensajeBloqueo || '🚫 Este comprobante ya fue registrado previamente en la empresa.',
      [{ id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' }]
    );
    return { status: 'duplicado_archivo_bloqueado' };
  }

  const categoriaNormalizada = normalizeCategory(raw.categoria_gasto || 'MISCELLANEOUS');

  const extraccionNormalizada: ExtraccionOcrSesion = {
    nombre_comercio: raw.nombre_comercio || 'No detectado',
    rif_comercio: raw.rif_comercio || '',
    numero_factura: raw.numero_factura || '',
    fecha_emision: raw.fecha_emision || new Date().toISOString().split('T')[0],
    moneda: fiscalResult.moneda_original,
    monto_original: Number(raw.total || 0),
    tasa_impresa: raw.tasa_impresa ?? null,
    tasa_cambio: fiscalResult.tasa_cambio,
    base_imponible_ves: fiscalResult.base_imponible_ves,
    iva_ves: fiscalResult.iva_ves,
    exento_ves: fiscalResult.exento_ves,
    igtf_ves: fiscalResult.igtf_ves,
    monto_ves: fiscalResult.monto_ves,
    monto_usd: fiscalResult.monto_usd,
    hash_duplicado: fiscalDupResult.duplicateHash || '',
    categoria: categoriaNormalizada,
    url_comprobante: urlComprobante,
    hash_comprobante: hashArchivo,
    requiere_revision_fiscal: fiscalResult.requiere_revision_fiscal,
    pais_gasto: fiscalResult.pais_gasto,
    estado_region: fiscalResult.estado_region,
    ciudad: fiscalResult.ciudad,
    codigo_postal: fiscalResult.codigo_postal,
    estado_tax_usa: auditoriaUSA.estado_tax_usa,
    subtotal_usd: fiscalResult.subtotal_usd,
    sales_tax_usd: fiscalResult.sales_tax_usd,
    propina_usd: fiscalResult.propina_usd,
    tiene_sales_tax: fiscalResult.tiene_sales_tax,
    alerta_tax_usa: null,
  };

  const viaticosActivos = await obtenerViaticosActivosEmpleado(supabase, empleadoId, {
    soloPendientesJustificar: true,
  });
  const numActivos = viaticosActivos.length;

  // CASO 1: 0 Viáticos Activos -> Reembolso Personal Directo -> Seleccionar Categoría
  if (numActivos === 0) {
    const datosSesion: DatosTemporalesSesion = {
      es_reembolso: true,
      viatico_id: null,
      extraccion_ocr: extraccionNormalizada,
      excess_detail: null,
      flujo_origen: 'RUTA_RAPIDA',
      media_id: mediaId,
      es_pdf: esPdf,
    };

    await actualizarSesion(supabase, telefono, 'ESPERANDO_CATEGORIA', datosSesion, empleadoId);
    await enviarSelectorCategoriasWhatsApp(supabase, telefono, empresaId);
    return { status: 'caso_cero_viaticos_esperando_categoria' };
  }

  // CASO 2: Exactamente 1 Viático Activo -> Preguntar: ¿Rendir Viático o Pedir Reembolso?
  if (numActivos === 1) {
    const viaticoUnico = viaticosActivos[0];

    const datosSesion: DatosTemporalesSesion = {
      extraccion_ocr: extraccionNormalizada,
      flujo_origen: 'RUTA_RAPIDA',
      media_id: mediaId,
      es_pdf: esPdf,
    };

    await actualizarSesion(supabase, telefono, 'RESOLVIENDO_DESTINO_FOTO', datosSesion, empleadoId);

    let textoMonto = `*$${fiscalResult.monto_usd.toFixed(2)} USD*`;
    if (fiscalResult.moneda_original === 'VES') {
      textoMonto = `*${fiscalResult.monto_ves.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs* (equiv. $${fiscalResult.monto_usd.toFixed(2)} USD)`;
    } else if (fiscalResult.moneda_original && fiscalResult.moneda_original !== 'USD') {
      const nominal = (raw.total || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 });
      textoMonto = `*${nominal} ${fiscalResult.moneda_original}* (equiv. $${fiscalResult.monto_usd.toFixed(2)} USD)`;
    }

    const cuerpoMensaje =
      `📄 *Comprobante Detectado*\n\n` +
      `🏢 *Comercio:* ${extraccionNormalizada.nombre_comercio || 'No detectado'}\n` +
      `💵 *Total:* ${textoMonto}\n\n` +
      `Tienes 1 viático activo:\n` +
      `📁 *Proyecto:* ${viaticoUnico.nombre_proyecto}\n` +
      `💰 *Disponible:* $${viaticoUnico.saldo_disponible_usd.toFixed(2)} USD (de $${viaticoUnico.monto_asignado_usd.toFixed(2)})\n\n` +
      `¿Deseas imputar este comprobante a tu viático o registrarlo como reembolso personal?`;

    await enviarBotonesWhatsApp(
      telefono,
      cuerpoMensaje,
      [
        { id: `DESTINO_VIATICO_${viaticoUnico.id}`, title: '📁 Rendir Viático' },
        { id: 'DESTINO_REEMBOLSO', title: '💸 Pedir Reembolso' },
        { id: 'VOLVER_MENU', title: '⬅️ Cancelar' },
      ],
      '📁 Destino del Comprobante',
      'Rendy • Control de Gastos'
    );
    return { status: 'caso_un_viatico_selector' };
  }

  // CASO 3: 2 o Más Viáticos Activos -> Selector Interactivo
  const datosSesion: DatosTemporalesSesion = {
    extraccion_ocr: extraccionNormalizada,
    flujo_origen: 'RUTA_RAPIDA',
    media_id: mediaId,
    es_pdf: esPdf,
  };

  await actualizarSesion(supabase, telefono, 'RESOLVIENDO_DESTINO_FOTO', datosSesion, empleadoId);
  await enviarSelectorDestinoGasto(
    telefono,
    viaticosActivos,
    fiscalResult.monto_usd,
    fiscalResult.monto_ves,
    fiscalResult.moneda_original,
    Number(raw.total || 0)
  );
  return { status: 'caso_multi_viatico_selector' };
}

/**
 * @name manejarComprobanteEnRutaGuiada
 * @description Processes a receipt uploaded while the user was already in a guided subflow.
 */
async function manejarComprobanteEnRutaGuiada({
  supabase,
  telefono,
  empleadoId,
  empresaId,
  mediaId,
  esPdf,
  sesion,
}: {
  supabase: SupabaseClient;
  telefono: string;
  empleadoId: string;
  empresaId: string;
  mediaId: string;
  esPdf: boolean;
  sesion: SesionWhatsAppRecord;
}): Promise<{ status: string }> {
  await enviarMensajeWhatsApp(telefono, '⏳ Estoy procesando tu comprobante, dame un momento por favor...');

  const [resultadoOcr, urlComprobante] = await Promise.all([
    esPdf ? procesarFacturaPDFConIA(mediaId) : procesarFacturaConIA(mediaId),
    esPdf ? guardarPDFEnSupabase(mediaId) : guardarImagenEnSupabase(mediaId),
  ]);

  if (!resultadoOcr || typeof resultadoOcr !== 'object') {
    await enviarBotonesWhatsApp(
      telefono,
      '⚠️ No se pudo extraer la información del comprobante. Por favor, asegúrate de que la foto o PDF sea legible y esté bien iluminada:',
      [{ id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' }]
    );
    return { status: 'error_ocr_guiado' };
  }

  const raw = resultadoOcr as unknown as GeminiFiscalExtraction & Record<string, unknown>;

  const fiscalResult = await normalizarGastoFiscal({
    nombre_comercio: raw.nombre_comercio || 'No detectado',
    rif_comercio: raw.rif_comercio || '',
    numero_factura: raw.numero_factura || '',
    fecha_emision: raw.fecha_emision || new Date().toISOString().split('T')[0],
    moneda: normalizeMoneda(raw.moneda),
    tasa_impresa: raw.tasa_impresa ?? null,
    base_imponible: Number(raw.base_imponible || 0),
    iva: Number(raw.iva || 0),
    exento: Number(raw.exento || 0),
    igtf: Number(raw.igtf || 0),
    total: Number(raw.total || 0),
    pais_detectado: raw.pais_detectado,
    estado_region: raw.estado_region,
    ciudad: raw.ciudad,
    codigo_postal: raw.codigo_postal,
    subtotal_usd: Number(raw.subtotal_usd || 0),
    sales_tax_usd: Number(raw.sales_tax_usd || 0),
    propina_usd: Number(raw.propina_usd || 0),
  });

  const { data: empTaxData } = await supabase
    .from('empresas')
    .select('us_tax_exempt')
    .eq('id', empresaId)
    .maybeSingle();

  const auditoriaUSA = auditarGastoUSA({
    esEmpresaTaxExempt: Boolean(empTaxData?.us_tax_exempt),
    estadoUs: fiscalResult.estado_region,
    salesTaxUsd: fiscalResult.sales_tax_usd,
    paisGasto: fiscalResult.pais_gasto,
  });

  const fiscalDupResult = await verifyInvoiceDuplicate(supabase, {
    employeeId: empleadoId,
    senderPhone: telefono,
    taxId: raw.rif_comercio,
    invoiceNumber: raw.numero_factura,
    totalAmount: raw.total,
    merchantName: raw.nombre_comercio,
    currency: raw.moneda,
  });

  if (fiscalDupResult.isDuplicate) {
    await resetearSesion(supabase, telefono, empleadoId);
    await enviarBotonesWhatsApp(
      telefono,
      fiscalDupResult.blockMessage || '🚫 *Comprobante Duplicado Detectado.*',
      [{ id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' }]
    );
    return { status: 'duplicado_guiado_bloqueado' };
  }

  const categoriaNormalizada = normalizeCategory(raw.categoria_gasto || 'MISCELLANEOUS');

  const extraccionNormalizada: ExtraccionOcrSesion = {
    nombre_comercio: raw.nombre_comercio || 'No detectado',
    rif_comercio: raw.rif_comercio || '',
    numero_factura: raw.numero_factura || '',
    fecha_emision: raw.fecha_emision || new Date().toISOString().split('T')[0],
    moneda: fiscalResult.moneda_original,
    monto_original: Number(raw.total || 0),
    tasa_impresa: raw.tasa_impresa ?? null,
    tasa_cambio: fiscalResult.tasa_cambio,
    base_imponible_ves: fiscalResult.base_imponible_ves,
    iva_ves: fiscalResult.iva_ves,
    exento_ves: fiscalResult.exento_ves,
    igtf_ves: fiscalResult.igtf_ves,
    monto_ves: fiscalResult.monto_ves,
    monto_usd: fiscalResult.monto_usd,
    hash_duplicado: fiscalDupResult.duplicateHash || '',
    categoria: categoriaNormalizada,
    url_comprobante: urlComprobante,
    requiere_revision_fiscal: fiscalResult.requiere_revision_fiscal,
    pais_gasto: fiscalResult.pais_gasto,
    estado_region: fiscalResult.estado_region,
    ciudad: fiscalResult.ciudad,
    codigo_postal: fiscalResult.codigo_postal,
    estado_tax_usa: auditoriaUSA.estado_tax_usa,
    subtotal_usd: fiscalResult.subtotal_usd,
    sales_tax_usd: fiscalResult.sales_tax_usd,
    propina_usd: fiscalResult.propina_usd,
    tiene_sales_tax: fiscalResult.tiene_sales_tax,
    alerta_tax_usa: null,
  };

  if (sesion.estado === 'ESPERANDO_FOTO_VIATICO' && sesion.datos_temporales?.viatico_id) {
    const viaticoId = sesion.datos_temporales.viatico_id;
    const evaluacion = await calcularSaldoViatico(supabase, viaticoId, fiscalResult.monto_usd);

    const datosSesion: DatosTemporalesSesion = {
      es_reembolso: false,
      viatico_id: viaticoId,
      extraccion_ocr: extraccionNormalizada,
      evaluacion_saldo: evaluacion,
      excess_detail: null,
      flujo_origen: 'RUTA_GUIADA',
      media_id: mediaId,
      es_pdf: esPdf,
    };

    await actualizarSesion(supabase, telefono, 'ESPERANDO_CATEGORIA', datosSesion, empleadoId);
    await enviarSelectorCategoriasWhatsApp(supabase, telefono, empresaId);
    return { status: 'recibo_viatico_guiado_esperando_categoria' };
  } else {
    const datosSesion: DatosTemporalesSesion = {
      es_reembolso: true,
      viatico_id: null,
      extraccion_ocr: extraccionNormalizada,
      excess_detail: null,
      flujo_origen: 'RUTA_GUIADA',
      media_id: mediaId,
      es_pdf: esPdf,
    };

    await actualizarSesion(supabase, telefono, 'ESPERANDO_CATEGORIA', datosSesion, empleadoId);
    await enviarSelectorCategoriasWhatsApp(supabase, telefono, empresaId);
    return { status: 'recibo_reembolso_guiado_esperando_categoria' };
  }
}

/**
 * @name manejarCorreccionTextoComprobante
 * @description Handles conversational corrections by text while in `ESPERANDO_CONFIRMACION`.
 */
async function manejarCorreccionTextoComprobante({
  supabase,
  telefono,
  empleadoId,
  textoCorreccion,
  sesion,
}: {
  supabase: SupabaseClient;
  telefono: string;
  empleadoId: string;
  textoCorreccion: string;
  sesion: SesionWhatsAppRecord;
}): Promise<{ status: string }> {
  const ocrPrevio = sesion.datos_temporales?.extraccion_ocr;
  if (!ocrPrevio) return { status: 'sin_ocr_previo' };

  await enviarMensajeWhatsApp(telefono, '✍️ Actualizando datos con tu corrección...');

  const correccion = await aplicarCorreccionConIA(ocrPrevio, textoCorreccion);

  const fiscalResult = await normalizarGastoFiscal({
    nombre_comercio: correccion.comercio || correccion.nombre_comercio || ocrPrevio.nombre_comercio,
    rif_comercio: correccion.tax_id || correccion.rif_comercio || ocrPrevio.rif_comercio,
    numero_factura: correccion.invoice_number || correccion.numero_factura || ocrPrevio.numero_factura,
    fecha_emision: correccion.fecha || correccion.fecha_emision || ocrPrevio.fecha_emision,
    moneda: normalizeMoneda(correccion.moneda || ocrPrevio.moneda),
    tasa_impresa: correccion.tasa_impresa ?? ocrPrevio.tasa_impresa ?? null,
    base_imponible: Number(correccion.base_imponible ?? correccion.monto_total ?? ocrPrevio.base_imponible_ves),
    iva: Number(correccion.iva ?? ocrPrevio.iva_ves),
    exento: Number(correccion.exento ?? ocrPrevio.exento_ves),
    igtf: Number(correccion.igtf ?? ocrPrevio.igtf_ves),
    total: Number(correccion.monto_total ?? correccion.total ?? ocrPrevio.monto_original ?? (ocrPrevio.moneda === 'VES' ? ocrPrevio.monto_ves : ocrPrevio.monto_usd)),
  });

  const extraccionActualizada: ExtraccionOcrSesion = {
    ...ocrPrevio,
    nombre_comercio: correccion.comercio || correccion.nombre_comercio || ocrPrevio.nombre_comercio,
    rif_comercio: correccion.tax_id || correccion.rif_comercio || ocrPrevio.rif_comercio,
    numero_factura: correccion.invoice_number || correccion.numero_factura || ocrPrevio.numero_factura,
    fecha_emision: correccion.fecha || correccion.fecha_emision || ocrPrevio.fecha_emision,
    moneda: fiscalResult.moneda_original,
    monto_original: Number(correccion.monto_total ?? correccion.total ?? ocrPrevio.monto_original ?? (ocrPrevio.moneda === 'VES' ? ocrPrevio.monto_ves : ocrPrevio.monto_usd)),
    tasa_cambio: fiscalResult.tasa_cambio,
    base_imponible_ves: fiscalResult.base_imponible_ves,
    iva_ves: fiscalResult.iva_ves,
    exento_ves: fiscalResult.exento_ves,
    igtf_ves: fiscalResult.igtf_ves,
    monto_ves: fiscalResult.monto_ves,
    monto_usd: fiscalResult.monto_usd,
    pais_gasto: fiscalResult.pais_gasto,
    estado_region: fiscalResult.estado_region,
    ciudad: fiscalResult.ciudad,
    codigo_postal: fiscalResult.codigo_postal,
    subtotal_usd: fiscalResult.subtotal_usd,
    sales_tax_usd: fiscalResult.sales_tax_usd,
    propina_usd: fiscalResult.propina_usd,
    tiene_sales_tax: fiscalResult.tiene_sales_tax,
    alerta_tax_usa: null,
  };

  let evaluacionActualizada: EvaluacionSobregiro | undefined;
  if (sesion.datos_temporales?.viatico_id) {
    evaluacionActualizada = await calcularSaldoViatico(
      supabase,
      sesion.datos_temporales.viatico_id,
      fiscalResult.monto_usd
    );
  }

  const datosSesion: DatosTemporalesSesion = {
    ...sesion.datos_temporales,
    extraccion_ocr: extraccionActualizada,
    evaluacion_saldo: evaluacionActualizada,
  };

  await actualizarSesion(supabase, telefono, 'ESPERANDO_CONFIRMACION', datosSesion, empleadoId);

  await enviarConfirmacionGastoInteractiva(telefono, extraccionActualizada, {
    tipo: sesion.datos_temporales?.es_reembolso ? 'REEMBOLSO_DIRECTO' : 'VIATICO_ASIGNADO',
    nombreProyecto: evaluacionActualizada?.nombre_proyecto,
    evaluacion: evaluacionActualizada,
  });

  return { status: 'gasto_corregido_y_reenviado' };
}

/**
 * @name persistirGastoDefinitivo
 * @description [Persistence]: Inserts the finalized expense record into the `gastos` database table
 * and synchronizes with `solicitudes_viaticos.monto_gastado` for Web Dashboard reporting.
 */
async function persistirGastoDefinitivo(
  supabase: SupabaseClient,
  telefono: string,
  empleadoId: string,
  empresaId: string,
  datos: DatosTemporalesSesion | null
): Promise<{ status: string }> {
  if (!datos || !datos.extraccion_ocr) {
    await enviarMensajeWhatsApp(telefono, '⚠️ No se encontraron datos para guardar.');
    await resetearSesion(supabase, telefono, empleadoId);
    return { status: 'sin_datos_para_guardar' };
  }

  const ocr = datos.extraccion_ocr;
  const evaluacion = datos.evaluacion_saldo;
  const esSobregiro = evaluacion?.excede_limite || false;
  const excedeLimiteDiario = Boolean(datos.excede_limite);
  const estadoFinal = (esSobregiro || excedeLimiteDiario) ? 'REQUIERE_APROBACION_ESPECIAL' : 'PENDIENTE';
  const targetViaticoId = datos.viatico_id || null;

  /**
   * @name resolveProjectFromViatico
   * @description [Business Logic]: Retrieves the proyecto_id associated with
   * the viático (travel allowance request) so the expense is correctly linked
   * to its parent project for dashboard KPI tracking and financial reporting.
   * Without this, expenses appear as "Sin proyecto" in the project breakdown.
   */
  let targetProyectoId: string | null = null;
  if (targetViaticoId) {
    const { data: viaticoRecord } = await supabase
      .from('solicitudes_viaticos')
      .select('proyecto_id')
      .eq('id', targetViaticoId)
      .maybeSingle();

    targetProyectoId = viaticoRecord?.proyecto_id || null;

    // Fallback: if solicitudes_viaticos has no proyecto_id, try the viaticos table
    if (!targetProyectoId) {
      const { data: viaticoFallback } = await supabase
        .from('viaticos')
        .select('proyecto_id')
        .eq('id', targetViaticoId)
        .maybeSingle();

      targetProyectoId = viaticoFallback?.proyecto_id || null;
    }

    if (targetProyectoId) {
      console.log(`✅ Resolved proyecto_id=${targetProyectoId} from viático ${targetViaticoId}`);
    } else {
      console.warn(`⚠️ No proyecto_id found for viático ${targetViaticoId}`);
    }
  }

  const detalleExceso = esSobregiro
    ? {
        tipo: 'SOBREGIRO_VIATICO',
        sobregiro_usd: evaluacion?.sobregiro_usd,
        monto_asignado_usd: evaluacion?.monto_asignado_usd,
        acumulado_previo_usd: evaluacion?.acumulado_previo_usd,
        motivo: `Comprobante excede el presupuesto disponible del viático en $${evaluacion?.sobregiro_usd.toFixed(2)} USD`,
      }
    : datos.excess_detail || null;

  // Determine nominal amount in invoice's original currency (VES, USD, MXN, COP, EUR, etc.)
  const montoOriginal = ocr.monto_original ?? (ocr.moneda === 'VES' ? ocr.monto_ves : ocr.monto_usd);

  // Defensive recovery: if storage upload timed out during initial receipt processing,
  // re-attempt uploading the image now so url_comprobante is never lost
  let urlComprobante = ocr.url_comprobante || null;
  if (!urlComprobante && datos.media_id) {
    console.log('🔄 Re-attempting receipt storage upload before database insertion...');
    urlComprobante = datos.es_pdf
      ? await guardarPDFEnSupabase(datos.media_id)
      : await guardarImagenEnSupabase(datos.media_id);
  }

  // Insert expense linking BOTH solicitud_id and viatico_id for complete cross-platform traceability
  const tieneSalesTax = Number(ocr.sales_tax_usd || 0) > 0;
  const insertPayload: Record<string, unknown> = {
    usuario_id: empleadoId,
    empresa_id: empresaId,
    solicitud_id: targetViaticoId,
    viatico_id: targetViaticoId,
    proyecto_id: targetProyectoId,
    es_reembolso: Boolean(datos.es_reembolso),
    comercio: ocr.nombre_comercio,
    rif_comercio: ocr.rif_comercio || null,
    numero_factura: ocr.numero_factura || null,
    fecha_gasto: ocr.fecha_emision,
    categoria: ocr.categoria || 'Miscellaneous',
    monto: montoOriginal,
    moneda: ocr.moneda,
    moneda_original: ocr.moneda,
    monto_total: montoOriginal,
    monto_convertido: ocr.monto_usd,
    monto_usd: ocr.monto_usd,
    monto_ves: ocr.monto_ves,
    tasa_cambio: ocr.tasa_cambio,
    base_imponible_ves: ocr.base_imponible_ves,
    iva_ves: ocr.iva_ves,
    exento_ves: ocr.exento_ves,
    igtf_ves: ocr.igtf_ves,
    url_comprobante: urlComprobante,
    hash_duplicado: ocr.hash_duplicado || null,
    hash_comprobante: ocr.hash_comprobante || null,
    excede_limite: esSobregiro || excedeLimiteDiario,
    detalle_exceso: detalleExceso,
    estado: estadoFinal,
    requiere_revision_fiscal: Boolean(ocr.requiere_revision_fiscal),
    pais_gasto: ocr.pais_gasto || (ocr.moneda === 'USD' ? 'US' : 'VE'),
    estado_region: ocr.estado_region || null,
    ciudad: ocr.ciudad || null,
    codigo_postal: ocr.codigo_postal || null,
    estado_tax_usa: ocr.estado_tax_usa || 'NO_APLICA',
    subtotal_usd: ocr.subtotal_usd || 0,
    sales_tax_usd: ocr.sales_tax_usd || 0,
    propina_usd: ocr.propina_usd || 0,
    tiene_sales_tax: tieneSalesTax,
    datos_ocr: {
      ...ocr,
      tiene_sales_tax: tieneSalesTax,
      comercio: ocr.nombre_comercio,
      total: montoOriginal,
      monto_total: montoOriginal,
      moneda: ocr.moneda,
      tasa_aplicada: ocr.tasa_cambio,
      base_imponible: ocr.base_imponible_ves,
      iva: ocr.iva_ves,
      exento: ocr.exento_ves,
      igtf: ocr.igtf_ves,
      url_comprobante: urlComprobante,
      pais_gasto: ocr.pais_gasto,
      estado_region: ocr.estado_region,
      ciudad: ocr.ciudad,
      codigo_postal: ocr.codigo_postal,
      estado_tax_usa: ocr.estado_tax_usa,
      subtotal_usd: ocr.subtotal_usd,
      sales_tax_usd: ocr.sales_tax_usd,
      propina_usd: ocr.propina_usd,
    } as unknown as Record<string, unknown>,
  };

  let { error: errInsert } = await supabase.from('gastos').insert(insertPayload);
  if (errInsert && (errInsert.message?.includes('tiene_sales_tax') || errInsert.code === '42703')) {
    delete insertPayload.tiene_sales_tax;
    const retry = await supabase.from('gastos').insert(insertPayload);
    errInsert = retry.error;
  }

  if (errInsert) {
    console.error('❌ Error saving expense in database:', errInsert);
    await enviarMensajeWhatsApp(
      telefono,
      '❌ Ocurrió un error al guardar el comprobante en la base de datos. Por favor intenta de nuevo.'
    );
    await resetearSesion(supabase, telefono, empleadoId);
    return { status: 'error_guardando_gasto' };
  }

  // Update solicitudes_viaticos.monto_gastado so the web dashboard (/dashboard/justificacion) updates in real-time
  if (targetViaticoId && !datos.es_reembolso) {
    const { data: todosLosGastos } = await supabase
      .from('gastos')
      .select('monto_convertido, monto, monto_usd')
      .or(`solicitud_id.eq.${targetViaticoId},viatico_id.eq.${targetViaticoId}`)
      .neq('estado', 'RECHAZADO');

    const nuevoGastado = Number(
      (todosLosGastos ?? []).reduce(
        (acc, g) => acc + Number(g.monto_convertido ?? g.monto_usd ?? g.monto ?? 0),
        0
      ).toFixed(2)
    );

    await supabase
      .from('solicitudes_viaticos')
      .update({ monto_gastado: nuevoGastado })
      .eq('id', targetViaticoId);
  }

  await resetearSesion(supabase, telefono, empleadoId);

  let mensajeExito = '✅ *¡Comprobante guardado con éxito!*\nLos datos contables han sido registrados en la plataforma web.';
  if (esSobregiro) {
    mensajeExito += `\n\n⚠️ *Nota de Auditoría:* Debido al sobregiro de *$${evaluacion?.sobregiro_usd.toFixed(2)} USD*, el comprobante ha sido marcado como *Requiere Aprobación Especial* para liquidación.`;
  }

  await enviarMensajeWhatsApp(telefono, mensajeExito);
  await enviarPreguntaContinuarSesion(telefono);
  return { status: 'gasto_guardado_con_exito' };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRESENTATION & WHATSAPP MESSAGE BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

export { enviarMenuPrincipalListMessage };

/**
 * @name enviarSelectorCategoriasWhatsApp
 * @description [Business Logic]: Sends a WhatsApp interactive list message displaying
 * the active expense categories for the employee's company.
 * - Paginates in slices of 9 (reserving the 10th row for "Ver más" if needed).
 * - Row titles are capped at 24 characters per WhatsApp API constraints.
 * - Each row ID follows the pattern `CAT_SEL_${codigo}` for category selection
 *   or `CAT_PAGE_${page}` for pagination navigation.
 */
async function enviarSelectorCategoriasWhatsApp(
  supabase: SupabaseClient,
  telefono: string,
  empresaId: string,
  page = 1
): Promise<void> {
  const PAGE_SIZE = 9;

  const { data: categorias, error } = await supabase
    .from('categorias_gastos')
    .select('codigo, nombre, icono')
    .eq('empresa_id', empresaId)
    .eq('activa', true)
    .order('orden', { ascending: true })
    .order('nombre', { ascending: true });

  let listaCategorias = categorias;
  if (error || !listaCategorias || listaCategorias.length === 0) {
    listaCategorias = DEFAULT_OFFICIAL_CATEGORIES.map((cat) => ({
      codigo: cat.codigo,
      nombre: cat.nombre,
      icono: cat.icono,
    }));
  }

  const totalPages = Math.ceil(listaCategorias.length / PAGE_SIZE);
  const safePage = Math.max(1, Math.min(page, totalPages));
  const offset = (safePage - 1) * PAGE_SIZE;
  const slice = listaCategorias.slice(offset, offset + PAGE_SIZE);

  const filas: WhatsAppRow[] = slice.map((cat) => ({
    id: `CAT_SEL_${cat.codigo}`,
    title: `${cat.icono || '🏷️'} ${cat.nombre}`.slice(0, 24),
    description: cat.nombre,
  }));

  // Add pagination row if there are more categories beyond this page
  if (safePage < totalPages) {
    filas.push({
      id: `CAT_PAGE_${safePage + 1}`,
      title: '➡️ Ver más categorías',
      description: `Página ${safePage + 1} de ${totalPages}`,
    });
  }

  const headerText =
    safePage === 1
      ? '🏷️ *Selecciona la Categoría del Gasto:*\n\nElige la categoría que mejor describe este comprobante:'
      : `🏷️ *Categorías (Página ${safePage}/${totalPages}):*\n\nSelecciona la categoría que corresponde:`;

  await enviarListaWhatsApp(
    telefono,
    headerText,
    'Ver Categorías',
    '🏷️ Categoría del Gasto',
    filas,
    'Rendy • Control de Gastos',
    'Categorías Disponibles'
  );
}

/**
 * @name enviarSelectorDestinoGasto
 * @description Sends the interactive list selector when a cold photo arrives and employee has 2+ active viáticos.
 */
async function enviarSelectorDestinoGasto(
  to: string,
  viaticos: ViaticoActivo[],
  montoUsd: number,
  montoVes: number,
  monedaOriginal?: string,
  montoOriginal?: number
) {
  const filas: WhatsAppRow[] = viaticos.slice(0, 8).map((v) => ({
    id: `DESTINO_VIATICO_${v.id}`,
    title: v.nombre_proyecto.substring(0, 24),
    description: `Disponible: $${v.saldo_disponible_usd.toFixed(2)} USD (de $${v.monto_asignado_usd.toFixed(2)})`,
  }));

  filas.push({
    id: 'DESTINO_REEMBOLSO',
    title: '💸 Reembolso Personal',
    description: 'Pagué con mis propios fondos',
  });

  filas.push({
    id: 'VOLVER_MENU',
    title: '⬅️ Cancelar',
    description: 'Descartar esta factura',
  });

  let textoMonto = `*$${montoUsd.toFixed(2)} USD*`;
  if (monedaOriginal === 'VES') {
    textoMonto = `*${montoVes.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs* (equiv. $${montoUsd.toFixed(2)} USD)`;
  } else if (monedaOriginal && monedaOriginal !== 'USD' && montoOriginal) {
    textoMonto = `*${montoOriginal.toLocaleString('es-VE', { minimumFractionDigits: 2 })} ${monedaOriginal}* (equiv. $${montoUsd.toFixed(2)} USD)`;
  }

  await enviarListaWhatsApp(
    to,
    `Detectamos un comprobante por ${textoMonto}.\n\nTienes varios viáticos activos disponibles.\n\nPor favor selecciona a cuál de tus viáticos imputarlo o si deseas registrarlo como reembolso personal:`,
    'Asignar Destino',
    '📁 Asignar Comprobante',
    filas,
    'Rendy • Control de Gastos',
    'Destinos Disponibles'
  );
}

/**
 * @name enviarConfirmacionGastoInteractiva
 * @description Sends the final validation summary with dual interactive buttons (Confirmar / Cancelar).
 */
async function enviarConfirmacionGastoInteractiva(
  to: string,
  ocr: ExtraccionOcrSesion,
  contexto: {
    tipo: 'VIATICO_ASIGNADO' | 'REEMBOLSO_DIRECTO';
    nombreProyecto?: string;
    evaluacion?: EvaluacionSobregiro;
    dailyLimitAlert?: string | null;
  }
) {
  let cuerpo = `🏢 *Comercio:* ${ocr.nombre_comercio}\n`;

  // Category line
  if (ocr.categoria) {
    cuerpo += `🏷️ *Categoría:* ${ocr.categoria}\n`;
  }
  if (ocr.moneda === 'VES') {
    cuerpo += `💵 *Total Factura:* ${ocr.monto_ves.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs (equiv. $${ocr.monto_usd.toFixed(2)} USD a tasa ${ocr.tasa_cambio})\n`;
  } else if (ocr.moneda === 'USD') {
    cuerpo += `💵 *Total Factura:* $${ocr.monto_usd.toFixed(2)} USD\n`;
  } else {
    const nominal = (ocr.monto_original ?? ocr.monto_usd).toLocaleString('es-VE', { minimumFractionDigits: 2 });
    cuerpo += `💵 *Total Factura:* ${nominal} ${ocr.moneda} (equiv. $${ocr.monto_usd.toFixed(2)} USD a tasa 1 USD = ${ocr.tasa_cambio} ${ocr.moneda})\n`;
  }

  // USA Tax & Geographic Breakdown
  if (
    ocr.pais_gasto === 'US' ||
    (ocr.moneda === 'USD' &&
      ((ocr.sales_tax_usd ?? 0) > 0 || (ocr.propina_usd ?? 0) > 0 || Boolean(ocr.estado_region)))
  ) {
    const ubicacion = [
      ocr.ciudad,
      ocr.estado_region,
      ocr.codigo_postal ? `ZIP ${ocr.codigo_postal}` : null,
    ]
      .filter(Boolean)
      .join(', ');

    if (ubicacion) {
      cuerpo += `📍 *Ubicación:* ${ubicacion}\n`;
    }
    const sub =
      ocr.subtotal_usd ??
      Math.max(0, ocr.monto_usd - (ocr.sales_tax_usd || 0) - (ocr.propina_usd || 0));
    const hasTax = (ocr.sales_tax_usd ?? 0) > 0 || Boolean(ocr.tiene_sales_tax);
    const taxLabel = hasTax
      ? `$${(ocr.sales_tax_usd || 0).toFixed(2)} USD (Con Tax)`
      : `$0.00 USD (Sin Tax)`;
    cuerpo += `• Subtotal: $${sub.toFixed(2)} USD\n• Sales Tax: ${taxLabel}\n`;
    if ((ocr.propina_usd || 0) > 0) {
      cuerpo += `• Propina: $${ocr.propina_usd!.toFixed(2)} USD\n`;
    }
  }

  if (contexto.tipo === 'VIATICO_ASIGNADO') {
    cuerpo += `📁 *Viático:* ${contexto.nombreProyecto || 'Asignado'}\n`;

    if (contexto.evaluacion?.excede_limite) {
      cuerpo += `\n⚠️ *Alerta de Sobregiro:*\n`;
      cuerpo += `Este comprobante excede tu anticipo en *$${contexto.evaluacion.sobregiro_usd.toFixed(2)} USD*.\n`;
      cuerpo += `_Pasará a Aprobación Especial para liquidación como reembolso._`;
    } else if (contexto.evaluacion) {
      cuerpo += `\n💰 *Saldo Restante Proyectado:* *$${contexto.evaluacion.saldo_restante_usd.toFixed(2)} USD*`;
    }
  } else {
    cuerpo += `💸 *Tipo:* Reembolso Personal (Fondos Propios)\n`;
  }

  // Include daily category spending limit warning if triggered by organization policy
  if (contexto.dailyLimitAlert) {
    cuerpo += `\n${contexto.dailyLimitAlert}\n`;
  }

  // Fiscal details footnote
  if (ocr.rif_comercio || ocr.numero_factura) {
    cuerpo += `\n\n📄 _RIF: ${ocr.rif_comercio || 'N/A'} • Factura: ${ocr.numero_factura || 'N/A'}_`;
  }

  await enviarBotonesWhatsApp(
    to,
    cuerpo,
    [
      { id: 'CONFIRMAR_GUARDAR_GASTO', title: '✅ Confirmar' },
      { id: 'CANCELAR_GASTO', title: '⬅️ Volver al Menú' },
    ],
    '📄 Validación de Comprobante',
    '¿Confirmas el registro?'
  );
}

/**
 * @name enviarPreguntaContinuarSesion
 * @description [Business Logic]: Prompts the employee at the conclusion of an operation (viático request,
 * expense/reimbursement registration, or balance query) whether they wish to perform another management action or finish.
 */
export async function enviarPreguntaContinuarSesion(telefono: string): Promise<void> {
  await enviarBotonesWhatsApp(
    telefono,
    '¿Deseas realizar alguna otra gestión en Rendy?',
    [
      { id: 'BTN_CONTINUAR_SI', title: 'Sí, otra gestión' },
      { id: 'BTN_CONTINUAR_NO', title: 'No, finalizar' },
    ]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DATABASE SESSION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @name resetearSesion
 * @description Resets the phone number's session state to INICIO with null payload.
 */
export async function resetearSesion(
  supabase: SupabaseClient,
  telefono: string,
  empleadoId?: string | null
) {
  clearInactivityTimers(telefono);
  await supabase.from('sesiones_whatsapp').upsert({
    telefono,
    empleado_id: empleadoId || null,
    estado: 'INICIO',
    datos_temporales: null,
    ultima_interaccion: new Date().toISOString(),
  });
}

/**
 * @name actualizarSesion
 * @description Upserts the conversation state and temporary payload in Supabase.
 */
export async function actualizarSesion(
  supabase: SupabaseClient,
  telefono: string,
  estado: EstadoConversacion,
  datos: DatosTemporalesSesion | null,
  empleadoId?: string | null,
  employeeName?: string
) {
  if (estado === 'INICIO') {
    clearInactivityTimers(telefono);
  } else {
    scheduleInactivityTimers({
      supabase,
      telefono,
      empleadoId,
      employeeName,
    });
  }

  await supabase.from('sesiones_whatsapp').upsert({
    telefono,
    empleado_id: empleadoId || null,
    estado,
    datos_temporales: datos as unknown as Record<string, unknown>,
    ultima_interaccion: new Date().toISOString(),
  });
}
