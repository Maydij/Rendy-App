'use client';

/**
 * @file ConfigSubSections.tsx
 * @description [UI Organisms]: Modular Stitch-styled views for Projects/Cost Centers,
 * Payment Methods, Corporate Subscription Management, Optional US Fiscal Certificates,
 * and the Read-Only Employee Organization view.
 */

import React from 'react';
import {
  Plus,
  Trash2,
  Check,
  X,
  CreditCard,
  ShieldCheck,
  UploadCloud,
  ExternalLink,
  FileCheck,
  FileText,
  FolderKanban,
  Banknote,
  ArrowLeftRight,
  Building2,
} from 'lucide-react';
import type { CategoriaGasto } from '@/lib/types/categoria';
import { RolBadge } from './RolBadge';
import {
  getCompanyMonogram,
  type Empresa,
  type Metodo,
  type Proyecto,
  type SubscriptionInfo,
  type Usuario,
} from './types';

/* ── Proyectos y Centros de Costo ── */

export function ProyectosTabSection({
  proyectos,
  newProyecto,
  isPending,
  onNewProyectoChange,
  onCrearProyecto,
  onToggleProyecto,
  onEliminarProyecto,
}: {
  proyectos: Proyecto[];
  newProyecto: string;
  isPending: boolean;
  onNewProyectoChange: (val: string) => void;
  onCrearProyecto: () => void;
  onToggleProyecto: (id: string, nextActive: boolean) => void;
  onEliminarProyecto: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl bg-surface-container-low border border-outline-variant/25 p-5 sm:p-6 flex flex-col gap-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/20 pb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-on-surface">
            Proyectos y Centros de Costo
          </h2>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
            Los proyectos activos aparecen en los desplegables de WhatsApp en tiempo real.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            id="config-new-proyecto-input"
            value={newProyecto}
            onChange={(e) => onNewProyectoChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onCrearProyecto();
              }
            }}
            placeholder="Nombre del proyecto…"
            className="flex-1 sm:w-52 px-3.5 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-xs sm:text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary"
          />
          <button
            id="config-add-proyecto-btn"
            type="button"
            disabled={isPending || !newProyecto.trim()}
            onClick={onCrearProyecto}
            className="px-4 py-2 rounded-full bg-primary-container hover:bg-primary-fixed text-on-primary-container text-xs font-bold inline-flex items-center gap-1.5 shadow-[0_0_16px_rgba(0,229,153,0.25)] disabled:opacity-50 shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Crear</span>
          </button>
        </div>
      </div>

      {proyectos.length === 0 ? (
        <div className="py-10 text-center rounded-xl bg-surface-container-lowest/60 border border-dashed border-outline-variant/30 text-xs sm:text-sm text-on-surface-variant">
          No hay proyectos registrados. Crea tu primer centro de costos arriba.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {proyectos.map((p) => (
            <div
              key={p.id}
              className="p-4 rounded-xl bg-surface-container border border-outline-variant/25 flex items-center justify-between gap-3 hover:bg-surface-container-high/70 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    p.activo
                      ? 'bg-primary/15 text-primary'
                      : 'bg-surface-container-highest text-on-surface-variant'
                  }`}
                >
                  <FolderKanban className="w-4 h-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-on-surface truncate">
                    {p.nombre}
                  </span>
                  <span
                    className={`text-[10px] font-semibold flex items-center gap-1 ${
                      p.activo ? 'text-primary' : 'text-on-surface-variant'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        p.activo ? 'bg-primary' : 'bg-outline'
                      }`}
                    />
                    {p.activo ? 'Activo en WhatsApp' : 'Pausado'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => onToggleProyecto(p.id, !p.activo)}
                  className="p-1.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                  title={p.activo ? 'Pausar proyecto' : 'Activar proyecto'}
                >
                  {p.activo ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5 text-primary" />}
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => onEliminarProyecto(p.id)}
                  className="p-1.5 rounded-lg bg-error-container/20 text-error hover:bg-error-container/35 transition-colors cursor-pointer"
                  title="Eliminar proyecto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Métodos de Pago ── */

export function MetodosTabSection({
  metodos,
  newMetodo,
  isPending,
  onNewMetodoChange,
  onCrearMetodo,
  onEliminarMetodo,
}: {
  metodos: Metodo[];
  newMetodo: string;
  isPending: boolean;
  onNewMetodoChange: (val: string) => void;
  onCrearMetodo: () => void;
  onEliminarMetodo: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl bg-surface-container-low border border-outline-variant/25 p-5 sm:p-6 flex flex-col gap-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/20 pb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-on-surface">
            Métodos de Pago Corporativos
          </h2>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
            Los métodos configurados aquí aparecen en los desplegables de WhatsApp al registrar gastos corporativos.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            id="config-new-metodo-input"
            value={newMetodo}
            onChange={(e) => onNewMetodoChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onCrearMetodo();
              }
            }}
            placeholder="Ej: Tarjeta Corporativa…"
            className="flex-1 sm:w-56 px-3.5 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-xs sm:text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary"
          />
          <button
            id="config-add-metodo-btn"
            type="button"
            disabled={isPending || !newMetodo.trim()}
            onClick={onCrearMetodo}
            className="px-4 py-2 rounded-full bg-primary-container hover:bg-primary-fixed text-on-primary-container text-xs font-bold inline-flex items-center gap-1.5 shadow-[0_0_16px_rgba(0,229,153,0.25)] disabled:opacity-50 shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar</span>
          </button>
        </div>
      </div>

      {metodos.length === 0 ? (
        <div className="py-10 text-center rounded-xl bg-surface-container-lowest/60 border border-dashed border-outline-variant/30 text-xs sm:text-sm text-on-surface-variant">
          No hay métodos de pago registrados aún.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metodos.map((m) => {
            const lower = m.nombre.toLowerCase();
            const isCard = lower.includes('tarjeta') || lower.includes('card');
            const isCash = lower.includes('efectivo') || lower.includes('caja');
            const IconComp = isCard ? CreditCard : isCash ? Banknote : ArrowLeftRight;
            const iconColor = isCard
              ? 'text-secondary'
              : isCash
              ? 'text-tertiary-fixed'
              : 'text-primary';

            return (
              <div
                key={m.id}
                className="p-5 rounded-2xl bg-surface-container border border-outline-variant/25 hover:bg-surface-container-high/60 transition-all flex flex-col justify-between gap-5"
              >
                <div className="flex items-start justify-between">
                  <div
                    className={`w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center ${iconColor}`}
                  >
                    <IconComp className="w-5 h-5" />
                  </div>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => onEliminarMetodo(m.id)}
                    className="p-2 rounded-lg bg-error-container/20 text-error hover:bg-error-container/35 transition-colors cursor-pointer"
                    title="Eliminar método de pago"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-sm sm:text-base font-bold text-on-surface truncate">
                    {m.nombre}
                  </span>
                  <span className="text-[11px] text-on-surface-variant font-mono" suppressHydrationWarning>
                    Alta: {new Date(m.creado_en).toLocaleDateString('es-VE')}
                  </span>
                </div>

                <div className="pt-2.5 border-t border-surface-container-highest/25 flex items-center gap-1.5 text-[11px] text-primary font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span>Disponible en WhatsApp</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Suscripción y Facturación ── */

export function SuscripcionTabSection({
  subscription,
  isPending,
  onCancelSubscription,
}: {
  subscription: SubscriptionInfo | null;
  isPending: boolean;
  onCancelSubscription: () => void;
}) {
  return (
    <div className="rounded-2xl bg-surface-container-low border border-outline-variant/25 p-5 sm:p-6 flex flex-col gap-5 shadow-sm">
      <div className="border-b border-outline-variant/20 pb-4">
        <h2 className="text-base sm:text-lg font-bold text-on-surface">
          Suscripción Corporativa y Prueba Gratuita
        </h2>
        <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
          Gestiona tu plan activo, método de pago PCI-DSS o cancela antes del día 8 sin ningún cargo.
        </p>
      </div>

      {!subscription ? (
        <div className="p-6 rounded-xl bg-surface-container-lowest/60 border border-dashed border-outline-variant/30 text-xs sm:text-sm text-on-surface-variant text-center">
          No se encontró información de suscripción vinculada a esta organización.
        </div>
      ) : (
        <div className="p-5 rounded-2xl bg-surface-container border border-outline-variant/25 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-base sm:text-lg font-bold text-on-surface">
                Plan {subscription.plan_id} ({subscription.billing_cycle})
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary/15 text-primary">
                {subscription.status}
              </span>
            </div>

            {subscription.status === 'TRIALING' && (
              <div className="text-xs text-on-surface-variant" suppressHydrationWarning>
                Prueba gratuita finaliza el{' '}
                <strong className="text-on-surface">
                  {new Date(subscription.trial_end).toLocaleDateString('es-VE')}
                </strong>{' '}
                (primer cobro automático ese día)
              </div>
            )}

            {subscription.card_last4 && (
              <div className="text-xs text-on-surface-variant font-mono mt-1 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-secondary" />
                <span>
                  {subscription.card_brand?.toUpperCase()} •••• {subscription.card_last4}
                </span>
              </div>
            )}
          </div>

          {subscription.status !== 'CANCELED' && !subscription.cancel_at_period_end && (
            <button
              type="button"
              disabled={isPending}
              onClick={onCancelSubscription}
              className="px-4 py-2.5 rounded-xl bg-error-container/25 border border-error/30 text-error hover:bg-error-container/40 text-xs font-bold transition-colors shrink-0 cursor-pointer disabled:opacity-50"
            >
              {subscription.status === 'TRIALING'
                ? 'Cancelar Prueba Gratuita ($0.00)'
                : 'Cancelar Suscripción'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Certificado Fiscal EE. UU. (Opcional) ── */

export function FiscalTabSection({
  nombreCertificado,
  urlCertificado,
  isPending,
  isUploadingCert,
  isSavingCertName,
  onNombreChange,
  onSaveName,
  onUploadFile,
  onDeleteCertificate,
}: {
  nombreCertificado: string;
  urlCertificado: string | null;
  isPending: boolean;
  isUploadingCert: boolean;
  isSavingCertName: boolean;
  onNombreChange: (val: string) => void;
  onSaveName: () => void;
  onUploadFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteCertificate: () => void;
}) {
  return (
    <div className="rounded-2xl bg-surface-container-low border border-outline-variant/25 p-5 sm:p-6 flex flex-col gap-5 shadow-sm">
      <div className="border-b border-outline-variant/20 pb-4">
        <h2 className="text-base sm:text-lg font-bold text-on-surface">
          Certificado Fiscal EE. UU. (Opcional)
        </h2>
        <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5 max-w-3xl">
          Configura opcionalmente el documento fiscal de tu empresa en EE. UU. (Resale Certificate, Exención 501(c)(3), W-9) para consulta inmediata vía WhatsApp.
        </p>
      </div>

      {/* Certificate Name & Upload Box */}
      <div className="p-5 rounded-2xl bg-surface-container border border-outline-variant/25 flex flex-col gap-5">
        <div>
          <label className="block text-xs font-semibold text-on-surface mb-1.5">
            Nombre / Tipo de Certificado
          </label>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={nombreCertificado}
              placeholder="ej. Certificado de Reventa (Resale Certificate) o Florida Tax-Exempt"
              onChange={(e) => onNombreChange(e.target.value)}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/35 text-xs sm:text-sm text-on-surface focus:outline-none focus:border-primary"
            />
            <button
              type="button"
              disabled={isPending || isSavingCertName}
              onClick={onSaveName}
              className="px-4 py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-semibold border border-outline-variant/30 whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              {isSavingCertName ? 'Guardando...' : 'Guardar Nombre'}
            </button>
          </div>
          <p className="text-[11px] text-on-surface-variant mt-1.5">
            Este nombre aparecerá como título descriptivo cuando los colaboradores consulten el documento en WhatsApp.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-on-surface">Archivo del Certificado</span>

          {urlCertificado ? (
            <div className="p-4 rounded-xl bg-surface-container-lowest border border-primary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-semibold text-on-surface truncate">
                    {nombreCertificado || 'Certificado Fiscal EE. UU.'}
                  </div>
                  <div className="text-[11px] text-primary">
                    ✓ Documento disponible para consulta vía WhatsApp
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href={urlCertificado}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-xs font-semibold text-on-surface inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-secondary" />
                  <span>Ver / Descargar</span>
                </a>

                <label className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-xs font-semibold text-on-surface inline-flex items-center gap-1.5 cursor-pointer">
                  <UploadCloud className="w-3.5 h-3.5 text-primary" />
                  <span>{isUploadingCert ? 'Subiendo...' : 'Reemplazar'}</span>
                  <input
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/webp"
                    disabled={isUploadingCert}
                    onChange={onUploadFile}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  disabled={isPending || isUploadingCert}
                  onClick={onDeleteCertificate}
                  className="px-3 py-1.5 rounded-lg bg-error-container/20 text-error hover:bg-error-container/35 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="border-2 border-dashed border-outline-variant/40 rounded-xl p-8 text-center bg-surface-container-lowest/60 flex flex-col items-center gap-2">
              <UploadCloud className="w-9 h-9 text-on-surface-variant" />
              <div className="text-sm font-semibold text-on-surface">
                Ningún certificado fiscal cargado (Opcional)
              </div>
              <p className="text-xs text-on-surface-variant max-w-md mb-2">
                Si tu empresa posee un certificado de reventa, exención tributaria o W-9, puedes subirlo aquí (PDF, PNG, JPG, máx 10 MB).
              </p>
              <label className="px-5 py-2.5 rounded-full bg-primary-container hover:bg-primary-fixed text-on-primary-container text-xs font-bold inline-flex items-center gap-2 shadow-[0_0_20px_rgba(0,229,153,0.25)] cursor-pointer">
                <UploadCloud className="w-4 h-4" />
                <span>{isUploadingCert ? 'Subiendo documento...' : 'Seleccionar Certificado'}</span>
                <input
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  disabled={isUploadingCert}
                  onChange={onUploadFile}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Info Guidelines Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-surface-container border border-outline-variant/25">
          <div className="flex items-center gap-2 text-primary mb-1.5">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-xs font-bold">Consulta Inmediata en WhatsApp</span>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Cargar este certificado es 100% opcional. Si está cargado, tus empleados pueden escribir{' '}
            <strong className="text-on-surface">&quot;Certificado&quot;</strong>,{' '}
            <strong className="text-on-surface">&quot;Tax Exempt&quot;</strong> o{' '}
            <strong className="text-on-surface">&quot;Resale&quot;</strong> en WhatsApp para recibirlo al instante.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-surface-container border border-outline-variant/25">
          <div className="flex items-center gap-2 text-secondary mb-1.5">
            <FileText className="w-4 h-4" />
            <span className="text-xs font-bold">Extracción Contable Universal</span>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Rendy clasifica automáticamente cada gasto en EE. UU. (Estado, Subtotal, Sales Tax y Propina) y habilita la pestaña{' '}
            <strong className="text-on-surface">&quot;Desglose Taxes USA&quot;</strong> en tus reportes contables Excel.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Employee Read-Only View ── */

export function EmployeeOrganizacionView({
  empresa,
  myUser,
  categorias,
}: {
  empresa: Empresa | null;
  myUser: Usuario | undefined;
  categorias: CategoriaGasto[];
}) {
  const activeCategories = categorias.filter((c) => c.activa);

  return (
    <div className="relative w-full max-w-[1400px] mx-auto flex flex-col gap-6 pb-12 text-on-surface select-text">
      <div className="absolute -top-24 -right-16 w-96 h-96 rounded-full bg-primary-container/5 blur-3xl pointer-events-none" />

      <div className="flex flex-col gap-1.5 pt-2 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-primary shadow-sm shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">
            Información de mi Organización
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-on-surface-variant sm:pl-[52px]">
          Vista informativa de tu empresa, tu perfil y las políticas de gastos vigentes.
        </p>
      </div>

      {empresa && (
        <div className="rounded-2xl bg-surface-container-low border border-outline-variant/25 p-5 sm:p-6 flex items-center gap-4 flex-wrap relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-surface-container-high to-surface-container flex items-center justify-center text-primary font-bold text-xl ring-1 ring-primary/30 shrink-0">
            {getCompanyMonogram(empresa.nombre)}
          </div>
          <div>
            <div className="text-lg font-bold text-on-surface">{empresa.nombre}</div>
            <div className="text-xs text-on-surface-variant mt-0.5">
              Moneda de operación:{' '}
              <strong className="text-primary">{empresa.moneda || 'USD'}</strong>
            </div>
          </div>
        </div>
      )}

      {/* My Profile */}
      <div className="rounded-2xl bg-surface-container-low border border-outline-variant/25 p-5 sm:p-6 relative z-10">
        <h2 className="text-base font-bold text-on-surface">Mi Perfil</h2>
        <p className="text-xs text-on-surface-variant mb-4">
          Tu información registrada en la organización.
        </p>

        {myUser ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 p-4 rounded-xl bg-surface-container border border-outline-variant/20">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
                Nombre
              </div>
              <div className="text-sm font-semibold text-on-surface truncate">{myUser.nombre}</div>
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
                Email
              </div>
              <div className="text-xs sm:text-sm text-on-surface truncate">{myUser.email || '—'}</div>
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
                Teléfono WhatsApp
              </div>
              <div className="text-xs sm:text-sm text-on-surface font-mono">
                {myUser.telefono_whatsapp ? `+${myUser.telefono_whatsapp}` : '—'}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
                Rol
              </div>
              <RolBadge rol={myUser.rol || myUser.role || 'EMPLOYEE'} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
                Departamento
              </div>
              <div className="text-xs sm:text-sm text-on-surface truncate">
                {myUser.department || 'General'}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-on-surface-variant">
            No se encontró tu perfil de usuario.
          </div>
        )}
      </div>

      {/* Expense Categories Read-Only */}
      <div className="rounded-2xl bg-surface-container-low border border-outline-variant/25 p-5 sm:p-6 relative z-10">
        <h2 className="text-base font-bold text-on-surface">
          Categorías de Gastos y Límites Diarios
        </h2>
        <p className="text-xs text-on-surface-variant mb-4">
          Políticas de gastos vigentes definidas por tu administrador.
        </p>

        {activeCategories.length === 0 ? (
          <div className="py-8 text-center text-xs text-on-surface-variant rounded-xl bg-surface-container-lowest/60 border border-dashed border-outline-variant/30">
            No hay categorías activas configuradas.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {activeCategories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between p-3.5 rounded-xl bg-surface-container border border-outline-variant/20 gap-3 flex-wrap"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-xl leading-none">{cat.icono || '🏷️'}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-on-surface truncate">{cat.nombre}</div>
                    {cat.descripcion && (
                      <div className="text-[11px] text-on-surface-variant truncate">
                        {cat.descripcion}
                      </div>
                    )}
                  </div>
                </div>
                <div
                  className={`text-xs font-bold font-mono shrink-0 ${
                    cat.limite_diario_usd > 0 ? 'text-primary' : 'text-on-surface-variant'
                  }`}
                >
                  {cat.limite_diario_usd > 0
                    ? `$${cat.limite_diario_usd.toFixed(2)} USD / día`
                    : 'Sin límite'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
