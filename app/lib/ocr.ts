import { GoogleGenerativeAI, SchemaType, type ResponseSchema } from '@google/generative-ai';
import { supabase } from '@/app/lib/supabase';
import { createHash } from 'crypto';
import type { GeminiFiscalExtraction } from '@/lib/services/procesadorFiscal';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/* ─────────────────────────────────────────────────────────
 * GEMINI FISCAL EXTRACTION CONFIGURATION
 * ───────────────────────────────────────────────────────── */

/**
 * @name FISCAL_SYSTEM_PROMPT
 * @description [AI Configuration]: System instruction for Gemini to act as a Venezuelan
 * fiscal auditor specialized in reading SENIAT fiscal tickets, invoices, and delivery notes.
 * This prompt ensures precise extraction of all four tax components required by Venezuelan law.
 */
const FISCAL_SYSTEM_PROMPT = `Eres un auditor contable y fiscal internacional de élite especializado en lectura y extracción contable de facturas, recibos, comprobantes y tickets de máquinas fiscales (SENIAT Venezuela, SAT México, DIAN Colombia, tickets internacionales en USD/EUR, etc.).

Tu tarea es analizar el comprobante adjunto y extraer la información financiera con precisión matemática absoluta.

REGLAS DE EXTRACCIÓN FISCAL:
1. RIF / Tax ID: Extrae el identificador fiscal del emisor (RIF venezolano iniciando con J/V/E/G, RFC mexicano, NIT colombiano, NIF/CIF o número de identificación fiscal correspondiente).
2. Base Imponible: Subtotal de los productos o servicios gravados antes de impuestos. Si no hay items gravados o el desglose no especifica base, usa el subtotal antes de impuestos. Si no aplica, es 0.00.
3. IVA: Impuesto al valor agregado o impuesto local (IVA 16% en Venezuela/México, 19% Colombia, etc.).
4. Exento: Bienes o servicios marcados explícitamente con (E), tasa 0%, no sujetos o exentos de impuestos.
5. IGTF (3%): Impuesto a las Grandes Transacciones Financieras aplicable en comprobantes venezolanos que indiquen pago en divisas o efectivo USD. Si no aplica o la factura no es de Venezuela, es 0.00.
6. Total: Monto total final pagado reflejado en el comprobante.
7. Moneda: Determina con máxima precisión la moneda del comprobante en código ISO de 3 letras (ej. "USD", "MXN", "VES", "COP", "EUR", "ARS", "CLP", "PEN", etc.).
   - Si el comprobante o emisor es de México (RFC, pesos mexicanos, M.N., MXN, dirección en México), la moneda es "MXN".
   - Si el comprobante es de Venezuela (RIF, SENIAT, Bolívares, Bs, VED), la moneda es "VES" (o "USD" si los importes explícitamente están tasados en dólares).
   - Si el símbolo es "$" sin mención de México ni Colombia, y los montos concuerdan con dólares, o es internacional en dólares, es "USD".
   - Si el comprobante es de Colombia (NIT, pesos colombianos), es "COP".
   - Si es en euros (€), es "EUR".
8. Tasa Impresa: Si el ticket imprime explícitamente una tasa de cambio (ej. "Tasa BCV: 68.50" o "Tipo de cambio: 18.50"), extrae ese número decimal. Si no la menciona, devuelve null.
9. Categoría de Gasto: Clasifica el gasto según su naturaleza en una de las siguientes categorías estándar: ALIMENTACION (restaurantes, comida, bebidas, supermercados), TRANSPORTE (gasolina, taxi, estacionamiento, peajes, boletos aéreos/terrestres, alquiler de vehículos), HOSPEDAJE (hoteles, posadas, alojamiento), REPRESENTACION (eventos, regalos corporativos, entretenimiento de clientes), OTROS (cualquier otra cosa no clasificable en las anteriores).

Devuelve estrictamente un objeto JSON con la estructura solicitada, sin rodeos ni Markdown adicional.`;

/**
 * @name FISCAL_RESPONSE_SCHEMA
 * @description [AI Configuration]: JSON schema enforced via Gemini's structured output
 * (response_mime_type: application/json) to guarantee type-safe extraction.
 */
const FISCAL_RESPONSE_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    nombre_comercio: { type: SchemaType.STRING, description: 'Business/store name' },
    rif_comercio: { type: SchemaType.STRING, description: 'Tax ID (RIF, RFC, NIT, etc.) without dashes or special characters' },
    numero_factura: { type: SchemaType.STRING, description: 'Invoice/fiscal control number' },
    fecha_emision: { type: SchemaType.STRING, description: 'Date in YYYY-MM-DD format' },
    moneda: {
      type: SchemaType.STRING,
      description: '3-letter ISO currency code: USD, MXN, VES, COP, EUR, ARS, etc.',
    },
    tasa_impresa: { type: SchemaType.NUMBER, description: 'Exchange rate printed on invoice, or 0 if not present', nullable: true },
    base_imponible: { type: SchemaType.NUMBER, description: 'Taxable base amount before IVA' },
    iva: { type: SchemaType.NUMBER, description: 'IVA 16% amount' },
    exento: { type: SchemaType.NUMBER, description: 'Tax-exempt amount' },
    igtf: { type: SchemaType.NUMBER, description: 'IGTF 3% amount (0 if not applicable)' },
    total: { type: SchemaType.NUMBER, description: 'Total amount paid' },
    categoria_gasto: {
      type: SchemaType.STRING,
      format: 'enum',
      description: 'Expense category: ALIMENTACION, TRANSPORTE, HOSPEDAJE, REPRESENTACION, or OTROS',
      enum: ['ALIMENTACION', 'TRANSPORTE', 'HOSPEDAJE', 'REPRESENTACION', 'OTROS'],
    },
  },
  required: [
    'nombre_comercio', 'rif_comercio', 'numero_factura', 'fecha_emision',
    'moneda', 'base_imponible', 'iva', 'exento', 'igtf', 'total', 'categoria_gasto',
  ],
};

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

