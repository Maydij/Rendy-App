import { supabaseServer } from '@/lib/supabase-server';
import { requireAdminSession } from '@/lib/auth/session-context';
import ConfiguracionClient from './configuracion-client';

async function getConfigData(empresaId: string) {
  const [
    { data: empresa },
    { data: usuarios },
    { data: proyectos },
    { data: metodos },
    { data: subscription },
    { data: pendingInvitations },
  ] = await Promise.all([
    supabaseServer.from('empresas').select('*').eq('id', empresaId).single(),
    supabaseServer.from('usuarios').select('*').eq('empresa_id', empresaId).order('creado_en'),
    supabaseServer.from('proyectos').select('*').eq('empresa_id', empresaId).order('creado_en'),
    supabaseServer.from('metodos_pago').select('*').eq('empresa_id', empresaId).order('creado_en'),
    supabaseServer.from('subscriptions').select('*').eq('empresa_id', empresaId).maybeSingle(),
    supabaseServer
      .from('employee_invitations')
      .select('id, first_name, last_name, email, department, status, expires_at')
      .eq('empresa_id', empresaId)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false }),
  ]);

  return {
    empresa,
    usuarios: usuarios ?? [],
    proyectos: proyectos ?? [],
    metodos: metodos ?? [],
    subscription: subscription ?? null,
    pendingInvitations: pendingInvitations ?? [],
  };
}

export default async function ConfiguracionPage() {
  const session = await requireAdminSession();
  const data = await getConfigData(session.empresaId);
  return <ConfiguracionClient {...data} />;
}