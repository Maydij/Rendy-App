'use client';

import { useState, useTransition, useEffect } from 'react';
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
  FileText,
  UploadCloud,
  ExternalLink,
  FileCheck,
  Tag,
} from 'lucide-react';
import {
  crearProyecto,
  toggleProyecto,
  eliminarProyecto,
  crearMetodoPago,
  eliminarMetodoPago,
  actualizarMonedaEmpresa,
  actualizarExencionFiscalUsa,
  subirCertificadoTaxExempt,
  eliminarCertificadoTaxExempt,
  guardarCertificadoFiscalUsa,
  eliminarCertificadoFiscalUsa,
  crearCategoriaPersonalizada,
  actualizarLimiteDiarioCategoria,
  toggleCategoriaActiva,
  eliminarCategoriaPersonalizada,
  darDeBajaMiembro,
  reactivarMiembro,
} from './actions';
import { cancelTrialOrSubscriptionAction } from '@/app/actions/subscription.actions';
import { InviteEmployeeModal } from '@/components/dashboard/InviteEmployeeModal';
import type { CategoriaGasto } from '@/lib/types/categoria';

type Empresa = {
  id: string;
  nombre: string;
  moneda: string;
  creado_en: string;
  us_tax_exempt?: boolean;
  url_certificado_tax_exempt?: string | null;
  nombre_certificado_usa?: string | null;
  url_certificado_usa?: string | null;
};
type Usuario = {
  id: string;
  nombre: string;
  email: string | null;
  telefono_whatsapp: string | null;
  rol?: string;
  role?: string;
  department?: string | null;
  creado_en: string;
  activo?: boolean;
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

function CategoryLimitInput({
  initialLimit,
  onSave,
  disabled,
}: {
  initialLimit: number;
  onSave: (val: number) => void;
  disabled?: boolean;
}) {
  const [val, setVal] = useState(initialLimit.toString());
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setVal(initialLimit.toString());
  }, [initialLimit]);

  const commitChange = () => {
    setIsEditing(false);
    const parsed = Math.max(0, parseFloat(val) || 0);
    if (parsed !== initialLimit) {
      onSave(parsed);
    }
  };

  const num = parseFloat(val) || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: '150px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>$</span>
        <input
          type="number"
          step="any"
          min="0"
          value={val}
          disabled={disabled}
          onFocus={() => setIsEditing(true)}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commitChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
          className="input-field"
          style={{
            width: '90px',
            padding: '4px 8px',
            fontSize: '13px',
            textAlign: 'right',
            fontWeight: 600,
            borderRadius: '6px',
            borderColor: isEditing ? 'var(--rendy-primary)' : 'var(--bg-border)',
          }}
        />
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>USD/día</span>
      </div>
      <span
        style={{
          fontSize: '10px',
          fontWeight: 600,
          marginTop: '3px',
          color: num > 0 ? '#00e599' : 'var(--text-muted)',
        }}
      >
        {num > 0 ? `Tope: $${num.toFixed(2)} / día` : 'Sin límite diario'}
      </span>
    </div>
  );
}

