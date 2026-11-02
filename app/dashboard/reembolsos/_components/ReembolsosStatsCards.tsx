'use client';

/**
 * @name ReembolsosStatsCards
 * @description [UI Component]: Displays high-level aggregated financial KPI cards
 * for corporate reimbursements (Pending review, Processed ready for transfer, Settled transfers, and Total).
 */

import React from 'react';
import { Clock, CheckCircle2, SendHorizontal, DollarSign } from 'lucide-react';
import type { ReembolsosKpisResponse } from '@/lib/services/reembolsos.service';

interface ReembolsosStatsCardsProps {
  kpis: ReembolsosKpisResponse;
}

export function ReembolsosStatsCards({ kpis }: ReembolsosStatsCardsProps) {
  const formatUsd = (amount: number): string =>
    `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;

  const cards = [
    {
      label: 'Pendientes de Revisión',
      count: kpis.pendientesCount,
      amount: formatUsd(kpis.pendientesMontoUsd),
      icon: Clock,
      colorClass: 'amber',
      subtext: 'Comprobantes por auditar',
    },
    {
      label: 'Listos para Transferir',
      count: kpis.procesadosCount,
      amount: formatUsd(kpis.procesadosMontoUsd),
      icon: CheckCircle2,
      colorClass: 'indigo',
      subtext: 'Aprobados contablemente',
    },
    {
      label: 'Pagados / Transferidos',
      count: kpis.transferidosCount,
      amount: formatUsd(kpis.transferidosMontoUsd),
      icon: SendHorizontal,
      colorClass: 'emerald',
      subtext: 'Fondos liquidados con éxito',
    },
    {
      label: 'Volumen Total Reembolsos',
      count: kpis.totalCount,
      amount: formatUsd(kpis.totalMontoUsd),
      icon: DollarSign,
      colorClass: 'indigo',
      subtext: `${kpis.rechazadosCount} rechazados`,
    },
  ];

  return (
    <div className="kpi-grid">
      {cards.map((card, idx) => {
        const IconComponent = card.icon;
        return (
          <div key={idx} className="kpi-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <span className="kpi-card-label">{card.label}</span>
              <div className={`kpi-card-icon ${card.colorClass}`}>
                <IconComponent size={18} strokeWidth={2.2} />
              </div>
            </div>
            <div className="kpi-card-value" style={{ fontSize: '20px', fontWeight: 700 }}>
              {card.amount}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {card.count} {card.count === 1 ? 'comprobante' : 'comprobantes'}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {card.subtext}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

