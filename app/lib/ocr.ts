import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '@/app/lib/supabase';
import { createHash } from 'crypto';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Descarga la imagen desde Meta y la convierte a Base64
async function obtenerImagenMetaBuffer(imageId: string) {
  const token = process.env.WHATSAPP_API_TOKEN;

  const res = await fetch(`https://graph.facebook.com/v20.0/${imageId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();

  if (!data || !data.url) {
    console.error('❌ Error obteniendo URL de la imagen desde Meta:', data);
    throw new Error('No se pudo obtener la URL de la imagen.');
  }

  const imageRes = await fetch(data.url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const arrayBuffer = await imageRes.arrayBuffer();
  const base64Data = Buffer.from(arrayBuffer).toString('base64');

  return {
    inlineData: {
      data: base64Data,
      mimeType: data.mime_type || 'image/jpeg',
    },
  };
}

// Procesa una imagen de factura con Gemini AI
export async function procesarFacturaConIA(imageId: string) {
  try {
    const imagenPart = await obtenerImagenMetaBuffer(imageId);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash-lite' });

    const prompt = `Analiza esta factura o recibo de gasto. 
Extrae la información y responde ÚNICAMENTE con un objeto JSON válido (sin formato markdown ni texto adicional) con esta estructura exacta:
{
  "comercio": "Nombre del negocio o tienda",
  "monto_total": 0.00,
  "moneda": "USD, EUR, VES, etc.",
  "fecha": "YYYY-MM-DD",
  "concepto": "Descripción breve del gasto"
}
Si no logras identificar algún campo, asígnale el valor null.`;

    const result = await model.generateContent([prompt, imagenPart]);
    const responseText = result.response.text();

    const jsonLimpio = responseText.replace(/```json|```/g, '').trim();
    return JSON.parse(jsonLimpio);
  } catch (error: any) {
    console.error('❌ Error al procesar factura con Gemini AI:', error);

    if (
      error?.status === 503 ||
      error?.message?.includes('503') ||
      error?.message?.includes('high demand')
    ) {
      return 'ERROR_SATURACION';
    }

    return null;
  }
}

// Aplica correcciones sobre los datos mediante un mensaje de texto
export async function aplicarCorreccionConIA(datosPrevios: any, textoUsuario: string) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash-lite' });

    const prompt = `Tienes el siguiente JSON de un gasto detectado previamente:
${JSON.stringify(datosPrevios, null, 2)}

El usuario ha enviado el siguiente mensaje pidiendo una corrección o confirmación:
"${textoUsuario}"

Analiza el mensaje y devuelve ÚNICAMENTE un objeto JSON válido actualizado con los cambios aplicados. 
Si el usuario modificó el monto, el comercio, la moneda, la fecha o el concepto, actualízalo. Conserva los campos que no hayan sido modificados.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const jsonLimpio = responseText.replace(/```json|```/g, '').trim();

    return JSON.parse(jsonLimpio);
  } catch (error) {
    console.error('❌ Error al aplicar corrección con IA:', error);
    return datosPrevios;
  }
}

