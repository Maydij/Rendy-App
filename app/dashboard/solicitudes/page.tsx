import { supabaseServer, EMPRESA_ID } from '@/lib/supabase-server';
import SolicitudesClient from './solicitudes-client';

async function getSolicitudesData() {
  const [{ data: solicitudes }, { data: usuarios }, { data: proyectos }] = await Promise.all([
    supabaseServer
      .from('solicitudes_viaticos')
      .select('*')
      .eq('empresa_id', EMPRESA_ID)
      .order('creado_en', { ascending: false }),
    supabaseServer
      .from('usuarios')
      .select('id, nombre, email')
      .eq('empresa_id', EMPRESA_ID),
    supabaseServer
      .from('proyectos')
      .select('id, nombre')
      .eq('empresa_id', EMPRESA_ID),
  ]);

  const usuMap = Object.fromEntries((usuarios ?? []).map((u) => [u.id, u.nombre]));
  const proyMap = Object.fromEntries((proyectos ?? []).map((p) => [p.id, p.nombre]));

  return {
    solicitudes: (solicitudes ?? []).map((s) => ({
      ...s,
      empleado: usuMap[s.usuario_id] ?? 'Usuario desconocido',
      proyecto: s.proyecto_id ? (proyMap[s.proyecto_id] ?? 'Sin proyecto') : 'Sin proyecto',
    })),
  };
}

export default async function SolicitudesPage() {
  const { solicitudes } = await getSolicitudesData();
  return <SolicitudesClient solicitudes={solicitudes} />;
}