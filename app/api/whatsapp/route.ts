import { NextRequest, NextResponse } from 'next/server';
import {
  procesarFacturaConIA,
  aplicarCorreccionConIA,
  aplicarCorreccionAudioConIA,
  guardarImagenEnSupabase,
  procesarFacturaPDFConIA,
  guardarPDFEnSupabase,
  verificarGastoDuplicado,
  calcularHashBuffer
} from '@/app/lib/ocr';
import { enviarMensajeWhatsApp, enviarListaWhatsApp, enviarBotonesWhatsApp } from '@/app/lib/whatsapp';
import { supabase } from '@/app/lib/supabase';
import { verifyInvoiceDuplicate } from '@/lib/services/duplicate-detection.service';
import {
  generateExpenseHash,
  hasSufficientFiscalData,
  sanitizeTaxId,
  sanitizeInvoiceNumber,
  sanitizeAmount,
} from '@/lib/utils/hash';
import {
  normalizarGastoFiscal,
  formatearConfirmacionFiscalWhatsApp,
  type GeminiFiscalExtraction,
  type ResultadoContable,
} from '@/lib/services/procesadorFiscal';

import { TimedMap } from '@/lib/utils/timed-map';

const TIMEOUT_SESION_MS = 3 * 60 * 1000; // 3 minutos de inactividad

const mensajesProcesados = new Set<string>();
const facturasPendientes = new TimedMap<any>(TIMEOUT_SESION_MS);
const solicitudesPendientes = new TimedMap<any>(TIMEOUT_SESION_MS);

// CONSULTA UNIVERSAL DE TASAS DE CAMBIO (GLOBAL EXCHANGE RATES API)
async function obtenerTasaDelDia(monedaOrigen: string, monedaDestino: string): Promise<{ tasa: number; montoConvertido: (monto: number) => number }> {
  const orig = (monedaOrigen || 'USD').toUpperCase();
  const dest = (monedaDestino || 'USD').toUpperCase();

  if (orig === dest) {
    return { tasa: 1.0, montoConvertido: (m) => m };
  }

  try {
    // 1. CASO ESPECIAL VES (Bolívares / BCV Oficial)
    if (orig === 'VES' || dest === 'VES') {
      const resBcv = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', { cache: 'no-store' });
      const dataBcv = await resBcv.json();

      if (dataBcv && dataBcv.promedio && dataBcv.promedio > 0) {
        const tasaBcv = Number(dataBcv.promedio);

        if (orig === 'VES' && dest === 'USD') {
          return {
            tasa: tasaBcv,
            montoConvertido: (m: number) => Number((m / tasaBcv).toFixed(2)),
          };
        }
        if (orig === 'USD' && dest === 'VES') {
          return {
            tasa: tasaBcv,
            montoConvertido: (m: number) => Number((m * tasaBcv).toFixed(2)),
          };
        }

        // Si la conversión es de VES a otra moneda (ej. VES -> EUR / COP / MXN), usamos USD como puente
        const resGlobal = await fetch(`https://open.er-api.com/v6/latest/USD`, { cache: 'no-store' });
        const dataGlobal = await resGlobal.json();
        const tasaDestinoUSD = dataGlobal?.rates?.[dest] || 1.0;

        if (orig === 'VES') {
          const tasaDirecta = tasaBcv / tasaDestinoUSD;
          return {
            tasa: Number(tasaDirecta.toFixed(4)),
            montoConvertido: (m: number) => Number(((m / tasaBcv) * tasaDestinoUSD).toFixed(2)),
          };
        }
      }
    }

    // 2. API DE EXCHANGE RATES GLOBAL PARA CUALQUIER MONEDA (USD, EUR, COP, MXN, CLP, PEN, GBP, ETC.)
    const res = await fetch(`https://open.er-api.com/v6/latest/${orig}`, { cache: 'no-store' });
    const data = await res.json();

    if (data && data.result === 'success' && data.rates && data.rates[dest]) {
      const tasaRelativa = Number(data.rates[dest]);
      return {
        tasa: Number(tasaRelativa.toFixed(4)),
        montoConvertido: (m: number) => Number((m * tasaRelativa).toFixed(2)),
      };
    }
  } catch (error) {
    console.error('❌ Error consultando la API de Exchange Rates:', error);
  }

  // Respaldo defensivo si falla la red
  return { tasa: 1.0, montoConvertido: (m: number) => m };
}

