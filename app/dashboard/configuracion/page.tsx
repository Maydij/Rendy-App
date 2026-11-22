import { supabaseServer } from '@/lib/supabase-server';
import { requireAuthenticatedSession } from '@/lib/auth/session-context';
import { obtenerCategoriasEmpresa } from '@/app/actions/categorias.actions';
import ConfiguracionClient from './configuracion-client';

/**
 * @name getConfigData
 * @description [Business Logic]: Fetches all organization configuration entities
 * (company info, users, projects, payment methods, subscription, invitations, categories)
 * scoped to the authenticated user's organization for the Configuration dashboard.
 */
async function getConfigData(empresaId: string) {
  const [
    { data: empresa },
    { data: usuarios },
    { data: proyectos },
    { data: metodos },
    { data: subscription },
    { data: pendingInvitations },
    categorias,
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
    obtenerCategoriasEmpresa(empresaId),
  ]);

  return {
    empresa,
    usuarios: usuarios ?? [],
    proyectos: proyectos ?? [],
    metodos: metodos ?? [],
    subscription: subscription ?? null,
    pendingInvitations: pendingInvitations ?? [],
    categorias: categorias ?? [],
  };
}

export default async function ConfiguracionPage() {
  const session = await requireAuthenticatedSession();
  const data = await getConfigData(session.empresaId);

  // Resolve user display name from the fetched users list (session JWT does not carry nombre)
  const currentUser = data.usuarios.find((u) => u.id === session.userId);
  const currentUserName = currentUser?.nombre ?? 'Colaborador';

  return (
    <ConfiguracionClient
      {...data}
      isAdmin={session.role === 'ADMIN'}
      currentUserId={session.userId}
      currentUserName={currentUserName}
    />
  );
}