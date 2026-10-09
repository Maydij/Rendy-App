'use server';

import { supabaseServer } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

export async function actualizarEstadoReembolso(id: string, estado: 'APROBADO' | 'RECHAZADO') {
  const { error } = await supabaseServer
    .from('gastos')
    .update({ estado })
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/dashboard/reembolsos');
  revalidatePath('/dashboard');
  return { error: null };
}
