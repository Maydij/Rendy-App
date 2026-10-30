/**
 * @name ViaticosEngine
 * @description [Business Logic]: Financial computation engine for project-based viáticos (per diem)
 * budget allocations. Evaluates real-time balances, projected expenditures, and overdraft thresholds.
 *
 * Guarantees strict financial accounting:
 * - Deductions are computed exclusively against non-rejected invoices linked to the allocation.
 * - Overdrafts automatically trigger special approval routing (`REQUIERE_APROBACION_ESPECIAL`).
 * - Supports both `viaticos` (budget allocations) and `solicitudes_viaticos` (legacy/web requests)
 *   in a fully synchronized, cohesive model.
 * - All computations are executed in USD (primary control currency).
 */

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * @name EvaluacionSobregiro
 * @description Output contract for overdraft evaluation against a specific viático allocation.
 */
export interface EvaluacionSobregiro {
  excede_limite: boolean;
  estado_sugerido: 'PENDIENTE' | 'REQUIERE_APROBACION_ESPECIAL';
  monto_asignado_usd: number;
  acumulado_previo_usd: number;
  saldo_restante_usd: number;
  sobregiro_usd: number;
  nombre_proyecto?: string;
}

/**
 * @name ViaticoActivo
 * @description Active viático budget row contract with financial balance projections.
 */
export interface ViaticoActivo {
  id: string;
  empleado_id: string;
  nombre_proyecto: string;
  monto_asignado_usd: number;
  estado: string;
  fecha_inicio?: string;
  fecha_cierre?: string | null;
  monto_gastado_usd: number;
  saldo_disponible_usd: number;
  porcentaje_justificado: number;
}

/**
 * @name ObtenerViaticosOptions
 * @description Filtering parameters for querying employee viático allocations.
 */
export interface ObtenerViaticosOptions {
  /**
   * When true, excludes allocations that have reached or exceeded 100% justification
   * (e.g. remaining balance <= 0).
   */
  soloPendientesJustificar?: boolean;
}

/**
 * @name ResumenViaticoIndividual
 * @description Computed balance breakdown for a single active viático.
 */
export interface ResumenViaticoIndividual {
  id: string;
  nombre_proyecto: string;
  monto_asignado_usd: number;
  acumulado_gastado_usd: number;
  saldo_disponible_usd: number;
}

/**
 * @name ResumenSaldosEmpleado
 * @description Global financial status for an employee across all their active and pending budgets.
 */
export interface ResumenSaldosEmpleado {
  viaticos_activos: ResumenViaticoIndividual[];
  total_asignado_usd: number;
  total_gastado_usd: number;
  total_disponible_usd: number;
  solicitudes_pendientes: {
    id: string;
    nombre_proyecto: string;
    monto_asignado_usd: number;
    creado_en: string;
  }[];
}

/**
 * @name extractExpenseUsd
 * @description [Business Logic]: Resolves the true USD amount of an expense record.
 * Handles legacy entries where `monto_usd` might be 0 but `monto_convertido` holds the converted USD value,
 * or where `moneda` is 'USD' and stored in `monto`.
 *
 * @param g - Gasto record with currency and amount fields.
 * @returns Non-negative numerical value in USD.
 */
export function extractExpenseUsd(g: {
  monto_usd?: number | null;
  monto_convertido?: number | null;
  monto?: number | null;
  moneda?: string | null;
}): number {
  if (typeof g.monto_usd === 'number' && g.monto_usd > 0) return g.monto_usd;
  if (typeof g.monto_convertido === 'number' && g.monto_convertido > 0) return g.monto_convertido;
  if (g.moneda === 'USD' && typeof g.monto === 'number' && g.monto > 0) return g.monto;
  return Number(g.monto_convertido || g.monto_usd || 0);
}

