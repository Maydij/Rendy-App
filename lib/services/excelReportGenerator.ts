/**
 * @file excelReportGenerator.ts
 * @description [Business Logic]: Multi-jurisdiction accounting spreadsheet generator for Rendy.
 * Generates dual-sheet Microsoft Excel (.xlsx) financial workbooks with dynamic international tax compliance:
 *   1. "Resumen Ejecutivo": Multi-currency KPI dashboard, country-specific fiscal disclosures
 *      (SENIAT for Venezuela, SAT for Mexico, DIAN for Colombia, IRS/State for US, EU VAT for Europe),
 *      and category distribution.
 *   2. "Detalle de Gastos": Multi-currency line-item analytical table with local tax breakdown
 *      (Base Imponible, IVA/Sales Tax, Special Taxes, Exempt, USD consolidation, Receipt Hyperlinks).
 */

import ExcelJS from 'exceljs';
import {
  detectTaxJurisdiction,
  JURISDICTION_CATALOG,
  type TaxJurisdictionRules,
} from './taxRulesEngine';

/* ─────────────────────────────────────────────────────────────
 * Types & Interfaces
 * ───────────────────────────────────────────────────────────── */

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  currency?: string;
  projectId?: string;
  projectName?: string;
  employeeId?: string;
  employeeName?: string;
  expenseType?: 'ALL' | 'VIATICOS' | 'REEMBOLSOS' | 'CORPORATIVO';
  status?: string;
}

export interface ReportExpenseItem {
  id: string;
  expenseDate: string;
  createdAt: string;
  expenseType: 'Viático' | 'Reembolso' | 'Tarjeta Corporativa';
  employeeName: string;
  projectName: string;
  category: string;
  merchantName: string;
  merchantTaxId: string | null;
  taxIdType: string;
  invoiceNumber: string | null;
  concept: string | null;
  jurisdictionName: string;
  originalCurrency: string;
  nominalAmount: number;
  exchangeRate: number;
  taxBaseLocal: number;
  exemptLocal: number;
  vatLocal: number;
  specialTaxLocal: number;
  totalLocal: number;
  totalUsd: number;
  status: string;
  receiptUrl: string | null;
}

export interface GenerateExcelReportOptions {
  companyName: string;
  companyRif?: string | null;
  generatedByName: string;
  filters: ReportFilters;
  expenses: ReportExpenseItem[];
}

/* ─────────────────────────────────────────────────────────────
 * Style Constants
 * ───────────────────────────────────────────────────────────── */

const COLORS = {
  headerBg: 'FF10131C',        // Dark Rendy Navy
  headerText: 'FFFFFFFF',      // White
  accentGreen: 'FF00A86B',     // Rendy Emerald
  accentSoftGreen: 'FFE6F7F0', // Light emerald tint
  summaryHeaderBg: 'FF1E293B', // Slate 800
  zebraRow: 'FFF8FAFC',        // Slate 50
  white: 'FFFFFFFF',
  borderGray: 'FFE2E8F0',      // Slate 200
  textMuted: 'FF64748B',       // Slate 500
  textDark: 'FF0F172A',        // Slate 900
};

const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: COLORS.borderGray } },
  left: { style: 'thin', color: { argb: COLORS.borderGray } },
  bottom: { style: 'thin', color: { argb: COLORS.borderGray } },
  right: { style: 'thin', color: { argb: COLORS.borderGray } },
};

const BORDER_HEADER: Partial<ExcelJS.Borders> = {
  top: { style: 'medium', color: { argb: COLORS.headerBg } },
  left: { style: 'thin', color: { argb: COLORS.borderGray } },
  bottom: { style: 'medium', color: { argb: COLORS.headerBg } },
  right: { style: 'thin', color: { argb: COLORS.borderGray } },
};

const BORDER_TOTAL: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: COLORS.headerBg } },
  bottom: { style: 'double', color: { argb: COLORS.headerBg } },
  left: { style: 'thin', color: { argb: COLORS.borderGray } },
  right: { style: 'thin', color: { argb: COLORS.borderGray } },
};

/* ─────────────────────────────────────────────────────────────
 * Main Generator
 * ───────────────────────────────────────────────────────────── */

/**
 * @name generateAccountingExcelReport
 * @description [Business Logic]: Constructs an internationalized, multi-currency Excel workbook.
 * Adapts fiscal disclosures dynamically according to the currencies detected in the filtered expenses.
 */
