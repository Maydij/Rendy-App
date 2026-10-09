import { supabaseServer, EMPRESA_ID } from '@/lib/supabase-server';
import ConfiguracionClient from './configuracion-client';

async function getConfigData() {
  const [{ data: empresa }, { data: usuarios }, { data: proyectos }, { data: metodos }] = await Promise.all([
    supabaseServer.from('empresas').select('*').eq('id', EMPRESA_ID).single(),
    supabaseServer.from('usuarios').select('*').eq('empresa_id', EMPRESA_ID).order('creado_en'),
    supabaseServer.from('proyectos').select('*').eq('empresa_id', EMPRESA_ID).order('creado_en'),
    supabaseServer.from('metodos_pago').select('*').eq('empresa_id', EMPRESA_ID).order('creado_en'),
  ]);

  return { empresa, usuarios: usuarios ?? [], proyectos: proyectos ?? [], metodos: metodos ?? [] };
}

export default async function ConfiguracionPage() {
  const data = await getConfigData();
  return <ConfiguracionClient {...data} />;
}