/**
 * @name calcularSaldoViatico
 * @description [Business Logic]: Evaluates the projected impact of a new invoice against an active viático budget.
 *
 * Checks `viaticos` and `solicitudes_viaticos`, aggregates all approved and pending invoices tied
 * to this allocation (`viatico_id` or `solicitud_id`), projects total spend including the new receipt,
 * and determines whether an overdraft occurs.
 *
 * @param supabase - Authenticated Supabase client (service role).
 * @param viaticoId - Unique UUID of the viático allocation.
 * @param montoNuevaFacturaUsd - Expense amount in USD from OCR fiscal extraction.
 * @returns Projection containing remaining balance, overdraft amount, and suggested invoice status.
 */
export async function calcularSaldoViatico(
  supabase: SupabaseClient,
  viaticoId: string,
  montoNuevaFacturaUsd: number
): Promise<EvaluacionSobregiro> {
  // 1. Fetch viático metadata from viaticos table
  let nombreProyecto = 'General';
  let montoAsignado = 0;
  let montoGastadoCache = 0;

  const { data: viatico } = await supabase
    .from('viaticos')
    .select('id, nombre_proyecto, monto_asignado_usd')
    .eq('id', viaticoId)
    .maybeSingle();

  if (viatico) {
    nombreProyecto = viatico.nombre_proyecto || 'General';
    montoAsignado = Number(viatico.monto_asignado_usd || 0);
  } else {
    // Fallback: check solicitudes_viaticos for backward compatibility
    const { data: sol } = await supabase
      .from('solicitudes_viaticos')
      .select('id, monto_aprobado, monto_solicitado, monto_gastado, proyectos(nombre)')
      .eq('id', viaticoId)
      .maybeSingle();

    if (sol) {
      nombreProyecto = (sol.proyectos as unknown as { nombre?: string })?.nombre || 'General';
      montoAsignado = Number(sol.monto_aprobado ?? sol.monto_solicitado ?? 0);
    } else {
      throw new Error(`Viático not found: ${viaticoId}`);
    }
  }

  // 2. Aggregate all existing expenses for this viático (checking both viatico_id and solicitud_id)
  const { data: gastosPrevios, error: errGastos } = await supabase
    .from('gastos')
    .select('monto_usd, monto_convertido, monto, moneda')
    .or(`viatico_id.eq.${viaticoId},solicitud_id.eq.${viaticoId}`)
    .neq('estado', 'RECHAZADO');

  if (errGastos) {
    throw new Error(`Error fetching existing expenses: ${errGastos.message}`);
  }

  const acumuladoPrevio = (gastosPrevios || []).reduce(
    (acc, item) => acc + extractExpenseUsd(item),
    0
  );

  const totalProyectado = acumuladoPrevio + montoNuevaFacturaUsd;
  const saldoFinal = montoAsignado - totalProyectado;

  if (saldoFinal < 0) {
    const sobregiro = Math.abs(saldoFinal);
    return {
      excede_limite: true,
      estado_sugerido: 'REQUIERE_APROBACION_ESPECIAL',
      monto_asignado_usd: montoAsignado,
      acumulado_previo_usd: Number(acumuladoPrevio.toFixed(2)),
      saldo_restante_usd: 0,
      sobregiro_usd: Number(sobregiro.toFixed(2)),
      nombre_proyecto: nombreProyecto,
    };
  }

  return {
    excede_limite: false,
    estado_sugerido: 'PENDIENTE',
    monto_asignado_usd: montoAsignado,
    acumulado_previo_usd: Number(acumuladoPrevio.toFixed(2)),
    saldo_restante_usd: Number(saldoFinal.toFixed(2)),
    sobregiro_usd: 0,
    nombre_proyecto: nombreProyecto,
  };
}

/**
 * @name obtenerViaticosActivosEmpleado
 * @description [Business Logic]: Retrieves all currently active viáticos for a given employee.
 * Merges active records from `viaticos` table and approved records from `solicitudes_viaticos`,
 * calculates current spent amounts and available balances from `gastos`, and optionally filters out
 * allocations that are already 100% justified.
 *
 * @param supabase - Supabase client.
 * @param empleadoId - Unique user UUID.
 * @param options - Optional filters (e.g. `soloPendientesJustificar`).
 * @returns Array of active viático records with balance calculations.
 */