/**
 * @name procesarFacturaConIA
 * @description [Business Logic]: Processes an invoice image through Gemini AI with
 * structured fiscal extraction. Returns a GeminiFiscalExtraction object with all four
 * Venezuelan tax components (base_imponible, iva, exento, igtf) plus currency/rate data.
 *
 * Uses `response_mime_type: "application/json"` with a strict schema to guarantee
 * type-safe, parseable output without post-processing regex cleanups.
 */
export async function procesarFacturaConIA(
  imageId: string
): Promise<GeminiFiscalExtraction | 'ERROR_SATURACION' | null> {
  try {
    const imagenPart = await obtenerImagenMetaBuffer(imageId);

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      systemInstruction: FISCAL_SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: FISCAL_RESPONSE_SCHEMA,
      },
    });

    const prompt = `Analiza este comprobante fiscal y extrae toda la información financiera según las reglas de extracción fiscal indicadas.`;

    const result = await model.generateContent([prompt, imagenPart]);
    const responseText = result.response.text();
    const parsed: GeminiFiscalExtraction = JSON.parse(responseText);

    // Normalize tasa_impresa: Gemini may return 0 instead of null
    if (parsed.tasa_impresa === 0) {
      parsed.tasa_impresa = null;
    }

    return parsed;
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    console.error('❌ Error al procesar factura con Gemini AI:', error);

    if (
      err?.status === 503 ||
      err?.message?.includes('503') ||
      err?.message?.includes('high demand')
    ) {
      return 'ERROR_SATURACION';
    }

    return null;
  }
}

// Aplica correcciones sobre los datos mediante un mensaje de texto
export async function aplicarCorreccionConIA(datosPrevios: any, textoUsuario: string) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

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
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

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

/**
 * @name uploadBufferToStorageWithRetry
 * @description [Business Logic]: Uploads a binary buffer to Supabase Storage with exponential
 * backoff retry. Protects against transient 504 Gateway Timeout, Kong proxy hiccups, and network latency.
 */
async function uploadBufferToStorageWithRetry(
  bucketName: string,
  fileName: string,
  buffer: Buffer,
  contentType: string,
  maxAttempts = 3
): Promise<string | null> {
  let attempt = 0;
  let delayMs = 1000;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, buffer, {
          contentType,
          upsert: true,
          duplex: 'half',
        });

      if (uploadError) {
        console.warn(`⚠️ Supabase Storage upload attempt ${attempt}/${maxAttempts} failed:`, uploadError.message || uploadError);
        if (attempt >= maxAttempts) {
          console.error(`❌ Final attempt failed uploading ${fileName} to bucket ${bucketName}:`, uploadError);
          return null;
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2;
        continue;
      }

      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (err: unknown) {
      console.warn(`⚠️ Exception on Supabase Storage upload attempt ${attempt}/${maxAttempts}:`, err);
      if (attempt >= maxAttempts) {
        console.error(`❌ All retry attempts failed for ${fileName}:`, err);
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs *= 2;
    }
  }

  return null;
}

// Descarga la imagen de WhatsApp y la sube a Supabase Storage con reintentos
export async function guardarImagenEnSupabase(idImagen: string): Promise<string | null> {
  try {
    const token = process.env.WHATSAPP_API_TOKEN;

    const res = await fetch(`https://graph.facebook.com/v20.0/${idImagen}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (!data || !data.url) {
      console.error('❌ No se pudo obtener la URL de la imagen de Meta:', data);
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

    return await uploadBufferToStorageWithRetry('comprobantes', fileName, buffer, mimeType);
  } catch (error) {
    console.error('❌ Error en guardarImagenEnSupabase:', error);
    return null;
  }
}

// --- FUNCIONES PARA SOPORTE DE ARCHIVOS PDF ---

/**
 * @name procesarFacturaPDFConIA
 * @description [Business Logic]: Processes a PDF invoice document through Gemini AI
 * with the same structured fiscal extraction as image processing. Downloads the PDF
 * from Meta's Graph API, converts to base64, and sends to Gemini with fiscal schema.
 */
export async function procesarFacturaPDFConIA(
  idDocumento: string
): Promise<GeminiFiscalExtraction | 'ERROR_SATURACION' | null> {
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

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      systemInstruction: FISCAL_SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: FISCAL_RESPONSE_SCHEMA,
      },
    });

    const prompt = `Analiza este documento PDF de factura y extrae toda la información financiera según las reglas de extracción fiscal indicadas.`;

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
    const parsed: GeminiFiscalExtraction = JSON.parse(responseText);

    // Normalize tasa_impresa: Gemini may return 0 instead of null
    if (parsed.tasa_impresa === 0) {
      parsed.tasa_impresa = null;
    }

    return parsed;
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    console.error('❌ Error procesando PDF con Gemini AI:', error);

    if (
      err?.status === 503 ||
      err?.message?.includes('503') ||
      err?.message?.includes('high demand')
    ) {
      return 'ERROR_SATURACION';
    }

    return null;
  }
}

// Descarga un archivo PDF de WhatsApp y lo sube a Supabase Storage con reintentos
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

    return await uploadBufferToStorageWithRetry('comprobantes', fileName, buffer, 'application/pdf');
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