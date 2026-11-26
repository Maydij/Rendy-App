/**
 * @file types.ts
 * @description [Domain Model]: Shared TypeScript interfaces and formatting helpers
 * for the Organization & Configuration dashboard (/dashboard/configuracion).
 */

export type Empresa = {
  id: string;
  nombre: string;
  moneda: string;
  creado_en: string;
  us_tax_exempt?: boolean;
  url_certificado_tax_exempt?: string | null;
  nombre_certificado_usa?: string | null;
  url_certificado_usa?: string | null;
};

export type Usuario = {
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

export type Proyecto = {
  id: string;
  nombre: string;
  activo: boolean;
  creado_en: string;
};

export type Metodo = {
  id: string;
  nombre: string;
  creado_en: string;
};

export type SubscriptionInfo = {
  id: string;
  plan_id: string;
  billing_cycle: string;
  status: string;
  trial_end: string;
  cancel_at_period_end: boolean;
  card_brand: string | null;
  card_last4: string | null;
};

export type PendingInvitation = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  department: string;
  status: string;
  expires_at: string;
};

export type ConfigTabId =
  | 'usuarios'
  | 'categorias'
  | 'proyectos'
  | 'metodos'
  | 'suscripcion'
  | 'fiscal';

export function getCompanyMonogram(name: string): string {
  const parts = (name || 'RD').trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0] ? parts[0].substring(0, 2) : 'RD').toUpperCase();
}
