'use client';

import { useState, useCallback } from 'react';
import { Receipt, Search, Eye } from 'lucide-react';
import { useEscapeClose } from '@/lib/hooks/use-escape-close';
import type { Gasto } from '@/lib/types/gasto';
import DigitalInvoice from './digital-invoice';

/**
 * @name GastosEmpresaClient
 * @description [Business View]: Renders the corporate expense table showing
 * all receipts justified via WhatsApp that were paid with company funds
 * (corporate cards, travel advances). Each row can open a DigitalInvoice modal.
 */
export default function GastosEmpresaClient({ gastos }: { gastos: Gasto[] }) {
  const [search, setSearch] = useState('');
  const [selectedGasto, setSelectedGasto] = useState<Gasto | null>(null);

  const handleCloseModal = useCallback(() => setSelectedGasto(null), []);

  useEscapeClose(handleCloseModal, selectedGasto !== null);

  const filtered = gastos.filter((g) =>
    g.empleado.toLowerCase().includes(search.toLowerCase()) ||
    g.comercio.toLowerCase().includes(search.toLowerCase()) ||
    g.proyecto.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="page-header">
        <h1 className="page-title"><Receipt size={24} strokeWidth={2} />Gastos de Empresa</h1>
        <p className="page-subtitle">Comprobantes justificados pagados con fondos corporativos (Tarjetas de crédito/débito de la empresa).</p>
      </div>

      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input
          id="gastos-search"
          type="search"
          placeholder="Buscar por empleado, comercio o proyecto…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: '8px', padding: '9px 12px 9px 36px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
        />
      </div>

      <div className="card">
        {gastos.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Receipt size={22} /></div>
            <div className="empty-state-title">Sin gastos corporativos registrados</div>
            <div className="empty-state-desc">Los gastos registrados con tarjetas o fondos de la empresa aparecerán aquí.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table className="rendy-table">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Categoría</th>
                  <th>Comercio</th>
                  <th>Monto</th>
                  <th>Tasa</th>
                  <th>Convertido</th>
                  <th>Proyecto</th>
                  <th>Fecha</th>
                  <th>Método</th>
                  <th style={{ textAlign: 'right' }}>Comprobante</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => {
                  const tieneTasa = g.tasa_cambio && g.tasa_cambio !== 1;
                  const monedaViat = g.moneda_viatico || 'USD';

                  return (
                    <tr key={g.id}>
                      <td style={{ verticalAlign: 'middle', fontWeight: 600, color: 'var(--text-primary)' }}>{g.empleado}</td>
                      <td style={{ verticalAlign: 'middle' }}>
                        <span style={{ background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, color: 'var(--text-accent)' }}>
                          {g.categoria}
                        </span>
                      </td>
                      <td style={{ verticalAlign: 'middle' }}>{g.comercio}</td>
                      
                      {/* Monto Original */}
                      <td style={{ verticalAlign: 'middle', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {g.monto.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {g.moneda}
                      </td>

                      {/* Tasa de Cambio */}
                      <td style={{ verticalAlign: 'middle', color: 'var(--text-muted)', fontSize: '12px' }}>
                        {tieneTasa ? `${g.tasa_cambio}` : '1.00'}
                      </td>

                      {/* Monto Convertido / Deducible */}
                      <td style={{ verticalAlign: 'middle', fontWeight: 700, color: tieneTasa ? '#10b981' : 'var(--text-primary)' }}>
                        {g.monto_convertido != null && tieneTasa
                          ? `${g.monto_convertido.toLocaleString('es-VE', { minimumFractionDigits: 2 })} ${monedaViat}`
                          : `${g.monto.toLocaleString('es-VE', { minimumFractionDigits: 2 })} ${g.moneda}`}
                      </td>

                      <td style={{ verticalAlign: 'middle', color: 'var(--text-muted)', fontSize: '12px' }}>{g.proyecto}</td>
                      <td style={{ verticalAlign: 'middle', color: 'var(--text-muted)', fontSize: '12px' }}>{g.fecha_gasto}</td>
                      <td style={{ verticalAlign: 'middle', color: 'var(--text-muted)', fontSize: '12px' }}>{g.metodo_pago}</td>
                      <td style={{ verticalAlign: 'middle', textAlign: 'right' }}>
                        <button
                          onClick={() => setSelectedGasto(g)}
                          className="btn btn-ghost btn-sm"
                          style={{
                            background: 'rgba(99, 102, 241, 0.1)',
                            border: '1px solid rgba(99, 102, 241, 0.25)',
                            color: 'var(--rendy-primary-light)',
                            gap: '5px',
                            cursor: 'pointer',
                          }}
                        >
                          <Eye size={12} /> Ver
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Digital Invoice Modal ── */}
      {selectedGasto && (
        <DigitalInvoice
          gasto={selectedGasto}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
}