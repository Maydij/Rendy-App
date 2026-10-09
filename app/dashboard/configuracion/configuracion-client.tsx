'use client';

import { useState, useTransition } from 'react';
import { Settings, Users, FolderKanban, CreditCard, Plus, Trash2, Edit3, Check, X } from 'lucide-react';
import {
  crearProyecto, toggleProyecto, eliminarProyecto,
  crearMetodoPago, eliminarMetodoPago, actualizarMonedaEmpresa
} from './actions';

type Empresa  = { id: string; nombre: string; moneda: string; creado_en: string };
type Usuario  = { id: string; nombre: string; email: string | null; telefono_whatsapp: string; rol: string; creado_en: string };
type Proyecto = { id: string; nombre: string; activo: boolean; creado_en: string };
type Metodo   = { id: string; nombre: string; creado_en: string };

function SectionHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
      <div>
        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '3px' }}>{title}</div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{subtitle}</div>
      </div>
      {action}
    </div>
  );
}

function RolBadge({ rol }: { rol: string }) {
  return (
    <span className={`badge ${rol === 'ADMIN' ? 'pagado' : 'aprobado'}`}>
      <span className="badge-dot" />
      {rol === 'ADMIN' ? 'Admin' : 'Empleado'}
    </span>
  );
}

export default function ConfiguracionClient({ empresa, usuarios, proyectos: initProyectos, metodos: initMetodos }: {
  empresa: Empresa | null;
  usuarios: Usuario[];
  proyectos: Proyecto[];
  metodos: Metodo[];
}) {
  const [activeTab, setActiveTab] = useState<'usuarios' | 'proyectos' | 'metodos'>('usuarios');
  const [proyectos, setProyectos] = useState(initProyectos);
  const [metodos, setMetodos] = useState(initMetodos);
  const [newProyecto, setNewProyecto] = useState('');
  const [newMetodo, setNewMetodo] = useState('');
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  function toast(msg: string) {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  }

  const TABS = [
    { id: 'usuarios' as const,  label: 'Usuarios',        icon: Users,        count: usuarios.length },
    { id: 'proyectos' as const, label: 'Proyectos',       icon: FolderKanban, count: proyectos.length },
    { id: 'metodos' as const,   label: 'Métodos de Pago', icon: CreditCard,   count: metodos.length },
  ];

  return (
    <>
      <div className="page-header">
        <h1 className="page-title"><Settings size={24} strokeWidth={2} />Gestión de Organización</h1>
        <p className="page-subtitle">
          Administra usuarios, proyectos y métodos de pago. Los cambios se reflejan en tiempo real en los desplegables de WhatsApp.
        </p>
      </div>

      {feedback && (
        <div style={{ position: 'fixed', top: '20px', right: '24px', zIndex: 200, background: feedback.startsWith('❌') ? 'var(--rendy-danger)' : 'var(--rendy-accent)', color: 'white', padding: '12px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
          {feedback}
        </div>
      )}

     {/* Org Card con Selector de Moneda */}
      {empresa && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', flexShrink: 0, background: 'linear-gradient(135deg, var(--rendy-accent-dark), var(--rendy-accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 800, color: 'white' }}>
              {empresa.nombre.charAt(0).toUpperCase()}{empresa.nombre.split(' ')[1]?.charAt(0).toUpperCase() ?? ''}
            </div>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>{empresa.nombre}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                ID: <span style={{ fontFamily: 'monospace', color: 'var(--text-accent)' }}>{empresa.id.slice(0, 18)}…</span>
                {' · '}Activo desde {new Date(empresa.creado_en).toLocaleDateString('es-VE')}
              </div>
            </div>

            {/* Selector de Moneda Local de la Organización */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-elevated)', padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--bg-border)' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Moneda Principal:</span>
              <select
                id="select-moneda-empresa"
                defaultValue={empresa.moneda || 'VES'}
                disabled={isPending}
                onChange={(e) => {
                  const nuevaMoneda = e.target.value;
                  startTransition(async () => {
                    const res = await actualizarMonedaEmpresa(nuevaMoneda);
                    if (!res.error) toast(`✅ Moneda actualizada a ${nuevaMoneda}`);
                    else toast(`❌ ${res.error}`);
                  });
                }}
                style={{
                  background: 'var(--bg-surface)',
                  color: 'var(--rendy-accent)',
                  fontWeight: 700,
                  fontSize: '13px',
                  border: '1px solid var(--bg-border)',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="VES">VES (Bolívares)</option>
                <option value="USD">USD (Dólares)</option>
                <option value="COP">COP (Pesos Col.)</option>
                <option value="MXN">MXN (Pesos Mex.)</option>
                <option value="EUR">EUR (Euros)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'var(--bg-surface)', padding: '6px', borderRadius: '10px', border: '1px solid var(--bg-border)', width: 'fit-content' }}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              id={`config-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'all 150ms ease', background: activeTab === tab.id ? 'rgba(99,102,241,0.2)' : 'transparent', color: activeTab === tab.id ? 'var(--rendy-primary-light)' : 'var(--text-muted)' }}
            >
              <Icon size={15} />
              {tab.label}
              <span style={{ background: activeTab === tab.id ? 'var(--rendy-primary)' : 'var(--bg-elevated)', color: activeTab === tab.id ? 'white' : 'var(--text-muted)', fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '10px' }}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Usuarios ── */}
      {activeTab === 'usuarios' && (
        <div className="card">
          <div style={{ padding: '20px 24px 0' }}>
            <SectionHeader
              title="Usuarios de la Organización"
              subtitle="Los empleados con WhatsApp registrado pueden enviar recibos vía chat."
              action={<button id="config-add-usuario-btn" className="btn btn-primary btn-sm"><Plus size={13} /> Agregar Usuario</button>}
            />
          </div>
          <div style={{ padding: '0 24px 24px' }}>
            {usuarios.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px' }}>
                <div className="empty-state-title">Sin usuarios registrados</div>
              </div>
            ) : (
              <table className="rendy-table" aria-label="Usuarios de la organización">
                <thead>
                  <tr><th>Nombre</th><th>Email</th><th>WhatsApp</th><th>Rol</th><th>Alta</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: u.rol === 'ADMIN' ? 'linear-gradient(135deg, var(--rendy-primary), var(--rendy-primary-light))' : 'linear-gradient(135deg, var(--rendy-accent-dark), var(--rendy-accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'white' }}>
                            {u.nombre.charAt(0)}
                          </div>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.nombre}</span>
                        </div>
                      </td>
                      <td>{u.email ?? '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{u.telefono_whatsapp}</td>
                      <td><RolBadge rol={u.rol} /></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{new Date(u.creado_en).toLocaleDateString('es-VE')}</td>
                      <td>
                        <button id={`usuario-edit-${u.id}`} className="btn btn-ghost btn-sm" aria-label={`Editar ${u.nombre}`}><Edit3 size={12} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Proyectos ── */}
      {activeTab === 'proyectos' && (
        <div className="card">
          <div style={{ padding: '20px 24px 0' }}>
            <SectionHeader
              title="Proyectos"
              subtitle="Los proyectos activos aparecen en los desplegables de WhatsApp en tiempo real."
              action={
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    id="config-new-proyecto-input"
                    value={newProyecto}
                    onChange={(e) => setNewProyecto(e.target.value)}
                    placeholder="Nombre del proyecto…"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: '7px', padding: '6px 12px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', width: '200px' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newProyecto.trim()) {
                        startTransition(async () => {
                          const res = await crearProyecto(newProyecto.trim());
                          if (res.data) { setProyectos((ps) => [...ps, res.data!]); setNewProyecto(''); toast('✅ Proyecto creado'); }
                          else toast(`❌ ${res.error}`);
                        });
                      }
                    }}
                  />
                  <button
                    id="config-add-proyecto-btn"
                    className="btn btn-primary btn-sm"
                    disabled={isPending}
                    onClick={() => {
                      if (!newProyecto.trim()) return;
                      startTransition(async () => {
                        const res = await crearProyecto(newProyecto.trim());
                        if (res.data) { setProyectos((ps) => [...ps, res.data!]); setNewProyecto(''); toast('✅ Proyecto creado'); }
                        else toast(`❌ ${res.error}`);
                      });
                    }}
                  >
                    <Plus size={13} /> Crear
                  </button>
                </div>
              }
            />
          </div>
          <div style={{ padding: '0 24px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
            {proyectos.map((p) => (
              <div key={p.id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.activo ? 'var(--rendy-accent)' : 'var(--text-muted)', boxShadow: p.activo ? '0 0 8px var(--rendy-accent)' : 'none' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{p.nombre}</span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    id={`proyecto-toggle-${p.id}`}
                    className="btn btn-ghost btn-sm"
                    disabled={isPending}
                    title={p.activo ? 'Desactivar' : 'Activar'}
                    aria-label={p.activo ? `Desactivar ${p.nombre}` : `Activar ${p.nombre}`}
                    onClick={() => {
                      startTransition(async () => {
                        const res = await toggleProyecto(p.id, !p.activo);
                        if (!res.error) setProyectos((ps) => ps.map((x) => x.id === p.id ? { ...x, activo: !x.activo } : x));
                        else toast(`❌ ${res.error}`);
                      });
                    }}
                  >
                    {p.activo ? <X size={12} /> : <Check size={12} />}
                  </button>
                  <button
                    id={`proyecto-delete-${p.id}`}
                    className="btn btn-danger btn-sm"
                    disabled={isPending}
                    aria-label={`Eliminar ${p.nombre}`}
                    onClick={() => {
                      startTransition(async () => {
                        const res = await eliminarProyecto(p.id);
                        if (!res.error) { setProyectos((ps) => ps.filter((x) => x.id !== p.id)); toast('✅ Proyecto eliminado'); }
                        else toast(`❌ ${res.error}`);
                      });
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Métodos de Pago ── */}
      {activeTab === 'metodos' && (
        <div className="card">
          <div style={{ padding: '20px 24px 0' }}>
            <SectionHeader
              title="Métodos de Pago"
              subtitle="Los métodos configurados aquí aparecen en los desplegables de WhatsApp al registrar un gasto."
              action={
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    id="config-new-metodo-input"
                    value={newMetodo}
                    onChange={(e) => setNewMetodo(e.target.value)}
                    placeholder="Ej: American Express…"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: '7px', padding: '6px 12px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', width: '200px' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newMetodo.trim()) {
                        startTransition(async () => {
                          const res = await crearMetodoPago(newMetodo.trim());
                          if (res.data) { setMetodos((ms) => [...ms, res.data!]); setNewMetodo(''); toast('✅ Método creado'); }
                          else toast(`❌ ${res.error}`);
                        });
                      }
                    }}
                  />
                  <button
                    id="config-add-metodo-btn"
                    className="btn btn-primary btn-sm"
                    disabled={isPending}
                    onClick={() => {
                      if (!newMetodo.trim()) return;
                      startTransition(async () => {
                        const res = await crearMetodoPago(newMetodo.trim());
                        if (res.data) { setMetodos((ms) => [...ms, res.data!]); setNewMetodo(''); toast('✅ Método creado'); }
                        else toast(`❌ ${res.error}`);
                      });
                    }}
                  >
                    <Plus size={13} /> Agregar
                  </button>
                </div>
              }
            />
          </div>
          <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {metodos.map((m) => (
              <div key={m.id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CreditCard size={15} style={{ color: 'var(--text-accent)' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{m.nombre}</span>
                </div>
                <button
                  id={`metodo-delete-${m.id}`}
                  className="btn btn-danger btn-sm"
                  disabled={isPending}
                  aria-label={`Eliminar ${m.nombre}`}
                  onClick={() => {
                    startTransition(async () => {
                      const res = await eliminarMetodoPago(m.id);
                      if (!res.error) { setMetodos((ms) => ms.filter((x) => x.id !== m.id)); toast('✅ Método eliminado'); }
                      else toast(`❌ ${res.error}`);
                    });
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