function CategoryRowItem({
  categoria,
  onUpdateLimit,
  onToggleActive,
  onDelete,
  disabled,
}: {
  categoria: CategoriaGasto;
  onUpdateLimit: (val: number) => void;
  onToggleActive: (activa: boolean) => void;
  onDelete?: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--bg-border)',
        borderRadius: '10px',
        gap: '16px',
        flexWrap: 'wrap',
        opacity: categoria.activa ? 1 : 0.6,
        transition: 'var(--transition-fast)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px', flex: 1 }}>
        <span style={{ fontSize: '20px', lineHeight: 1 }}>{categoria.icono || '🏷️'}</span>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {categoria.nombre}
            </span>
            {categoria.es_sistema ? (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '1px 6px',
                  borderRadius: '6px',
                  background: 'rgba(100, 116, 139, 0.15)',
                  color: 'var(--text-muted)',
                }}
              >
                Oficial Rendy
              </span>
            ) : (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '1px 6px',
                  borderRadius: '6px',
                  background: 'rgba(0, 168, 107, 0.15)',
                  color: 'var(--rendy-success, #00A86B)',
                }}
              >
                Personalizada
              </span>
            )}
          </div>
          {categoria.descripcion && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {categoria.descripcion}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
        {/* Inline Daily Limit Input */}
        <CategoryLimitInput
          initialLimit={categoria.limite_diario_usd}
          onSave={onUpdateLimit}
          disabled={disabled || !categoria.activa}
        />

        {/* Switch Activa */}
        <label
          style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            cursor: disabled ? 'wait' : 'pointer',
            gap: '8px',
          }}
        >
          <input
            type="checkbox"
            checked={categoria.activa}
            disabled={disabled}
            onChange={(e) => onToggleActive(e.target.checked)}
            style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
          />
          <span
            style={{
              width: '38px',
              height: '20px',
              backgroundColor: categoria.activa ? 'var(--rendy-primary)' : 'var(--bg-overlay)',
              borderRadius: '20px',
              transition: 'var(--transition-fast)',
              position: 'relative',
              display: 'inline-block',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: '2px',
                left: categoria.activa ? '20px' : '2px',
                width: '16px',
                height: '16px',
                backgroundColor: 'white',
                borderRadius: '50%',
                transition: 'var(--transition-fast)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}
            />
          </span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: categoria.activa ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {categoria.activa ? 'Activa' : 'Pausada'}
          </span>
        </label>

        {/* Delete Button (Only custom categories) */}
        {!categoria.es_sistema && onDelete && (
          <button
            type="button"
            disabled={disabled}
            onClick={onDelete}
            className="btn btn-icon btn-danger btn-sm"
            title="Eliminar categoría personalizada"
            style={{ padding: '6px' }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function ModalNuevaCategoria({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { nombre: string; descripcion: string; icono: string; limiteDiarioUsd: number }) => void;
  isSubmitting: boolean;
}) {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [icono, setIcono] = useState('🏷️');
  const [limiteDiario, setLimiteDiario] = useState('0');

  if (!isOpen) return null;

  const EMOJIS = ['🏷️', '📦', '🛠️', '💻', '🩺', '🎓', '⚖️', '📑', '🚚', '💡', '📱', '🎟️', '🛒', '☕', '🏢'];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '460px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--bg-border)',
          borderRadius: '14px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '18px 20px',
            borderBottom: '1px solid var(--bg-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Nueva Categoría Personalizada
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ padding: '4px 8px' }}
          >
            <X size={16} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              nombre,
              descripcion,
              icono,
              limiteDiarioUsd: parseFloat(limiteDiario) || 0,
            });
          }}
          style={{ padding: '20px' }}
        >
          {/* Selector de Icono / Emoji */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Icono / Emoji
            </label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setIcono(em)}
                  style={{
                    fontSize: '18px',
                    padding: '6px 8px',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: icono === em ? 'var(--rendy-primary)' : 'var(--bg-border)',
                    background: icono === em ? 'rgba(0, 168, 107, 0.15)' : 'var(--bg-surface)',
                    cursor: 'pointer',
                  }}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          {/* Nombre de la Categoría */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Nombre de la Categoría *
            </label>
            <input
              type="text"
              required
              maxLength={30}
              placeholder="ej. Envíos y Currier, Licencias Software"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="input-field"
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
              Recomendado máx. 20 caracteres para visualización óptima en WhatsApp.
            </div>
          </div>

          {/* Descripción */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Descripción (Opcional)
            </label>
            <input
              type="text"
              maxLength={80}
              placeholder="ej. Paquetería local, despachos y encomiendas"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="input-field"
              style={{ width: '100%' }}
            />
          </div>

          {/* Límite Diario en USD */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Límite Diario en USD (Opcional)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>$</span>
              <input
                type="number"
                step="any"
                min="0"
                value={limiteDiario}
                onChange={(e) => setLimiteDiario(e.target.value)}
                className="input-field"
                style={{ width: '130px', fontWeight: 600 }}
              />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>USD / día</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
              Deja en 0 para permitir gastos en esta categoría sin límite diario ni alertas.
            </div>
          </div>

          {/* Botones de acción */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn btn-secondary btn-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !nombre.trim()}
              className="btn btn-primary btn-sm"
            >
              {isSubmitting ? 'Guardando...' : 'Crear Categoría'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ConfiguracionClient({
  empresa,
  usuarios,
  proyectos: initProyectos,
  metodos: initMetodos,
  subscription,
  pendingInvitations,
  categorias: initCategorias = [],
  isAdmin = true,
  currentUserId,
  currentUserName,
}: {
  empresa: Empresa | null;
  usuarios: Usuario[];
  proyectos: Proyecto[];
  metodos: Metodo[];
  subscription: SubscriptionInfo | null;
  pendingInvitations: PendingInvitation[];
  categorias?: CategoriaGasto[];
  isAdmin?: boolean;
  currentUserId?: string;
  currentUserName?: string;
}) {
  const [activeTab, setActiveTab] = useState<'usuarios' | 'proyectos' | 'metodos' | 'suscripcion' | 'fiscal' | 'categorias'>(
    'usuarios'
  );
  const [proyectos, setProyectos] = useState(initProyectos);
  const [metodos, setMetodos] = useState(initMetodos);
  const [categorias, setCategorias] = useState<CategoriaGasto[]>(initCategorias);
  const [isNewCategoryModalOpen, setIsNewCategoryModalOpen] = useState(false);
  const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);
  const [newProyecto, setNewProyecto] = useState('');
  const [newMetodo, setNewMetodo] = useState('');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  // USA Fiscal Certificate State (Optional)
  const [nombreCertificado, setNombreCertificado] = useState<string>(
    ((empresa as Record<string, unknown>)?.nombre_certificado_usa as string) || ''
  );
  const [urlCertificado, setUrlCertificado] = useState<string | null>(
    ((empresa as Record<string, unknown>)?.url_certificado_usa as string | null) ||
    empresa?.url_certificado_tax_exempt ||
    null
  );
  const [isUploadingCert, setIsUploadingCert] = useState(false);
  const [isSavingCertName, setIsSavingCertName] = useState(false);

  function toast(msg: string) {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  }

  const [memberActionLoading, setMemberActionLoading] = useState<string | null>(null);

  const handleDarDeBaja = async (usuario: Usuario) => {
    if (
      !confirm(
        `¿Estás seguro de que deseas dar de baja a ${usuario.nombre}?\n\nAl darlo de baja, se desactivará su acceso y su número de WhatsApp quedará liberado para poder ser registrado en otra organización.`
      )
    ) {
      return;
    }
    setMemberActionLoading(usuario.id);
    const res = await darDeBajaMiembro(usuario.id);
    setMemberActionLoading(null);
    if (res.error) {
      alert(res.error);
    } else {
      toast('Colaborador dado de baja. Su número ha sido liberado.');
    }
  };

  const handleReactivar = async (usuario: Usuario) => {
    setMemberActionLoading(usuario.id);
    const res = await reactivarMiembro(usuario.id);
    setMemberActionLoading(null);
    if (res.error) {
      alert(res.error);
    } else {
      toast('Colaborador reactivado con éxito.');
    }
  };

  const handleUpdateDailyLimit = (catId: string, limitVal: number) => {
    startTransition(async () => {
      try {
        const res = await actualizarLimiteDiarioCategoria({
          categoriaId: catId,
          limiteDiarioUsd: limitVal,
        });
        if (res?.error) {
          toast(`❌ ${res.error}`);
        } else {
          setCategorias((prev) =>
            prev.map((c) => (c.id === catId ? { ...c, limite_diario_usd: limitVal } : c))
          );
          toast(
            limitVal > 0
              ? `✅ Límite diario actualizado a $${limitVal.toFixed(2)} USD`
              : '✅ Categoría configurada sin límite diario'
          );
        }
      } catch {
        toast('❌ Error al actualizar el límite diario');
      }
    });
  };

  const handleToggleCategoria = (catId: string, currentActiva: boolean) => {
    const nextActiva = !currentActiva;
    startTransition(async () => {
      try {
        const res = await toggleCategoriaActiva({
          categoriaId: catId,
          activa: nextActiva,
        });
        if (res?.error) {
          toast(`❌ ${res.error}`);
        } else {
          setCategorias((prev) =>
            prev.map((c) => (c.id === catId ? { ...c, activa: nextActiva } : c))
          );
          toast(nextActiva ? '✅ Categoría activada' : '⏸️ Categoría desactivada');
        }
      } catch {
        toast('❌ Error al cambiar el estado de la categoría');
      }
    });
  };

  const handleDeleteCategoria = (catId: string, nombre: string) => {
    if (!confirm(`¿Estás seguro de eliminar la categoría personalizada "${nombre}"?`)) {
      return;
    }
    startTransition(async () => {
      try {
        const res = await eliminarCategoriaPersonalizada({ categoriaId: catId });
        if (res?.error) {
          toast(`❌ ${res.error}`);
        } else {
          setCategorias((prev) => prev.filter((c) => c.id !== catId));
          toast(`🗑️ Categoría "${nombre}" eliminada.`);
        }
      } catch {
        toast('❌ Error al eliminar la categoría');
      }
    });
  };

  const handleCreateCategoria = async (input: {
    nombre: string;
    descripcion?: string;
    icono?: string;
    limite_diario_usd?: number;
  }) => {
    setIsSubmittingCategory(true);
    try {
      const res = await crearCategoriaPersonalizada({
        nombre: input.nombre,
        descripcion: input.descripcion,
        icono: input.icono,
        limiteDiarioUsd: input.limite_diario_usd,
      });
      if (res?.error) {
        toast(`❌ ${res.error}`);
      } else if (res?.data) {
        setCategorias((prev) => [...prev, res.data as CategoriaGasto]);
        setIsNewCategoryModalOpen(false);
        toast(`✅ Categoría "${res.data.nombre}" creada con éxito.`);
      }
    } catch {
      toast('❌ Error al crear la categoría');
    } finally {
      setIsSubmittingCategory(false);
    }
  };

  const handleUploadCertificate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    if (nombreCertificado.trim()) {
      formData.append('nombre', nombreCertificado.trim());
    }

    setIsUploadingCert(true);
    try {
      const res = await guardarCertificadoFiscalUsa(formData);
      if (res?.error) {
        toast(`❌ ${res.error}`);
      } else {
        if (res?.url) setUrlCertificado(res.url);
        toast('✅ Certificado fiscal cargado exitosamente.');
      }
    } catch {
      toast('❌ Error inesperado al subir el certificado.');
    } finally {
      setIsUploadingCert(false);
      e.target.value = '';
    }
  };

  const handleSaveCertificateName = () => {
    const formData = new FormData();
    formData.append('nombre', nombreCertificado.trim());

    setIsSavingCertName(true);
    startTransition(async () => {
      try {
        const res = await guardarCertificadoFiscalUsa(formData);
        if (res?.error) {
          toast(`❌ ${res.error}`);
        } else {
          toast('✅ Nombre del certificado actualizado.');
        }
      } catch {
        toast('❌ Error al actualizar el nombre del certificado.');
      } finally {
        setIsSavingCertName(false);
      }
    });
  };

  const handleDeleteCertificate = () => {
    startTransition(async () => {
      const res = await eliminarCertificadoFiscalUsa();
      if (res?.error) {
        toast(`❌ ${res.error}`);
      } else {
        setUrlCertificado(null);
        setNombreCertificado('');
        toast('🗑️ Certificado fiscal eliminado.');
      }
    });
  };

  /* ─────────────────────────────────────────────────────────────
   * Employee Read-Only View
   * ───────────────────────────────────────────────────────────── */
  if (!isAdmin) {
    const myUser = usuarios.find((u) => u.id === currentUserId);

    return (
      <>
        <div className="page-header">
          <h1 className="page-title">
            <Settings size={24} strokeWidth={2} />
            Información de mi Organización
          </h1>
          <p className="page-subtitle">
            Vista informativa de tu empresa, tu perfil y las políticas de gastos vigentes.
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

        {/* Organization Info Card */}
        {empresa && (
          <div className="card" style={{ marginBottom: '24px' }}>
            <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '14px',
                  flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--rendy-accent-dark), var(--rendy-accent))',
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
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>{empresa.nombre}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Moneda de operación: <strong style={{ color: 'var(--text-secondary)' }}>{empresa.moneda || 'USD'}</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* My Profile */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ padding: '20px 24px' }}>
            <SectionHeader
              title="Mi Perfil"
              subtitle="Tu información registrada en la organización."
            />
            {myUser ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '12px' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nombre</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{myUser.nombre}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</div>
                  <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{myUser.email || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Teléfono WhatsApp</div>
                  <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{myUser.telefono_whatsapp ? `+${myUser.telefono_whatsapp}` : '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rol</div>
                  <RolBadge rol={myUser.rol || myUser.role || 'EMPLOYEE'} />
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Departamento</div>
                  <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{myUser.department || 'General'}</div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>No se encontró tu perfil de usuario.</div>
            )}
          </div>
        </div>

        {/* Expense Categories & Daily Limits (Read-Only) */}
        <div className="card">
          <div style={{ padding: '20px 24px' }}>
            <SectionHeader
              title="Categorías de Gastos y Límites Diarios"
              subtitle="Políticas de gastos vigentes definidas por tu administrador."
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
              {categorias.filter((c) => c.activa).map((cat) => (
                <div
                  key={cat.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--bg-border)',
                    borderRadius: '10px',
                    gap: '16px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px', flex: 1 }}>
                    <span style={{ fontSize: '20px', lineHeight: 1 }}>{cat.icono || '🏷️'}</span>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{cat.nombre}</div>
                      {cat.descripcion && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{cat.descripcion}</div>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: '120px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: cat.limite_diario_usd > 0 ? 'var(--rendy-accent)' : 'var(--text-muted)' }}>
                      {cat.limite_diario_usd > 0 ? `$${cat.limite_diario_usd.toFixed(2)} USD / día` : 'Sin límite'}
                    </div>
                  </div>
                </div>
              ))}
              {categorias.filter((c) => c.activa).length === 0 && (
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                  No hay categorías activas configuradas.
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ─────────────────────────────────────────────────────────────
   * Admin Full View (original)
   * ───────────────────────────────────────────────────────────── */

  const TABS = [
    { id: 'usuarios' as const, label: 'Usuarios', icon: Users, count: usuarios.length },
    { id: 'categorias' as const, label: 'Categorías y Límites', icon: Tag, count: categorias.length },
    { id: 'proyectos' as const, label: 'Proyectos', icon: FolderKanban, count: proyectos.length },
    { id: 'metodos' as const, label: 'Métodos de Pago', icon: CreditCard, count: metodos.length },
    { id: 'suscripcion' as const, label: 'Suscripción y Plan', icon: ShieldCheck, count: 1 },
    { id: 'fiscal' as const, label: 'Certificado Fiscal USA', icon: FileText, count: urlCertificado ? 'Cargado' : 'Opcional' },
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
                      <th>Estado</th>
                      <th>Alta</th>
                      <th style={{ textAlign: 'right' }}>Acciones</th>
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
                          <td>
                            {u.activo !== false ? (
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '9999px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                Activo
                              </span>
                            ) : (
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '9999px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                Inactivo (Baja)
                              </span>
                            )}
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                            {new Date(u.creado_en).toLocaleDateString('es-VE')}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {effectiveRole !== 'ADMIN' && (
                              u.activo !== false ? (
                                <button
                                  type="button"
                                  onClick={() => handleDarDeBaja(u)}
                                  disabled={memberActionLoading === u.id}
                                  className="btn btn-ghost btn-sm"
                                  style={{
                                    fontSize: '11px',
                                    color: 'var(--rendy-danger, #ef4444)',
                                    background: 'rgba(239, 68, 68, 0.08)',
                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                  }}
                                  title="Dar de baja y liberar número de teléfono"
                                >
                                  {memberActionLoading === u.id ? '...' : 'Dar de baja'}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleReactivar(u)}
                                  disabled={memberActionLoading === u.id}
                                  className="btn btn-ghost btn-sm"
                                  style={{
                                    fontSize: '11px',
                                    color: '#10b981',
                                    background: 'rgba(16, 185, 129, 0.08)',
                                    border: '1px solid rgba(16, 185, 129, 0.2)',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                  }}
                                  title="Reactivar usuario"
                                >
                                  {memberActionLoading === u.id ? '...' : 'Reactivar'}
                                </button>
                              )
                            )}
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

      {/* ── Categorías y Límites Diarios ── */}
      {activeTab === 'categorias' && (
        <div className="card" style={{ padding: '24px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Catálogo de Categorías y Límites Diarios
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Configura las categorías de gastos y establece topes diarios en USD por categoría para tus colaboradores.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsNewCategoryModalOpen(true)}
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              + Nueva Categoría
            </button>
          </div>

          {/* Bloque 1: Categorías Personalizadas */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Categorías Personalizadas
              </h3>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  padding: '2px 8px',
                  borderRadius: '12px',
                }}
              >
                {categorias.filter((c) => !c.es_sistema).length}
              </span>
            </div>

            {categorias.filter((c) => !c.es_sistema).length === 0 ? (
              <div
                style={{
                  padding: '24px',
                  background: 'var(--bg-elevated)',
                  border: '1px dashed var(--bg-border)',
                  borderRadius: '10px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '13px',
                }}
              >
                No has creado categorías personalizadas aún. Haz clic en <strong>&quot;+ Nueva Categoría&quot;</strong> para añadir categorías específicas de tu negocio.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {categorias
                  .filter((c) => !c.es_sistema)
                  .map((cat) => (
                    <CategoryRowItem
                      key={cat.id}
                      categoria={cat}
                      onUpdateLimit={(val) => handleUpdateDailyLimit(cat.id, val)}
                      onToggleActive={() => handleToggleCategoria(cat.id, cat.activa)}
                      onDelete={() => handleDeleteCategoria(cat.id, cat.nombre)}
                      disabled={isPending}
                    />
                  ))}
              </div>
            )}
          </div>

          {/* Bloque 2: Categorías Oficiales por Defecto */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Categorías Oficiales por Defecto
              </h3>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  background: 'rgba(0, 229, 153, 0.15)',
                  color: '#00e599',
                  padding: '2px 8px',
                  borderRadius: '12px',
                }}
              >
                {categorias.filter((c) => c.es_sistema).length}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Las 8 categorías universales de Rendy. Puedes ajustar su límite diario o desactivarlas si tu empresa no las utiliza.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {categorias
                .filter((c) => c.es_sistema)
                .map((cat) => (
                  <CategoryRowItem
                    key={cat.id}
                    categoria={cat}
                    onUpdateLimit={(val) => handleUpdateDailyLimit(cat.id, val)}
                    onToggleActive={() => handleToggleCategoria(cat.id, cat.activa)}
                    disabled={isPending}
                  />
                ))}
            </div>
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

      {/* ── Certificado Fiscal EE. UU. (Opcional) ── */}
      {activeTab === 'fiscal' && (
        <div className="card">
          <div style={{ padding: '24px' }}>
            <SectionHeader
              title="Certificado Fiscal EE. UU. (Opcional)"
              subtitle="Configura opcionalmente el documento fiscal de tu empresa en EE. UU. (Resale Certificate, Exención 501(c)(3), Formulario W-9, etc.) para que tus colaboradores puedan consultarlo o descargarlo rápidamente desde WhatsApp."
            />

            {/* Document Name & Upload Configuration Card */}
            <div
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--bg-border)',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '20px',
              }}
            >
              <div style={{ marginBottom: '18px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '6px',
                  }}
                >
                  Nombre / Tipo de Certificado
                </label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={nombreCertificado}
                    placeholder="ej. Certificado de Reventa (Resale Certificate) o Florida Tax-Exempt"
                    onChange={(e) => setNombreCertificado(e.target.value)}
                    className="input-field"
                    style={{ flex: 1, minWidth: '280px' }}
                  />
                  <button
                    type="button"
                    disabled={isPending || isSavingCertName}
                    onClick={handleSaveCertificateName}
                    className="btn btn-secondary btn-sm"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {isSavingCertName ? 'Guardando...' : 'Guardar Nombre'}
                  </button>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
                  Este nombre aparecerá como título descriptivo cuando los colaboradores consulten el documento en WhatsApp.
                </p>
              </div>

              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Archivo del Certificado
              </div>

              {urlCertificado ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    background: 'var(--bg-surface)',
                    border: '1px solid rgba(0, 168, 107, 0.3)',
                    borderRadius: '10px',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        background: 'rgba(0, 168, 107, 0.15)',
                        color: 'var(--rendy-success, #00A86B)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <FileCheck size={20} />
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {nombreCertificado || 'Certificado Fiscal EE. UU.'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--rendy-success, #00A86B)' }}>
                        ✓ Documento disponible para consulta vía WhatsApp
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <a
                      href={urlCertificado}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <ExternalLink size={14} />
                      Ver / Descargar
                    </a>

                    <label
                      className="btn btn-secondary btn-sm"
                      style={{ cursor: isUploadingCert ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <UploadCloud size={14} />
                      {isUploadingCert ? 'Subiendo...' : 'Reemplazar'}
                      <input
                        type="file"
                        accept=".pdf,image/png,image/jpeg,image/webp"
                        disabled={isUploadingCert}
                        onChange={handleUploadCertificate}
                        style={{ display: 'none' }}
                      />
                    </label>

                    <button
                      type="button"
                      disabled={isPending || isUploadingCert}
                      className="btn btn-danger btn-sm"
                      onClick={handleDeleteCertificate}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Trash2 size={14} />
                      Eliminar
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    border: '2px dashed var(--bg-border)',
                    borderRadius: '10px',
                    padding: '30px 20px',
                    textAlign: 'center',
                    background: 'var(--bg-surface)',
                  }}
                >
                  <UploadCloud size={36} style={{ color: 'var(--text-muted)', marginBottom: '10px' }} />
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    Ningún certificado fiscal cargado (Opcional)
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '460px', margin: '0 auto 16px auto' }}>
                    Si tu empresa posee un certificado de reventa, exención tributaria o W-9, puedes subirlo aquí (PDF, PNG, JPG, máx 10 MB).
                  </p>
                  <label
                    className="btn btn-primary btn-sm"
                    style={{ cursor: isUploadingCert ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    <UploadCloud size={15} />
                    {isUploadingCert ? 'Subiendo documento...' : 'Seleccionar Certificado'}
                    <input
                      type="file"
                      accept=".pdf,image/png,image/jpeg,image/webp"
                      disabled={isUploadingCert}
                      onChange={handleUploadCertificate}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Informational Architecture Guidelines */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '14px',
              }}
            >
              <div
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--bg-border)',
                  borderRadius: '10px',
                  padding: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', color: 'var(--rendy-primary-light)' }}>
                  <ShieldCheck size={16} />
                  <span style={{ fontSize: '13px', fontWeight: 700 }}>Consulta Inmediata en WhatsApp</span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  Cargar este certificado es 100% opcional. Si está cargado, tus empleados pueden escribir <strong>&quot;Certificado&quot;</strong>, <strong>&quot;Tax Exempt&quot;</strong> o <strong>&quot;Resale&quot;</strong> en el chat de WhatsApp para recibirlo al instante y presentarlo en caja.
                </p>
              </div>

              <div
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--bg-border)',
                  borderRadius: '10px',
                  padding: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', color: 'var(--rendy-success)' }}>
                  <FileText size={16} />
                  <span style={{ fontSize: '13px', fontWeight: 700 }}>Extracción Contable Universal</span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  Rendy clasifica automáticamente cada gasto en EE. UU. (Estado, Subtotal, Sales Tax y Propina) y habilita la pestaña <strong>&quot;Desglose Taxes USA&quot;</strong> con fórmulas dinámicas en tus reportes contables Excel, tenga o no certificado la empresa.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Creación de Categoría Personalizada */}
      <ModalNuevaCategoria
        isOpen={isNewCategoryModalOpen}
        onClose={() => setIsNewCategoryModalOpen(false)}
        onSubmit={handleCreateCategoria}
        isSubmitting={isSubmittingCategory}
      />

      {/* Modal de Alta e Invitación de Empleados */}
      <InviteEmployeeModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />
    </>
  );
}