export async function obtenerViaticosActivosEmpleado(
  supabase: SupabaseClient,
  empleadoId: string,
  options?: ObtenerViaticosOptions
): Promise<ViaticoActivo[]> {
  // 1. Query active viáticos and approved requests in parallel
  const [{ data: viaticosData }, { data: solicitudesData }] = await Promise.all([
    supabase
      .from('viaticos')
      .select('id, empleado_id, nombre_proyecto, monto_asignado_usd, estado, fecha_inicio, fecha_cierre')
      .eq('empleado_id', empleadoId)
      .eq('estado', 'ACTIVO')
      .order('creado_en', { ascending: false }),

    supabase
      .from('solicitudes_viaticos')
      .select('id, usuario_id, monto_aprobado, monto_solicitado, monto_gastado, estado, proyectos(nombre)')
      .eq('usuario_id', empleadoId)
      .eq('estado', 'APROBADO'),
  ]);

  interface BaseViatico {
    id: string;
    empleado_id: string;
    nombre_proyecto: string;
    monto_asignado_usd: number;
    estado: string;
    fecha_inicio?: string;
    fecha_cierre?: string | null;
    monto_gastado_cache?: number;
  }

  const mapViaticos = new Map<string, BaseViatico>();

  // Ingest approved solicitudes first to capture cached monto_gastado and project names
  for (const s of solicitudesData || []) {
    const proyNom = (s.proyectos as unknown as { nombre?: string })?.nombre || 'General';
    const monto = Number(s.monto_aprobado ?? s.monto_solicitado ?? 0);
    mapViaticos.set(s.id, {
      id: s.id,
      empleado_id: s.usuario_id,
      nombre_proyecto: proyNom,
      monto_asignado_usd: monto,
      estado: 'ACTIVO',
      monto_gastado_cache: Number(s.monto_gastado || 0),
    });
  }

  // Merge with viaticos table, preserving or overriding with authoritative budget data
  for (const v of viaticosData || []) {
    if (mapViaticos.has(v.id)) {
      const existing = mapViaticos.get(v.id)!;
      existing.nombre_proyecto = v.nombre_proyecto || existing.nombre_proyecto;
      existing.monto_asignado_usd = Number(v.monto_asignado_usd || existing.monto_asignado_usd);
      existing.fecha_inicio = v.fecha_inicio || existing.fecha_inicio;
      existing.fecha_cierre = v.fecha_cierre || existing.fecha_cierre;
    } else {
      mapViaticos.set(v.id, {
        id: v.id,
        empleado_id: v.empleado_id,
        nombre_proyecto: v.nombre_proyecto || 'General',
        monto_asignado_usd: Number(v.monto_asignado_usd || 0),
        estado: v.estado,
        fecha_inicio: v.fecha_inicio,
        fecha_cierre: v.fecha_cierre,
        monto_gastado_cache: 0,
      });
    }
  }

  if (mapViaticos.size === 0) {
    return [];
  }

  // 2. Fetch all non-rejected expenses for this employee in a single indexed query
  const { data: todosLosGastos } = await supabase
    .from('gastos')
    .select('solicitud_id, viatico_id, monto_usd, monto_convertido, monto, moneda')
    .eq('usuario_id', empleadoId)
    .neq('estado', 'RECHAZADO');

  // 3. Aggregate total spent per viático allocation
  const gastosPorViatico = new Map<string, number>();

  for (const g of todosLosGastos || []) {
    const monto = extractExpenseUsd(g);
    if (g.viatico_id) {
      gastosPorViatico.set(g.viatico_id, (gastosPorViatico.get(g.viatico_id) || 0) + monto);
    }
    if (g.solicitud_id && g.solicitud_id !== g.viatico_id) {
      gastosPorViatico.set(g.solicitud_id, (gastosPorViatico.get(g.solicitud_id) || 0) + monto);
    }
  }

  // 4. Construct enriched ViaticoActivo array
  const listaViaticos: ViaticoActivo[] = [];

  for (const base of mapViaticos.values()) {
    const asignado = base.monto_asignado_usd;
    const gastadoCalculado = Number((gastosPorViatico.get(base.id) || 0).toFixed(2));
    const gastado = gastadoCalculado;
    const disponible = Number(Math.max(0, asignado - gastado).toFixed(2));
    const pct = Number((asignado > 0 ? (gastado / asignado) * 100 : (gastado > 0 ? 100 : 0)).toFixed(2));

    // Self-healing synchronization: if solicitudes_viaticos cache differs from actual gastos in DB, update it
    if (base.monto_gastado_cache !== undefined && Number(base.monto_gastado_cache.toFixed(2)) !== gastado) {
      void supabase
        .from('solicitudes_viaticos')
        .update({ monto_gastado: gastado })
        .eq('id', base.id)
        .then(
          () => {},
          (err: unknown) => {
            console.error(`Error syncing monto_gastado for ${base.id}:`, err);
          }
        );
    }

    listaViaticos.push({
      id: base.id,
      empleado_id: base.empleado_id,
      nombre_proyecto: base.nombre_proyecto,
      monto_asignado_usd: Number(asignado.toFixed(2)),
      estado: base.estado,
      fecha_inicio: base.fecha_inicio,
      fecha_cierre: base.fecha_cierre,
      monto_gastado_usd: Number(gastado.toFixed(2)),
      saldo_disponible_usd: Number(disponible.toFixed(2)),
      porcentaje_justificado: Number(pct.toFixed(2)),
    });
  }

  // 5. Apply filter: exclude viáticos that are 100% or more justified
  if (options?.soloPendientesJustificar) {
    return listaViaticos.filter((v) => {
      const estaCompleto = v.saldo_disponible_usd <= 0 || v.porcentaje_justificado >= 100;
      return !estaCompleto;
    });
  }

  return listaViaticos;
}

