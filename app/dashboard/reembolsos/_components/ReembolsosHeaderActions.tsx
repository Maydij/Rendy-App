'use client';

/**
 * @name ReembolsosHeaderActions
 * @description [UI Component]: Header utility actions for the Reimbursements module,
 * enabling CSV financial reconciliation export and quick navigation to claims ready for payment.
 */

import React, { useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Download, SendHorizontal } from 'lucide-react';
import type { ReembolsoItem } from '@/lib/services/reembolsos.service';

interface ReembolsosHeaderActionsProps {
  data: ReembolsoItem[];
  procesadosCount: number;
  userRole?: 'ADMIN' | 'EMPLOYEE';
}

export function ReembolsosHeaderActions({
  data,
  procesadosCount,
  userRole = 'ADMIN',
}: ReembolsosHeaderActionsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const isEmployee = userRole === 'EMPLOYEE';

  const handleExportCsv = () => {
    if (data.length === 0) return;

    const headers = [
      'ID',
      'Empleado',
      'Email',
      'Fecha',
      'Comercio',
      'RIF/ID',
      'Factura Nro',
      'Categoría',
      'Monto Original',
      'Moneda',
      'Tasa de Cambio',
      'Monto USD',
      'Estado',
      'Motivo Rechazo',
    ];

    const rows = data.map((r) => [
      `"${r.id}"`,
      `"${r.usuario.nombre.replace(/"/g, '""')}"`,
      `"${(r.usuario.email || '').replace(/"/g, '""')}"`,
      `"${r.fecha_gasto}"`,
      `"${r.comercio.replace(/"/g, '""')}"`,
      `"${(r.rif_comercio || '').replace(/"/g, '""')}"`,
      `"${(r.numero_factura || '').replace(/"/g, '""')}"`,
      `"${r.categoria.replace(/"/g, '""')}"`,
      r.monto.toFixed(2),
      `"${r.moneda}"`,
      r.tasa_cambio != null ? r.tasa_cambio.toFixed(2) : '',
      r.monto_usd.toFixed(2),
      `"${r.estado}"`,
      `"${(r.comentario_rechazo || '').replace(/"/g, '""')}"`,
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `rendy_conciliacion_reembolsos_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFilterReadyForTransfer = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('estado', 'PROCESADO');
    params.set('page', '1');
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
      <button
        type="button"
        onClick={handleExportCsv}
        disabled={data.length === 0}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/40 text-on-surface text-xs font-semibold transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        <Download className="w-4 h-4 text-secondary" />
        <span>Exportar Conciliación</span>
      </button>

      {!isEmployee && procesadosCount > 0 && (
        <button
          type="button"
          onClick={handleFilterReadyForTransfer}
          disabled={isPending}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-container hover:bg-primary-fixed text-on-primary-container text-xs font-bold shadow-[0_0_20px_rgba(0,229,153,0.3)] transition-all active:scale-95 cursor-pointer"
        >
          <SendHorizontal className="w-4 h-4" />
          <span>Por Transferir ({procesadosCount})</span>
        </button>
      )}
    </div>
  );
}
