'use client';

import { useState, useEffect } from 'react';
import { Receipt, Search, ExternalLink, Eye, X, FileText, Image as ImageIcon, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Gasto } from './gasto-type'
import DigitalInvoice from './digital-invoice'

export default function GastosEmpresaClient({ gastos }: { gastos: Gasto[] }) {
  const [search, setSearch] = useState('');
  const [selectedGasto, setSelectedGasto] = useState<Gasto | null>(null);
  const [modalTab, setModalTab] = useState<'digital' | 'imagen'>('digital');

  // Cerrar modal al presionar Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedGasto(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
                          onClick={() => {
                            setSelectedGasto(g);
                            setModalTab('digital');
                          }}
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

      {/* =========================================================
          MODAL: FACTURA DIGITAL (ERECEIPT) + FOTO ORIGINAL
          ========================================================= */}
      {selectedGasto && (
        <DigitalInvoice
        setSelectedGasto={setSelectedGasto}
        modalTab={modalTab}
        setModalTab={setModalTab}
        selectedGasto={selectedGasto}
        />
        // <div
        //   style={{
        //     position: 'fixed',
        //     inset: 0,
        //     background: 'rgba(5, 7, 15, 0.85)',
        //     backdropFilter: 'blur(10px)',
        //     display: 'flex',
        //     alignItems: 'center',
        //     justifyContent: 'center',
        //     zIndex: 150,
        //     padding: '16px',
        //     animation: 'fadeIn 0.2s ease',
        //   }}
        //   onClick={() => setSelectedGasto(null)}
        // >
        //   <div
        //     style={{
        //       background: 'var(--bg-surface)',
        //       border: '1px solid rgba(99, 102, 241, 0.25)',
        //       borderRadius: '20px',
        //       maxWidth: '560px',
        //       width: '100%',
        //       maxHeight: '92vh',
        //       display: 'flex',
        //       flexDirection: 'column',
        //       boxShadow: '0 30px 80px rgba(0, 0, 0, 0.9), 0 0 50px rgba(99, 102, 241, 0.15)',
        //       overflow: 'hidden',
        //     }}
        //     onClick={(e) => e.stopPropagation()}
        //   >
        //     {/* Header del Modal con Pestañas */}
        //     <div
        //       style={{
        //         padding: '14px 20px',
        //         borderBottom: '1px solid var(--bg-border)',
        //         display: 'flex',
        //         alignItems: 'center',
        //         justifyContent: 'space-between',
        //         background: 'var(--bg-elevated)',
        //       }}
        //     >
        //       {/* Selector de Vistas: Factura Digital vs Imagen Real */}
        //       <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-surface)', padding: '4px', borderRadius: '10px', border: '1px solid var(--bg-border)' }}>
        //         <button
        //           onClick={() => setModalTab('digital')}
        //           style={{
        //             display: 'flex',
        //             alignItems: 'center',
        //             gap: '6px',
        //             padding: '6px 14px',
        //             borderRadius: '7px',
        //             border: 'none',
        //             fontSize: '12px',
        //             fontWeight: 700,
        //             cursor: 'pointer',
        //             background: modalTab === 'digital' ? 'var(--rendy-primary)' : 'transparent',
        //             color: modalTab === 'digital' ? 'white' : 'var(--text-muted)',
        //             transition: 'all 0.15s ease',
        //           }}
        //         >
        //           <FileText size={14} /> Factura Digital
        //         </button>
        //         <button
        //           onClick={() => setModalTab('imagen')}
        //           disabled={!selectedGasto.url_comprobante}
        //           style={{
        //             display: 'flex',
        //             alignItems: 'center',
        //             gap: '6px',
        //             padding: '6px 14px',
        //             borderRadius: '7px',
        //             border: 'none',
        //             fontSize: '12px',
        //             fontWeight: 700,
        //             cursor: selectedGasto.url_comprobante ? 'pointer' : 'not-allowed',
        //             background: modalTab === 'imagen' ? 'var(--rendy-primary)' : 'transparent',
        //             color: modalTab === 'imagen' ? 'white' : selectedGasto.url_comprobante ? 'var(--text-muted)' : 'rgba(255,255,255,0.2)',
        //             transition: 'all 0.15s ease',
        //           }}
        //         >
        //           <ImageIcon size={14} /> Foto Original
        //         </button>
        //       </div>

        //       <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        //         {selectedGasto.url_comprobante && (
        //           <a
        //             href={selectedGasto.url_comprobante}
        //             target="_blank"
        //             rel="noopener noreferrer"
        //             className="btn btn-ghost btn-sm"
        //             style={{ padding: '6px 10px', fontSize: '11px' }}
        //             title="Abrir imagen en pestaña nueva"
        //           >
        //             <ExternalLink size={12} />
        //           </a>
        //         )}
        //         <button
        //           onClick={() => setSelectedGasto(null)}
        //           style={{
        //             background: 'transparent',
        //             border: 'none',
        //             color: 'var(--text-muted)',
        //             cursor: 'pointer',
        //             padding: '6px',
        //             borderRadius: '8px',
        //             display: 'flex',
        //             alignItems: 'center',
        //             justifyContent: 'center',
        //           }}
        //           aria-label="Cerrar modal"
        //         >
        //           <X size={20} />
        //         </button>
        //       </div>
        //     </div>

        //     {/* Contenido Dinámico */}
        //     <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#0a0d16' }}>
        //       {modalTab === 'digital' ? (
        //         /* === TICKET / FACTURA DIGITAL ESTILO PAPEL RECIBO === */
        //         <div
        //           style={{
        //             background: '#fcfaf6',
        //             color: '#1a1a1a',
        //             borderRadius: '6px',
        //             filter: 'drop-shadow(0 20px 40px rgba(0, 0, 0, 0.7))',
        //             maxWidth: '420px',
        //             margin: '0 auto',
        //             position: 'relative',
        //             overflow: 'hidden',
        //             fontFamily: 'system-ui, -apple-system, sans-serif',
        //           }}
        //         >
        //           {/* Borde superior dentado/perforado */}
        //           <svg viewBox="0 0 300 12" style={{ display: 'block', width: '100%', height: '11px', fill: '#0a0d16' }}>
        //             <path d="M0,0 L5,12 L10,0 L15,12 L20,0 L25,12 L30,0 L35,12 L40,0 L45,12 L50,0 L55,12 L60,0 L65,12 L70,0 L75,12 L80,0 L85,12 L90,0 L95,12 L100,0 L105,12 L110,0 L115,12 L120,0 L125,12 L130,0 L135,12 L140,0 L145,12 L150,0 L155,12 L160,0 L165,12 L170,0 L175,12 L180,0 L185,12 L190,0 L195,12 L200,0 L205,12 L210,0 L215,12 L220,0 L225,12 L230,0 L235,12 L240,0 L245,12 L250,0 L255,12 L260,0 L265,12 L270,0 L275,12 L280,0 L285,12 L290,0 L295,12 L300,0 Z" />
        //           </svg>

        //           <div style={{ padding: '26px 28px 20px' }}>
        //             {/* Badge Superior */}
        //             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '20px' }}>
        //               <div
        //                 style={{
        //                   display: 'inline-flex',
        //                   alignItems: 'center',
        //                   gap: '6px',
        //                   color: '#0284c7',
        //                   fontSize: '14px',
        //                   fontWeight: 800,
        //                   letterSpacing: '0.04em',
        //                   textTransform: 'uppercase',
        //                 }}
        //               >
        //                 <ShieldCheck size={20} strokeWidth={2.4} />
        //                 GUARANTEED ERECEIPT
        //               </div>
        //               <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginTop: '3px' }}>
        //                 OCR Verificado Rendy IA • Tasa Fiscal Congelada
        //               </div>
        //             </div>

        //             {/* Total y Monto Principal */}
        //             <div style={{ textAlign: 'center', marginBottom: '18px' }}>
        //               <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        //                 Amount • {selectedGasto.metodo_pago.includes('Tarjeta') ? 'Card' : 'Viático'}
        //               </div>
        //               <div style={{ fontSize: '32px', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '2px' }}>
        //                 <span>
        //                   {selectedGasto.moneda === 'USD' ? '$' : ''}{selectedGasto.monto.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {selectedGasto.moneda}
        //                 </span>
        //                 <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: selectedGasto.tasa_cambio ? '#10b981' : '#f59e0b' }} />
        //               </div>
        //             </div>

        //             {/* Banner de Tasa / Alerta de Política */}
        //             <div
        //               style={{
        //                 background: '#fef3c7',
        //                 border: '1px solid #fde68a',
        //                 borderRadius: '10px',
        //                 padding: '10px 12px',
        //                 marginBottom: '20px',
        //                 display: 'flex',
        //                 alignItems: 'center',
        //                 gap: '8px',
        //                 fontSize: '11.5px',
        //                 color: '#92400e',
        //                 lineHeight: 1.4,
        //               }}
        //             >
        //               <AlertTriangle size={16} style={{ flexShrink: 0, color: '#d97706' }} />
        //               <div>
        //                 {selectedGasto.tasa_cambio && selectedGasto.tasa_cambio !== 1 ? (
        //                   <>
        //                     <strong>Conversión Congelada:</strong> Tasa oficial {selectedGasto.tasa_cambio} → Deducible <strong>{selectedGasto.monto_convertido?.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {selectedGasto.moneda_viatico || 'USD'}</strong>
        //                   </>
        //                 ) : (
        //                   <>
        //                     <strong>Gasto Registrado:</strong> Comprobante procesado en divisa original sin necesidad de puente cambiario.
        //                   </>
        //                 )}
        //               </div>
        //             </div>

        //             {/* Datos del Comercio y Encabezado Fiscal */}
        //             <div style={{ marginBottom: '18px' }}>
        //               <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', lineHeight: 1.2, textTransform: 'uppercase' }}>
        //                 {selectedGasto.comercio}
        //               </div>
        //               <div style={{ fontSize: '12px', color: '#475569', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
        //                 <div>Date: {selectedGasto.fecha_gasto} • {selectedGasto.creado_en ? new Date(selectedGasto.creado_en).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : '12:00'}</div>
        //                 <div>Category: <strong>{selectedGasto.categoria}</strong></div>
        //                 <div>Método: {selectedGasto.metodo_pago}</div>
        //                 <div>Empleado: <strong>{selectedGasto.empleado}</strong></div>
        //                 <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>
        //                   Folio UUID: {selectedGasto.id.slice(0, 18).toUpperCase()}
        //                 </div>
        //                 {selectedGasto.datos_ocr?.rif && (
        //                   <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>
        //                     RIF / RFC: {selectedGasto.datos_ocr.rif}
        //                   </div>
        //                 )}
        //               </div>
        //             </div>

        //             {/* Línea Divisoria Punteada */}
        //             <div style={{ borderBottom: '1px dashed #cbd5e1', marginBottom: '16px' }} />

        //             {/* Desglose de Artículos / Concepto */}
        //             <div style={{ fontSize: '12.5px', marginBottom: '16px' }}>
        //               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        //                 <span style={{ color: '#0f172a', fontWeight: 600 }}>
        //                   1x {selectedGasto.concepto || selectedGasto.categoria || 'Consumo Registrado'}
        //                 </span>
        //                 <span style={{ fontWeight: 700, color: '#0f172a' }}>
        //                   {selectedGasto.monto.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {selectedGasto.moneda}
        //                 </span>
        //               </div>
        //             </div>

        //             {/* Línea Divisoria Punteada */}
        //             <div style={{ borderBottom: '1px dashed #cbd5e1', marginBottom: '16px' }} />

        //             {/* Totales y Subtotales */}
        //             <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12.5px' }}>
        //               <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
        //                 <span>Subtotal</span>
        //                 <span>{(selectedGasto.monto * 0.84).toLocaleString('es-VE', { minimumFractionDigits: 2 })} {selectedGasto.moneda}</span>
        //               </div>
        //               <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
        //                 <span>IVA Trasladado (16%)</span>
        //                 <span>{(selectedGasto.monto * 0.16).toLocaleString('es-VE', { minimumFractionDigits: 2 })} {selectedGasto.moneda}</span>
        //               </div>
        //               <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 900, color: '#0f172a', marginTop: '6px', paddingTop: '8px', borderTop: '2px solid #0f172a' }}>
        //                 <span>Total Facturado</span>
        //                 <span>{selectedGasto.monto.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {selectedGasto.moneda}</span>
        //               </div>
        //             </div>

        //             {/* Código de Barras Decorativo */}
        //             <div style={{ marginTop: '26px', textAlign: 'center' }}>
        //               <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', height: '36px', opacity: 0.85 }}>
        //                 {[3, 1, 4, 1, 2, 4, 1, 3, 2, 1, 4, 2, 3, 1, 2, 1, 4, 3, 1, 2, 4, 1, 3, 2, 4, 1, 2, 3].map((w, idx) => (
        //                   <span
        //                     key={idx}
        //                     style={{
        //                       display: 'inline-block',
        //                       width: `${w}px`,
        //                       height: '100%',
        //                       background: '#1a1a1a',
        //                     }}
        //                   />
        //                 ))}
        //               </div>
        //               <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#64748b', letterSpacing: '0.12em', marginTop: '6px' }}>
        //                 SWORK RENDY CORE V4.2
        //               </div>
        //             </div>
        //           </div>

        //           {/* Borde inferior dentado/perforado */}
        //           <svg viewBox="0 0 300 12" style={{ display: 'block', width: '100%', height: '11px', fill: '#0a0d16' }}>
        //             <path d="M0,12 L5,0 L10,12 L15,0 L20,12 L25,0 L30,12 L35,0 L40,12 L45,0 L50,12 L55,0 L60,12 L65,0 L70,12 L75,0 L80,12 L85,0 L90,12 L95,0 L100,12 L105,0 L110,12 L115,0 L120,12 L125,0 L130,12 L135,0 L140,12 L145,0 L150,12 L155,0 L160,12 L165,0 L170,12 L175,0 L180,12 L185,0 L190,12 L195,0 L200,12 L205,0 L210,12 L215,0 L220,12 L225,0 L230,12 L235,0 L240,12 L245,0 L250,12 L255,0 L260,12 L265,0 L270,12 L275,0 L280,12 L285,0 L290,12 L295,0 L300,12 Z" />
        //           </svg>
        //         </div>
        //       ) : (
        //         /* === VISOR DE FOTO / COMPROBANTE ORIGINAL === */
        //         <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        //           {selectedGasto.url_comprobante ? (
        //             <div style={{ position: 'relative', width: '100%', textAlign: 'center' }}>
        //               {/* eslint-disable-next-line @next/next/no-img-element */}
        //               <img
        //                 src={selectedGasto.url_comprobante}
        //                 alt={`Comprobante de ${selectedGasto.comercio}`}
        //                 style={{
        //                   maxWidth: '100%',
        //                   maxHeight: '68vh',
        //                   objectFit: 'contain',
        //                   borderRadius: '12px',
        //                   border: '1px solid var(--bg-border)',
        //                   boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
        //                   margin: '0 auto',
        //                 }}
        //               />
        //             </div>
        //           ) : (
        //             <div className="empty-state">
        //               <div className="empty-state-title">Sin archivo adjunto</div>
        //               <div className="empty-state-desc">Este gasto fue registrado sin comprobante fotográfico.</div>
        //             </div>
        //           )}
        //         </div>
        //       )}
        //     </div>

        //     {/* Footer del Modal */}
        //     <div
        //       style={{
        //         padding: '14px 20px',
        //         borderTop: '1px solid var(--bg-border)',
        //         display: 'flex',
        //         justifyContent: 'space-between',
        //         alignItems: 'center',
        //         background: 'var(--bg-elevated)',
        //       }}
        //     >
        //       <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
        //         Estado del Gasto: <strong style={{ color: 'var(--rendy-accent)' }}>{selectedGasto.estado}</strong>
        //       </div>
        //       <button
        //         className="btn btn-primary btn-sm"
        //         onClick={() => setSelectedGasto(null)}
        //         style={{ padding: '6px 16px', borderRadius: '8px' }}
        //       >
        //         Cerrar
        //       </button>
        //     </div>
        //   </div>
        // </div>
      )}
    </>
  );
}