export async function generateAccountingExcelReport(
  options: GenerateExcelReportOptions
): Promise<Uint8Array> {
  const { companyName, companyRif, generatedByName, filters, expenses } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Rendy Expense Intelligence';
  workbook.lastModifiedBy = generatedByName;
  workbook.created = new Date();
  workbook.modified = new Date();

  // 1. Build "Resumen Ejecutivo" Sheet (Dynamic multi-currency & jurisdiction tabs)
  buildSummarySheet(workbook, { companyName, companyRif, generatedByName, filters, expenses });

  // 2. Build "Detalle de Gastos" Sheet (Analytical multi-currency table)
  buildExpenseDetailSheet(workbook, expenses);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

/* ─────────────────────────────────────────────────────────────
 * Sheet 1: Resumen Ejecutivo
 * ───────────────────────────────────────────────────────────── */

function buildSummarySheet(
  workbook: ExcelJS.Workbook,
  data: GenerateExcelReportOptions
): void {
  const { companyName, companyRif, generatedByName, filters, expenses } = data;
  const sheet = workbook.addWorksheet('Resumen Ejecutivo', {
    views: [{ showGridLines: true }],
  });

  // Analyze distinct currencies present in this report
  const currencySet = new Set<string>();
  expenses.forEach((e) => currencySet.add(e.originalCurrency));
  const detectedCurrencies = Array.from(currencySet);
  if (detectedCurrencies.length === 0) detectedCurrencies.push('USD');

  const totalCount = expenses.length;
  const totalUsd = expenses.reduce((acc, curr) => acc + (curr.totalUsd || 0), 0);

  // Currency totals map
  const currencyTotalsMap = new Map<string, { count: number; totalLocal: number; totalUsd: number }>();
  expenses.forEach((e) => {
    const cur = e.originalCurrency;
    const curr = currencyTotalsMap.get(cur) || { count: 0, totalLocal: 0, totalUsd: 0 };
    curr.count += 1;
    curr.totalLocal += e.totalLocal || 0;
    curr.totalUsd += e.totalUsd || 0;
    currencyTotalsMap.set(cur, curr);
  });

  // Title Block
  sheet.mergeCells('B2:H2');
  const titleCell = sheet.getCell('B2');
  titleCell.value = 'RENDY • REPORTE FINANCIERO Y RENDICIÓN DE GASTOS';
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: COLORS.headerBg } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(2).height = 28;

  sheet.mergeCells('B3:H3');
  const subtitleCell = sheet.getCell('B3');
  subtitleCell.value = `Consolidado Multidivisa (${detectedCurrencies.join(', ')}) con Desglose Fiscal Internacional`;
  subtitleCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: COLORS.textMuted } };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(3).height = 18;

  // Metadata Section (Rows 5-8)
  const metaRows: [string, string, string, string][] = [
    [
      'Empresa:',
      companyName || 'Rendy Demo',
      'Fecha de Emisión:',
      new Date().toLocaleDateString('es-VE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    ],
    [
      'ID Fiscal Empresa:',
      companyRif || 'J-50000000-0',
      'Generado Por:',
      generatedByName || 'Administrador',
    ],
    [
      'Período Consultado:',
      filters.dateFrom && filters.dateTo ? `${filters.dateFrom} al ${filters.dateTo}` : 'Histórico Completo',
      'Monedas en Reporte:',
      detectedCurrencies.join(', '),
    ],
    [
      'Proyecto Filtrado:',
      filters.projectName || 'Todos los Proyectos',
      'Colaborador:',
      filters.employeeName || 'Todos los Colaboradores',
    ],
  ];

  metaRows.forEach((rowVals, idx) => {
    const rowNum = 5 + idx;
    const r = sheet.getRow(rowNum);
    r.height = 20;

    sheet.getCell(`B${rowNum}`).value = rowVals[0];
    sheet.getCell(`B${rowNum}`).font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLORS.textMuted } };

    sheet.getCell(`C${rowNum}`).value = rowVals[1];
    sheet.getCell(`C${rowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.textDark } };

    sheet.getCell(`E${rowNum}`).value = rowVals[2];
    sheet.getCell(`E${rowNum}`).font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLORS.textMuted } };

    sheet.getCell(`F${rowNum}`).value = rowVals[3];
    sheet.getCell(`F${rowNum}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.textDark } };
  });

  // Section 1: KPI Dashboard Grid
  sheet.getCell('B10').value = '1. INDICADORES FINANCIEROS CONSOLIDADOS';
  sheet.getCell('B10').font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLORS.headerBg } };
  sheet.getRow(10).height = 22;

  // Build dynamic KPI columns: Invoices, Total USD, and up to 4 currency totals
  const kpiItems: { title: string; value: number; format: string }[] = [
    { title: 'Comprobantes Totales', value: totalCount, format: '#,##0' },
    { title: 'Volumen Global (USD)', value: totalUsd, format: '$#,##0.00' },
  ];

  detectedCurrencies.forEach((cur) => {
    const dataCur = currencyTotalsMap.get(cur);
    const amount = dataCur ? dataCur.totalLocal : 0;
    kpiItems.push({
      title: `Total en ${cur}`,
      value: amount,
      format: cur === 'USD' ? '$#,##0.00' : '#,##0.00',
    });
  });

  sheet.getRow(11).height = 18;
  sheet.getRow(12).height = 26;

  const colLetters = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
  kpiItems.forEach((kpi, idx) => {
    const col = colLetters[idx] || 'B';
    const headCell = sheet.getCell(`${col}11`);
    headCell.value = kpi.title;
    headCell.font = { name: 'Calibri', size: 8, bold: true, color: { argb: COLORS.white } };
    headCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
    headCell.alignment = { horizontal: 'center', vertical: 'middle' };
    headCell.border = BORDER_THIN;

    const valCell = sheet.getCell(`${col}12`);
    valCell.value = kpi.value;
    valCell.numFmt = kpi.format;
    valCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLORS.accentGreen } };
    valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.accentSoftGreen } };
    valCell.alignment = { horizontal: 'center', vertical: 'middle' };
    valCell.border = BORDER_THIN;
  });

  let currentRow = 14;

  // Section 2: Country-Specific Fiscal Breakdown Blocks
  // ONLY render Venezuela (SENIAT) if VES is present in the report!
  if (detectedCurrencies.includes('VES')) {
    const vesExpenses = expenses.filter((e) => e.originalCurrency === 'VES');
    const totalVes = vesExpenses.reduce((sum, e) => sum + e.totalLocal, 0);
    const totalTaxBaseVes = vesExpenses.reduce((sum, e) => sum + e.taxBaseLocal, 0);
    const totalIvaVes = vesExpenses.reduce((sum, e) => sum + e.vatLocal, 0);
    const totalIgtfVes = vesExpenses.reduce((sum, e) => sum + e.specialTaxLocal, 0);
    const totalExemptVes = vesExpenses.reduce((sum, e) => sum + e.exemptLocal, 0);

    sheet.getCell(`B${currentRow}`).value = '2. RESUMEN FISCAL VENEZUELA (SENIAT)';
    sheet.getCell(`B${currentRow}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLORS.headerBg } };
    sheet.getRow(currentRow).height = 22;
    currentRow++;

    renderFiscalTable(sheet, currentRow, [
      ['Base Imponible Gravable (IVA 16%)', totalTaxBaseVes, '#,##0.00', 'Monto gravado sujeto a la alícuota general de IVA.'],
      ['Impuesto al Valor Agregado (IVA 16%)', totalIvaVes, '#,##0.00', 'Débito/crédito fiscal liquidado a favor del SENIAT.'],
      ['Impuesto a Grandes Transacciones Financieras (IGTF 3%)', totalIgtfVes, '#,##0.00', 'Tributo por operaciones en divisas o moneda extranjera.'],
      ['Monto Exento / Exonerado', totalExemptVes, '#,##0.00', 'Operaciones sin incidencia impositiva de IVA.'],
      ['Total Consolidado en Bolívares (VES)', totalVes, '#,##0.00', 'Suma total facturada en moneda legal venezolana.'],
    ]);

    currentRow += 7;
  }

  // Render Mexico (SAT) if MXN is present in the report
  if (detectedCurrencies.includes('MXN')) {
    const mxnExpenses = expenses.filter((e) => e.originalCurrency === 'MXN');
    const totalMxn = mxnExpenses.reduce((sum, e) => sum + e.totalLocal, 0);
    const totalTaxBaseMxn = mxnExpenses.reduce((sum, e) => sum + e.taxBaseLocal, 0);
    const totalIvaMxn = mxnExpenses.reduce((sum, e) => sum + e.vatLocal, 0);
    const totalIepsMxn = mxnExpenses.reduce((sum, e) => sum + e.specialTaxLocal, 0);
    const totalExemptMxn = mxnExpenses.reduce((sum, e) => sum + e.exemptLocal, 0);

    const sectionNum = detectedCurrencies.includes('VES') ? '3' : '2';
    sheet.getCell(`B${currentRow}`).value = `${sectionNum}. RESUMEN FISCAL MÉXICO (SAT)`;
    sheet.getCell(`B${currentRow}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLORS.headerBg } };
    sheet.getRow(currentRow).height = 22;
    currentRow++;

    renderFiscalTable(sheet, currentRow, [
      ['Base Gravable (IVA 16% / 8% Fronterizo)', totalTaxBaseMxn, '#,##0.00', 'Subtotal antes de impuestos de comprobantes fiscales digitales (CFDI).'],
      ['IVA Trasladado (16%)', totalIvaMxn, '#,##0.00', 'Impuesto al Valor Agregado acreditable conforme a la LIVA.'],
      ['IEPS (Impuesto Especial sobre Producción y Servicios)', totalIepsMxn, '#,##0.00', 'Impuesto especial aplicable a gasolinas, tabacos y alimentos calóricos.'],
      ['Actos a Tasa 0% / Exentos', totalExemptMxn, '#,##0.00', 'Actividades comerciales exentas o con tasa cero conforme al SAT.'],
      ['Total Consolidado en Pesos Mexicanos (MXN)', totalMxn, '#,##0.00', 'Total facturado amparado por CFDI en territorio mexicano.'],
    ]);

    currentRow += 7;
  }

  // Render Colombia (DIAN) if COP is present
  if (detectedCurrencies.includes('COP')) {
    const copExpenses = expenses.filter((e) => e.originalCurrency === 'COP');
    const totalCop = copExpenses.reduce((sum, e) => sum + e.totalLocal, 0);
    const totalTaxBaseCop = copExpenses.reduce((sum, e) => sum + e.taxBaseLocal, 0);
    const totalIvaCop = copExpenses.reduce((sum, e) => sum + e.vatLocal, 0);
    const totalIncCop = copExpenses.reduce((sum, e) => sum + e.specialTaxLocal, 0);
    const totalExemptCop = copExpenses.reduce((sum, e) => sum + e.exemptLocal, 0);

    sheet.getCell(`B${currentRow}`).value = `RESUMEN FISCAL COLOMBIA (DIAN)`;
    sheet.getCell(`B${currentRow}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLORS.headerBg } };
    sheet.getRow(currentRow).height = 22;
    currentRow++;

    renderFiscalTable(sheet, currentRow, [
      ['Base Gravable (IVA 19% / 5%)', totalTaxBaseCop, '#,##0.00', 'Monto gravable según Estatuto Tributario de la DIAN.'],
      ['Impuesto sobre las Ventas (IVA 19%)', totalIvaCop, '#,##0.00', 'IVA generado y descontable por compras y servicios.'],
      ['Impuesto Nacional al Consumo (INC 8%)', totalIncCop, '#,##0.00', 'Impuesto aplicable al servicio de comidas y bebidas.'],
      ['Excluido / Exento de IVA', totalExemptCop, '#,##0.00', 'Bienes de la canasta o servicios exentos de imposición.'],
      ['Total Consolidado en Pesos Colombianos (COP)', totalCop, '#,##0.00', 'Total facturado en territorio colombiano.'],
    ]);

    currentRow += 7;
  }

  // Section: Category Distribution
  sheet.getCell(`B${currentRow}`).value = 'DISTRIBUCIÓN DE GASTOS POR CATEGORÍA';
  sheet.getCell(`B${currentRow}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLORS.headerBg } };
  sheet.getRow(currentRow).height = 22;
  currentRow++;

  const catHeadRow = currentRow;
  sheet.getRow(catHeadRow).height = 20;

  const catCols = [
    { col: 'B', title: 'Categoría', align: 'left' },
    { col: 'C', title: 'N° Facturas', align: 'center' },
    { col: 'D', title: 'Total Consolidado (USD)', align: 'right' },
    { col: 'E', title: '% del Presupuesto', align: 'right' },
  ];

  catCols.forEach((c) => {
    const cell = sheet.getCell(`${c.col}${catHeadRow}`);
    cell.value = c.title;
    cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLORS.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
    cell.alignment = { horizontal: c.align as ExcelJS.Alignment['horizontal'], vertical: 'middle' };
    cell.border = BORDER_THIN;
  });

  const categoryMap = new Map<string, { count: number; totalUsd: number }>();
  expenses.forEach((item) => {
    const cat = item.category || 'Otros';
    const curr = categoryMap.get(cat) || { count: 0, totalUsd: 0 };
    curr.count += 1;
    curr.totalUsd += item.totalUsd || 0;
    categoryMap.set(cat, curr);
  });

  const sortedCategories = Array.from(categoryMap.entries()).sort((a, b) => b[1].totalUsd - a[1].totalUsd);
  let currentCatRow = catHeadRow + 1;

  sortedCategories.forEach(([cat, metrics], cIdx) => {
    sheet.getRow(currentCatRow).height = 19;
    const isZebra = cIdx % 2 === 1;
    const rowFill: ExcelJS.Fill = isZebra
      ? { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.zebraRow } }
      : { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.white } };

    const bCell = sheet.getCell(`B${currentCatRow}`);
    bCell.value = cat;
    bCell.font = { name: 'Calibri', size: 9 };
    bCell.fill = rowFill;
    bCell.border = BORDER_THIN;

    const cCell = sheet.getCell(`C${currentCatRow}`);
    cCell.value = metrics.count;
    cCell.numFmt = '#,##0';
    cCell.font = { name: 'Calibri', size: 9 };
    cCell.alignment = { horizontal: 'center' };
    cCell.fill = rowFill;
    cCell.border = BORDER_THIN;

    const dCell = sheet.getCell(`D${currentCatRow}`);
    dCell.value = metrics.totalUsd;
    dCell.numFmt = '$#,##0.00';
    dCell.font = { name: 'Calibri', size: 9 };
    dCell.alignment = { horizontal: 'right' };
    dCell.fill = rowFill;
    dCell.border = BORDER_THIN;

    const eCell = sheet.getCell(`E${currentCatRow}`);
    eCell.value = totalUsd > 0 ? metrics.totalUsd / totalUsd : 0;
    eCell.numFmt = '0.0%';
    eCell.font = { name: 'Calibri', size: 9 };
    eCell.alignment = { horizontal: 'right' };
    eCell.fill = rowFill;
    eCell.border = BORDER_THIN;

    currentCatRow++;
  });

  // Total summary row for categories
  if (sortedCategories.length > 0) {
    sheet.getRow(currentCatRow).height = 20;

    const bTotal = sheet.getCell(`B${currentCatRow}`);
    bTotal.value = 'TOTAL CONSOLIDADO';
    bTotal.font = { name: 'Calibri', size: 9, bold: true };
    bTotal.border = BORDER_TOTAL;

    const cTotal = sheet.getCell(`C${currentCatRow}`);
    cTotal.value = { formula: `SUM(C${catHeadRow + 1}:C${currentCatRow - 1})` };
    cTotal.numFmt = '#,##0';
    cTotal.font = { name: 'Calibri', size: 9, bold: true };
    cTotal.alignment = { horizontal: 'center' };
    cTotal.border = BORDER_TOTAL;

    const dTotal = sheet.getCell(`D${currentCatRow}`);
    dTotal.value = { formula: `SUM(D${catHeadRow + 1}:D${currentCatRow - 1})` };
    dTotal.numFmt = '$#,##0.00';
    dTotal.font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLORS.accentGreen } };
    dTotal.alignment = { horizontal: 'right' };
    dTotal.border = BORDER_TOTAL;

    const eTotal = sheet.getCell(`E${currentCatRow}`);
    eTotal.value = 1.0;
    eTotal.numFmt = '0.0%';
    eTotal.font = { name: 'Calibri', size: 9, bold: true };
    eTotal.alignment = { horizontal: 'right' };
    eTotal.border = BORDER_TOTAL;
  }

  // Column widths
  sheet.getColumn('A').width = 4;
  sheet.getColumn('B').width = 38;
  sheet.getColumn('C').width = 24;
  sheet.getColumn('D').width = 24;
  sheet.getColumn('E').width = 24;
  sheet.getColumn('F').width = 24;
  sheet.getColumn('G').width = 24;
  sheet.getColumn('H').width = 24;
}

