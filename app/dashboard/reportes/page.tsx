/**
 * @file page.tsx
 * @description [Server Component]: Server-rendered entry point for the accounting reports module (/dashboard/reportes).
 * Fetches available filter entities (projects, employees), historical generated report audit records,
 * and company aggregate metrics directly from Supabase via server role client, passing initial state to ReportesClient.
 */

import React from 'react';
import { supabaseServer, EMPRESA_ID } from '@/lib/supabase-server';
import { getFilterOptionsAction, getReportHistoryAction } from './actions';
import { ReportesClient } from './_components/ReportesClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Reportes Contables y Exportación • Rendy',
  description: 'Exportación bimonetaria de gastos con desglose fiscal legal venezolano a Microsoft Excel (.xlsx).',
};

export default async function ReportesPage() {
  // Parallel server-side fetch of lookup entities, past reports, and summary aggregates
  const [filterOptions, history, expensesStats] = await Promise.all([
    getFilterOptionsAction(),
    getReportHistoryAction(),
    supabaseServer
      .from('gastos')
      .select('monto, moneda, monto_usd, monto_ves, tasa_cambio')
      .eq('empresa_id', EMPRESA_ID),
  ]);

  const rawExpenses = expensesStats.data || [];
  const totalExpensesInDb = rawExpenses.length;

  let totalUsdInDb = 0;
  let totalVesInDb = 0;

  rawExpenses.forEach((g) => {
    const amount = Number(g.monto || 0);
    const currency = g.moneda || 'VES';
    const rate = g.tasa_cambio ? Number(g.tasa_cambio) : null;

    let usd = Number(g.monto_usd || 0);
    let ves = Number(g.monto_ves || 0);

    if (usd === 0 && ves === 0) {
      if (currency === 'USD') {
        usd = amount;
        ves = rate ? amount * rate : amount;
      } else {
        ves = amount;
        usd = rate && rate > 0 ? amount / rate : 0;
      }
    }

    totalUsdInDb += usd;
    totalVesInDb += ves;
  });

  return (
    <ReportesClient
      projects={filterOptions.projects}
      employees={filterOptions.employees}
      currencies={filterOptions.currencies}
      initialHistory={history}
      totalExpensesInDb={totalExpensesInDb}
      totalUsdInDb={Number(totalUsdInDb.toFixed(2))}
      totalVesInDb={Number(totalVesInDb.toFixed(2))}
    />
  );
}

