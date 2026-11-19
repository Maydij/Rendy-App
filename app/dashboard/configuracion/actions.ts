'use server';

import { supabaseServer } from '@/lib/supabase-server';
import { requireAdminSession } from '@/lib/auth/session-context';
import { revalidatePath } from 'next/cache';

/**
 * @name crearProyecto
 * @description [Business Logic]: Creates a new project in the active company.
 */
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

/**
 * @name toggleProyecto
 * @description [Business Logic]: Activates or deactivates a project.
 */
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

/**
 * @name eliminarProyecto
 * @description [Business Logic]: Permanently removes a company project.
 */
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

/**
 * @name crearMetodoPago
 * @description [Business Logic]: Registers a new company payment method.
 */
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

/**
 * @name eliminarMetodoPago
 * @description [Business Logic]: Deletes a company payment method.
 */
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

/**
 * @name actualizarMonedaEmpresa
 * @description [Business Logic]: Updates the primary corporate currency.
 */
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

/**
 * @name guardarCertificadoFiscalUsa
 * @description [Business Logic]: Uploads and updates the optional US fiscal certificate
 * (Tax-Exempt, Resale Certificate, 501(c)(3)) with a customizable business title.
 * Allows employees to query and download the document via WhatsApp during purchases in the US.
 */
export async function guardarCertificadoFiscalUsa(formData: FormData) {
  const session = await requireAdminSession();
  const nombre = ((formData.get('nombre') as string | null) || '').trim();
  const file = formData.get('file') as File | null;

  let publicUrl: string | null = null;

  if (file && file instanceof File && file.size > 0) {
    if (file.size > 10 * 1024 * 1024) {
      return { error: 'El archivo excede el tamaño máximo permitido de 10 MB.' };
    }

    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return { error: 'Formato no permitido. Solo se aceptan archivos PDF, PNG o JPG.' };
    }

    const extension = file.name.split('.').pop() || 'pdf';
    const fileName = `${session.empresaId}/usa_fiscal_cert_${Date.now()}.${extension}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseServer.storage
      .from('certificados_fiscales')
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('❌ [guardarCertificadoFiscalUsa] Storage upload error:', uploadError);
      return { error: `Error al subir el archivo: ${uploadError.message}` };
    }

    const { data: urlData } = supabaseServer.storage
      .from('certificados_fiscales')
      .getPublicUrl(fileName);

    publicUrl = urlData.publicUrl;
  }

  // Build update payload defensively
  const updatePayload: Record<string, unknown> = {};
  if (nombre) {
    updatePayload.nombre_certificado_usa = nombre;
  }
  if (publicUrl) {
    updatePayload.url_certificado_usa = publicUrl;
    updatePayload.url_certificado_tax_exempt = publicUrl;
    updatePayload.us_tax_exempt = true;
  }

  if (Object.keys(updatePayload).length > 0) {
    let { error: updateError } = await supabaseServer
      .from('empresas')
      .update(updatePayload)
      .eq('id', session.empresaId);

    // If migration 010 hasn't been executed yet in remote DB, fallback to legacy columns
    if (updateError && (updateError.message?.includes('nombre_certificado_usa') || updateError.code === '42703')) {
      delete updatePayload.nombre_certificado_usa;
      delete updatePayload.url_certificado_usa;
      if (Object.keys(updatePayload).length > 0) {
        const retry = await supabaseServer
          .from('empresas')
          .update(updatePayload)
          .eq('id', session.empresaId);
        updateError = retry.error;
      } else {
        updateError = null;
      }
    }

    if (updateError) {
      return { error: updateError.message };
    }
  }

  revalidatePath('/dashboard/configuracion');
  return { error: null, url: publicUrl, nombre };
}

/**
 * @name eliminarCertificadoFiscalUsa
 * @description [Business Logic]: Removes the optional US fiscal certificate and its title
 * from the company configuration.
 */
export async function eliminarCertificadoFiscalUsa() {
  const session = await requireAdminSession();
  const updatePayload: Record<string, unknown> = {
    url_certificado_usa: null,
    nombre_certificado_usa: null,
    url_certificado_tax_exempt: null,
  };

  let { error } = await supabaseServer
    .from('empresas')
    .update(updatePayload)
    .eq('id', session.empresaId);

  if (error && (error.message?.includes('nombre_certificado_usa') || error.code === '42703')) {
    delete updatePayload.nombre_certificado_usa;
    delete updatePayload.url_certificado_usa;
    const retry = await supabaseServer
      .from('empresas')
      .update(updatePayload)
      .eq('id', session.empresaId);
    error = retry.error;
  }

  if (error) return { error: error.message };

  revalidatePath('/dashboard/configuracion');
  return { error: null };
}

import {
  obtenerCategoriasEmpresa as _obtenerCategoriasEmpresa,
  crearCategoriaPersonalizada as _crearCategoriaPersonalizada,
  actualizarLimiteDiarioCategoria as _actualizarLimiteDiarioCategoria,
  toggleCategoriaActiva as _toggleCategoriaActiva,
  eliminarCategoriaPersonalizada as _eliminarCategoriaPersonalizada,
} from '@/app/actions/categorias.actions';

// Re-export category actions for unified organizational dashboard usage
export async function obtenerCategoriasEmpresa(empresaId: string) {
  return await _obtenerCategoriasEmpresa(empresaId);
}

export async function crearCategoriaPersonalizada(input: {
  nombre: string;
  descripcion?: string;
  icono?: string;
  limiteDiarioUsd?: number;
}) {
  return await _crearCategoriaPersonalizada(input);
}

export async function actualizarLimiteDiarioCategoria(input: {
  categoriaId: string;
  limiteDiarioUsd: number;
}) {
  return await _actualizarLimiteDiarioCategoria(input);
}

export async function toggleCategoriaActiva(input: {
  categoriaId: string;
  activa: boolean;
}) {
  return await _toggleCategoriaActiva(input);
}

export async function eliminarCategoriaPersonalizada(input: { categoriaId: string }) {
  return await _eliminarCategoriaPersonalizada(input);
}
