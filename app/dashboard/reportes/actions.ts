'use server';

/**
 * @file actions.ts
 * @description [Business Logic]: Server Actions managing corporate financial report generation,
 * multi-jurisdiction fiscal extraction, Excel workbook serialization, and audit trail persistence
 * for the Rendy accounting reports module (/dashboard/reportes).
 */

import { revalidatePath } from 'next/cache';
import { supabaseServer, EMPRESA_ID } from '@/lib/supabase-server';
import { normalizeMoneda, getExchangeRates } from '@/lib/currency';
import { computeFiscalBreakdown } from '@/lib/services/taxRulesEngine';
import {
  generateAccountingExcelReport,
  type ReportFilters,
  type ReportExpenseItem,
} from '@/lib/services/excelReportGenerator';

/* ─────────────────────────────────────────────────────────────
 * Types
 * ───────────────────────────────────────────────────────────── */

export interface ExportReportResult {
  success: boolean;
  error?: string;
  base64?: string;
  filename?: string;
  totalCount?: number;
  totalUsd?: number;
  detectedCurrencies?: string[];
  historyItem?: ReportHistoryItem;
}

export interface ReportHistoryItem {
  id: string;
  reportName: string;
  format: string;
  filters: ReportFilters;
  totalExpenses: number;
  totalUsd: number;
  totalVes: number;
  createdAt: string;
  userName: string;
}

export interface FilterOptions {
  projects: { id: string; name: string }[];
  employees: { id: string; name: string }[];
  currencies: string[];
}

/**
 * @name resolveTrueCurrency
 * @description [Business Logic]: Resolves the authentic original currency of a receipt by
 * checking explicit transaction fields and raw OCR extractions, avoiding default fallback pollution.
 */
function resolveTrueCurrency(g: {
  moneda?: string | null;
  moneda_original?: string | null;
  datos_ocr?: Record<string, unknown> | null;
}): string {
  const ocrMoneda = g.datos_ocr?.moneda as string | undefined;

  // 1. If explicit moneda is set and is non-VES, it is definitive
  if (g.moneda && g.moneda !== 'VES') {
    return normalizeMoneda(g.moneda);
  }

  // 2. Check OCR extracted currency
  if (ocrMoneda && ocrMoneda !== 'VES' && ocrMoneda !== 'Bs' && ocrMoneda !== 'BS') {
    return normalizeMoneda(ocrMoneda);
  }

  // 3. Check explicit moneda_original if non-VES
  if (g.moneda_original && g.moneda_original !== 'VES') {
    return normalizeMoneda(g.moneda_original);
  }

  // 4. Fallback to whatever field is non-empty
  const candidate = g.moneda || ocrMoneda || g.moneda_original || 'USD';
  return normalizeMoneda(candidate);
}

/* ─────────────────────────────────────────────────────────────
 * Server Actions
 * ───────────────────────────────────────────────────────────── */

/**
 * @name exportAccountingReportAction
 * @description [Business Logic]: Executes server-side query across company expenses applying
 * user-selected fiscal filters (including multi-currency detection), computes country-specific
 * tax rules, constructs an international Excel spreadsheet, and returns Base64 for download.
 */
