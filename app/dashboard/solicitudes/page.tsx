import { supabaseServer } from '@/lib/supabase-server';
import { requireAuthenticatedSession } from '@/lib/auth/session-context';
import SolicitudesClient from './solicitudes-client';

async function getSolicitudesData(empresaId: string, role: string, userId: string) {
  let solQuery = supabaseServer
    .from('solicitudes_viaticos')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('creado_en', { ascending: false });

  if (role === 'EMPLOYEE') {
    solQuery = solQuery.eq('usuario_id', userId);
  }

  const [{ data: solicitudes }, { data: usuarios }, { data: proyectos }] = await Promise.all([
    solQuery,
    supabaseServer
      .from('usuarios')
      .select('id, nombre, email')
      .eq('empresa_id', empresaId),
    supabaseServer
      .from('proyectos')
      .select('id, nombre')
      .eq('empresa_id', empresaId),
  ]);

  const usuMap = Object.fromEntries((usuarios ?? []).map((u) => [u.id, u.nombre]));
  const usuEmailMap = Object.fromEntries((usuarios ?? []).map((u) => [u.id, u.email ?? '']));
  const proyMap = Object.fromEntries((proyectos ?? []).map((p) => [p.id, p.nombre]));

  return {
    solicitudes: (solicitudes ?? []).map((s) => ({
      ...s,
      empleado: usuMap[s.usuario_id] ?? 'Usuario desconocido',
      empleadoEmail: usuEmailMap[s.usuario_id] ?? '',
      proyecto: s.proyecto_id ? (proyMap[s.proyecto_id] ?? 'Sin proyecto') : 'Sin proyecto',
    })),
    proyectosList: (proyectos ?? []).map((p) => p.nombre),
  };
}

export default async function SolicitudesPage() {
  const session = await requireAuthenticatedSession();
  const { solicitudes, proyectosList } = await getSolicitudesData(session.empresaId, session.role, session.userId);
  return (
    <SolicitudesClient
      solicitudes={solicitudes}
      proyectosList={proyectosList}
      userRole={session.role}
    />
  );
}