/**
 * @name obtenerResumenSaldosEmpleado
 * @description [Business Logic]: Computes comprehensive balance metrics across all active viáticos
 * and pending approval requests for an employee. Used in the "Consultar Saldos" operation.
 *
 * @param supabase - Supabase client.
 * @param empleadoId - Unique user UUID.
 * @returns Structured summary with per-project balances and overall totals.
 */
export async function obtenerResumenSaldosEmpleado(
  supabase: SupabaseClient,
  empleadoId: string
): Promise<ResumenSaldosEmpleado> {
  const activos = await obtenerViaticosActivosEmpleado(supabase, empleadoId, {
    soloPendientesJustificar: false,
  });

  // Fetch pending approval requests from both sources
  const [{ data: pendViaticos }, { data: pendSol }] = await Promise.all([
    supabase
      .from('viaticos')
      .select('id, nombre_proyecto, monto_asignado_usd, creado_en')
      .eq('empleado_id', empleadoId)
      .eq('estado', 'PENDIENTE_APROBACION')
      .order('creado_en', { ascending: false }),

    supabase
      .from('solicitudes_viaticos')
      .select('id, monto_solicitado, creado_en, proyectos(nombre)')
      .eq('usuario_id', empleadoId)
      .eq('estado', 'PENDIENTE')
      .order('creado_en', { ascending: false }),
  ]);

  const viaticosActivosList: ResumenViaticoIndividual[] = [];
  let totalAsignado = 0;
  let totalGastado = 0;

  for (const v of activos) {
    totalAsignado += v.monto_asignado_usd;
    totalGastado += v.monto_gastado_usd;

    viaticosActivosList.push({
      id: v.id,
      nombre_proyecto: v.nombre_proyecto,
      monto_asignado_usd: v.monto_asignado_usd,
      acumulado_gastado_usd: v.monto_gastado_usd,
      saldo_disponible_usd: v.saldo_disponible_usd,
    });
  }

  const totalDisponible = Math.max(0, totalAsignado - totalGastado);

  const solicitudesPendientesMap = new Map<string, { id: string; nombre_proyecto: string; monto_asignado_usd: number; creado_en: string }>();

  for (const p of pendViaticos || []) {
    solicitudesPendientesMap.set(p.id, {
      id: p.id,
      nombre_proyecto: p.nombre_proyecto,
      monto_asignado_usd: Number(p.monto_asignado_usd),
      creado_en: p.creado_en,
    });
  }

  for (const s of pendSol || []) {
    if (!solicitudesPendientesMap.has(s.id)) {
      const nom = (s.proyectos as unknown as { nombre?: string })?.nombre || 'General';
      solicitudesPendientesMap.set(s.id, {
        id: s.id,
        nombre_proyecto: nom,
        monto_asignado_usd: Number(s.monto_solicitado || 0),
        creado_en: s.creado_en,
      });
    }
  }

  return {
    viaticos_activos: viaticosActivosList,
    total_asignado_usd: Number(totalAsignado.toFixed(2)),
    total_gastado_usd: Number(totalGastado.toFixed(2)),
    total_disponible_usd: Number(totalDisponible.toFixed(2)),
    solicitudes_pendientes: Array.from(solicitudesPendientesMap.values()),
  };
}