export async function exportAccountingReportAction(
  filters: ReportFilters
): Promise<ExportReportResult> {
  try {
    // 1. Fetch Company Information
    const { data: companyData } = await supabaseServer
      .from('empresas')
      .select('id, nombre')
      .eq('id', EMPRESA_ID)
      .single();

    const companyName = companyData?.nombre || 'Rendy Technologies';

    // 2. Build Query with Dynamic Filters
    let query = supabaseServer
      .from('gastos')
      .select(`
        id,
        fecha_gasto,
        creado_en,
        es_reembolso,
        metodo_pago_id,
        viatico_id,
        solicitud_id,
        usuario_id,
        proyecto_id,
        categoria,
        comercio,
        rif_comercio,
        numero_factura,
        concepto,
        moneda,
        moneda_original,
        monto,
        tasa_cambio,
        base_imponible_ves,
        exento_ves,
        iva_ves,
        igtf_ves,
        monto_ves,
        monto_usd,
        estado,
        url_comprobante,
        datos_ocr
      `)
      .eq('empresa_id', EMPRESA_ID);

    // Filter by Date Range
    if (filters.dateFrom) {
      query = query.gte('fecha_gasto', filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.lte('fecha_gasto', filters.dateTo);
    }

    // Filter by Project
    if (filters.projectId && filters.projectId !== 'ALL') {
      query = query.eq('proyecto_id', filters.projectId);
    }

    // Filter by Employee
    if (filters.employeeId && filters.employeeId !== 'ALL') {
      query = query.eq('usuario_id', filters.employeeId);
    }

    // Filter by Expense Type
    if (filters.expenseType === 'REEMBOLSOS') {
      query = query.eq('es_reembolso', true);
    } else if (filters.expenseType === 'VIATICOS') {
      query = query.eq('es_reembolso', false);
    }

    // Execute query ordered chronologically
    const { data: expensesRaw, error: expensesError } = await query.order('fecha_gasto', { ascending: false });

    if (expensesError) {
      console.error('❌ [exportAccountingReportAction] Database query error:', expensesError);
      return { success: false, error: 'Error al consultar los registros de gastos en la base de datos.' };
    }

    // 3. Resolve Reference Lookups (Users and Projects)
    const [{ data: usersData }, { data: projectsData }, liveRates] = await Promise.all([
      supabaseServer.from('usuarios').select('id, nombre').eq('empresa_id', EMPRESA_ID),
      supabaseServer.from('proyectos').select('id, nombre').eq('empresa_id', EMPRESA_ID),
      getExchangeRates(),
    ]);

    const userMap = new Map<string, string>();
    (usersData || []).forEach((u) => userMap.set(u.id, u.nombre));

    const projectMap = new Map<string, string>();
    (projectsData || []).forEach((p) => projectMap.set(p.id, p.nombre));

    const selectedProjectName =
      filters.projectId && filters.projectId !== 'ALL'
        ? projectMap.get(filters.projectId) || 'Proyecto Especificado'
        : 'Todos los Proyectos';

    const selectedEmployeeName =
      filters.employeeId && filters.employeeId !== 'ALL'
        ? userMap.get(filters.employeeId) || 'Colaborador Especificado'
        : 'Todos los Colaboradores';

    // 4. Transform, Filter by Currency, and Compute Localized Taxes
    const filterCurrency = filters.currency && filters.currency !== 'ALL' ? filters.currency : null;
    const detectedCurrenciesSet = new Set<string>();

    const normalizedExpenses: ReportExpenseItem[] = [];

    for (const g of expensesRaw || []) {
      const resolvedCurrency = resolveTrueCurrency({
        moneda: g.moneda,
        moneda_original: g.moneda_original,
        datos_ocr: g.datos_ocr as Record<string, unknown> | null,
      });

      // Apply currency filter if active
      if (filterCurrency && resolvedCurrency !== filterCurrency) {
        continue;
      }

      detectedCurrenciesSet.add(resolvedCurrency);

      let expenseType: 'Viático' | 'Reembolso' | 'Tarjeta Corporativa' = 'Viático';
      if (g.es_reembolso) {
        expenseType = 'Reembolso';
      } else if (g.metodo_pago_id) {
        expenseType = 'Tarjeta Corporativa';
      }

      const amount = Number(g.monto || 0);

      // Resolve Exchange Rate against USD
      let rate = g.tasa_cambio ? Number(g.tasa_cambio) : null;
      if (!rate || rate <= 0) {
        rate = liveRates[resolvedCurrency] || 1;
      }

      // Compute Total USD
      let totalUsd = Number(g.monto_usd || 0);
      if (totalUsd === 0) {
        if (resolvedCurrency === 'USD') {
          totalUsd = amount;
        } else {
          totalUsd = rate > 0 ? Number((amount / rate).toFixed(2)) : amount;
        }
      }

      // Compute Fiscal Breakdown according to Jurisdiction Laws
      const fiscal = computeFiscalBreakdown(
        amount,
        resolvedCurrency,
        g.datos_ocr as Record<string, unknown> | null,
        {
          base_imponible_ves: g.base_imponible_ves,
          iva_ves: g.iva_ves,
          exento_ves: g.exento_ves,
          igtf_ves: g.igtf_ves,
          rif_comercio: g.rif_comercio,
        }
      );

      normalizedExpenses.push({
        id: g.id,
        expenseDate: g.fecha_gasto || (g.creado_en ? g.creado_en.split('T')[0] : '—'),
        createdAt: g.creado_en || '',
        expenseType,
        employeeName: g.usuario_id ? (userMap.get(g.usuario_id) || 'Usuario') : 'Sin Asignar',
        projectName: g.proyecto_id ? (projectMap.get(g.proyecto_id) || 'General') : 'General',
        category: g.categoria || 'Otros Gastos',
        merchantName: g.comercio || (g.datos_ocr as Record<string, unknown>)?.comercio as string || 'Proveedor No Identificado',
        merchantTaxId: fiscal.taxIdFormatted,
        taxIdType: fiscal.jurisdiction.taxIdLabel,
        invoiceNumber: g.numero_factura || (g.datos_ocr as Record<string, unknown>)?.numero_factura as string || null,
        concept: g.concepto || (g.datos_ocr as Record<string, unknown>)?.concepto as string || null,
        jurisdictionName: `${fiscal.jurisdiction.countryName} (${fiscal.jurisdiction.taxAuthority})`,
        originalCurrency: resolvedCurrency,
        nominalAmount: amount,
        exchangeRate: rate,
        taxBaseLocal: fiscal.taxBase,
        exemptLocal: fiscal.exemptAmount,
        vatLocal: fiscal.vatAmount,
        specialTaxLocal: fiscal.specialTaxAmount,
        totalLocal: fiscal.totalLocal,
        totalUsd,
        status: g.estado || 'REGISTRADO',
        receiptUrl: g.url_comprobante || null,
      });
    }

    const totalCount = normalizedExpenses.length;
    const totalUsd = normalizedExpenses.reduce((sum, item) => sum + item.totalUsd, 0);
    const detectedCurrencies = Array.from(detectedCurrenciesSet);

    // 5. Generate Excel Workbook Binary
    const uint8Array = await generateAccountingExcelReport({
      companyName,
      companyRif: 'J-50000000-0',
      generatedByName: 'Administrador Rendy',
      filters: {
        ...filters,
        projectName: selectedProjectName,
        employeeName: selectedEmployeeName,
      },
      expenses: normalizedExpenses,
    });

    const base64 = Buffer.from(uint8Array).toString('base64');
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `Reporte_Contable_Rendy_${dateStamp}_${Date.now().toString().slice(-4)}.xlsx`;

    // 6. Audit in `reportes_generados` Table (Safe Execution)
    const adminUser = (usersData || [])[0];
    const adminUserName = adminUser?.nombre || 'Administrador Rendy';
    const totalVesAmount = normalizedExpenses
      .filter((e) => e.originalCurrency === 'VES')
      .reduce((sum, e) => sum + e.totalLocal, 0);

    const historyItem: ReportHistoryItem = {
      id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      reportName: filename.replace('.xlsx', ''),
      format: 'XLSX',
      filters: {
        dateFrom: filters.dateFrom || '',
        dateTo: filters.dateTo || '',
        currency: filters.currency || 'ALL',
        projectId: filters.projectId || 'ALL',
        employeeId: filters.employeeId || 'ALL',
        expenseType: filters.expenseType || 'ALL',
      },
      totalExpenses: totalCount,
      totalUsd: Number(totalUsd.toFixed(2)),
      totalVes: Number(totalVesAmount.toFixed(2)),
      createdAt: new Date().toISOString(),
      userName: adminUserName,
    };

    try {
      const adminUserId = adminUser?.id;
      if (adminUserId) {
        await supabaseServer.from('reportes_generados').insert({
          empresa_id: EMPRESA_ID,
          usuario_id: adminUserId,
          nombre_reporte: historyItem.reportName,
          formato: 'XLSX',
          filtros_aplicados: {
            dateFrom: filters.dateFrom || null,
            dateTo: filters.dateTo || null,
            currency: filters.currency || 'ALL',
            projectId: filters.projectId || 'ALL',
            employeeId: filters.employeeId || 'ALL',
            expenseType: filters.expenseType || 'ALL',
            detectedCurrencies,
          },
          total_gastos_incluidos: totalCount,
          monto_total_usd: Number(totalUsd.toFixed(2)),
          monto_total_ves: Number(totalVesAmount.toFixed(2)),
        });
      }
    } catch (auditErr) {
      console.warn('⚠️ [exportAccountingReportAction] Audit log warning (non-fatal):', auditErr);
    }

    revalidatePath('/dashboard/reportes');

    return {
      success: true,
      base64,
      filename,
      totalCount,
      totalUsd: Number(totalUsd.toFixed(2)),
      detectedCurrencies,
      historyItem,
    };
  } catch (error) {
    console.error('❌ [exportAccountingReportAction] Fatal error during report generation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error inesperado al generar el archivo Excel.',
    };
  }
}

/**
 * @name getReportHistoryAction
 * @description [Business Logic]: Retrieves the audit history of previously exported reports
 * for the current company tenant, displaying date, author, total aggregates, and filter criteria.
 */
export async function getReportHistoryAction(): Promise<ReportHistoryItem[]> {
  try {
    const { data: reports, error } = await supabaseServer
      .from('reportes_generados')
      .select(`
        id,
        nombre_reporte,
        formato,
        filtros_aplicados,
        total_gastos_incluidos,
        monto_total_usd,
        monto_total_ves,
        creado_en,
        usuario_id
      `)
      .eq('empresa_id', EMPRESA_ID)
      .order('creado_en', { ascending: false })
      .limit(20);

    if (error || !reports) {
      return [];
    }

    const { data: users } = await supabaseServer
      .from('usuarios')
      .select('id, nombre')
      .eq('empresa_id', EMPRESA_ID);

    const userMap = new Map<string, string>();
    (users || []).forEach((u) => userMap.set(u.id, u.nombre));

    return reports.map((r) => ({
      id: r.id,
      reportName: r.nombre_reporte,
      format: r.formato,
      filters: (r.filtros_aplicados as ReportFilters) || {},
      totalExpenses: r.total_gastos_incluidos || 0,
      totalUsd: Number(r.monto_total_usd || 0),
      totalVes: Number(r.monto_total_ves || 0),
      createdAt: r.creado_en,
      userName: r.usuario_id ? (userMap.get(r.usuario_id) || 'Administrador') : 'Administrador',
    }));
  } catch (err) {
    console.warn('⚠️ [getReportHistoryAction] Failed to retrieve report history:', err);
    return [];
  }
}

/**
 * @name getFilterOptionsAction
 * @description [Business Logic]: Provides active project, employee, and distinct currency lists
 * used to populate the interactive filter selectors on the report generator panel.
 */
export async function getFilterOptionsAction(): Promise<FilterOptions> {
  const [{ data: projects }, { data: users }, { data: gastos }] = await Promise.all([
    supabaseServer
      .from('proyectos')
      .select('id, nombre')
      .eq('empresa_id', EMPRESA_ID)
      .order('nombre', { ascending: true }),
    supabaseServer
      .from('usuarios')
      .select('id, nombre')
      .eq('empresa_id', EMPRESA_ID)
      .order('nombre', { ascending: true }),
    supabaseServer
      .from('gastos')
      .select('moneda, moneda_original, datos_ocr')
      .eq('empresa_id', EMPRESA_ID),
  ]);

  const currencySet = new Set<string>();
  (gastos || []).forEach((g) => {
    const cur = resolveTrueCurrency({
      moneda: g.moneda,
      moneda_original: g.moneda_original,
      datos_ocr: g.datos_ocr as Record<string, unknown> | null,
    });
    if (cur) currencySet.add(cur);
  });

  // Ensure primary supported currencies are present
  if (currencySet.size === 0) {
    currencySet.add('USD');
    currencySet.add('MXN');
    currencySet.add('VES');
  }

  return {
    projects: (projects || []).map((p) => ({ id: p.id, name: p.nombre })),
    employees: (users || []).map((u) => ({ id: u.id, name: u.nombre })),
    currencies: Array.from(currencySet),
  };
}
