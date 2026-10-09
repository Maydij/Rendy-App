'use client';

import { useState } from 'react';
import { Receipt, Search, ExternalLink } from 'lucide-react';

type Gasto = {
  id: string;
  empleado: string;
  categoria: string;
  comercio: string;
  monto: number;
  moneda: string;
  fecha_gasto: string;
  proyecto: string;
  metodo_pago: string;
  estado: string;
  url_comprobante: string | null;
  concepto: string | null;
};

export default function GastosEmpresaClient({ gastos }: { gastos: Gasto[] }) {
  const [search, setSearch] = useState('');

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
          <div style={{ overflowX: 'auto' }}>
            <table className="rendy-table">
              <thead>
                <tr>
                  <th style={{ verticalAlign: 'middle', padding: '14px 16px' }}>Empleado</th>
                  <th style={{ verticalAlign: 'middle', padding: '14px 16px' }}>Categoría</th>
                  <th style={{ verticalAlign: 'middle', padding: '14px 16px' }}>Comercio</th>
                  <th style={{ verticalAlign: 'middle', padding: '14px 16px' }}>Monto</th>
                  <th style={{ verticalAlign: 'middle', padding: '14px 16px' }}>Proyecto</th>
                  <th style={{ verticalAlign: 'middle', padding: '14px 16px' }}>Fecha</th>
                  <th style={{ verticalAlign: 'middle', padding: '14px 16px' }}>Método</th>
                  <th style={{ verticalAlign: 'middle', padding: '14px 16px' }}>Comprobante</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => (
                  <tr key={g.id}>
                    <td style={{ verticalAlign: 'middle', fontWeight: 600, color: 'var(--text-primary)' }}>{g.empleado}</td>
                    <td style={{ verticalAlign: 'middle' }}>
                      <span style={{ background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, color: 'var(--text-accent)' }}>
                        {g.categoria}
                      </span>
                    </td>
                    <td style={{ verticalAlign: 'middle' }}>{g.comercio}</td>
                    <td style={{ verticalAlign: 'middle', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {g.monto.toLocaleString('es-VE')} {g.moneda}
                    </td>
                    <td style={{ verticalAlign: 'middle', color: 'var(--text-muted)', fontSize: '12px' }}>{g.proyecto}</td>
                    <td style={{ verticalAlign: 'middle', color: 'var(--text-muted)', fontSize: '12px' }}>{g.fecha_gasto}</td>
                    <td style={{ verticalAlign: 'middle', color: 'var(--text-muted)', fontSize: '12px' }}>{g.metodo_pago}</td>
                    <td style={{ verticalAlign: 'middle' }}>
                      {g.url_comprobante ? (
                        <a href={g.url_comprobante} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                          Ver <ExternalLink size={12} />
                        </a>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}