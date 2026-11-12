'use client';

import { useState, useTransition } from 'react';
import {
  Settings,
  Users,
  FolderKanban,
  CreditCard,
  Plus,
  Trash2,
  Check,
  X,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import {
  crearProyecto,
  toggleProyecto,
  eliminarProyecto,
  crearMetodoPago,
  eliminarMetodoPago,
  actualizarMonedaEmpresa,
} from './actions';
import { cancelTrialOrSubscriptionAction } from '@/app/actions/subscription.actions';
import { InviteEmployeeModal } from '@/components/dashboard/InviteEmployeeModal';

type Empresa = { id: string; nombre: string; moneda: string; creado_en: string };
type Usuario = {
  id: string;
  nombre: string;
  email: string | null;
  telefono_whatsapp: string | null;
  rol?: string;
  role?: string;
  department?: string | null;
  creado_en: string;
};
type Proyecto = { id: string; nombre: string; activo: boolean; creado_en: string };
type Metodo = { id: string; nombre: string; creado_en: string };
type SubscriptionInfo = {
  id: string;
  plan_id: string;
  billing_cycle: string;
  status: string;
  trial_end: string;
  cancel_at_period_end: boolean;
  card_brand: string | null;
  card_last4: string | null;
};
type PendingInvitation = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  department: string;
  status: string;
  expires_at: string;
};

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '16px',
        gap: '12px',
        flexWrap: 'wrap',
      }}
    >
      <div>
        <div
          style={{
            fontSize: '15px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '3px',
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{subtitle}</div>
      </div>
      {action}
    </div>
  );
}

function RolBadge({ rol }: { rol: string }) {
  const isAdmin = rol === 'ADMIN';
  return (
    <span className={`badge ${isAdmin ? 'pagado' : 'aprobado'}`}>
      <span className="badge-dot" />
      {isAdmin ? 'Admin' : 'Empleado'}
    </span>
  );
}

