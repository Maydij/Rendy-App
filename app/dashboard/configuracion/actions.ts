'use server';

import { supabaseServer } from '@/lib/supabase-server';
import { requireAdminSession } from '@/lib/auth/session-context';
import { revalidatePath } from 'next/cache';

export async function crearProyecto(nombre: string) {
  const session = await requireAdminSession();
  const { data, error } = await supabaseServer
    .from('proyectos')
    .insert({ empresa_id: session.empresaId, nombre, activo: true })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  revalidatePath('/dashboard/configuracion');
  return { data, error: null };
}

export async function toggleProyecto(id: string, activo: boolean) {
  const session = await requireAdminSession();
  const { error } = await supabaseServer
    .from('proyectos')
    .update({ activo })
    .eq('id', id)
    .eq('empresa_id', session.empresaId);

  if (error) return { error: error.message };
  revalidatePath('/dashboard/configuracion');
  return { error: null };
}

export async function eliminarProyecto(id: string) {
  const session = await requireAdminSession();
  const { error } = await supabaseServer
    .from('proyectos')
    .delete()
    .eq('id', id)
    .eq('empresa_id', session.empresaId);

  if (error) return { error: error.message };
  revalidatePath('/dashboard/configuracion');
  return { error: null };
}

export async function crearMetodoPago(nombre: string) {
  const session = await requireAdminSession();
  const { data, error } = await supabaseServer
    .from('metodos_pago')
    .insert({ empresa_id: session.empresaId, nombre })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  revalidatePath('/dashboard/configuracion');
  return { data, error: null };
}

export async function eliminarMetodoPago(id: string) {
  const session = await requireAdminSession();
  const { error } = await supabaseServer
    .from('metodos_pago')
    .delete()
    .eq('id', id)
    .eq('empresa_id', session.empresaId);

  if (error) return { error: error.message };
  revalidatePath('/dashboard/configuracion');
  return { error: null };
}

export async function actualizarMonedaEmpresa(moneda: string) {
  const session = await requireAdminSession();
  const { error } = await supabaseServer
    .from('empresas')
    .update({ moneda })
    .eq('id', session.empresaId);

  if (error) return { error: error.message };

  revalidatePath('/dashboard/configuracion');
  revalidatePath('/dashboard');
  return { error: null };
}

/**
 * @name actualizarExencionFiscalUsa
 * @description [Business Logic]: Toggles the US Sales Tax Exemption status for the active company.
 */
export async function actualizarExencionFiscalUsa(usTaxExempt: boolean) {
  const session = await requireAdminSession();
  const { error } = await supabaseServer
    .from('empresas')
    .update({ us_tax_exempt: Boolean(usTaxExempt) })
    .eq('id', session.empresaId);

  if (error) return { error: error.message };

  revalidatePath('/dashboard/configuracion');
  return { error: null };
}

/**
 * @name subirCertificadoTaxExempt
 * @description [Business Logic]: Uploads a tax-exempt certificate (PDF, PNG, JPG) to Supabase Storage,
 * sets the company public certificate URL, and activates `us_tax_exempt = true`.
 */
export async function subirCertificadoTaxExempt(formData: FormData) {
  const session = await requireAdminSession();
  const file = formData.get('file') as File | null;

  if (!file || !(file instanceof File) || file.size === 0) {
    return { error: 'Por favor selecciona un archivo válido (PDF, PNG o JPG).' };
  }

  // File size limit: 10 MB
  if (file.size > 10 * 1024 * 1024) {
    return { error: 'El archivo excede el tamaño máximo permitido de 10 MB.' };
  }

  const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return { error: 'Formato no permitido. Solo se aceptan archivos PDF, PNG o JPG.' };
  }

  const extension = file.name.split('.').pop() || 'pdf';
  const fileName = `${session.empresaId}/tax_exempt_certificate_${Date.now()}.${extension}`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabaseServer.storage
    .from('certificados_fiscales')
    .upload(fileName, fileBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error('❌ [subirCertificadoTaxExempt] Storage upload error:', uploadError);
    return { error: `Error al subir el archivo: ${uploadError.message}` };
  }

  const { data: urlData } = supabaseServer.storage
    .from('certificados_fiscales')
    .getPublicUrl(fileName);

  const publicUrl = urlData.publicUrl;

  const { error: updateError } = await supabaseServer
    .from('empresas')
    .update({
      url_certificado_tax_exempt: publicUrl,
      us_tax_exempt: true,
    })
    .eq('id', session.empresaId);

  if (updateError) {
    return { error: updateError.message };
  }

  revalidatePath('/dashboard/configuracion');
  return { error: null, url: publicUrl };
}

/**
 * @name eliminarCertificadoTaxExempt
 * @description [Business Logic]: Removes the stored tax-exempt certificate URL for the company.
 */
export async function eliminarCertificadoTaxExempt() {
  const session = await requireAdminSession();
  const { error } = await supabaseServer
    .from('empresas')
    .update({
      url_certificado_tax_exempt: null,
    })
    .eq('id', session.empresaId);

  if (error) return { error: error.message };

  revalidatePath('/dashboard/configuracion');
  return { error: null };
}