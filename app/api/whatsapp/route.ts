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

const mensajesProcesados = new Set<string>();
const facturasPendientes = new Map<string, any>();
const solicitudesPendientes = new Map<string, any>();

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
      const tipoMensaje = message.type;

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

      // 0. MANEJO DE SELECCIÓN DE BOTONES
      if (tipoMensaje === 'interactive' && message.interactive?.type === 'button_reply') {
        const btnId = message.interactive?.button_reply?.id;

        if (btnId === 'BTN_REPORTAR_GASTO') {
          solicitudesPendientes.delete(telefonoEmpleado);
          await enviarMensajeWhatsApp(
            telefonoEmpleado,
            '📸 *Excelente.* Por favor envía la foto o el documento PDF de la factura/recibo que deseas registrar.'
          );
          return NextResponse.json({ status: 'esperando_recibo' }, { status: 200 });
        } 
        
        else if (btnId === 'BTN_SOLICITAR_VIATICOS') {
          facturasPendientes.delete(telefonoEmpleado);

          const { data: proyectos } = await supabase
            .from('proyectos')
            .select('id, nombre')
            .eq('empresa_id', usuario.empresa_id)
            .eq('activo', true);

          if (!proyectos || proyectos.length === 0) {
            await enviarMensajeWhatsApp(
              telefonoEmpleado,
              '⚠️ No hay proyectos activos configurados en tu empresa para asignar la solicitud de viáticos.'
            );
            return NextResponse.json({ status: 'sin_proyectos' }, { status: 200 });
          }

          solicitudesPendientes.set(telefonoEmpleado, {
            usuario_id: usuario.id,
            empresa_id: usuario.empresa_id,
            paso: 'PROYECTO',
          });

          const filasProyectos = proyectos.map((p) => ({
            id: `SOL_PROY_${p.id}`,
            title: p.nombre.substring(0, 24),
          }));

          await enviarListaWhatsApp(
            telefonoEmpleado,
            '📝 *Solicitud de Viáticos*\n\nSelecciona el proyecto al cual estarán destinados los fondos:',
            'Ver Proyectos',
            '📁 Asignar Proyecto',
            filasProyectos
          );
          return NextResponse.json({ status: 'solicitud_proyecto' }, { status: 200 });
        }

        // SELECCIÓN DE MONEDA
        else if (btnId === 'BTN_MONEDA_LOCAL' || btnId === 'BTN_MONEDA_USD') {
          const solPendiente = solicitudesPendientes.get(telefonoEmpleado);
          if (solPendiente && solPendiente.paso === 'MONEDA') {
            solPendiente.moneda = btnId === 'BTN_MONEDA_LOCAL' ? monedaEmpresa : 'USD';
            solPendiente.paso = 'FECHA';
            solicitudesPendientes.set(telefonoEmpleado, solPendiente);

            // Lista rápida de fechas
            const fechasRapidas = [
              { id: 'SOL_FECHA_HOY', title: 'Para HOY' },
              { id: 'SOL_FECHA_MANANA', title: 'Para MAÑANA' },
              { id: 'SOL_FECHA_3DIAS', title: 'En 3 días' },
              { id: 'SOL_FECHA_1SEMANA', title: 'En 1 semana' },
            ];

            await enviarListaWhatsApp(
              telefonoEmpleado,
              `✅ Moneda: *${solPendiente.moneda}*\n\n¿Para qué fecha requieres los fondos? Selecciona una opción o escribe la fecha en texto (AAAA-MM-DD):`,
              'Ver Fechas',
              '📅 Fecha Requerida',
              fechasRapidas
            );
            return NextResponse.json({ status: 'solicitud_fecha' }, { status: 200 });
          }
        }

        // RESPUESTAS DE CIERRE
        else if (btnId === 'BTN_CONTINUAR_SI') {
          await enviarBotonesWhatsApp(
            telefonoEmpleado,
            `👍 ¡Claro! ¿Qué otra gestión deseas realizar?`,
            [
              { id: 'BTN_REPORTAR_GASTO', title: '📸 Reportar Gasto' },
              { id: 'BTN_SOLICITAR_VIATICOS', title: '📝 Solicitar Viáticos' },
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
      }

      // 1. MANEJO DE MENSAJES INTERACTIVOS DE LISTAS
      if (tipoMensaje === 'interactive' && message.interactive?.type === 'list_reply') {
        const respuestaLista = message.interactive?.list_reply;
        const idSeleccionado = respuestaLista?.id;
        const tituloSeleccionado = respuestaLista?.title;

        // A. FLUJO DE SOLICITUD DE VIÁTICOS
        const solPendiente = solicitudesPendientes.get(telefonoEmpleado);
        if (solPendiente && idSeleccionado.startsWith('SOL_')) {
          if (idSeleccionado.startsWith('SOL_PROY_')) {
            solPendiente.proyecto_id = idSeleccionado.replace('SOL_PROY_', '');
            solPendiente.proyecto_nombre = tituloSeleccionado;
            solPendiente.paso = 'MONTO';
            solicitudesPendientes.set(telefonoEmpleado, solPendiente);

            await enviarMensajeWhatsApp(
              telefonoEmpleado,
              `✅ Proyecto: *${tituloSeleccionado}*\n\nIndica el *monto solicitado* (Ej: 150.00):`
            );
            return NextResponse.json({ status: 'solicitud_monto' }, { status: 200 });
          }

          // Selección rápida de Fecha
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
Responde *SI* para confirmar o envía *CANCELAR* para descartar.`;

            await enviarMensajeWhatsApp(telefonoEmpleado, mensajeResumen);
            return NextResponse.json({ status: 'solicitud_resumen' }, { status: 200 });
          }
        }

        // B. FLUJO DE REGISTRO DE GASTO
        const facturaPendiente = facturasPendientes.get(telefonoEmpleado);
        if (facturaPendiente) {
          if (idSeleccionado.startsWith('PROY_')) {
            const proyectoId = idSeleccionado.replace('PROY_', '');
            facturaPendiente.proyecto_id = proyectoId;
            facturaPendiente.proyecto_nombre = tituloSeleccionado;
            facturasPendientes.set(telefonoEmpleado, facturaPendiente);

            await enviarListaWhatsApp(
              telefonoEmpleado,
              `✅ Proyecto seleccionado: *${tituloSeleccionado}*\n\nAhora selecciona la categoría de este gasto:`,
              'Ver Categorías',
              '🏷️ Categoría de Gasto',
              CATEGORIAS_GASTO
            );
            return NextResponse.json({ status: 'categoria_enviada' }, { status: 200 });
          } 
          
          else if (idSeleccionado.startsWith('CAT_')) {
            const categoriaNombre = idSeleccionado.replace('CAT_', '');
            facturaPendiente.categoria = categoriaNombre;
            facturasPendientes.set(telefonoEmpleado, facturaPendiente);

            const { data: metodos } = await supabase
              .from('metodos_pago')
              .select('id, nombre')
              .eq('empresa_id', facturaPendiente.empresa_id);

            const filasMetodos: { id: string; title: string }[] = [
              { id: 'MET_FONDOS_PERSONALES', title: 'Fondos Personales' },
            ];

            if (metodos && metodos.length > 0) {
              metodos.forEach((m) => {
                filasMetodos.push({
                  id: `MET_${m.id}`,
                  title: m.nombre.substring(0, 24),
                });
              });
            }

            await enviarListaWhatsApp(
              telefonoEmpleado,
              `✅ Categoría seleccionada: *${categoriaNombre}*\n\nPor último, indica con qué método de pago realizaste este gasto:`,
              'Ver Métodos',
              '💳 Método de Pago',
              filasMetodos
            );
            return NextResponse.json({ status: 'metodos_enviados' }, { status: 200 });
          } 
          
          else if (idSeleccionado.startsWith('MET_')) {
            if (idSeleccionado === 'MET_FONDOS_PERSONALES') {
              facturaPendiente.metodo_pago_id = null;
              facturaPendiente.metodo_pago_nombre = 'Fondos Personales (Reembolso)';
              facturaPendiente.es_reembolso = true;
            } else {
              const metodoId = idSeleccionado.replace('MET_', '');
              facturaPendiente.metodo_pago_id = metodoId;
              facturaPendiente.metodo_pago_nombre = tituloSeleccionado;
              facturaPendiente.es_reembolso = false;
            }
            facturaPendiente.paso = 'CONFIRMACION';
            facturasPendientes.set(telefonoEmpleado, facturaPendiente);

            const mensajeResumen = 
`📌 *Resumen del Gasto a Registrar:*

🏢 *Comercio:* ${facturaPendiente.comercio || 'No detectado'}
💵 *Monto:* ${facturaPendiente.monto_total || 0} ${facturaPendiente.moneda || ''}
📅 *Fecha:* ${facturaPendiente.fecha || 'No detectada'}
🛒 *Concepto:* ${facturaPendiente.concepto || 'Sin detalle'}
📁 *Proyecto:* ${facturaPendiente.proyecto_nombre || 'No asignado'}
🏷️ *Categoría:* ${facturaPendiente.categoria || 'Sin categoría'}
💳 *Método de Pago:* ${facturaPendiente.metodo_pago_nombre || 'No asignado'}

_¿Los datos son correctos?_
Responde *SI* para guardar o envía un texto/audio si deseas corregir algo.`;

            await enviarMensajeWhatsApp(telefonoEmpleado, mensajeResumen);
            return NextResponse.json({ status: 'resumen_enviado' }, { status: 200 });
          }
        }
      }

      // 2. MANEJO DE MENSAJES DE TEXTO
      else if (tipoMensaje === 'text' && message.text?.body) {
        const texto = message.text.body.trim();
        const solPendiente = solicitudesPendientes.get(telefonoEmpleado);
        const facturaPendiente = facturasPendientes.get(telefonoEmpleado);

        if (texto.toUpperCase() === 'CANCELAR') {
          solicitudesPendientes.delete(telefonoEmpleado);
          facturasPendientes.delete(telefonoEmpleado);
          await enviarMensajeWhatsApp(telefonoEmpleado, '🛑 Operación cancelada correctamente.');
          return NextResponse.json({ status: 'cancelado' }, { status: 200 });
        }

        // MONTO DE SOLICITUD
        if (solPendiente && solPendiente.paso === 'MONTO') {
          const montoNum = parseFloat(texto.replace(',', '.'));
          if (isNaN(montoNum) || montoNum <= 0) {
            await enviarMensajeWhatsApp(
              telefonoEmpleado,
              '⚠️ Por favor ingresa un monto numérico válido (Ej: 150.00).'
            );
            return NextResponse.json({ status: 'monto_invalido' }, { status: 200 });
          }

          solPendiente.monto_solicitado = montoNum;
          solPendiente.paso = 'MONEDA';
          solicitudesPendientes.set(telefonoEmpleado, solPendiente);

          const simboloMoneda = monedaEmpresa === 'VES' ? 'VES (Bs)' : monedaEmpresa;

          await enviarBotonesWhatsApp(
            telefonoEmpleado,
            `✅ Monto ingresado: *${montoNum}*\n\n¿En qué moneda requieres esta solicitud de viáticos?`,
            [
              { id: 'BTN_MONEDA_LOCAL', title: `Local (${simboloMoneda})`.substring(0, 20) },
              { id: 'BTN_MONEDA_USD', title: 'Dólares (USD)' },
            ]
          );
          return NextResponse.json({ status: 'solicitud_moneda' }, { status: 200 });
        }

        // FECHA MANUAL DE SOLICITUD
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

        // CONFIRMACION SOLICITUD
        if (solPendiente && solPendiente.paso === 'CONFIRMACION' && (texto.toUpperCase() === 'SI' || texto.toUpperCase() === 'SÍ')) {
          const fechaHoy = new Date().toISOString().split('T')[0];

          const { error } = await supabase.from('solicitudes_viaticos').insert({
            usuario_id: solPendiente.usuario_id,
            empresa_id: solPendiente.empresa_id,
            proyecto_id: solPendiente.proyecto_id || null,
            monto_solicitado: solPendiente.monto_solicitado,
            moneda: solPendiente.moneda || 'USD',
            monto_asignado: 0,
            monto_gastado: 0,
            fecha_inicio: fechaHoy,
            fecha_fin: solPendiente.fecha_requerida || fechaHoy,
            fecha_requerida: solPendiente.fecha_requerida || fechaHoy,
            titulo_viaje: `Solicitud Viáticos - ${solPendiente.proyecto_nombre || 'General'}`,
            estado: 'PENDIENTE',
          });

          if (error) {
            console.error('❌ Error guardando solicitud de viáticos:', error);
            await enviarMensajeWhatsApp(telefonoEmpleado, '❌ Ocurrió un error al registrar la solicitud.');
          } else {
            solicitudesPendientes.delete(telefonoEmpleado);
            await enviarMensajeWhatsApp(
              telefonoEmpleado,
              `🎉 *¡Solicitud de Viáticos Enviada!*\n\n📁 *Proyecto:* ${solPendiente.proyecto_nombre}\n💵 *Monto:* ${solPendiente.monto_solicitado} ${solPendiente.moneda}\n📅 *Requerido:* ${solPendiente.fecha_requerida}\n\nTu administrador revisará la solicitud en el panel web.`
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

        // CONFIRMACION GASTO
        if (facturaPendiente && facturaPendiente.paso === 'CONFIRMACION' && (texto.toUpperCase() === 'SI' || texto.toUpperCase() === 'SÍ')) {
          const estadoGasto = facturaPendiente.requiere_revision_duplicado 
            ? 'REVISION_DUPLICADO' 
            : 'PENDIENTE';

          const { error } = await supabase.from('gastos').insert({
            usuario_id: facturaPendiente.usuario_id || null,
            empresa_id: facturaPendiente.empresa_id || null,
            proyecto_id: facturaPendiente.proyecto_id || null,
            metodo_pago_id: facturaPendiente.metodo_pago_id || null,
            categoria: facturaPendiente.categoria || 'Otros',
            monto: facturaPendiente.monto_total || 0,
            moneda: facturaPendiente.moneda || 'USD',
            comercio: facturaPendiente.comercio,
            fecha_gasto: facturaPendiente.fecha || new Date().toISOString().split('T')[0],
            concepto: facturaPendiente.concepto,
            url_comprobante: facturaPendiente.url_comprobante || null,
            hash_comprobante: facturaPendiente.hash_comprobante || null,
            datos_ocr: facturaPendiente,
            estado: estadoGasto,
          });

          if (error) {
            console.error('❌ Error guardando en Supabase:', error);
            await enviarMensajeWhatsApp(telefonoEmpleado, '❌ Error guardando el gasto.');
            return NextResponse.json({ status: 'error_supabase' }, { status: 200 });
          }

          facturasPendientes.delete(telefonoEmpleado);

          const notaEstado = facturaPendiente.requiere_revision_duplicado 
            ? '\n\n⚠️ *Nota:* Guardado en estado *EN REVISIÓN* para validación del administrador.'
            : '';

          const mensajeConfirmacionCompleto = 
`🎉 *¡Gasto registrado con éxito!*

🏢 *Comercio:* ${facturaPendiente.comercio || 'No especificado'}
💵 *Monto:* ${facturaPendiente.monto_total || 0} ${facturaPendiente.moneda || ''}
📅 *Fecha:* ${facturaPendiente.fecha || 'No especificada'}
🛒 *Concepto:* ${facturaPendiente.concepto || 'Sin detalle'}
📁 *Proyecto:* ${facturaPendiente.proyecto_nombre || 'General'}
🏷️ *Categoría:* ${facturaPendiente.categoria || 'Sin categoría'}
💳 *Método:* ${facturaPendiente.metodo_pago_nombre || 'Efectivo'}${notaEstado}

_Almacenado correctamente junto con su comprobante._`;

          await enviarMensajeWhatsApp(telefonoEmpleado, mensajeConfirmacionCompleto);

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

        // CORRECCION GASTO
        if (facturaPendiente) {
          const datosActualizados = await aplicarCorreccionConIA(facturaPendiente, texto);
          datosActualizados.proyecto_id = facturaPendiente.proyecto_id;
          datosActualizados.proyecto_nombre = facturaPendiente.proyecto_nombre;
          datosActualizados.categoria = facturaPendiente.categoria;
          datosActualizados.metodo_pago_id = facturaPendiente.metodo_pago_id;
          datosActualizados.metodo_pago_nombre = facturaPendiente.metodo_pago_nombre;
          datosActualizados.empresa_id = facturaPendiente.empresa_id;
          datosActualizados.usuario_id = facturaPendiente.usuario_id;
          datosActualizados.url_comprobante = facturaPendiente.url_comprobante;
          datosActualizados.hash_comprobante = facturaPendiente.hash_comprobante;
          datosActualizados.paso = 'CONFIRMACION';

          facturasPendientes.set(telefonoEmpleado, datosActualizados);

          const mensajeActualizado = 
`📌 *Resumen del Gasto Actualizado:*

🏢 *Comercio:* ${datosActualizados.comercio || 'No detectado'}
💵 *Monto:* ${datosActualizados.monto_total || 0} ${datosActualizados.moneda || ''}
📅 *Fecha:* ${datosActualizados.fecha || 'No detectada'}
🛒 *Concepto:* ${datosActualizados.concepto || 'Sin detalle'}
📁 *Proyecto:* ${datosActualizados.proyecto_nombre || 'No asignado'}
🏷️ *Categoría:* ${datosActualizados.categoria || 'Sin categoría'}
💳 *Método de Pago:* ${datosActualizados.metodo_pago_nombre || 'No asignado'}

_¿Los datos están correctos ahora?_
Responde *SI* para guardar o envía un texto/audio si deseas corregir algo más.`;

          await enviarMensajeWhatsApp(telefonoEmpleado, mensajeActualizado);
          return NextResponse.json({ status: 'gasto_corregido' }, { status: 200 });
        }

        // SALUDO
        if (!facturaPendiente && !solPendiente) {
          await enviarBotonesWhatsApp(
            telefonoEmpleado,
            `👋 *¡Hola, ${usuario.nombre || 'Empleado'}!* Bienvenido a *Rendy*.\n\n¿Qué te gustaría hacer hoy?`,
            [
              { id: 'BTN_REPORTAR_GASTO', title: '📸 Reportar Gasto' },
              { id: 'BTN_SOLICITAR_VIATICOS', title: '📝 Solicitar Viáticos' },
            ]
          );
          return NextResponse.json({ status: 'menu_enviado' }, { status: 200 });
        }
      }

      // 3. NOTAS DE VOZ
      else if (tipoMensaje === 'audio' || tipoMensaje === 'voice') {
        const facturaPendiente = facturasPendientes.get(telefonoEmpleado);
        if (facturaPendiente) {
          const idAudio = message.audio?.id || message.voice?.id;
          const datosActualizados = await aplicarCorreccionAudioConIA(facturaPendiente, idAudio);

          datosActualizados.proyecto_id = facturaPendiente.proyecto_id;
          datosActualizados.proyecto_nombre = facturaPendiente.proyecto_nombre;
          datosActualizados.categoria = facturaPendiente.categoria;
          datosActualizados.metodo_pago_id = facturaPendiente.metodo_pago_id;
          datosActualizados.metodo_pago_nombre = facturaPendiente.metodo_pago_nombre;
          datosActualizados.empresa_id = facturaPendiente.empresa_id;
          datosActualizados.usuario_id = facturaPendiente.usuario_id;
          datosActualizados.url_comprobante = facturaPendiente.url_comprobante;
          datosActualizados.paso = 'CONFIRMACION';

          facturasPendientes.set(telefonoEmpleado, datosActualizados);

          const mensajeActualizado = 
`🎙️ *Resumen del Gasto Actualizado por Voz:*

🏢 *Comercio:* ${datosActualizados.comercio || 'No detectado'}
💵 *Monto:* ${datosActualizados.monto_total || 0} ${datosActualizados.moneda || ''}
📅 *Fecha:* ${datosActualizados.fecha || 'No detectada'}
🛒 *Concepto:* ${datosActualizados.concepto || 'Sin detalle'}
📁 *Proyecto:* ${datosActualizados.proyecto_nombre || 'No asignado'}
🏷️ *Categoría:* ${datosActualizados.categoria || 'Sin categoría'}
💳 *Método de Pago:* ${datosActualizados.metodo_pago_nombre || 'No asignado'}

_¿Los datos están correctos ahora?_
Responde *SI* para guardar o indícame otra corrección.`;

          await enviarMensajeWhatsApp(telefonoEmpleado, mensajeActualizado);
        }
      }

      // 4. IMÁGENES
      else if (tipoMensaje === 'image') {
        solicitudesPendientes.delete(telefonoEmpleado);

        const idImagen = message.image?.id;
        const [resultado, urlComprobante] = await Promise.all([
          procesarFacturaConIA(idImagen),
          guardarImagenEnSupabase(idImagen),
        ]);

        if (resultado && typeof resultado === 'object') {
          resultado.empresa_id = usuario.empresa_id;
          resultado.usuario_id = usuario.id;
          resultado.url_comprobante = urlComprobante;

          let hashArchivo: string | null = null;
          if (urlComprobante) {
            try {
              const resFile = await fetch(urlComprobante);
              const arrayBuf = await resFile.arrayBuffer();
              hashArchivo = calcularHashBuffer(Buffer.from(arrayBuf));
              resultado.hash_comprobante = hashArchivo;
            } catch (e) {
              console.error('❌ Error hash imagen:', e);
            }
          }

          const validacion = await verificarGastoDuplicado(
            usuario.empresa_id,
            resultado.comercio,
            resultado.monto_total,
            resultado.fecha,
            hashArchivo
          );

          if (validacion.esHashDuplicado) {
            await enviarMensajeWhatsApp(telefonoEmpleado, validacion.mensajeBloqueo!);
            return NextResponse.json({ status: 'duplicado_bloqueado' }, { status: 200 });
          }

          if (validacion.esDatosCoincidentes) {
            resultado.requiere_revision_duplicado = true;
            await enviarMensajeWhatsApp(telefonoEmpleado, validacion.mensajeAlerta!);
          }

          facturasPendientes.set(telefonoEmpleado, resultado);

          const { data: proyectos } = await supabase
            .from('proyectos')
            .select('id, nombre')
            .eq('empresa_id', usuario.empresa_id)
            .eq('activo', true);

          if (proyectos && proyectos.length > 0) {
            const filasProyectos = proyectos.map((p) => ({
              id: `PROY_${p.id}`,
              title: p.nombre.substring(0, 24),
            }));

            await enviarListaWhatsApp(
              telefonoEmpleado,
              `📸 *¡Factura procesada!*\n\n🏢 *Comercio:* ${resultado.comercio || 'No detectado'}\n💵 *Monto:* ${resultado.monto_total || 0} ${resultado.moneda || ''}\n📅 *Fecha:* ${resultado.fecha || 'No detectada'}\n\n👇 *Selecciona el proyecto al que pertenece este gasto:*`,
              'Ver Proyectos',
              '📁 Asignar Proyecto',
              filasProyectos
            );
          }
        }
      }

      // 5. DOCUMENTOS PDF
      else if (tipoMensaje === 'document') {
        solicitudesPendientes.delete(telefonoEmpleado);

        const idDocumento = message.document?.id;
        const [resultado, urlComprobante] = await Promise.all([
          procesarFacturaPDFConIA(idDocumento),
          guardarPDFEnSupabase(idDocumento),
        ]);

        if (resultado && typeof resultado === 'object') {
          resultado.empresa_id = usuario.empresa_id;
          resultado.usuario_id = usuario.id;
          resultado.url_comprobante = urlComprobante;

          let hashArchivo: string | null = null;
          if (urlComprobante) {
            try {
              const resFile = await fetch(urlComprobante);
              const arrayBuf = await resFile.arrayBuffer();
              hashArchivo = calcularHashBuffer(Buffer.from(arrayBuf));
              resultado.hash_comprobante = hashArchivo;
            } catch (e) {
              console.error('❌ Error hash PDF:', e);
            }
          }

          const validacion = await verificarGastoDuplicado(
            usuario.empresa_id,
            resultado.comercio,
            resultado.monto_total,
            resultado.fecha,
            hashArchivo
          );

          if (validacion.esHashDuplicado) {
            await enviarMensajeWhatsApp(telefonoEmpleado, validacion.mensajeBloqueo!);
            return NextResponse.json({ status: 'duplicado_bloqueado' }, { status: 200 });
          }

          if (validacion.esDatosCoincidentes) {
            resultado.requiere_revision_duplicado = true;
            await enviarMensajeWhatsApp(telefonoEmpleado, validacion.mensajeAlerta!);
          }

          facturasPendientes.set(telefonoEmpleado, resultado);

          const { data: proyectos } = await supabase
            .from('proyectos')
            .select('id, nombre')
            .eq('empresa_id', usuario.empresa_id)
            .eq('activo', true);

          if (proyectos && proyectos.length > 0) {
            const filasProyectos = proyectos.map((p) => ({
              id: `PROY_${p.id}`,
              title: p.nombre.substring(0, 24),
            }));

            await enviarListaWhatsApp(
              telefonoEmpleado,
              `📄 *¡Documento PDF procesado!*\n\n🏢 *Comercio:* ${resultado.comercio || 'No detectado'}\n💵 *Monto:* ${resultado.monto_total || 0} ${resultado.moneda || ''}\n📅 *Fecha:* ${resultado.fecha || 'No detectada'}\n\n👇 *Selecciona el proyecto al que pertenece este gasto:*`,
              'Ver Proyectos',
              '📁 Asignar Proyecto',
              filasProyectos
            );
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