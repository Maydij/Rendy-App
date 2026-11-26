'use client';

/**
 * @name ReembolsosStatsCards
 * @description [UI Component]: Displays the 4 executive financial KPI cards for corporate
 * reimbursements (Pending Review, Ready to Transfer, Settled Transfers, Total Volume)
 * following the Stitch dark Bento design system.
 */

import React, { useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Clock, CheckCircle2, SendHorizontal, Wallet } from 'lucide-react';
import type { EstadoReembolso, ReembolsosKpisResponse } from '@/lib/services/reembolsos.service';

interface ReembolsosStatsCardsProps {
  kpis: ReembolsosKpisResponse;
}

function formatUsdValue(amount: number): string {
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function ReembolsosStatsCards({ kpis }: ReembolsosStatsCardsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const activeEstado = searchParams.get('estado') || 'TODOS';

  const handleFilterClick = (estado: EstadoReembolso | 'TODOS') => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', '1');
    if (estado === 'TODOS') {
      params.delete('estado');
    } else {
      params.set('estado', estado);
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const cards = [
    {
      id: 'PENDIENTE' as const,
      label: 'Pendientes de Revisión',
      count: kpis.pendientesCount,
      amount: formatUsdValue(kpis.pendientesMontoUsd),
      icon: Clock,
      glowBg: 'bg-tertiary-container/10',
      hoverBg: 'hover:bg-surface-container',
      activeRing: 'ring-1 ring-tertiary-fixed-dim/50 bg-surface-container',
      iconBox: 'bg-tertiary-container/20 text-tertiary-fixed-dim',
      dotColor: 'bg-tertiary-fixed-dim',
      countText: 'text-tertiary-fixed-dim',
      subtext: 'Por auditar',
    },
    {
      id: 'PROCESADO' as const,
      label: 'Listos para Transferir',
      count: kpis.procesadosCount,
      amount: formatUsdValue(kpis.procesadosMontoUsd),
      icon: CheckCircle2,
      glowBg: 'bg-primary-container/10',
      hoverBg: 'hover:bg-surface-container',
      activeRing: 'ring-1 ring-primary/50 bg-surface-container',
      iconBox: 'bg-primary-container/20 text-primary-container',
      dotColor: 'bg-primary-container',
      countText: 'text-primary',
      subtext: 'Aprobados contablemente',
    },
    {
      id: 'TRANSFERIDO' as const,
      label: 'Pagados / Transferidos',
      count: kpis.transferidosCount,
      amount: formatUsdValue(kpis.transferidosMontoUsd),
      icon: SendHorizontal,
      glowBg: 'bg-secondary/10',
      hoverBg: 'hover:bg-surface-container',
      activeRing: 'ring-1 ring-secondary/50 bg-surface-container',
      iconBox: 'bg-secondary/20 text-secondary',
      dotColor: 'bg-secondary',
      countText: 'text-secondary',
      subtext: 'Fondos liquidados con éxito',
    },
    {
      id: 'TODOS' as const,
      label: 'Volumen Total Reembolsos',
      count: kpis.totalCount,
      amount: formatUsdValue(kpis.totalMontoUsd),
      icon: Wallet,
      glowBg: 'bg-primary/10',
      hoverBg: 'hover:bg-surface-container',
      activeRing: 'ring-1 ring-outline/40 bg-surface-container',
      iconBox: 'bg-surface-container-highest text-primary',
      dotColor: 'bg-primary',
      countText: 'text-on-surface',
      subtext: `${kpis.rechazadosCount} rechazado${kpis.rechazadosCount === 1 ? '' : 's'}`,
      isTotalCard: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
      {cards.map((card) => {
        const IconComponent = card.icon;
        const isActive = activeEstado === card.id;

        return (
          <button
            key={card.id}
            type="button"
            onClick={() => handleFilterClick(card.id)}
            className={`text-left relative overflow-hidden rounded-2xl bg-surface-container-low p-5 flex flex-col justify-between shadow-md transition-all cursor-pointer group ${
              isActive ? card.activeRing : card.hoverBg
            }`}
          >
            <div
              className={`absolute -right-6 -top-6 w-24 h-24 rounded-full ${card.glowBg} blur-xl pointer-events-none`}
            />

            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold truncate">
                {card.label}
              </span>
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${card.iconBox}`}
              >
                <IconComponent className="w-[18px] h-[18px]" />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-1.5 min-w-0">
              <div className="flex items-baseline gap-1.5 min-w-0">
                <span className="text-2xl sm:text-[28px] leading-tight text-on-surface tracking-tight font-bold truncate font-mono">
                  {card.amount}
                </span>
                <span className="text-xs text-on-surface-variant font-semibold shrink-0">
                  USD
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 text-[11px] text-on-surface-variant pt-1.5 border-t border-surface-container-highest/20">
                <span
                  className={`${card.countText} font-semibold inline-flex items-center gap-1.5 truncate`}
                >
                  {!card.isTotalCard && (
                    <span className={`w-1.5 h-1.5 rounded-full ${card.dotColor} shrink-0`} />
                  )}
                  <span className="truncate">
                    {card.count} {card.count === 1 ? 'comprobante' : 'comprobantes'}
                  </span>
                </span>
                <span
                  className={`truncate shrink-0 ${
                    card.isTotalCard
                      ? kpis.rechazadosCount > 0
                        ? 'text-error font-medium'
                        : 'text-primary-container font-medium'
                      : 'text-on-surface-variant/80'
                  }`}
                >
                  {card.subtext}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