// Descarga el archivo de audio desde Meta y lo convierte a Base64
async function obtenerAudioMetaBuffer(audioId: string) {
  const token = process.env.WHATSAPP_API_TOKEN;

  const res = await fetch(`https://graph.facebook.com/v20.0/${audioId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();

  if (!data || !data.url) {
    throw new Error('No se pudo obtener la URL del audio desde Meta.');
  }

  const audioRes = await fetch(data.url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const arrayBuffer = await audioRes.arrayBuffer();
  const base64Data = Buffer.from(arrayBuffer).toString('base64');

  return {
    inlineData: {
      data: base64Data,
      mimeType: data.mime_type || 'audio/ogg',
    },
  };
}

// Procesa una nota de voz para extraer instrucciones y aplicar correcciones
export async function aplicarCorreccionAudioConIA(datosPrevios: any, audioId: string) {
  try {
    const audioPart = await obtenerAudioMetaBuffer(audioId);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash-lite' });

    const prompt = `Escucha esta nota de voz. El usuario está pidiendo una corrección o actualización sobre los siguientes datos de un gasto:
${JSON.stringify(datosPrevios, null, 2)}

Analiza lo que dice la nota de voz y devuelve ÚNICAMENTE un objeto JSON válido actualizado con los cambios solicitados.
Conserva los campos que no hayan sido mencionados o modificados.`;

    const result = await model.generateContent([prompt, audioPart]);
    const responseText = result.response.text();
    const jsonLimpio = responseText.replace(/```json|```/g, '').trim();

    return JSON.parse(jsonLimpio);
  } catch (error) {
    console.error('❌ Error al procesar audio con Gemini AI:', error);
    return datosPrevios;
  }
}

// Descarga la imagen de WhatsApp y la sube a Supabase Storage
export async function guardarImagenEnSupabase(idImagen: string): Promise<string | null> {
  try {
    const token = process.env.WHATSAPP_API_TOKEN;

    const res = await fetch(`https://graph.facebook.com/v20.0/${idImagen}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (!data || !data.url) {
      console.error('❌ No se pudo obtener la URL de la imagen de Meta');
      return null;
    }

    const imageRes = await fetch(data.url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const arrayBuffer = await imageRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const mimeType = data.mime_type || 'image/jpeg';
    const extension = mimeType.split('/')[1] || 'jpg';
    const fileName = `recibo_${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('comprobantes')
      .upload(fileName, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      console.error('❌ Error subiendo imagen a Supabase Storage:', uploadError);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('comprobantes')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    console.error('❌ Error en guardarImagenEnSupabase:', error);
    return null;
  }
}

// --- FUNCIONES PARA SOPORTE DE ARCHIVOS PDF ---

// Descarga y procesa un archivo PDF con Gemini AI
export async function procesarFacturaPDFConIA(idDocumento: string) {
  try {
    const token = process.env.WHATSAPP_API_TOKEN;

    const resUrl = await fetch(`https://graph.facebook.com/v20.0/${idDocumento}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const dataUrl = await resUrl.json();

    if (!dataUrl || !dataUrl.url) {
      console.error('❌ No se obtuvo la URL del PDF desde Meta');
      return null;
    }

    const pdfRes = await fetch(dataUrl.url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const arrayBuffer = await pdfRes.arrayBuffer();
    const base64PDF = Buffer.from(arrayBuffer).toString('base64');

    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash-lite' });

    const prompt = `Analiza este documento PDF de factura o recibo de gasto. 
Extrae la información y responde ÚNICAMENTE con un objeto JSON válido (sin formato markdown ni texto adicional) con esta estructura exacta:
{
  "comercio": "Nombre del negocio o tienda",
  "monto_total": 0.00,
  "moneda": "USD, EUR, VES, etc.",
  "fecha": "YYYY-MM-DD",
  "concepto": "Descripción breve del gasto"
}
Si no logras identificar algún campo, asígnale el valor null.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64PDF,
          mimeType: 'application/pdf',
        },
      },
    ]);

    const responseText = result.response.text().trim();
    const jsonLimpio = responseText.replace(/```json|```/g, '').trim();
    return JSON.parse(jsonLimpio);
  } catch (error: any) {
    console.error('❌ Error procesando PDF con Gemini AI:', error);
    if (
      error?.status === 503 ||
      error?.message?.includes('503') ||
      error?.message?.includes('high demand')
    ) {
      return 'ERROR_SATURACION';
    }
    return null;
  }
}

// Descarga un archivo PDF de WhatsApp y lo sube a Supabase Storage
export async function guardarPDFEnSupabase(idDocumento: string): Promise<string | null> {
  try {
    const token = process.env.WHATSAPP_API_TOKEN;

    const res = await fetch(`https://graph.facebook.com/v20.0/${idDocumento}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (!data || !data.url) return null;

    const pdfRes = await fetch(data.url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const arrayBuffer = await pdfRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fileName = `recibo_${Date.now()}_${Math.random().toString(36).substring(7)}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('comprobantes')
      .upload(fileName, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('❌ Error subiendo PDF a Supabase Storage:', uploadError);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('comprobantes')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    console.error('❌ Error guardando PDF en Supabase:', error);
    return null;
  }
}

// Función auxiliar para generar Hash SHA-256 de un Buffer
export function calcularHashBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

// Verifica el nivel de duplicidad (1. Hash idéntico o 2. Datos coincidentes)
export async function verificarGastoDuplicado(
  empresaId: string,
  comercio: string | null,
  monto: number | null,
  fecha: string | null,
  hashArchivo?: string | null
): Promise<{ 
  esHashDuplicado: boolean; 
  esDatosCoincidentes: boolean; 
  mensajeBloqueo?: string;
  mensajeAlerta?: string;
}> {
  if (!empresaId) return { esHashDuplicado: false, esDatosCoincidentes: false };

  try {
    // 1. NIVEL 1: Verificación por Hash exacto del archivo
    if (hashArchivo) {
      const { data: coincidenciaHash } = await supabase
        .from('gastos')
        .select('id')
        .eq('empresa_id', empresaId)
        .eq('hash_comprobante', hashArchivo);

      if (coincidenciaHash && coincidenciaHash.length > 0) {
        return {
          esHashDuplicado: true,
          esDatosCoincidentes: false,
          mensajeBloqueo: `⛔ *REGISTRO BLOQUEADO POR ARCHIVO DUPLICADO*\n\nEsta foto o documento es exactamente idéntico a un comprobante que ya existe en el sistema.\n\nNo es posible subir la misma foto dos veces.`,
        };
      }
    }

    // 2. NIVEL 2: Verificación por coincidencia de datos (Monto + Fecha + Comercio)
    if (monto && fecha) {
      let query = supabase
        .from('gastos')
        .select('id')
        .eq('empresa_id', empresaId)
        .eq('monto', monto)
        .eq('fecha_gasto', fecha);

      if (comercio) {
        query = query.ilike('comercio', `%${comercio.trim()}%`);
      }

      const { data: coincidenciaDatos } = await query;

      if (coincidenciaDatos && coincidenciaDatos.length > 0) {
        return {
          esHashDuplicado: false,
          esDatosCoincidentes: true,
          mensajeAlerta: `⚠️ *POSIBLE COINCIDENCIA DE FACTURA*\n\nYa existe un gasto registrado con el mismo comercio (*${comercio || 'No detectado'}*), monto (*${monto}*) y fecha (*${fecha}*).\n\n_Puedes continuar con la asignación, pero el gasto se guardará bajo estado 'EN REVISIÓN' para verificación del administrador._`,
        };
      }
    }

    return { esHashDuplicado: false, esDatosCoincidentes: false };
  } catch (err) {
    console.error('❌ Error en verificarGastoDuplicado:', err);
    return { esHashDuplicado: false, esDatosCoincidentes: false };
  }
}