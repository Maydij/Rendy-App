'use client';

/**
 * @file UsuariosTabSection.tsx
 * @description [UI Organism]: Stitch Organization Collaborators panel featuring 3 executive overview
 * cards, client-side search and role filtering, responsive desktop table & mobile cards, WhatsApp bot
 * connectivity indicators, pending Magic Link invitations, and quick Payment Methods overview.
 */

import React, { useState, useMemo } from 'react';
import {
  BadgeCheck,
  ShieldCheck,
  MessageSquare,
  Search,
  Filter,
  UserPlus,
  Monitor,
  Clock,
  CheckCircle2,
  ArrowRight,
  CreditCard,
  Banknote,
  ArrowLeftRight,
  Wallet,
} from 'lucide-react';
import { RolBadge } from './RolBadge';
import type { Metodo, PendingInvitation, Usuario } from './types';

interface UsuariosTabSectionProps {
  usuarios: Usuario[];
  pendingInvitations: PendingInvitation[];
  metodos: Metodo[];
  memberActionLoading: string | null;
  onInviteClick: () => void;
  onDarDeBaja: (usuario: Usuario) => void;
  onReactivar: (usuario: Usuario) => void;
  onNavigateToMetodos: () => void;
}

function resolveMethodIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('tarjeta') || lower.includes('card') || lower.includes('visa') || lower.includes('master')) {
    return { Icon: CreditCard, colorClass: 'text-secondary', badge: 'CORPORATIVO' };
  }
  if (lower.includes('efectivo') || lower.includes('caja') || lower.includes('cash')) {
    return { Icon: Banknote, colorClass: 'text-tertiary-fixed', badge: 'EFECTIVO' };
  }
  return { Icon: ArrowLeftRight, colorClass: 'text-primary', badge: 'TRANSFERENCIA' };
}