/**
 * @name renderFiscalTable
 * @description [Helper]: Renders a structured 5-row fiscal accounting table on the Summary worksheet.
 */
function renderFiscalTable(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  rows: [string, number, string, string][]
): void {
  sheet.getRow(startRow).height = 20;

  sheet.getCell(`B${startRow}`).value = 'Concepto Tributario';
  sheet.getCell(`B${startRow}`).font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLORS.white } };
  sheet.getCell(`B${startRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.summaryHeaderBg } };
  sheet.getCell(`B${startRow}`).border = BORDER_THIN;

  sheet.getCell(`C${startRow}`).value = 'Monto Fiscal';
  sheet.getCell(`C${startRow}`).font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLORS.white } };
  sheet.getCell(`C${startRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.summaryHeaderBg } };
  sheet.getCell(`C${startRow}`).alignment = { horizontal: 'right' };
  sheet.getCell(`C${startRow}`).border = BORDER_THIN;

  sheet.mergeCells(`D${startRow}:G${startRow}`);
  sheet.getCell(`D${startRow}`).value = 'Fundamento Legal y Alcance';
  sheet.getCell(`D${startRow}`).font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLORS.white } };
  sheet.getCell(`D${startRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.summaryHeaderBg } };
  sheet.getCell(`D${startRow}`).border = BORDER_THIN;

  rows.forEach(([concept, amt, fmt, notes], idx) => {
    const rNum = startRow + 1 + idx;
    sheet.getRow(rNum).height = 19;

    const isTotal = idx === rows.length - 1;
    const fontStyle = { name: 'Calibri', size: 9, bold: isTotal, color: { argb: COLORS.textDark } };
    const borderStyle = isTotal ? BORDER_TOTAL : BORDER_THIN;

    sheet.getCell(`B${rNum}`).value = concept;
    sheet.getCell(`B${rNum}`).font = fontStyle;
    sheet.getCell(`B${rNum}`).border = borderStyle;

    const amtCell = sheet.getCell(`C${rNum}`);
    amtCell.value = amt;
    amtCell.numFmt = fmt;
    amtCell.font = {
      name: 'Calibri',
      size: 9,
      bold: isTotal,
      color: isTotal ? { argb: COLORS.accentGreen } : { argb: COLORS.textDark },
    };
    amtCell.alignment = { horizontal: 'right' };
    amtCell.border = borderStyle;

    sheet.mergeCells(`D${rNum}:G${rNum}`);
    sheet.getCell(`D${rNum}`).value = notes;
    sheet.getCell(`D${rNum}`).font = { name: 'Calibri', size: 8, italic: true, color: { argb: COLORS.textMuted } };
    sheet.getCell(`D${rNum}`).border = borderStyle;
  });
}

/* ─────────────────────────────────────────────────────────────
 * Sheet 2: Detalle de Gastos (Multi-Currency Analytical Table)
 * ───────────────────────────────────────────────────────────── */

function buildExpenseDetailSheet(
  workbook: ExcelJS.Workbook,
  expenses: ReportExpenseItem[]
): void {
  const sheet = workbook.addWorksheet('Detalle de Gastos', {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: true }],
  });

  const columns: {
    header: string;
    key: string;
    width: number;
    align: ExcelJS.Alignment['horizontal'];
    format?: string;
  }[] = [
    { header: '#', key: 'index', width: 6, align: 'center' },
    { header: 'Fecha', key: 'expenseDate', width: 13, align: 'center' },
    { header: 'Tipo', key: 'expenseType', width: 18, align: 'center' },
    { header: 'Empleado', key: 'employeeName', width: 22, align: 'left' },
    { header: 'Proyecto', key: 'projectName', width: 22, align: 'left' },
    { header: 'Categoría', key: 'category', width: 18, align: 'left' },
    { header: 'Comercio / Proveedor', key: 'merchantName', width: 28, align: 'left' },
    { header: 'ID Fiscal (RIF/RFC/NIT)', key: 'merchantTaxId', width: 18, align: 'center' },
    { header: 'N° Factura / Control', key: 'invoiceNumber', width: 18, align: 'center' },
    { header: 'Concepto', key: 'concept', width: 30, align: 'left' },
    { header: 'Jurisdicción Fiscal', key: 'jurisdictionName', width: 22, align: 'left' },
    { header: 'Moneda Orig.', key: 'originalCurrency', width: 13, align: 'center' },
    { header: 'Monto Nominal', key: 'nominalAmount', width: 16, align: 'right', format: '#,##0.00' },
    { header: 'Tasa vs USD', key: 'exchangeRate', width: 14, align: 'right', format: '#,##0.0000' },
    { header: 'Base Imponible Local', key: 'taxBaseLocal', width: 20, align: 'right', format: '#,##0.00' },
    { header: 'Exento Local', key: 'exemptLocal', width: 16, align: 'right', format: '#,##0.00' },
    { header: 'Impuesto IVA / Sales Tax', key: 'vatLocal', width: 22, align: 'right', format: '#,##0.00' },
    { header: 'Impuestos Esp. (IGTF/IEPS)', key: 'specialTaxLocal', width: 22, align: 'right', format: '#,##0.00' },
    { header: 'Total Moneda Local', key: 'totalLocal', width: 20, align: 'right', format: '#,##0.00' },
    { header: 'Total Consolidado (USD)', key: 'totalUsd', width: 20, align: 'right', format: '$#,##0.00' },
    { header: 'Estado', key: 'status', width: 15, align: 'center' },
    { header: 'Comprobante', key: 'receiptUrl', width: 18, align: 'center' },
  ];

  sheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width,
  }));

  // Style Header Row (Row 1)
  const headerRow = sheet.getRow(1);
  headerRow.height = 26;

  headerRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLORS.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
    cell.alignment = {
      horizontal: columns[colNumber - 1]?.align || 'left',
      vertical: 'middle',
      wrapText: false,
    };
    cell.border = BORDER_HEADER;
  });

  // Enable AutoFilter on header row
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };

  // Populate Data Rows
  expenses.forEach((item, index) => {
    const rowNumber = index + 2;
    const isZebra = index % 2 === 1;
    const rowFill: ExcelJS.Fill = isZebra
      ? { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.zebraRow } }
      : { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.white } };

    const row = sheet.getRow(rowNumber);
    row.height = 20;

    const rowData: Record<string, unknown> = {
      index: index + 1,
      expenseDate: item.expenseDate,
      expenseType: item.expenseType,
      employeeName: item.employeeName,
      projectName: item.projectName,
      category: item.category,
      merchantName: item.merchantName,
      merchantTaxId: item.merchantTaxId || '—',
      invoiceNumber: item.invoiceNumber || '—',
      concept: item.concept || '—',
      jurisdictionName: item.jurisdictionName,
      originalCurrency: item.originalCurrency,
      nominalAmount: item.nominalAmount,
      exchangeRate: item.exchangeRate,
      taxBaseLocal: item.taxBaseLocal,
      exemptLocal: item.exemptLocal,
      vatLocal: item.vatLocal,
      specialTaxLocal: item.specialTaxLocal,
      totalLocal: item.totalLocal,
      totalUsd: item.totalUsd,
      status: item.status,
      receiptUrl: item.receiptUrl,
    };

    columns.forEach((col, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      const val = rowData[col.key];

      if (col.key === 'receiptUrl' && val && typeof val === 'string' && val.startsWith('http')) {
        cell.value = {
          text: 'Ver Comprobante',
          hyperlink: val,
        };
        cell.font = { name: 'Calibri', size: 9, color: { argb: 'FF2563EB' }, underline: true };
      } else {
        cell.value = val as ExcelJS.CellValue;
        cell.font = { name: 'Calibri', size: 9, color: { argb: COLORS.textDark } };
      }

      if (col.format) {
        cell.numFmt = col.format;
      }

      cell.alignment = {
        horizontal: col.align,
        vertical: 'middle',
      };
      cell.fill = rowFill;
      cell.border = BORDER_THIN;
    });
  });

  // Footer Totals Row
  const totalRowNum = expenses.length + 2;
  const footerRow = sheet.getRow(totalRowNum);
  footerRow.height = 24;

  columns.forEach((_, idx) => {
    const cell = footerRow.getCell(idx + 1);
    cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLORS.textDark } };
    cell.border = BORDER_TOTAL;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.accentSoftGreen } };
  });

  const labelCell = footerRow.getCell(1);
  labelCell.value = 'TOTALES';
  labelCell.alignment = { horizontal: 'center', vertical: 'middle' };

  if (expenses.length > 0) {
    const startRow = 2;
    const endRow = totalRowNum - 1;

    // Total USD (col 20 / T)
    const usdCell = footerRow.getCell(20);
    usdCell.value = { formula: `SUM(T${startRow}:T${endRow})` };
    usdCell.numFmt = '$#,##0.00';
    usdCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLORS.accentGreen } };
    usdCell.alignment = { horizontal: 'right', vertical: 'middle' };
  }
}