const CATEGORIAS_GASTO = [
  { id: 'CAT_Airfare/train', title: 'Airfare/train' },
  { id: 'CAT_Car Rental', title: 'Car Rental' },
  { id: 'CAT_Food/Beverage', title: 'Food/Beverage' },
  { id: 'CAT_Gas (Fuel)', title: 'Gas (Fuel)' },
  { id: 'CAT_Hotel', title: 'Hotel' },
  { id: 'CAT_Miscellaneous', title: 'Miscellaneous' },
  { id: 'CAT_Parking & Tolls/Taxi', title: 'Parking & Tolls/Taxi' },
  { id: 'CAT_Materiales', title: 'Materiales' },
];

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (message) {
      const messageId = message.id;

      if (mensajesProcesados.has(messageId)) {
        return NextResponse.json({ status: 'duplicado_ignorado' }, { status: 200 });
      }

      mensajesProcesados.add(messageId);
      setTimeout(() => mensajesProcesados.delete(messageId), 5 * 60 * 1000);

      const telefonoEmpleado = message.from;
      let tipoMensaje = message.type;

      const { data: usuario } = await supabase
        .from('usuarios')
        .select('id, empresa_id, nombre, empresas(moneda)')
        .eq('telefono_whatsapp', telefonoEmpleado)
        .maybeSingle();

      if (!usuario || !usuario.empresa_id) {
        await enviarMensajeWhatsApp(
          telefonoEmpleado,
          '⚠️ Tu número de teléfono no está registrado en ninguna empresa. Por favor, contacta a tu administrador.'
        );
        return NextResponse.json({ status: 'usuario_no_registrado' }, { status: 200 });
      }

      const monedaEmpresa = (usuario.empresas as any)?.moneda || 'VES';

      // ─── TIMEOUT: Verificar expiración de sesión (3 min de inactividad) ───
      const facturaExpirada = facturasPendientes.consumeExpired(telefonoEmpleado);
      const solicitudExpirada = solicitudesPendientes.consumeExpired(telefonoEmpleado);

      if (facturaExpirada || solicitudExpirada) {
        // Limpiar ambos Maps por seguridad
        facturasPendientes.delete(telefonoEmpleado);
        solicitudesPendientes.delete(telefonoEmpleado);

        await enviarMensajeWhatsApp(
          telefonoEmpleado,
          '⏱️ *Sesión expirada por inactividad.*\nTu solicitud anterior fue cancelada automáticamente.'
        );
        await enviarBotonesWhatsApp(
          telefonoEmpleado,
          `¿En qué te puedo ayudar?`,
          [
            { id: 'BTN_SOLICITAR_VIATICOS', title: '📝 Pedir Viáticos' },
            { id: 'BTN_JUSTIFICAR_VIATICOS', title: '📄 Rendir Viáticos' },
            { id: 'BTN_SOLICITAR_REEMBOLSO', title: '💸 Pedir Reembolso' },
          ]
        );
        return NextResponse.json({ status: 'sesion_expirada' }, { status: 200 });
      }

      // 0. BOTONES DEL MENÚ PRINCIPAL
      if (tipoMensaje === 'interactive' && message.interactive?.type === 'button_reply') {
        const btnId = message.interactive?.button_reply?.id;

        if (btnId === 'BTN_SOLICITAR_VIATICOS') {
          facturasPendientes.delete(telefonoEmpleado);

          const { data: proyectos } = await supabase
            .from('proyectos')
            .select('id, nombre')
            .eq('empresa_id', usuario.empresa_id)
            .eq('activo', true);

          if (!proyectos || proyectos.length === 0) {
            await enviarBotonesWhatsApp(
              telefonoEmpleado,
              '⚠️ No hay proyectos activos configurados en tu empresa para asignar la solicitud de viáticos.',
              [{ id: 'BTN_VOLVER_MENU', title: '⬅️ Volver al Menú' }]
            );
            return NextResponse.json({ status: 'sin_proyectos' }, { status: 200 });
          }

          solicitudesPendientes.set(telefonoEmpleado, {
            usuario_id: usuario.id,
            empresa_id: usuario.empresa_id,
            paso: 'PROYECTO',
          });

          const filasProyectos = proyectos.slice(0, 9).map((p) => ({
            id: `SOL_PROY_${p.id}`,
            title: p.nombre.substring(0, 24),
          }));

          await enviarListaWhatsApp(
            telefonoEmpleado,
            '📝 *Solicitud de Viáticos*\n\nSelecciona el proyecto al cual estarán destinados los fondos:',
            'Ver Proyectos',
            '📁 Asignar Proyecto',
            [...filasProyectos, { id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' }]
          );
          return NextResponse.json({ status: 'solicitud_proyecto' }, { status: 200 });
        }

        // --- OPCIÓN 2: RENDIR VIÁTICOS ---
        else if (btnId === 'BTN_JUSTIFICAR_VIATICOS') {
          solicitudesPendientes.delete(telefonoEmpleado);

          // Buscar solicitudes aprobadas (filtrado estricto en mayúsculas para coincidir con el ENUM de Supabase)
          const { data: viaticosAprobados, error: errViat } = await supabase
            .from('solicitudes_viaticos')
            .select('id, monto_aprobado, monto_solicitado, monto_gastado, moneda, estado, proyectos(nombre)')
            .eq('usuario_id', usuario.id)
            .eq('estado', 'APROBADO');

          console.log('🔍 Viáticos encontrados para usuario', usuario.id, ':', viaticosAprobados, 'Error:', errViat);

          if (errViat || !viaticosAprobados || viaticosAprobados.length === 0) {
            await enviarBotonesWhatsApp(
              telefonoEmpleado,
              '⚠️ No tienes ninguna solicitud de viáticos aprobada pendiente por rendir.\n\n¿Qué deseas hacer?',
              [
                { id: 'BTN_SOLICITAR_VIATICOS', title: '📝 Pedir Viáticos' },
                { id: 'BTN_SOLICITAR_REEMBOLSO', title: '💸 Pedir Reembolso' },
                { id: 'BTN_VOLVER_MENU', title: '⬅️ Volver al Menú' },
              ]
            );
            return NextResponse.json({ status: 'sin_viaticos_pendientes' }, { status: 200 });
          }

          // Meta exige que cada elemento de la lista tenga título <= 24 caracteres
          const filasViaticos = viaticosAprobados.slice(0, 9).map((v) => {
            const proyNom = (v.proyectos as any)?.nombre || 'General';
            const aprobado = v.monto_aprobado ?? v.monto_solicitado ?? 0;
            const gastado = v.monto_gastado ?? 0;
            const restante = Number((aprobado - gastado).toFixed(2));
            const mon = v.moneda || 'USD';

            const labelMonto = `(${restante}${mon})`;
            const maxLenProy = Math.max(1, 23 - labelMonto.length);
            const proyCorto = proyNom.substring(0, maxLenProy);
            const tituloFinal = `${proyCorto} ${labelMonto}`.trim().substring(0, 24);

            return {
              id: `JUST_SOL_${v.id}`,
              title: tituloFinal,
            };
          });

          await enviarListaWhatsApp(
            telefonoEmpleado,
            '📄 *Rendir Viáticos*\n\nSelecciona el viático aprobado al que pertenece tu comprobante:',
            'Ver Viáticos',
            '📁 Seleccionar Viático',
            [...filasViaticos, { id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' }]
          );
          return NextResponse.json({ status: 'lista_viaticos_enviada' }, { status: 200 });
        }

        else if (btnId === 'BTN_SOLICITAR_REEMBOLSO') {
          solicitudesPendientes.delete(telefonoEmpleado);

          facturasPendientes.set(telefonoEmpleado, {
            usuario_id: usuario.id,
            empresa_id: usuario.empresa_id,
            tipo_flujo: 'REEMBOLSO',
            paso: 'ESPERANDO_RECIBO',
          });

          await enviarBotonesWhatsApp(
            telefonoEmpleado,
            '💸 *Solicitud de Reembolso*\n\nPor favor envía la foto o documento PDF de la factura/recibo que pagaste con tus *fondos personales*.',
            [{ id: 'BTN_VOLVER_MENU', title: '⬅️ Volver al Menú' }]
          );
          return NextResponse.json({ status: 'esperando_recibo_reembolso' }, { status: 200 });
        }

        else if (btnId === 'BTN_MONEDA_LOCAL' || btnId === 'BTN_MONEDA_USD') {
          const solPendiente = solicitudesPendientes.get(telefonoEmpleado);
          if (solPendiente && solPendiente.paso === 'MONEDA') {
            solPendiente.moneda = btnId === 'BTN_MONEDA_LOCAL' ? monedaEmpresa : 'USD';
            solPendiente.paso = 'FECHA';
            solicitudesPendientes.set(telefonoEmpleado, solPendiente);

            const fechasRapidas = [
              { id: 'SOL_FECHA_HOY', title: 'Para HOY' },
              { id: 'SOL_FECHA_MANANA', title: 'Para MAÑANA' },
              { id: 'SOL_FECHA_3DIAS', title: 'En 3 días' },
              { id: 'SOL_FECHA_1SEMANA', title: 'En 1 semana' },
              { id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' },
            ];

            await enviarListaWhatsApp(
              telefonoEmpleado,
              `✅ Moneda: *${solPendiente.moneda}*\n\n¿Para qué fecha requieres los fondos? Selecciona o escribe la fecha (AAAA-MM-DD):`,
              'Ver Fechas',
              '📅 Fecha Requerida',
              fechasRapidas
            );
            return NextResponse.json({ status: 'solicitud_fecha' }, { status: 200 });
          }
        }

        else if (btnId === 'BTN_CONTINUAR_SI') {
          await enviarBotonesWhatsApp(
            telefonoEmpleado,
            `👍 ¡Claro! ¿Qué otra gestión deseas realizar?`,
            [
              { id: 'BTN_SOLICITAR_VIATICOS', title: '📝 Pedir Viáticos' },
              { id: 'BTN_JUSTIFICAR_VIATICOS', title: '📄 Rendir Viáticos' },
              { id: 'BTN_SOLICITAR_REEMBOLSO', title: '💸 Pedir Reembolso' },
            ]
          );
          return NextResponse.json({ status: 'menu_reabierto' }, { status: 200 });
        }

        else if (btnId === 'BTN_CONTINUAR_NO') {
          solicitudesPendientes.delete(telefonoEmpleado);
          facturasPendientes.delete(telefonoEmpleado);
          await enviarMensajeWhatsApp(
            telefonoEmpleado,
            `🙌 ¡Muchas gracias por usar *Rendy*! Quedo a tu disposición si necesitas algo más tarde. ¡Que tengas un excelente día!`
          );
          return NextResponse.json({ status: 'conversacion_finalizada' }, { status: 200 });
        }
        // ─── BOTONES DE CONFIRMACIÓN (Delegamos al flujo de texto "SI") ───
        else if (btnId === 'BTN_CONFIRMAR_SOL' || btnId === 'BTN_CONFIRMAR_GASTO') {
          // Sintetizar un mensaje de texto "SI" para reutilizar la lógica existente
          // en vez de duplicar el flujo de confirmación completo.
          tipoMensaje = 'text';
          message.type = 'text';
          message.text = { body: 'SI' };
          // NO hacemos return — dejamos que caiga al handler de texto (sección 2)
        }
        // ─── BOTÓN UNIVERSAL: Volver al Menú Principal ───
        else if (btnId === 'BTN_VOLVER_MENU') {
          facturasPendientes.delete(telefonoEmpleado);
          solicitudesPendientes.delete(telefonoEmpleado);
          await enviarBotonesWhatsApp(
            telefonoEmpleado,
            '🔄 Has vuelto al menú principal. ¿Qué deseas hacer?',
            [
              { id: 'BTN_SOLICITAR_VIATICOS', title: '📝 Pedir Viáticos' },
              { id: 'BTN_JUSTIFICAR_VIATICOS', title: '📄 Rendir Viáticos' },
              { id: 'BTN_SOLICITAR_REEMBOLSO', title: '💸 Pedir Reembolso' },
            ]
          );
          return NextResponse.json({ status: 'volver_menu' }, { status: 200 });
        }
      }

      // 1. MANEJO DE LISTAS INTERACTIVAS
      if (tipoMensaje === 'interactive' && message.interactive?.type === 'list_reply') {
        const respuestaLista = message.interactive?.list_reply;
        const idSeleccionado = respuestaLista?.id;

        // ─── Volver al menú desde cualquier lista ───
        if (idSeleccionado === 'VOLVER_MENU') {
          facturasPendientes.delete(telefonoEmpleado);
          solicitudesPendientes.delete(telefonoEmpleado);
          await enviarBotonesWhatsApp(
            telefonoEmpleado,
            '🔄 Has vuelto al menú principal. ¿Qué deseas hacer?',
            [
              { id: 'BTN_SOLICITAR_VIATICOS', title: '📝 Pedir Viáticos' },
              { id: 'BTN_JUSTIFICAR_VIATICOS', title: '📄 Rendir Viáticos' },
              { id: 'BTN_SOLICITAR_REEMBOLSO', title: '💸 Pedir Reembolso' },
            ]
          );
          return NextResponse.json({ status: 'volver_menu' }, { status: 200 });
        }
        const tituloSeleccionado = respuestaLista?.title;

        // A. SELECCIÓN DE VIÁTICO A RENDIR
        if (idSeleccionado.startsWith('JUST_SOL_')) {
          const solicitudId = idSeleccionado.replace('JUST_SOL_', '');

          const { data: viat, error: errViatSingle } = await supabase
            .from('solicitudes_viaticos')
            .select('id, monto_aprobado, monto_solicitado, moneda, proyecto_id, proyectos(nombre)')
            .eq('id', solicitudId)
            .single();

          if (errViatSingle || !viat) {
            await enviarBotonesWhatsApp(
              telefonoEmpleado,
              '⚠️ No se pudo obtener la información de ese viático. Inténtalo de nuevo.',
              [{ id: 'BTN_VOLVER_MENU', title: '⬅️ Volver al Menú' }]
            );
            return NextResponse.json({ status: 'error_viatico_no_encontrado' }, { status: 200 });
          }

          // SUMA REAL de gastos existentes en BD (evita depender del campo cacheado monto_gastado)
          const { data: gastosExistentes } = await supabase
            .from('gastos')
            .select('monto_convertido, monto')
            .eq('solicitud_id', viat.id);

          const gastadoReal = Number(
            (gastosExistentes ?? []).reduce((acc, g) => acc + (g.monto_convertido ?? g.monto ?? 0), 0).toFixed(2)
          );

          const aprobado = viat.monto_aprobado ?? viat.monto_solicitado ?? 0;
          const restante = Number((aprobado - gastadoReal).toFixed(2));
          const mon = viat.moneda || 'USD';
          const proyNom = (viat.proyectos as any)?.nombre || 'General';

          // Sincronizar monto_gastado en BD con el valor real calculado
          await supabase
            .from('solicitudes_viaticos')
            .update({ monto_gastado: gastadoReal })
            .eq('id', viat.id);

          facturasPendientes.set(telefonoEmpleado, {
            usuario_id: usuario.id,
            empresa_id: usuario.empresa_id,
            solicitud_id: viat.id,
            proyecto_id: viat.proyecto_id,
            proyecto_nombre: proyNom,
            moneda_viatico: mon,
            monto_aprobado: aprobado,
            monto_gastado_previo: gastadoReal,
            monto_restante_previo: restante,
            tipo_flujo: 'JUSTIFICACION_VIATICO',
            paso: 'ESPERANDO_RECIBO',
          });

          const resumenViat =
            `📌 *Viático Seleccionado:* ${proyNom}

💵 *Monto Aprobado:* ${aprobado} ${mon}
📉 *Rendido a la fecha:* ${gastadoReal} ${mon}
💰 *Saldo Restante:* *${restante} ${mon}*

📸 Por favor, envía la foto o documento PDF del comprobante/factura para rendir este viático.`;

          await enviarBotonesWhatsApp(
            telefonoEmpleado,
            resumenViat,
            [{ id: 'BTN_VOLVER_MENU', title: '⬅️ Volver al Menú' }]
          );
          return NextResponse.json({ status: 'viatico_seleccionado' }, { status: 200 });
        }

        const solPendiente = solicitudesPendientes.get(telefonoEmpleado);
        if (solPendiente && idSeleccionado.startsWith('SOL_')) {
          if (idSeleccionado.startsWith('SOL_PROY_')) {
            solPendiente.proyecto_id = idSeleccionado.replace('SOL_PROY_', '');
            solPendiente.proyecto_nombre = tituloSeleccionado;
            solPendiente.paso = 'MONTO';
            solicitudesPendientes.set(telefonoEmpleado, solPendiente);

            await enviarBotonesWhatsApp(
              telefonoEmpleado,
              `✅ Proyecto: *${tituloSeleccionado}*\n\nIndica el *monto solicitado* (Ej: 150.00):`,
              [{ id: 'BTN_VOLVER_MENU', title: '⬅️ Volver al Menú' }]
            );
            return NextResponse.json({ status: 'solicitud_monto' }, { status: 200 });
          }

          if (idSeleccionado.startsWith('SOL_FECHA_')) {
            const hoy = new Date();
            let fechaCalc = new Date();
            if (idSeleccionado === 'SOL_FECHA_MANANA') fechaCalc.setDate(hoy.getDate() + 1);
            else if (idSeleccionado === 'SOL_FECHA_3DIAS') fechaCalc.setDate(hoy.getDate() + 3);
            else if (idSeleccionado === 'SOL_FECHA_1SEMANA') fechaCalc.setDate(hoy.getDate() + 7);

            solPendiente.fecha_requerida = fechaCalc.toISOString().split('T')[0];
            solPendiente.paso = 'USO';
            solicitudesPendientes.set(telefonoEmpleado, solPendiente);

            const categoriasUso = [
              { id: 'SOL_CAT_Alimentacion', title: 'Alimentación / Comida' },
              { id: 'SOL_CAT_Transporte/Gasolina', title: 'Transporte / Gasolina' },
              { id: 'SOL_CAT_Hospedaje', title: 'Hospedaje / Hotel' },
              { id: 'SOL_CAT_Materiales', title: 'Materiales / Equipos' },
              { id: 'SOL_CAT_Varios', title: 'Gastos Varios' },
              { id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' },
            ];

            await enviarListaWhatsApp(
              telefonoEmpleado,
              `✅ Fecha requerida: *${solPendiente.fecha_requerida}*\n\nSelecciona el uso principal estimado:`,
              'Ver Opciones',
              '🏷️ Uso Estimado',
              categoriasUso
            );
            return NextResponse.json({ status: 'solicitud_uso' }, { status: 200 });
          }

          if (idSeleccionado.startsWith('SOL_CAT_')) {
            solPendiente.uso_estimado = idSeleccionado.replace('SOL_CAT_', '');
            solPendiente.paso = 'CONFIRMACION';
            solicitudesPendientes.set(telefonoEmpleado, solPendiente);

            const mensajeResumen =
              `📌 *Resumen de Solicitud de Viáticos:*

📁 *Proyecto:* ${solPendiente.proyecto_nombre}
💵 *Monto Solicitado:* ${solPendiente.monto_solicitado} ${solPendiente.moneda}
📅 *Fecha Requerida:* ${solPendiente.fecha_requerida}
🏷️ *Uso Principal:* ${solPendiente.uso_estimado}

_¿Deseas enviar esta solicitud para aprobación?_
Presiona *Confirmar* para enviar o *Volver al Menú* para cancelar.`;

            await enviarBotonesWhatsApp(
              telefonoEmpleado,
              mensajeResumen,
              [
                { id: 'BTN_CONFIRMAR_SOL', title: '✅ Confirmar' },
                { id: 'BTN_VOLVER_MENU', title: '⬅️ Volver al Menú' },
              ]
            );
            return NextResponse.json({ status: 'solicitud_resumen' }, { status: 200 });
          }
        }

        const facturaPendiente = facturasPendientes.get(telefonoEmpleado);
        if (facturaPendiente && facturaPendiente.tipo_flujo === 'REEMBOLSO') {
          if (idSeleccionado.startsWith('PROY_')) {
            facturaPendiente.proyecto_id = idSeleccionado.replace('PROY_', '');
            facturaPendiente.proyecto_nombre = tituloSeleccionado;
            facturasPendientes.set(telefonoEmpleado, facturaPendiente);

            await enviarListaWhatsApp(
              telefonoEmpleado,
              `✅ Proyecto: *${tituloSeleccionado}*\n\nSelecciona la categoría de este gasto:`,
              'Ver Categorías',
              '🏷️ Categoría de Gasto',
              [...CATEGORIAS_GASTO, { id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' }]
            );
            return NextResponse.json({ status: 'reembolso_categoria' }, { status: 200 });
          }

          if (idSeleccionado.startsWith('CAT_')) {
            facturaPendiente.categoria = idSeleccionado.replace('CAT_', '');
            facturaPendiente.metodo_pago_id = null;
            facturaPendiente.metodo_pago_nombre = 'Fondos Personales (Reembolso)';
            facturaPendiente.paso = 'CONFIRMACION';
            facturasPendientes.set(telefonoEmpleado, facturaPendiente);

            let mensajeResumen = '';
            if (facturaPendiente.resultado_fiscal) {
              mensajeResumen = formatearConfirmacionFiscalWhatsApp(
                {
                  nombre_comercio: facturaPendiente.comercio || facturaPendiente.nombre_comercio,
                  rif_comercio: facturaPendiente.tax_id || facturaPendiente.rif_comercio,
                  numero_factura: facturaPendiente.invoice_number || facturaPendiente.numero_factura,
                  fecha_emision: facturaPendiente.fecha || facturaPendiente.fecha_emision,
                  moneda: (facturaPendiente.moneda?.toUpperCase() === 'USD' ? 'USD' : 'VES'),
                  tasa_impresa: facturaPendiente.tasa_impresa ?? null,
                  base_imponible: Number(facturaPendiente.base_imponible || 0),
                  iva: Number(facturaPendiente.iva || 0),
                  exento: Number(facturaPendiente.exento || 0),
                  igtf: Number(facturaPendiente.igtf || 0),
                  total: Number(facturaPendiente.monto_total || facturaPendiente.total || 0),
                },
                facturaPendiente.resultado_fiscal
              );
            } else {
              mensajeResumen =
                `📌 *Resumen de Solicitud de Reembolso:*

🏢 *Comercio:* ${facturaPendiente.comercio || 'No detectado'}
💵 *Monto:* ${facturaPendiente.monto_total || 0} ${facturaPendiente.moneda || ''}
📅 *Fecha:* ${facturaPendiente.fecha || 'No detectada'}
🛒 *Concepto:* ${facturaPendiente.concepto || 'Sin detalle'}
📁 *Proyecto:* ${facturaPendiente.proyecto_nombre || 'No asignado'}
🏷️ *Categoría:* ${facturaPendiente.categoria}

_¿Los datos son correctos?_
Presiona *Confirmar* para enviar a aprobación, o envía un texto para corregir.`;
            }

            await enviarBotonesWhatsApp(
              telefonoEmpleado,
              mensajeResumen,
              [
                { id: 'BTN_CONFIRMAR_GASTO', title: '✅ Confirmar' },
                { id: 'BTN_VOLVER_MENU', title: '⬅️ Volver al Menú' },
              ]
            );
            return NextResponse.json({ status: 'reembolso_resumen' }, { status: 200 });
          }
        }
      }

      // 2. MANEJO DE MENSAJES DE TEXTO
      else if (tipoMensaje === 'text' && message.text?.body) {
        const texto = message.text.body.trim();
        const solPendiente = solicitudesPendientes.get(telefonoEmpleado);
        const facturaPendiente = facturasPendientes.get(telefonoEmpleado);

        const COMANDOS_RESET = ['cancelar', 'volver', 'menu', 'menú', 'inicio'];
        if (COMANDOS_RESET.includes(texto.toLowerCase())) {
          solicitudesPendientes.delete(telefonoEmpleado);
          facturasPendientes.delete(telefonoEmpleado);
          await enviarMensajeWhatsApp(telefonoEmpleado, '🔄 *Operación cancelada.* Has vuelto al inicio.');
          await enviarBotonesWhatsApp(
            telefonoEmpleado,
            `¿Qué deseas hacer ahora?`,
            [
              { id: 'BTN_SOLICITAR_VIATICOS', title: '📝 Pedir Viáticos' },
              { id: 'BTN_JUSTIFICAR_VIATICOS', title: '📄 Rendir Viáticos' },
              { id: 'BTN_SOLICITAR_REEMBOLSO', title: '💸 Pedir Reembolso' },
            ]
          );
          return NextResponse.json({ status: 'cancelado' }, { status: 200 });
        }

        if (solPendiente && solPendiente.paso === 'MONTO') {
          const montoNum = parseFloat(texto.replace(',', '.'));
          if (isNaN(montoNum) || montoNum <= 0) {
            await enviarBotonesWhatsApp(
              telefonoEmpleado,
              '⚠️ Por favor ingresa un monto numérico válido (Ej: 150.00).',
              [{ id: 'BTN_VOLVER_MENU', title: '⬅️ Volver al Menú' }]
            );
            return NextResponse.json({ status: 'monto_invalido' }, { status: 200 });
          }

          solPendiente.monto_solicitado = montoNum;
          solPendiente.paso = 'MONEDA';
          solicitudesPendientes.set(telefonoEmpleado, solPendiente);

          const simboloMoneda = monedaEmpresa === 'VES' ? 'VES (Bs)' : monedaEmpresa;

          await enviarBotonesWhatsApp(
            telefonoEmpleado,
            `✅ Monto ingresado: *${montoNum}*\n\n¿En qué moneda requieres esta solicitud?`,
            [
              { id: 'BTN_MONEDA_LOCAL', title: `Local (${simboloMoneda})`.substring(0, 20) },
              { id: 'BTN_MONEDA_USD', title: 'Dólares (USD)' },
              { id: 'BTN_VOLVER_MENU', title: '⬅️ Volver al Menú' },
            ]
          );
          return NextResponse.json({ status: 'solicitud_moneda' }, { status: 200 });
        }

        if (solPendiente && solPendiente.paso === 'FECHA') {
          solPendiente.fecha_requerida = texto;
          solPendiente.paso = 'USO';
          solicitudesPendientes.set(telefonoEmpleado, solPendiente);

          const categoriasUso = [
            { id: 'SOL_CAT_Alimentacion', title: 'Alimentación / Comida' },
            { id: 'SOL_CAT_Transporte/Gasolina', title: 'Transporte / Gasolina' },
            { id: 'SOL_CAT_Hospedaje', title: 'Hospedaje / Hotel' },
            { id: 'SOL_CAT_Materiales', title: 'Materiales / Equipos' },
            { id: 'SOL_CAT_Varios', title: 'Gastos Varios' },
            { id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' },
          ];

          await enviarListaWhatsApp(
            telefonoEmpleado,
            `✅ Fecha requerida: *${solPendiente.fecha_requerida}*\n\nSelecciona el uso principal estimado:`,
            'Ver Opciones',
            '🏷️ Uso Estimado',
            categoriasUso
          );
          return NextResponse.json({ status: 'solicitud_uso' }, { status: 200 });
        }

        if (solPendiente && solPendiente.paso === 'CONFIRMACION' && (texto.toUpperCase() === 'SI' || texto.toUpperCase() === 'SÍ' || texto.toUpperCase() === 'CONFIRMAR')) {
          const fechaHoy = new Date().toISOString().split('T')[0];

          const { error } = await supabase.from('solicitudes_viaticos').insert({
            usuario_id: solPendiente.usuario_id,
            empresa_id: solPendiente.empresa_id,
            proyecto_id: solPendiente.proyecto_id || null,
            monto_solicitado: solPendiente.monto_solicitado,
            moneda: solPendiente.moneda || 'USD',
            monto_asignado: 0,
            monto_aprobado: 0,
            monto_gastado: 0,
            fecha_inicio: fechaHoy,
            fecha_fin: solPendiente.fecha_requerida || fechaHoy,
            fecha_requerida: solPendiente.fecha_requerida || fechaHoy,
            titulo_viaje: `Solicitud Viáticos - ${solPendiente.proyecto_nombre || 'General'}`,
            estado: 'PENDIENTE',
          });

          if (error) {
            console.error('❌ Error guardando solicitud:', error);
            await enviarBotonesWhatsApp(
              telefonoEmpleado,
              '❌ Ocurrió un error al registrar la solicitud.',
              [{ id: 'BTN_VOLVER_MENU', title: '⬅️ Volver al Menú' }]
            );
          } else {
            solicitudesPendientes.delete(telefonoEmpleado);
            await enviarMensajeWhatsApp(
              telefonoEmpleado,
              `🎉 *¡Solicitud de Viáticos Enviada!*\n\n📁 *Proyecto:* ${solPendiente.proyecto_nombre}\n💵 *Monto:* ${solPendiente.monto_solicitado} ${solPendiente.moneda}\n📅 *Requerido:* ${solPendiente.fecha_requerida}\n\nTu administrador la revisará en el panel web.`
            );

            await enviarBotonesWhatsApp(
              telefonoEmpleado,
              `¿Deseas realizar alguna otra gestión en Rendy?`,
              [
                { id: 'BTN_CONTINUAR_SI', title: 'Sí, otra gestión' },
                { id: 'BTN_CONTINUAR_NO', title: 'No, finalizar' },
              ]
            );
          }
          return NextResponse.json({ status: 'solicitud_completada' }, { status: 200 });
        }

        // CONFIRMACIÓN DE COMPROBANTE / RENDICIÓN / REEMBOLSO (SI)
        if (facturaPendiente && facturaPendiente.paso === 'CONFIRMACION' && (texto.toUpperCase() === 'SI' || texto.toUpperCase() === 'SÍ' || texto.toUpperCase() === 'CONFIRMAR')) {
          const estadoGasto = facturaPendiente.requiere_revision_duplicado ? 'REVISION_DUPLICADO' : 'PENDIENTE';
          const montoFacturaOriginal = facturaPendiente.monto_total || facturaPendiente.total || 0;
          const monedaFacturaOriginal = facturaPendiente.moneda || 'VES';
          const tasaCongelada = facturaPendiente.tasa_aplicada || facturaPendiente.tasa_cambio_fiscal || 1.0;
          const montoConvertidoCongelado = facturaPendiente.monto_convertido_viatico ?? montoFacturaOriginal;

          // ─── Campos fiscales normalizados para persistencia ───
          const persistRif = facturaPendiente.rif_comercio || facturaPendiente.tax_id
            ? sanitizeTaxId(facturaPendiente.rif_comercio || facturaPendiente.tax_id)
            : null;
          const persistNumeroFactura = facturaPendiente.numero_factura || facturaPendiente.invoice_number
            ? sanitizeInvoiceNumber(facturaPendiente.numero_factura || facturaPendiente.invoice_number)
            : null;
          const persistMontoTotal = facturaPendiente.monto_total || facturaPendiente.total
            ? parseFloat(sanitizeAmount(facturaPendiente.monto_total || facturaPendiente.total))
            : null;

          // ─── Sprint 2: Fiscal breakdown data from procesadorFiscal ───
          const fiscalData: Record<string, unknown> = facturaPendiente.resultado_fiscal || {};

          const { error } = await supabase.from('gastos').insert({
            usuario_id: facturaPendiente.usuario_id || null,
            empresa_id: facturaPendiente.empresa_id || null,
            proyecto_id: facturaPendiente.proyecto_id || null,
            solicitud_id: facturaPendiente.solicitud_id || null,
            metodo_pago_id: facturaPendiente.metodo_pago_id || null,
            categoria: facturaPendiente.categoria || 'Otros',
            monto: montoFacturaOriginal,
            moneda: monedaFacturaOriginal,
            tasa_cambio: tasaCongelada,
            monto_convertido: montoConvertidoCongelado,
            comercio: facturaPendiente.comercio || facturaPendiente.nombre_comercio,
            fecha_gasto: facturaPendiente.fecha || facturaPendiente.fecha_emision || new Date().toISOString().split('T')[0],
            concepto: facturaPendiente.concepto,
            url_comprobante: facturaPendiente.url_comprobante || null,
            hash_comprobante: facturaPendiente.hash_comprobante || null,
            datos_ocr: facturaPendiente,
            estado: estadoGasto,
            // ─── Anti-fraud fiscal dedup (Sprint 2) ───
            rif_comercio: persistRif,
            numero_factura: persistNumeroFactura,
            monto_total: persistMontoTotal,
            hash_duplicado: facturaPendiente.hash_duplicado || null,
            es_duplicado: facturaPendiente.requiere_revision_duplicado || false,
            // ─── Fiscal breakdown & dual-currency (Sprint 2 - Block 1) ───
            moneda_original: (fiscalData.moneda_original as string) || monedaFacturaOriginal,
            origen_tasa: (fiscalData.origen_tasa as string) || 'sistema',
            base_imponible_ves: (fiscalData.base_imponible_ves as number) || 0,
            iva_ves: (fiscalData.iva_ves as number) || 0,
            exento_ves: (fiscalData.exento_ves as number) || 0,
            igtf_ves: (fiscalData.igtf_ves as number) || 0,
            monto_ves: (fiscalData.monto_ves as number) || 0,
            monto_usd: (fiscalData.monto_usd as number) || 0,
            requiere_revision_fiscal: (fiscalData.requiere_revision_fiscal as boolean) || false,
          });

          if (error) {
            console.error('❌ Error guardando gasto:', error);
            await enviarBotonesWhatsApp(
              telefonoEmpleado,
              '❌ Error guardando el comprobante.',
              [{ id: 'BTN_VOLVER_MENU', title: '⬅️ Volver al Menú' }]
            );
            return NextResponse.json({ status: 'error_supabase' }, { status: 200 });
          }

          if (facturaPendiente.tipo_flujo === 'JUSTIFICACION_VIATICO' && facturaPendiente.solicitud_id) {
            const monedaViatico = facturaPendiente.moneda_viatico || 'USD';

            // SUMA REAL: recalcular monto_gastado sumando TODOS los gastos de esta solicitud
            // (incluyendo el que acaba de insertarse) para garantizar consistencia total.
            const { data: todosLosGastos } = await supabase
              .from('gastos')
              .select('monto_convertido, monto')
              .eq('solicitud_id', facturaPendiente.solicitud_id);

            const nuevoGastado = Number(
              (todosLosGastos ?? []).reduce((acc, g) => acc + (g.monto_convertido ?? g.monto ?? 0), 0).toFixed(2)
            );

            await supabase
              .from('solicitudes_viaticos')
              .update({ monto_gastado: nuevoGastado })
              .eq('id', facturaPendiente.solicitud_id);

            const aprobado = facturaPendiente.monto_aprobado || 0;
            const nuevoRestante = Number((aprobado - nuevoGastado).toFixed(2));

            facturasPendientes.delete(telefonoEmpleado);

            const textoConversion = (monedaFacturaOriginal.toUpperCase() !== monedaViatico.toUpperCase())
              ? `\n💱 *Monto Deducible (Tasa ${tasaCongelada}):* ${montoConvertidoCongelado} ${monedaViatico}`
              : '';

            await enviarMensajeWhatsApp(
              telefonoEmpleado,
              `🎉 *¡Comprobante Registrado con Éxito!*

🏢 *Comercio:* ${facturaPendiente.comercio}
💵 *Monto Factura:* ${montoFacturaOriginal} ${monedaFacturaOriginal}${textoConversion}
📁 *Proyecto:* ${facturaPendiente.proyecto_nombre}

📊 *Balance del Viático:*
Monto Aprobado: ${aprobado} ${monedaViatico}
Total Rendido: ${nuevoGastado} ${monedaViatico}
💰 *Saldo Restante:* *${nuevoRestante > 0 ? nuevoRestante : 0} ${monedaViatico}*`
            );
          } else {
            facturasPendientes.delete(telefonoEmpleado);

            await enviarMensajeWhatsApp(
              telefonoEmpleado,
              `🎉 *¡Solicitud de Reembolso Enviada!*\n\n🏢 *Comercio:* ${facturaPendiente.comercio}\n💵 *Monto:* ${montoFacturaOriginal} ${monedaFacturaOriginal}\n📁 *Proyecto:* ${facturaPendiente.proyecto_nombre}\n🏷️ *Categoría:* ${facturaPendiente.categoria}\n\nTu administrador revisará la factura en la sección de Reembolsos.`
            );
          }

          await enviarBotonesWhatsApp(
            telefonoEmpleado,
            `¿Deseas realizar alguna otra gestión en Rendy?`,
            [
              { id: 'BTN_CONTINUAR_SI', title: 'Sí, otra gestión' },
              { id: 'BTN_CONTINUAR_NO', title: 'No, finalizar' },
            ]
          );
          return NextResponse.json({ status: 'gasto_completado' }, { status: 200 });
        }

        if (facturaPendiente) {
          const datosActualizados = await aplicarCorreccionConIA(facturaPendiente, texto);
          datosActualizados.proyecto_id = facturaPendiente.proyecto_id;
          datosActualizados.proyecto_nombre = facturaPendiente.proyecto_nombre;
          datosActualizados.categoria = facturaPendiente.categoria;
          datosActualizados.solicitud_id = facturaPendiente.solicitud_id;
          datosActualizados.tipo_flujo = facturaPendiente.tipo_flujo;
          datosActualizados.monto_aprobado = facturaPendiente.monto_aprobado;
          datosActualizados.monto_gastado_previo = facturaPendiente.monto_gastado_previo;
          datosActualizados.moneda_viatico = facturaPendiente.moneda_viatico;
          datosActualizados.empresa_id = facturaPendiente.empresa_id;
          datosActualizados.usuario_id = facturaPendiente.usuario_id;
          datosActualizados.url_comprobante = facturaPendiente.url_comprobante;
          datosActualizados.hash_comprobante = facturaPendiente.hash_comprobante;

          // Re-normalizar lógica fiscal tras corrección
          const fiscalActualizado = await normalizarGastoFiscal({
            nombre_comercio: datosActualizados.comercio || datosActualizados.nombre_comercio || '',
            rif_comercio: datosActualizados.tax_id || datosActualizados.rif_comercio || '',
            numero_factura: datosActualizados.invoice_number || datosActualizados.numero_factura || '',
            fecha_emision: datosActualizados.fecha || datosActualizados.fecha_emision || '',
            moneda: (datosActualizados.moneda?.toUpperCase() === 'USD' ? 'USD' : 'VES'),
            tasa_impresa: datosActualizados.tasa_impresa ?? null,
            base_imponible: Number(datosActualizados.base_imponible ?? datosActualizados.monto_total ?? 0),
            iva: Number(datosActualizados.iva || 0),
            exento: Number(datosActualizados.exento || 0),
            igtf: Number(datosActualizados.igtf || 0),
            total: Number(datosActualizados.monto_total || datosActualizados.total || 0),
          });

          datosActualizados.resultado_fiscal = fiscalActualizado;
          datosActualizados.tasa_cambio_fiscal = fiscalActualizado.tasa_cambio;

          const monedaViat = facturaPendiente.moneda_viatico || 'USD';
          datosActualizados.monto_convertido_viatico = monedaViat.toUpperCase() === 'USD' ? fiscalActualizado.monto_usd : fiscalActualizado.monto_ves;
          datosActualizados.tasa_aplicada = fiscalActualizado.tasa_cambio;

          datosActualizados.paso = 'CONFIRMACION';
          facturasPendientes.set(telefonoEmpleado, datosActualizados);

          const mensajeActualizado = formatearConfirmacionFiscalWhatsApp(
            {
              nombre_comercio: datosActualizados.comercio || datosActualizados.nombre_comercio,
              rif_comercio: datosActualizados.tax_id || datosActualizados.rif_comercio,
              numero_factura: datosActualizados.invoice_number || datosActualizados.numero_factura,
              fecha_emision: datosActualizados.fecha || datosActualizados.fecha_emision,
              moneda: (datosActualizados.moneda?.toUpperCase() === 'USD' ? 'USD' : 'VES'),
              tasa_impresa: datosActualizados.tasa_impresa ?? null,
              base_imponible: Number(datosActualizados.base_imponible ?? datosActualizados.monto_total ?? 0),
              iva: Number(datosActualizados.iva || 0),
              exento: Number(datosActualizados.exento || 0),
              igtf: Number(datosActualizados.igtf || 0),
              total: Number(datosActualizados.monto_total || datosActualizados.total || 0),
            },
            fiscalActualizado
          );

          await enviarBotonesWhatsApp(
            telefonoEmpleado,
            mensajeActualizado,
            [
              { id: 'BTN_CONFIRMAR_GASTO', title: '✅ Confirmar' },
              { id: 'BTN_VOLVER_MENU', title: '⬅️ Volver al Menú' },
            ]
          );
          return NextResponse.json({ status: 'gasto_corregido' }, { status: 200 });
        }

        if (!facturaPendiente && !solPendiente) {
          await enviarBotonesWhatsApp(
            telefonoEmpleado,
            `👋 *¡Hola, ${usuario.nombre || 'Empleado'}!* Bienvenido a *Rendy*.\n\n¿Qué deseas hacer hoy?`,
            [
              { id: 'BTN_SOLICITAR_VIATICOS', title: '📝 Pedir Viáticos' },
              { id: 'BTN_JUSTIFICAR_VIATICOS', title: '📄 Rendir Viáticos' },
              { id: 'BTN_SOLICITAR_REEMBOLSO', title: '💸 Pedir Reembolso' },
            ]
          );
          return NextResponse.json({ status: 'menu_enviado' }, { status: 200 });
        }
      }

      // 3. IMÁGENES Y DOCUMENTOS PDF
      else if (tipoMensaje === 'image' || tipoMensaje === 'document') {
        const facturaPendiente = facturasPendientes.get(telefonoEmpleado);

        if (!facturaPendiente || facturaPendiente.paso !== 'ESPERANDO_RECIBO') {
          await enviarBotonesWhatsApp(
            telefonoEmpleado,
            `⚠️ Por favor, selecciona primero si deseas *Rendir Viáticos* o *Pedir Reembolso*:`,
            [
              { id: 'BTN_JUSTIFICAR_VIATICOS', title: '📄 Rendir Viáticos' },
              { id: 'BTN_SOLICITAR_REEMBOLSO', title: '💸 Pedir Reembolso' },
              { id: 'BTN_VOLVER_MENU', title: '⬅️ Volver al Menú' },
            ]
          );
          return NextResponse.json({ status: 'flujo_no_seleccionado' }, { status: 200 });
        }

        const idAdjunto = tipoMensaje === 'image' ? message.image?.id : message.document?.id;

        // ─── Feedback inmediato: el usuario sabe que la foto fue recibida ───
        await enviarMensajeWhatsApp(
          telefonoEmpleado,
          '⏳ Estoy procesando tu factura, dame un momento por favor...'
        );

        const [resultado, urlComprobante] = await Promise.all([
          tipoMensaje === 'image' ? procesarFacturaConIA(idAdjunto) : procesarFacturaPDFConIA(idAdjunto),
          tipoMensaje === 'image' ? guardarImagenEnSupabase(idAdjunto) : guardarPDFEnSupabase(idAdjunto),
        ]);

        if (resultado && typeof resultado === 'object') {
          const rawExtraction = resultado as unknown as GeminiFiscalExtraction & Record<string, any>;

          // ─── Normalización de campos fiscales y compatibilidad legacy ───
          rawExtraction.comercio = rawExtraction.nombre_comercio || rawExtraction.comercio || 'No detectado';
          rawExtraction.tax_id = rawExtraction.rif_comercio || rawExtraction.tax_id || null;
          rawExtraction.invoice_number = rawExtraction.numero_factura || rawExtraction.invoice_number || null;
          rawExtraction.fecha = rawExtraction.fecha_emision || rawExtraction.fecha || new Date().toISOString().split('T')[0];
          rawExtraction.monto_total = rawExtraction.total ?? rawExtraction.monto_total ?? 0;
          rawExtraction.moneda = (rawExtraction.moneda?.toUpperCase() === 'USD' ? 'USD' : 'VES');

          // ─── Procesador Fiscal: Desglose y normalización bimonetaria (Sprint 2) ───
          const fiscalResult = await normalizarGastoFiscal({
            nombre_comercio: rawExtraction.comercio,
            rif_comercio: rawExtraction.tax_id || '',
            numero_factura: rawExtraction.invoice_number || '',
            fecha_emision: rawExtraction.fecha,
            moneda: rawExtraction.moneda as 'VES' | 'USD',
            tasa_impresa: rawExtraction.tasa_impresa ?? null,
            base_imponible: Number(rawExtraction.base_imponible || 0),
            iva: Number(rawExtraction.iva || 0),
            exento: Number(rawExtraction.exento || 0),
            igtf: Number(rawExtraction.igtf || 0),
            total: Number(rawExtraction.monto_total || 0),
          });

          rawExtraction.resultado_fiscal = fiscalResult;
          rawExtraction.tasa_cambio_fiscal = fiscalResult.tasa_cambio;

          rawExtraction.empresa_id = usuario.empresa_id;
          rawExtraction.usuario_id = usuario.id;
          rawExtraction.url_comprobante = urlComprobante;
          rawExtraction.tipo_flujo = facturaPendiente.tipo_flujo;
          rawExtraction.solicitud_id = facturaPendiente.solicitud_id || null;
          rawExtraction.proyecto_id = facturaPendiente.proyecto_id || null;
          rawExtraction.proyecto_nombre = facturaPendiente.proyecto_nombre || null;
          rawExtraction.monto_aprobado = facturaPendiente.monto_aprobado || 0;
          rawExtraction.monto_gastado_previo = facturaPendiente.monto_gastado_previo || 0;
          rawExtraction.moneda_viatico = facturaPendiente.moneda_viatico || 'USD';

          let hashArchivo: string | null = null;
          if (urlComprobante) {
            try {
              const resFile = await fetch(urlComprobante);
              const arrayBuf = await resFile.arrayBuffer();
              hashArchivo = calcularHashBuffer(Buffer.from(arrayBuf));
              rawExtraction.hash_comprobante = hashArchivo;
            } catch (e) {
              console.error('❌ Error hash:', e);
            }
          }

          // ─── ANTI-FRAUD: Fiscal duplicate detection (Sprint 2) ───
          const fiscalDupResult = await verifyInvoiceDuplicate(supabase, {
            employeeId: usuario.id,
            senderPhone: telefonoEmpleado,
            taxId: rawExtraction.tax_id,
            invoiceNumber: rawExtraction.invoice_number,
            totalAmount: rawExtraction.monto_total,
            merchantName: rawExtraction.comercio,
            currency: rawExtraction.moneda,
          });

          if (fiscalDupResult.isDuplicate) {
            facturasPendientes.delete(telefonoEmpleado);
            await enviarBotonesWhatsApp(
              telefonoEmpleado,
              fiscalDupResult.blockMessage!,
              [
                { id: 'BTN_SOLICITAR_VIATICOS', title: '📝 Pedir Viáticos' },
                { id: 'BTN_JUSTIFICAR_VIATICOS', title: '📄 Rendir Viáticos' },
                { id: 'BTN_VOLVER_MENU', title: '⬅️ Volver al Menú' },
              ]
            );
            return NextResponse.json({ status: 'duplicado_fiscal_bloqueado' }, { status: 200 });
          }

          // Adjuntar metadata fiscal de dedup al resultado pendiente para persistencia
          rawExtraction.hash_duplicado = fiscalDupResult.duplicateHash;

          // ─── Legacy duplicate detection (file hash + data match) ───
          const validacion = await verificarGastoDuplicado(
            usuario.empresa_id,
            rawExtraction.comercio,
            rawExtraction.monto_total,
            rawExtraction.fecha,
            hashArchivo
          );

          if (validacion.esHashDuplicado) {
            facturasPendientes.delete(telefonoEmpleado);
            await enviarBotonesWhatsApp(
              telefonoEmpleado,
              validacion.mensajeBloqueo!,
              [
                { id: 'BTN_SOLICITAR_VIATICOS', title: '📝 Pedir Viáticos' },
                { id: 'BTN_JUSTIFICAR_VIATICOS', title: '📄 Rendir Viáticos' },
                { id: 'BTN_VOLVER_MENU', title: '⬅️ Volver al Menú' },
              ]
            );
            return NextResponse.json({ status: 'duplicado_bloqueado' }, { status: 200 });
          }

          if (validacion.esDatosCoincidentes) {
            rawExtraction.requiere_revision_duplicado = true;
            await enviarMensajeWhatsApp(telefonoEmpleado, validacion.mensajeAlerta!);
          }

          // A. SI ES RENDICIÓN DE VIÁTICO: APLICAMOS DESGLOSE FISCAL Y CONFIRMACIÓN WHATSAPP
          if (facturaPendiente.tipo_flujo === 'JUSTIFICACION_VIATICO') {
            const monedaViatico = facturaPendiente.moneda_viatico || 'USD';
            const equivalente = monedaViatico.toUpperCase() === 'USD'
              ? fiscalResult.monto_usd
              : fiscalResult.monto_ves;

            rawExtraction.monto_convertido_viatico = equivalente;
            rawExtraction.tasa_aplicada = fiscalResult.tasa_cambio;
            rawExtraction.paso = 'CONFIRMACION';

            facturasPendientes.set(telefonoEmpleado, rawExtraction);

            const mensajeResumen = formatearConfirmacionFiscalWhatsApp(
              {
                nombre_comercio: rawExtraction.comercio,
                rif_comercio: rawExtraction.tax_id || '',
                numero_factura: rawExtraction.invoice_number || '',
                fecha_emision: rawExtraction.fecha,
                moneda: rawExtraction.moneda as 'VES' | 'USD',
                tasa_impresa: rawExtraction.tasa_impresa ?? null,
                base_imponible: Number(rawExtraction.base_imponible || 0),
                iva: Number(rawExtraction.iva || 0),
                exento: Number(rawExtraction.exento || 0),
                igtf: Number(rawExtraction.igtf || 0),
                total: Number(rawExtraction.monto_total || 0),
              },
              fiscalResult
            );

            await enviarBotonesWhatsApp(
              telefonoEmpleado,
              mensajeResumen,
              [
                { id: 'BTN_CONFIRMAR_GASTO', title: '✅ Confirmar' },
                { id: 'BTN_VOLVER_MENU', title: '⬅️ Volver al Menú' },
              ]
            );
            return NextResponse.json({ status: 'recibo_justificacion_procesado' }, { status: 200 });
          }

          else if (facturaPendiente.tipo_flujo === 'REEMBOLSO') {
            facturasPendientes.set(telefonoEmpleado, rawExtraction);

            const { data: proyectos } = await supabase
              .from('proyectos')
              .select('id, nombre')
              .eq('empresa_id', usuario.empresa_id)
              .eq('activo', true);

            if (proyectos && proyectos.length > 0) {
              const filasProyectos = proyectos.slice(0, 9).map((p) => ({
                id: `PROY_${p.id}`,
                title: p.nombre.substring(0, 24),
              }));

              await enviarListaWhatsApp(
                telefonoEmpleado,
                `📸 *¡Factura procesada!*\n\n🏢 *Comercio:* ${rawExtraction.comercio || 'No detectado'}\n💵 *Monto:* ${rawExtraction.monto_total || 0} ${rawExtraction.moneda || ''}\n📅 *Fecha:* ${rawExtraction.fecha || 'No detectada'}\n\n👇 *Selecciona el proyecto asignado para este reembolso:*`,
                'Ver Proyectos',
                '📁 Asignar Proyecto',
                [...filasProyectos, { id: 'VOLVER_MENU', title: '⬅️ Volver al Menú' }]
              );
              return NextResponse.json({ status: 'reembolso_proyecto_enviado' }, { status: 200 });
            }
          }
        }
      }
    }

    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (error) {
    console.error('❌ Error en el webhook:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}