'use client';

/**
 * @file configuracion-client.tsx
 * @description [UI Orchestrator]: Stitch "Gestión de Organización" view orchestrating
 * organization identity, multi-currency selection, collaborators lifecycle, expense categories
 * with daily caps, cost-center projects, corporate payment methods, Stripe subscription controls,
 * and optional US fiscal certificates with strict role separation (ADMIN vs EMPLOYEE).
 */

import React, { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Users,
  Tags,
  FolderKanban,
  CreditCard,
  ShieldCheck,
  FileText,
  CheckCircle2,
  AlertCircle,
  Lock,
  Calendar,
  Hash,
  Globe2,
} from 'lucide-react';
import {
  crearProyecto,
  toggleProyecto,
  eliminarProyecto,
  crearMetodoPago,
  eliminarMetodoPago,
  actualizarMonedaEmpresa,
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
import {
  getCompanyMonogram,
  type ConfigTabId,
  type Empresa,
  type Metodo,
  type PendingInvitation,
  type Proyecto,
  type SubscriptionInfo,
  type Usuario,
} from './_components/types';
import { UsuariosTabSection } from './_components/UsuariosTabSection';
import { CategoriasTabSection, ModalNuevaCategoria } from './_components/CategoriasTabSection';
import {
  EmployeeOrganizacionView,
  FiscalTabSection,
  MetodosTabSection,
  ProyectosTabSection,
  SuscripcionTabSection,
} from './_components/ConfigSubSections';

interface ConfiguracionClientProps {
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
}

const CURRENCY_OPTIONS: ReadonlyArray<{ code: string; label: string }> = [
  { code: 'USD', label: 'USD — Dólar Estadounidense ($)' },
  { code: 'VES', label: 'VES — Bolívar Venezolano (Bs.)' },
  { code: 'EUR', label: 'EUR — Euro (€)' },
  { code: 'COP', label: 'COP — Peso Colombiano ($)' },
  { code: 'MXN', label: 'MXN — Peso Mexicano ($)' },
  { code: 'PEN', label: 'PEN — Sol Peruano (S/)' },
  { code: 'CLP', label: 'CLP — Peso Chileno ($)' },
  { code: 'ARS', label: 'ARS — Peso Argentino ($)' },
];

/**
 * @name resolveSubscriptionPill
 * @description [Business Logic]: Maps Stripe subscription lifecycle statuses into
 * stakeholder-friendly status badges for the organization hero header.
 */
function resolveSubscriptionPill(sub: SubscriptionInfo | null): {
  label: string;
  className: string;
} {
  if (!sub) {
    return {
      label: 'Plan Corporativo',
      className: 'bg-primary/10 text-primary border border-primary/25',
    };
  }
  const status = sub.status.toUpperCase();
  if (status === 'ACTIVE') {
    return {
      label: `Suscripción Activa · ${sub.plan_id}`,
      className: 'bg-primary/15 text-primary border border-primary/30',
    };
  }
  if (status === 'TRIALING') {
    return {
      label: `Prueba Gratuita · ${sub.plan_id}`,
      className: 'bg-secondary/15 text-secondary border border-secondary/30',
    };
  }
  if (status === 'PAST_DUE' || status === 'UNPAID') {
    return {
      label: 'Pago Pendiente',
      className: 'bg-tertiary-container/30 text-tertiary-fixed border border-tertiary-fixed/30',
    };
  }
  return {
    label: status === 'CANCELED' ? 'Suscripción Cancelada' : status,
    className: 'bg-error-container/25 text-error border border-error/30',
  };
}

/**
 * @name ConfiguracionClient
 * @description [Business Logic]: Main administrative portal for configuring tenant-wide rules,
 * staff access via WhatsApp, spending category limits, cost centers, payment methods, billing,
 * and US fiscal compliance certificates. Renders a read-only policy portal for non-admin staff.
 */
export default function ConfiguracionClient({
  empresa,
  usuarios: initUsuarios,
  proyectos: initProyectos,
  metodos: initMetodos,
  subscription: initSubscription,
  pendingInvitations,
  categorias: initCategorias = [],
  isAdmin = true,
  currentUserId,
}: ConfiguracionClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ConfigTabId>('usuarios');
  const [moneda, setMoneda] = useState<string>(empresa?.moneda || 'USD');
  const [usuarios, setUsuarios] = useState<Usuario[]>(initUsuarios);
  const [proyectos, setProyectos] = useState<Proyecto[]>(initProyectos);
  const [metodos, setMetodos] = useState<Metodo[]>(initMetodos);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(initSubscription);
  const [categorias, setCategorias] = useState<CategoriaGasto[]>(initCategorias);

  const [isNewCategoryModalOpen, setIsNewCategoryModalOpen] = useState(false);
  const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);

  const [newProyecto, setNewProyecto] = useState('');
  const [newMetodo, setNewMetodo] = useState('');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [memberActionLoading, setMemberActionLoading] = useState<string | null>(null);

  const [nombreCertificado, setNombreCertificado] = useState(
    empresa?.nombre_certificado_usa || ''
  );
  const [urlCertificado, setUrlCertificado] = useState<string | null>(
    empresa?.url_certificado_usa || empresa?.url_certificado_tax_exempt || null
  );
  const [isUploadingCert, setIsUploadingCert] = useState(false);
  const [isSavingCertName, setIsSavingCertName] = useState(false);

  // Sync hydrated lists if server refresh updates props
  useEffect(() => {
    setUsuarios(initUsuarios);
  }, [initUsuarios]);

  useEffect(() => {
    setProyectos(initProyectos);
  }, [initProyectos]);

  useEffect(() => {
    setMetodos(initMetodos);
  }, [initMetodos]);

  useEffect(() => {
    setCategorias(initCategorias);
  }, [initCategorias]);

  useEffect(() => {
    setSubscription(initSubscription);
  }, [initSubscription]);

  useEffect(() => {
    if (empresa?.moneda) {
      setMoneda(empresa.moneda);
    }
  }, [empresa?.moneda]);

  const toast = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  // Non-admin collaborators see their profile and active policies only
  if (!isAdmin) {
    const myUser = usuarios.find((u) => u.id === currentUserId);
    return (
      <EmployeeOrganizacionView
        empresa={empresa}
        myUser={myUser}
        categorias={categorias}
      />
    );
  }

  /**
   * @name handleCurrencyChange
   * @description [Business Logic]: Updates the organization's default operating currency
   * used across financial reporting dashboards and WhatsApp expense receipts.
   */
  const handleCurrencyChange = (nextCurrency: string) => {
    const previous = moneda;
    setMoneda(nextCurrency);
    startTransition(async () => {
      try {
        const res = await actualizarMonedaEmpresa(nextCurrency);
        if (res?.error) {
          setMoneda(previous);
          toast(`❌ ${res.error}`);
        } else {
          toast(`✅ Moneda principal actualizada a ${nextCurrency}.`);
          router.refresh();
        }
      } catch {
        setMoneda(previous);
        toast('❌ No se pudo actualizar la moneda de la organización.');
      }
    });
  };

  /**
   * @name handleDarDeBaja
   * @description [Business Logic]: Deactivates a collaborator and releases their bound WhatsApp
   * phone number so they can no longer log corporate expenses or be blocked in another tenant.
   */
  const handleDarDeBaja = async (usuario: Usuario) => {
    if (
      !confirm(
        `¿Estás seguro de que deseas dar de baja a ${usuario.nombre}?\n\nAl darlo de baja, se desactivará su acceso y su número de WhatsApp quedará liberado para poder ser registrado en otra organización.`
      )
    ) {
      return;
    }
    setMemberActionLoading(usuario.id);
    try {
      const res = await darDeBajaMiembro(usuario.id);
      if (res?.error) {
        alert(res.error);
      } else {
        setUsuarios((prev) =>
          prev.map((u) =>
            u.id === usuario.id ? { ...u, activo: false, telefono_whatsapp: null } : u
          )
        );
        toast('✅ Colaborador dado de baja y número de WhatsApp liberado.');
        router.refresh();
      }
    } finally {
      setMemberActionLoading(null);
    }
  };

  /**
   * @name handleReactivar
   * @description [Business Logic]: Restores active status for a previously deactivated employee.
   */
  const handleReactivar = async (usuario: Usuario) => {
    setMemberActionLoading(usuario.id);
    try {
      const res = await reactivarMiembro(usuario.id);
      if (res?.error) {
        alert(res.error);
      } else {
        setUsuarios((prev) =>
          prev.map((u) => (u.id === usuario.id ? { ...u, activo: true } : u))
        );
        toast('✅ Colaborador reactivado con éxito.');
        router.refresh();
      }
    } finally {
      setMemberActionLoading(null);
    }
  };

  /**
   * @name handleUpdateDailyLimit
   * @description [Business Logic]: Saves the daily USD expenditure cap for a category
   * to enforce real-time out-of-policy alerts when receipts are submitted via WhatsApp.
   */
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
          toast('✅ Límite diario actualizado.');
        }
      } catch {
        toast('❌ Error al guardar límite diario.');
      }
    });
  };

  /**
   * @name handleToggleCategoria
   * @description [Business Logic]: Enables or pauses an expense category across WhatsApp menus.
   */
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
          toast(
            nextActiva
              ? '✅ Categoría habilitada para reportes.'
              : '⏸️ Categoría pausada temporalmente.'
          );
        }
      } catch {
        toast('❌ Error al cambiar el estado de la categoría.');
      }
    });
  };

  /**
   * @name handleDeleteCategoria
   * @description [Business Logic]: Permanently removes a custom company expense category.
   */
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
        toast('❌ No se pudo eliminar la categoría.');
      }
    });
  };

  /**
   * @name handleCreateCategoria
   * @description [Business Logic]: Creates a custom corporate expense category with optional
   * icon, description, and daily USD threshold.
   */
  const handleCreateCategoria = async (input: {
    nombre: string;
    descripcion?: string;
    icono?: string;
    limiteDiarioUsd?: number;
  }) => {
    setIsSubmittingCategory(true);
    try {
      const res = await crearCategoriaPersonalizada({
        nombre: input.nombre,
        descripcion: input.descripcion,
        icono: input.icono,
        limiteDiarioUsd: input.limiteDiarioUsd ?? 0,
      });
      if (res?.error) {
        toast(`❌ ${res.error}`);
      } else if (res?.data) {
        setCategorias((prev) => [...prev, res.data as CategoriaGasto]);
        setIsNewCategoryModalOpen(false);
        toast(`✅ Categoría "${input.nombre}" creada correctamente.`);
        router.refresh();
      } else {
        setIsNewCategoryModalOpen(false);
        toast(`✅ Categoría "${input.nombre}" creada.`);
        router.refresh();
      }
    } catch {
      toast('❌ Ocurrió un error al crear la categoría.');
    } finally {
      setIsSubmittingCategory(false);
    }
  };

  /**
   * @name handleCrearProyecto
   * @description [Business Logic]: Registers a new project/cost center for expense tagging.
   */
  const handleCrearProyecto = () => {
    const trimmed = newProyecto.trim();
    if (!trimmed) return;
    startTransition(async () => {
      try {
        const res = await crearProyecto(trimmed);
        if (res?.error) {
          toast(`❌ ${res.error}`);
        } else {
          if (res?.data) {
            setProyectos((prev) => [res.data as Proyecto, ...prev]);
          }
          setNewProyecto('');
          toast(`✅ Proyecto "${trimmed}" creado.`);
          router.refresh();
        }
      } catch {
        toast('❌ Error al crear el proyecto.');
      }
    });
  };

  /**
   * @name handleToggleProyecto
   * @description [Business Logic]: Toggles active availability of a project in WhatsApp menus.
   */
  const handleToggleProyecto = (id: string, nextActive: boolean) => {
    startTransition(async () => {
      try {
        const res = await toggleProyecto(id, nextActive);
        if (res?.error) {
          toast(`❌ ${res.error}`);
        } else {
          setProyectos((prev) =>
            prev.map((p) => (p.id === id ? { ...p, activo: nextActive } : p))
          );
          toast(nextActive ? '✅ Proyecto activado.' : '⏸️ Proyecto pausado.');
        }
      } catch {
        toast('❌ Error al actualizar el proyecto.');
      }
    });
  };

  /**
   * @name handleEliminarProyecto
   * @description [Business Logic]: Deletes a project cost center when it has no blocking links.
   */
  const handleEliminarProyecto = (id: string) => {
    startTransition(async () => {
      try {
        const res = await eliminarProyecto(id);
        if (res?.error) {
          toast(`❌ ${res.error}`);
        } else {
          setProyectos((prev) => prev.filter((p) => p.id !== id));
          toast('🗑️ Proyecto eliminado.');
        }
      } catch {
        toast('❌ No se pudo eliminar el proyecto.');
      }
    });
  };

  /**
   * @name handleCrearMetodo
   * @description [Business Logic]: Registers a corporate payment method for WhatsApp expense tagging.
   */
  const handleCrearMetodo = () => {
    const trimmed = newMetodo.trim();
    if (!trimmed) return;
    startTransition(async () => {
      try {
        const res = await crearMetodoPago(trimmed);
        if (res?.error) {
          toast(`❌ ${res.error}`);
        } else {
          if (res?.data) {
            setMetodos((prev) => [res.data as Metodo, ...prev]);
          }
          setNewMetodo('');
          toast(`✅ Método "${trimmed}" agregado.`);
          router.refresh();
        }
      } catch {
        toast('❌ Error al agregar el método de pago.');
      }
    });
  };

  /**
   * @name handleEliminarMetodo
   * @description [Business Logic]: Deletes a payment method option from the organization catalog.
   */
  const handleEliminarMetodo = (id: string) => {
    startTransition(async () => {
      try {
        const res = await eliminarMetodoPago(id);
        if (res?.error) {
          toast(`❌ ${res.error}`);
        } else {
          setMetodos((prev) => prev.filter((m) => m.id !== id));
          toast('🗑️ Método de pago eliminado.');
        }
      } catch {
        toast('❌ No se pudo eliminar el método de pago.');
      }
    });
  };

  /**
   * @name handleCancelSubscription
   * @description [Business Logic]: Triggers subscription or free-trial cancellation via Stripe.
   */
  const handleCancelSubscription = () => {
    if (
      !confirm(
        '¿Estás seguro de que deseas cancelar la suscripción? Tu acceso continuará según las condiciones del período actual o finalizará de inmediato si estás en prueba gratuita.'
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        const res = await cancelTrialOrSubscriptionAction();
        if (!res.success) {
          toast(`❌ ${res.error || 'No se pudo cancelar la suscripción.'}`);
        } else {
          setSubscription((prev) =>
            prev
              ? {
                  ...prev,
                  status: prev.status === 'TRIALING' ? 'CANCELED' : prev.status,
                  cancel_at_period_end: true,
                }
              : null
          );
          toast('✅ Suscripción cancelada correctamente.');
          router.refresh();
        }
      } catch {
        toast('❌ Error al procesar la cancelación de suscripción.');
      }
    });
  };

  /**
   * @name handleUploadCertificate
   * @description [Business Logic]: Uploads a US Fiscal Certificate (Resale, 501(c)(3), W-9)
   * into secure storage for instant employee access on WhatsApp.
   */
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
        if ('url' in res && typeof res.url === 'string') {
          setUrlCertificado(res.url);
        }
        toast('✅ Certificado fiscal guardado con éxito.');
        router.refresh();
      }
    } catch {
      toast('❌ Error al subir el certificado fiscal.');
    } finally {
      setIsUploadingCert(false);
      e.target.value = '';
    }
  };

  /**
   * @name handleSaveCertName
   * @description [Business Logic]: Persists only the descriptive display name for the US
   * fiscal certificate without requiring a new file upload.
   */
  const handleSaveCertName = async () => {
    const formData = new FormData();
    formData.append('nombre', nombreCertificado.trim());

    setIsSavingCertName(true);
    try {
      const res = await guardarCertificadoFiscalUsa(formData);
      if (res?.error) {
        toast(`❌ ${res.error}`);
      } else {
        toast('✅ Nombre del certificado actualizado.');
        router.refresh();
      }
    } catch {
      toast('❌ Error al guardar el nombre del certificado.');
    } finally {
      setIsSavingCertName(false);
    }
  };

  /**
   * @name handleDeleteCertificate
   * @description [Business Logic]: Removes the stored US fiscal certificate from the tenant.
   */
  const handleDeleteCertificate = () => {
    startTransition(async () => {
      try {
        const res = await eliminarCertificadoFiscalUsa();
        if (res?.error) {
          toast(`❌ ${res.error}`);
        } else {
          setUrlCertificado(null);
          setNombreCertificado('');
          toast('🗑️ Certificado fiscal eliminado.');
          router.refresh();
        }
      } catch {
        toast('❌ Error al eliminar el certificado fiscal.');
      }
    });
  };

  const subPill = resolveSubscriptionPill(subscription);
  const activeMembersCount = usuarios.filter((u) => u.activo !== false).length;
  const activeProjectsCount = proyectos.filter((p) => p.activo).length;

  const tabs: ReadonlyArray<{
    id: ConfigTabId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }> = [
    { id: 'usuarios', label: 'Usuarios y Colaboradores', icon: Users, count: usuarios.length },
    { id: 'categorias', label: 'Categorías y Límites', icon: Tags, count: categorias.length },
    {
      id: 'proyectos',
      label: 'Proyectos y Centros de Costo',
      icon: FolderKanban,
      count: proyectos.length,
    },
    { id: 'metodos', label: 'Métodos de Pago', icon: CreditCard, count: metodos.length },
    { id: 'suscripcion', label: 'Suscripción y Facturación', icon: ShieldCheck },
    { id: 'fiscal', label: 'Certificados Fiscales & Cumplimiento', icon: FileText },
  ];

  return (
    <div className="relative w-full max-w-[1440px] mx-auto flex flex-col gap-6 pb-14 text-on-surface select-text">
      {/* Subtle Ambient Accent Glows */}
      <div className="absolute -top-24 -right-12 w-96 h-96 rounded-full bg-primary-container/5 blur-3xl pointer-events-none" />
      <div className="absolute top-40 -left-16 w-72 h-72 rounded-full bg-secondary/5 blur-3xl pointer-events-none" />

      {/* ── Header Banner ── */}
      <div className="flex flex-col gap-1.5 pt-2 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-primary shadow-sm ring-1 ring-outline-variant/25 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">
            Gestión de Organización
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-on-surface-variant sm:pl-[52px]">
          Administra la identidad corporativa, colaboradores activos, categorías de gastos, centros de costos y cumplimiento fiscal.
        </p>
      </div>

      {/* ── Organization Hero Overview Card ── */}
      <section className="relative z-10 rounded-2xl bg-surface-container-low border border-outline-variant/25 p-5 sm:p-6 shadow-sm overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Identity & Metadata */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 min-w-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-surface-container-high to-surface-container flex items-center justify-center text-primary font-bold text-xl sm:text-2xl ring-1 ring-primary/35 shadow-[0_0_24px_rgba(0,229,153,0.12)] shrink-0">
              {getCompanyMonogram(empresa?.nombre || 'Rendy')}
            </div>

            <div className="flex flex-col gap-2 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-on-surface truncate">
                  {empresa?.nombre || 'Organización Corporativa'}
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${subPill.className}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {subPill.label}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-secondary/10 text-secondary border border-secondary/20">
                  <Lock className="w-3 h-3" />
                  Multi-tenant Seguro
                </span>
              </div>

              <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-on-surface-variant">
                <span className="inline-flex items-center gap-1.5 font-mono">
                  <Hash className="w-3.5 h-3.5 text-on-surface-variant/80" />
                  ID: {empresa?.id ? empresa.id.slice(0, 8).toUpperCase() : 'ORG'}
                </span>
                {empresa?.creado_en && (
                  <span
                    className="inline-flex items-center gap-1.5"
                    suppressHydrationWarning
                  >
                    <Calendar className="w-3.5 h-3.5 text-on-surface-variant/80" />
                    Alta:{' '}
                    {new Date(empresa.creado_en).toLocaleDateString('es-VE', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 text-on-surface/80 font-medium">
                  {activeMembersCount} activos · {activeProjectsCount} proyectos
                </span>
              </div>
            </div>
          </div>

          {/* Primary Operating Currency Selector */}
          <div className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-surface-container border border-outline-variant/30 w-full lg:w-auto lg:min-w-[260px] shrink-0">
            <label
              htmlFor="select-moneda-empresa"
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant"
            >
              <Globe2 className="w-3.5 h-3.5 text-primary" />
              Moneda Principal
            </label>
            <select
              id="select-moneda-empresa"
              value={moneda}
              disabled={isPending}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant/35 text-xs sm:text-sm font-semibold text-on-surface [color-scheme:dark] focus:outline-none focus:border-primary transition-colors cursor-pointer disabled:opacity-60"
            >
              {CURRENCY_OPTIONS.map((curr) => (
                <option key={curr.code} value={curr.code}>
                  {curr.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* ── Scrollable Navigation Tabs ── */}
      <nav
        aria-label="Secciones de configuración de organización"
        className="relative z-10 flex items-center gap-2 overflow-x-auto pb-2 border-b border-outline-variant/25"
      >
        {tabs.map((tab) => {
          const IconComp = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              id={`config-tab-${tab.id}`}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer border ${
                isActive
                  ? 'bg-surface-container-high text-primary border-primary/40 shadow-[0_0_16px_rgba(0,229,153,0.1)]'
                  : 'bg-surface-container-low/60 text-on-surface-variant border-outline-variant/15 hover:text-on-surface hover:bg-surface-container'
              }`}
            >
              <IconComp
                className={`w-4 h-4 shrink-0 ${
                  isActive ? 'text-primary' : 'text-on-surface-variant'
                }`}
              />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold font-mono ${
                    isActive
                      ? 'bg-primary/15 text-primary'
                      : 'bg-surface-container-highest/50 text-on-surface-variant'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Active Section Content ── */}
      <div className="relative z-10">
        {activeTab === 'usuarios' && (
          <UsuariosTabSection
            usuarios={usuarios}
            pendingInvitations={pendingInvitations}
            metodos={metodos}
            memberActionLoading={memberActionLoading}
            onInviteClick={() => setIsInviteModalOpen(true)}
            onDarDeBaja={handleDarDeBaja}
            onReactivar={handleReactivar}
            onNavigateToMetodos={() => setActiveTab('metodos')}
          />
        )}

        {activeTab === 'categorias' && (
          <CategoriasTabSection
            categorias={categorias}
            isPending={isPending}
            onUpdateDailyLimit={handleUpdateDailyLimit}
            onToggleCategoria={handleToggleCategoria}
            onDeleteCategoria={handleDeleteCategoria}
            onOpenNewModal={() => setIsNewCategoryModalOpen(true)}
          />
        )}

        {activeTab === 'proyectos' && (
          <ProyectosTabSection
            proyectos={proyectos}
            newProyecto={newProyecto}
            isPending={isPending}
            onNewProyectoChange={setNewProyecto}
            onCrearProyecto={handleCrearProyecto}
            onToggleProyecto={handleToggleProyecto}
            onEliminarProyecto={handleEliminarProyecto}
          />
        )}

        {activeTab === 'metodos' && (
          <MetodosTabSection
            metodos={metodos}
            newMetodo={newMetodo}
            isPending={isPending}
            onNewMetodoChange={setNewMetodo}
            onCrearMetodo={handleCrearMetodo}
            onEliminarMetodo={handleEliminarMetodo}
          />
        )}

        {activeTab === 'suscripcion' && (
          <SuscripcionTabSection
            subscription={subscription}
            isPending={isPending}
            onCancelSubscription={handleCancelSubscription}
          />
        )}

        {activeTab === 'fiscal' && (
          <FiscalTabSection
            nombreCertificado={nombreCertificado}
            urlCertificado={urlCertificado}
            isPending={isPending}
            isUploadingCert={isUploadingCert}
            isSavingCertName={isSavingCertName}
            onNombreChange={setNombreCertificado}
            onSaveName={handleSaveCertName}
            onUploadFile={handleUploadCertificate}
            onDeleteCertificate={handleDeleteCertificate}
          />
        )}
      </div>

      {/* ── Floating Feedback Toast ── */}
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 max-w-sm px-4 py-3 rounded-xl bg-surface-container-highest border border-outline-variant/40 text-xs sm:text-sm font-medium text-on-surface shadow-2xl flex items-center gap-2.5"
        >
          {feedback.startsWith('❌') ? (
            <AlertCircle className="w-4 h-4 text-error shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
          )}
          <span>{feedback.replace(/^[✅❌🗑️⏸️]\s*/u, '')}</span>
        </div>
      )}

      {/* ── Custom Category Modal ── */}
      <ModalNuevaCategoria
        isOpen={isNewCategoryModalOpen}
        onClose={() => setIsNewCategoryModalOpen(false)}
        onSubmit={handleCreateCategoria}
        isSubmitting={isSubmittingCategory}
      />

      {/* ── Collaborator Invitation Modal ── */}
      <InviteEmployeeModal
        isOpen={isInviteModalOpen}
        onClose={() => {
          setIsInviteModalOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