export default function ConfiguracionClient({
  empresa,
  usuarios,
  proyectos: initProyectos,
  metodos: initMetodos,
  subscription,
  pendingInvitations,
}: {
  empresa: Empresa | null;
  usuarios: Usuario[];
  proyectos: Proyecto[];
  metodos: Metodo[];
  subscription: SubscriptionInfo | null;
  pendingInvitations: PendingInvitation[];
}) {
  const [activeTab, setActiveTab] = useState<'usuarios' | 'proyectos' | 'metodos' | 'suscripcion'>(
    'usuarios'
  );
  const [proyectos, setProyectos] = useState(initProyectos);
  const [metodos, setMetodos] = useState(initMetodos);
  const [newProyecto, setNewProyecto] = useState('');
  const [newMetodo, setNewMetodo] = useState('');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  function toast(msg: string) {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  }

  const TABS = [
    { id: 'usuarios' as const, label: 'Usuarios', icon: Users, count: usuarios.length },
    { id: 'proyectos' as const, label: 'Proyectos', icon: FolderKanban, count: proyectos.length },
    { id: 'metodos' as const, label: 'Métodos de Pago', icon: CreditCard, count: metodos.length },
    { id: 'suscripcion' as const, label: 'Suscripción y Plan', icon: ShieldCheck, count: 1 },
  ];

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">
          <Settings size={24} strokeWidth={2} />
          Gestión de Organización
        </h1>
        <p className="page-subtitle">
          Administra usuarios, permisos por categoría, proyectos y tu suscripción corporativa.
        </p>
      </div>

      {feedback && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 200,
            background: feedback.startsWith('❌') ? 'var(--rendy-danger)' : 'var(--rendy-accent)',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 600,
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}
        >
          {feedback}
        </div>
      )}

      {/* Org Card con Selector de Moneda */}
      {empresa && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div
            style={{
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '14px',
                flexShrink: 0,
                background:
                  'linear-gradient(135deg, var(--rendy-accent-dark), var(--rendy-accent))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                fontWeight: 800,
                color: 'white',
              }}
            >
              {empresa.nombre.charAt(0).toUpperCase()}
              {empresa.nombre.split(' ')[1]?.charAt(0).toUpperCase() ?? ''}
            </div>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: '4px',
                }}
              >
                {empresa.nombre}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                ID:{' '}
                <span style={{ fontFamily: 'monospace', color: 'var(--text-accent)' }}>
                  {empresa.id.slice(0, 18)}…
                </span>
                {' · '}Activo desde {new Date(empresa.creado_en).toLocaleDateString('es-VE')}
              </div>
            </div>

            {/* Selector de Moneda Local de la Organización */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: 'var(--bg-elevated)',
                padding: '8px 14px',
                borderRadius: '10px',
                border: '1px solid var(--bg-border)',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                Moneda Principal:
              </span>
              <select
                id="select-moneda-empresa"
                defaultValue={empresa.moneda || 'USD'}
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
                  cursor: 'pointer',
                }}
              >
                <option value="USD">USD (Dólares)</option>
                <option value="VES">VES (Bolívares)</option>
                <option value="COP">COP (Pesos Col.)</option>
                <option value="MXN">MXN (Pesos Mex.)</option>
                <option value="EUR">EUR (Euros)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '20px',
          background: 'var(--bg-surface)',
          padding: '6px',
          borderRadius: '10px',
          border: '1px solid var(--bg-border)',
          width: 'fit-content',
          maxWidth: '100%',
          overflowX: 'auto',
        }}
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              id={`config-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '7px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                transition: 'all 150ms ease',
                background: activeTab === tab.id ? 'rgba(99,102,241,0.2)' : 'transparent',
                color: activeTab === tab.id ? 'var(--rendy-primary-light)' : 'var(--text-muted)',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={15} />
              {tab.label}
              <span
                style={{
                  background: activeTab === tab.id ? 'var(--rendy-primary)' : 'var(--bg-elevated)',
                  color: activeTab === tab.id ? 'white' : 'var(--text-muted)',
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: '10px',
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Usuarios e Invitaciones ── */}
      {activeTab === 'usuarios' && (
        <div className="card">
          <div style={{ padding: '20px 24px 0' }}>
            <SectionHeader
              title="Usuarios de la Organización"
              subtitle="Invita empleados con Magic Link, código QR y permisos configurables por categoría."
              action={
                <button
                  id="config-add-usuario-btn"
                  className="btn btn-primary btn-sm"
                  onClick={() => setIsInviteModalOpen(true)}
                >
                  <Plus size={13} /> Invitar Empleado
                </button>
              }
            />
          </div>
          <div style={{ padding: '0 24px 24px' }}>
            {usuarios.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px' }}>
                <div className="empty-state-title">Sin usuarios registrados</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="rendy-table" aria-label="Usuarios de la organización">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Email</th>
                      <th>Departamento</th>
                      <th>Rol</th>
                      <th>Alta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map((u) => {
                      const effectiveRole = u.role || u.rol || 'EMPLOYEE';
                      return (
                        <tr key={u.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div
                                style={{
                                  width: '30px',
                                  height: '30px',
                                  borderRadius: '50%',
                                  background:
                                    effectiveRole === 'ADMIN'
                                      ? 'linear-gradient(135deg, var(--rendy-primary), var(--rendy-primary-light))'
                                      : 'linear-gradient(135deg, var(--rendy-accent-dark), var(--rendy-accent))',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  color: 'white',
                                }}
                              >
                                {u.nombre.charAt(0)}
                              </div>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                {u.nombre}
                              </span>
                            </div>
                          </td>
                          <td>{u.email ?? '—'}</td>
                          <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {u.department || 'General'}
                          </td>
                          <td>
                            <RolBadge rol={effectiveRole} />
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                            {new Date(u.creado_en).toLocaleDateString('es-VE')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Invitaciones Pendientes */}
            {pendingInvitations.length > 0 && (
              <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--bg-border)' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} /> Invitaciones Pendientes de Activación ({pendingInvitations.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {pendingInvitations.map((inv) => (
                    <div
                      key={inv.id}
                      style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--bg-border)',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '12px',
                      }}
                    >
                      <div>
                        <strong style={{ color: 'var(--text-primary)' }}>
                          {inv.first_name} {inv.last_name}
                        </strong>{' '}
                        <span style={{ color: 'var(--text-muted)' }}>
                          ({inv.email}) • {inv.department}
                        </span>
                      </div>
                      <span className="badge pendiente">
                        <span className="badge-dot" />
                        Expira {new Date(inv.expires_at).toLocaleDateString('es-VE')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
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
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--bg-border)',
                      borderRadius: '7px',
                      padding: '6px 12px',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      outline: 'none',
                      width: '200px',
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
                        if (res.data) {
                          setProyectos((ps) => [...ps, res.data!]);
                          setNewProyecto('');
                          toast('✅ Proyecto creado');
                        } else toast(`❌ ${res.error}`);
                      });
                    }}
                  >
                    <Plus size={13} /> Crear
                  </button>
                </div>
              }
            />
          </div>
          <div
            style={{
              padding: '0 24px 24px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: '12px',
            }}
          >
            {proyectos.map((p) => (
              <div
                key={p.id}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--bg-border)',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: p.activo ? 'var(--rendy-accent)' : 'var(--text-muted)',
                    }}
                  />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {p.nombre}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={isPending}
                    onClick={() => {
                      startTransition(async () => {
                        const res = await toggleProyecto(p.id, !p.activo);
                        if (!res.error)
                          setProyectos((ps) =>
                            ps.map((x) => (x.id === p.id ? { ...x, activo: !x.activo } : x))
                          );
                        else toast(`❌ ${res.error}`);
                      });
                    }}
                  >
                    {p.activo ? <X size={12} /> : <Check size={12} />}
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={isPending}
                    onClick={() => {
                      startTransition(async () => {
                        const res = await eliminarProyecto(p.id);
                        if (!res.error) {
                          setProyectos((ps) => ps.filter((x) => x.id !== p.id));
                          toast('✅ Proyecto eliminado');
                        } else toast(`❌ ${res.error}`);
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
                    placeholder="Ej: Tarjeta Corporativa…"
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--bg-border)',
                      borderRadius: '7px',
                      padding: '6px 12px',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      outline: 'none',
                      width: '200px',
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
                        if (res.data) {
                          setMetodos((ms) => [...ms, res.data!]);
                          setNewMetodo('');
                          toast('✅ Método creado');
                        } else toast(`❌ ${res.error}`);
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
              <div
                key={m.id}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--bg-border)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CreditCard size={15} style={{ color: 'var(--text-accent)' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {m.nombre}
                  </span>
                </div>
                <button
                  className="btn btn-danger btn-sm"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      const res = await eliminarMetodoPago(m.id);
                      if (!res.error) {
                        setMetodos((ms) => ms.filter((x) => x.id !== m.id));
                        toast('✅ Método eliminado');
                      } else toast(`❌ ${res.error}`);
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

      {/* ── Suscripción y Prueba Gratuita (Netflix-Style) ── */}
      {activeTab === 'suscripcion' && (
        <div className="card">
          <div style={{ padding: '24px' }}>
            <SectionHeader
              title="Suscripción Corporativa y Prueba Gratuita"
              subtitle="Gestiona tu plan activo, método de pago PCI-DSS o cancela antes del día 8 sin ningún cargo."
            />

            {!subscription ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                No se encontró información de suscripción vinculada.
              </p>
            ) : (
              <div
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--bg-border)',
                  borderRadius: '12px',
                  padding: '20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Plan {subscription.plan_id} ({subscription.billing_cycle})
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Estado: <strong>{subscription.status}</strong>
                    {subscription.status === 'TRIALING' && (
                      <>
                        {' '}
                        • Prueba gratuita finaliza el{' '}
                        <strong>
                          {new Date(subscription.trial_end).toLocaleDateString('es-VE')}
                        </strong>{' '}
                        (primer cobro automático ese día)
                      </>
                    )}
                  </div>
                  {subscription.card_last4 && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Método de pago: {subscription.card_brand?.toUpperCase()} ••••{' '}
                      {subscription.card_last4}
                    </div>
                  )}
                </div>

                {subscription.status !== 'CANCELED' && !subscription.cancel_at_period_end && (
                  <button
                    type="button"
                    disabled={isPending}
                    className="btn btn-danger btn-sm"
                    onClick={() => {
                      startTransition(async () => {
                        const res = await cancelTrialOrSubscriptionAction();
                        if (res.success) {
                          toast('✅ Suscripción cancelada. No se realizarán cobros.');
                        } else {
                          toast(`❌ ${res.error}`);
                        }
                      });
                    }}
                  >
                    {subscription.status === 'TRIALING'
                      ? 'Cancelar Prueba Gratuita ($0.00)'
                      : 'Cancelar Suscripción'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Alta e Invitación de Empleados */}
      <InviteEmployeeModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />
    </>
  );
}