/**
 * @name formatearResumenSaldosWhatsApp
 * @description [Presentation]: Formats the balance query results into a polished, professional WhatsApp message.
 *
 * @param resumen - The computed balance summary.
 * @param nombreEmpleado - Employee first name for greeting personalization.
 * @returns Markdown-formatted WhatsApp message body.
 */
export function formatearResumenSaldosWhatsApp(
  resumen: ResumenSaldosEmpleado,
  nombreEmpleado?: string
): string {
  const saludo = nombreEmpleado ? `Hola *${nombreEmpleado}*, este` : 'Este';
  let mensaje = `📊 *Centro de Consultas Rendy*\n\n${saludo} es el estado actual de tus viáticos y fondos:\n\n`;

  if (resumen.viaticos_activos.length === 0) {
    mensaje += `📁 *Bolsas de Viáticos Activas:* Ninguna asignada actualmente.\n\n`;
  } else {
    mensaje += `💼 *Bolsas de Viáticos Activas:*\n`;
    for (const v of resumen.viaticos_activos) {
      mensaje += `━━━━━━━━━━━━━━━━━━━━\n`;
      mensaje += `📌 *Proyecto:* ${v.nombre_proyecto}\n`;
      mensaje += `💵 *Asignado:* $${v.monto_asignado_usd.toFixed(2)} USD\n`;
      mensaje += `📉 *Rendido:* $${v.acumulado_gastado_usd.toFixed(2)} USD\n`;
      mensaje += `💰 *Disponible:* *$${v.saldo_disponible_usd.toFixed(2)} USD*\n`;
    }
    mensaje += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    mensaje += `📈 *Total General Disponible:* *$${resumen.total_disponible_usd.toFixed(2)} USD*\n\n`;
  }

  if (resumen.solicitudes_pendientes.length > 0) {
    mensaje += `⏳ *Solicitudes en Aprobación:*\n`;
    for (const p of resumen.solicitudes_pendientes) {
      mensaje += `• *${p.nombre_proyecto}:* $${p.monto_asignado_usd.toFixed(2)} USD (Pendiente por Gerencia)\n`;
    }
    mensaje += `\n`;
  }

  mensaje += `💡 *Tip:* Para rendir un gasto, envía la foto de tu comprobante directamente o selecciona *Rendir Viáticos* en el menú.`;
  return mensaje;
}
