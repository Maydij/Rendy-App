import { supabaseServer, EMPRESA_ID } from '@/lib/supabase-server';
import ReembolsosClient, { ReembolsoItem } from './reembolsos-client';
import { getExchangeRates, convertAmount, normalizeMoneda } from '@/lib/currency';

async function getReembolsosData(): Promise<{
  reembolsos: ReembolsoItem[];
  monedaOrg: string;
  rates: Record<string, number>;
}> {
  // Gastos pagados con Fondos Personales que requieren reembolso
  const [
    { data: gastos },
    { data: usuarios },
    { data: proyectos },
    { data: empresa },
    rates,
  ] = await Promise.all([
    supabaseServer
      .from('gastos')
      .select('*')
      .eq('empresa_id', EMPRESA_ID)
      .is('metodo_pago_id', null) // Sin método corporativo = Fondos Personales
      .is('solicitud_id', null) // Sin solicitud de viáticos (no es una rendición)
      .order('creado_en', { ascending: false }),
    supabaseServer.from('usuarios').select('id, nombre').eq('empresa_id', EMPRESA_ID),
    supabaseServer.from('proyectos').select('id, nombre').eq('empresa_id', EMPRESA_ID),
    supabaseServer.from('empresas').select('moneda').eq('id', EMPRESA_ID).single(),
    getExchangeRates(),
  ]);

  const monedaOrg = normalizeMoneda(empresa?.moneda || 'USD');
  const usuMap = Object.fromEntries((usuarios ?? []).map((u) => [u.id, u.nombre]));
  const proyMap = Object.fromEntries((proyectos ?? []).map((p) => [p.id, p.nombre]));

  const items: ReembolsoItem[] = (gastos ?? [])
    .filter((g) => g.monto != null || g.comercio != null || (g.datos_ocr as any)?.comercio)
    .map((g) => {
      // Normalizar la moneda original del gasto (si es null, inferir de datos_ocr o default a VES)
      const rawMoneda = g.moneda ?? (g.datos_ocr as any)?.moneda ?? 'VES';
      const monedaGasto = normalizeMoneda(rawMoneda);
      const montoOriginal = Number(g.monto ?? 0);

      // Convertir el monto a la moneda de la organización
      const montoConvertido = convertAmount(montoOriginal, monedaGasto, monedaOrg, rates);

      return {
        id: g.id,
        empleado: g.usuario_id ? (usuMap[g.usuario_id] ?? 'Usuario') : 'Sin asignar',
        categoria: g.categoria || 'Otros',
        comercio: g.comercio ?? (g.datos_ocr as any)?.comercio ?? '—',
        monto: montoOriginal,
        moneda: monedaGasto,
        monto_convertido_org: Number(montoConvertido.toFixed(2)),
        fecha_gasto: g.fecha_gasto || '—',
        proyecto: g.proyecto_id ? (proyMap[g.proyecto_id] ?? '—') : '—',
        metodo_pago: 'Fondos Personales (Reembolso)',
        estado: g.estado || 'PENDIENTE',
        url_comprobante: g.url_comprobante ?? null,
        concepto: g.concepto ?? (g.datos_ocr as any)?.concepto ?? null,
      };
    });

  return {
    reembolsos: items,
    monedaOrg,
    rates,
  };
}

export type Reembolso = ReembolsoItem;

export default async function ReembolsosPage() {
  const { reembolsos, monedaOrg, rates } = await getReembolsosData();
  return <ReembolsosClient reembolsos={reembolsos} monedaOrg={monedaOrg} rates={rates} />;
}
