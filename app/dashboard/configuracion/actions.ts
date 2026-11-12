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