export function UsuariosTabSection({
  usuarios,
  pendingInvitations,
  metodos,
  memberActionLoading,
  onInviteClick,
  onDarDeBaja,
  onReactivar,
  onNavigateToMetodos,
}: UsuariosTabSectionProps) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ADMIN' | 'EMPLOYEE'>('ALL');

  const stats = useMemo(() => {
    const activeUsers = usuarios.filter((u) => u.activo !== false);
    const adminsCount = activeUsers.filter((u) => (u.role || u.rol) === 'ADMIN').length;
    const whatsappLinkedCount = activeUsers.filter((u) => Boolean(u.telefono_whatsapp)).length;
    return {
      totalCount: usuarios.length,
      activeCount: activeUsers.length,
      adminsCount,
      whatsappLinkedCount,
    };
  }, [usuarios]);

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase().trim();
    return usuarios.filter((u) => {
      const effectiveRole = (u.role || u.rol || 'EMPLOYEE').toUpperCase();
      const matchesRole =
        roleFilter === 'ALL' ||
        (roleFilter === 'ADMIN' && effectiveRole === 'ADMIN') ||
        (roleFilter === 'EMPLOYEE' && effectiveRole !== 'ADMIN');

      if (!matchesRole) return false;
      if (!q) return true;

      return (
        u.nombre.toLowerCase().includes(q) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.department && u.department.toLowerCase().includes(q)) ||
        (u.telefono_whatsapp && u.telefono_whatsapp.includes(q))
      );
    });
  }, [usuarios, search, roleFilter]);

  return (
    <div className="flex flex-col gap-6">
      {/* 3 Executive Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5">
        {/* Card 1: Total Collaborators */}
        <div className="p-5 rounded-2xl bg-surface-container-low border border-outline-variant/25 flex items-center justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold truncate">
              Colaboradores Totales
            </span>
            <span className="text-3xl font-bold text-on-surface mt-1 font-mono">
              {stats.totalCount}
            </span>
            <span className="text-[11px] text-primary flex items-center gap-1 mt-1 truncate">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{stats.activeCount} activos en la organización</span>
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center text-primary shrink-0">
            <BadgeCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Principal Administrators */}
        <div className="p-5 rounded-2xl bg-surface-container-low border border-outline-variant/25 flex items-center justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold truncate">
              Administradores
            </span>
            <span className="text-3xl font-bold text-on-surface mt-1 font-mono">
              {stats.adminsCount}
            </span>
            <span className="text-[11px] text-secondary flex items-center gap-1 mt-1 truncate">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Acceso Global &amp; Auditoría</span>
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center text-secondary shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: WhatsApp Bot Enabled */}
        <div className="p-5 rounded-2xl bg-surface-container-low border border-outline-variant/25 flex items-center justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold truncate">
              WhatsApp Bot Rendy
            </span>
            <span className="text-3xl font-bold text-on-surface mt-1 font-mono">
              {stats.whatsappLinkedCount}
            </span>
            <span className="text-[11px] text-primary-fixed-dim flex items-center gap-1 mt-1 truncate">
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              <span>Registro instantáneo habilitado</span>
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center text-primary-fixed-dim shrink-0">
            <MessageSquare className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Collaborators Directory Card */}
      <div className="rounded-2xl bg-surface-container-low border border-outline-variant/25 p-5 sm:p-6 flex flex-col gap-5 shadow-sm">
        {/* Filters, Search Bar & Invite CTA */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5">
          <div className="flex flex-1 items-center gap-3 flex-wrap sm:flex-nowrap">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, correo o departamento..."
                className="w-full bg-surface-container-lowest border border-outline-variant/25 text-on-surface text-xs sm:text-sm pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-outline transition-all"
              />
            </div>

            <div className="relative shrink-0">
              <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as 'ALL' | 'ADMIN' | 'EMPLOYEE')}
                className="bg-surface-container-lowest border border-outline-variant/25 pl-9 pr-8 py-2.5 rounded-xl text-xs font-medium text-on-surface cursor-pointer hover:bg-surface-container-highest transition-colors focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]"
              >
                <option value="ALL">Todos los roles</option>
                <option value="ADMIN">Administradores</option>
                <option value="EMPLOYEE">Empleados</option>
              </select>
            </div>
          </div>

          <button
            id="config-add-usuario-btn"
            type="button"
            onClick={onInviteClick}
            className="px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold bg-primary-container text-on-primary-container hover:bg-primary-fixed transition-all flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(0,229,153,0.3)] hover:scale-[1.01] active:scale-[0.99] whitespace-nowrap cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invitar Colaborador</span>
          </button>
        </div>

        {/* Empty State */}
        {filteredUsers.length === 0 ? (
          <div className="py-10 text-center rounded-xl bg-surface-container-lowest/60 border border-dashed border-outline-variant/30 text-xs sm:text-sm text-on-surface-variant">
            {usuarios.length === 0
              ? 'Sin usuarios registrados en la organización.'
              : 'No hay colaboradores que coincidan con tu búsqueda.'}
          </div>
        ) : (
          <>
            {/* Desktop / Tablet Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[780px]" aria-label="Usuarios de la organización">
                <thead>
                  <tr className="bg-surface-container-lowest text-on-surface-variant text-[11px] uppercase tracking-wider font-semibold">
                    <th className="py-3.5 px-4 rounded-l-xl">Colaborador</th>
                    <th className="py-3.5 px-4">Departamento</th>
                    <th className="py-3.5 px-4">Rol</th>
                    <th className="py-3.5 px-4">Estado</th>
                    <th className="py-3.5 px-4">Fecha Alta</th>
                    <th className="py-3.5 px-4">Canal Vinculado</th>
                    <th className="py-3.5 px-4 text-right rounded-r-xl">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-highest/25 text-xs sm:text-sm">
                  {filteredUsers.map((u, idx) => {
                    const effectiveRole = (u.role || u.rol || 'EMPLOYEE').toUpperCase();
                    const isActive = u.activo !== false;
                    const avatarTone =
                      effectiveRole === 'ADMIN'
                        ? 'bg-primary/20 text-primary'
                        : idx % 2 === 1
                        ? 'bg-secondary/20 text-secondary'
                        : 'bg-tertiary-fixed-dim/20 text-tertiary-fixed';

                    return (
                      <tr key={u.id} className="hover:bg-surface-container-high/40 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${avatarTone}`}
                            >
                              {u.nombre.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-on-surface font-semibold truncate">
                                {u.nombre}
                              </span>
                              <span className="text-[11px] text-on-surface-variant truncate">
                                {u.email ?? (u.telefono_whatsapp ? `+${u.telefono_whatsapp}` : '—')}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-4 text-on-surface font-medium">
                          {u.department || 'General'}
                        </td>

                        <td className="py-4 px-4">
                          <RolBadge rol={effectiveRole} />
                        </td>

                        <td className="py-4 px-4">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                              Activo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-error-container/20 text-error">
                              <span className="w-1.5 h-1.5 rounded-full bg-error" />
                              Inactivo (Baja)
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-4 text-on-surface-variant font-mono text-xs" suppressHydrationWarning>
                          {new Date(u.creado_en).toLocaleDateString('es-VE')}
                        </td>

                        <td className="py-4 px-4">
                          {u.telefono_whatsapp ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium whitespace-nowrap">
                              <MessageSquare className="w-3.5 h-3.5" />
                              WhatsApp Conectado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-on-surface text-[11px] font-medium whitespace-nowrap">
                              <Monitor className="w-3.5 h-3.5 text-secondary" />
                              Web Console
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          {effectiveRole !== 'ADMIN' ? (
                            isActive ? (
                              <button
                                type="button"
                                onClick={() => onDarDeBaja(u)}
                                disabled={memberActionLoading === u.id}
                                className="px-2.5 py-1 rounded-lg text-error hover:bg-error/10 text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
                                title="Dar de baja y liberar número de teléfono"
                              >
                                {memberActionLoading === u.id ? 'Procesando...' : 'Dar de baja'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onReactivar(u)}
                                disabled={memberActionLoading === u.id}
                                className="px-2.5 py-1 rounded-lg text-primary hover:bg-primary/10 text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
                                title="Reactivar usuario"
                              >
                                {memberActionLoading === u.id ? 'Procesando...' : 'Reactivar'}
                              </button>
                            )
                          ) : (
                            <span className="text-[11px] text-on-surface-variant/60">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View (< md) */}
            <div className="md:hidden flex flex-col gap-3">
              {filteredUsers.map((u) => {
                const effectiveRole = (u.role || u.rol || 'EMPLOYEE').toUpperCase();
                const isActive = u.activo !== false;

                return (
                  <div
                    key={u.id}
                    className="p-4 rounded-xl bg-surface-container border border-outline-variant/25 flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                          {u.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-on-surface truncate">
                            {u.nombre}
                          </span>
                          <span className="text-xs text-on-surface-variant truncate">
                            {u.email ?? (u.telefono_whatsapp ? `+${u.telefono_whatsapp}` : '—')}
                          </span>
                        </div>
                      </div>
                      <RolBadge rol={effectiveRole} />
                    </div>

                    <div className="flex items-center justify-between flex-wrap gap-2 text-xs pt-2 border-t border-surface-container-high/50">
                      <span className="text-on-surface-variant">
                        Depto: <strong className="text-on-surface">{u.department || 'General'}</strong>
                      </span>
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-error">
                          <span className="w-1.5 h-1.5 rounded-full bg-error" /> Inactivo
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      {u.telefono_whatsapp ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium">
                          <MessageSquare className="w-3 h-3" /> WhatsApp
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-on-surface-variant text-[11px]">
                          <Monitor className="w-3 h-3 text-secondary" /> Web Console
                        </span>
                      )}

                      {effectiveRole !== 'ADMIN' && (
                        isActive ? (
                          <button
                            type="button"
                            onClick={() => onDarDeBaja(u)}
                            disabled={memberActionLoading === u.id}
                            className="px-3 py-1 rounded-lg bg-error-container/20 text-error text-xs font-semibold"
                          >
                            {memberActionLoading === u.id ? '...' : 'Dar de baja'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onReactivar(u)}
                            disabled={memberActionLoading === u.id}
                            className="px-3 py-1 rounded-lg bg-primary/15 text-primary text-xs font-semibold"
                          >
                            {memberActionLoading === u.id ? '...' : 'Reactivar'}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Table Bottom Helper Note */}
        <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-on-surface-variant text-xs">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            <span>
              Todos los cambios en roles y permisos se reflejan inmediatamente en WhatsApp y Web.
            </span>
          </span>
          <span className="shrink-0 font-medium">
            Mostrando {filteredUsers.length} de {usuarios.length} colaboradores
          </span>
        </div>

        {/* Pending Invitations Section */}
        {pendingInvitations.length > 0 && (
          <div className="mt-2 pt-5 border-t border-outline-variant/25 flex flex-col gap-3">
            <div className="text-xs sm:text-sm font-bold text-on-surface flex items-center gap-2">
              <Clock className="w-4 h-4 text-tertiary-fixed-dim" />
              <span>Invitaciones Pendientes de Activación ({pendingInvitations.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {pendingInvitations.map((inv) => (
                <div
                  key={inv.id}
                  className="bg-surface-container border border-outline-variant/25 rounded-xl px-4 py-3 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-on-surface truncate">
                      {inv.first_name} {inv.last_name}
                    </div>
                    <div className="text-on-surface-variant text-[11px] truncate">
                      {inv.email} · {inv.department}
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-tertiary-container/15 text-tertiary-fixed-dim text-[11px] font-semibold shrink-0" suppressHydrationWarning>
                    Expira {new Date(inv.expires_at).toLocaleDateString('es-VE')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Payment Methods Preview Section (Matching Stitch Organizacion Preview) */}
      {metodos.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              <h3 className="text-base sm:text-lg text-on-surface font-semibold">
                Métodos de Pago Configurados
              </h3>
            </div>
            <button
              type="button"
              onClick={onNavigateToMetodos}
              className="text-xs sm:text-sm text-primary hover:underline flex items-center gap-1 font-medium cursor-pointer"
            >
              <span>Ver configuración detallada</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {metodos.slice(0, 3).map((m) => {
              const { Icon, colorClass, badge } = resolveMethodIcon(m.nombre);
              return (
                <div
                  key={m.id}
                  onClick={onNavigateToMetodos}
                  className="p-5 rounded-2xl bg-surface-container-low border border-outline-variant/25 hover:bg-surface-container transition-all flex flex-col justify-between gap-5 group cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={`w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center ${colorClass}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-surface-container-high text-on-surface-variant">
                      {badge}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-base text-on-surface font-semibold tracking-tight truncate">
                      {m.nombre}
                    </span>
                    <span className="text-[11px] text-on-surface-variant font-mono">
                      Activo en flujo operativo
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-surface-container-highest/25">
                    <span className="text-[11px] text-primary flex items-center gap-1.5 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      Disponible en WhatsApp
                    </span>
                    <ArrowRight className="w-4 h-4 text-outline group-hover:text-on-surface transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
