export type BillingCycle = "monthly" | "annual";

export type PlanId = "starter" | "growth" | "enterprise";

export interface Plan {
  id: PlanId;
  tier: string;
  name: string;
  description: string;
  prices: Record<BillingCycle, number>;
  featured?: boolean;
  features: { text: string; emphasis?: "strong" | "highlight" }[];
}

export const SETUP_FEE_USD = 150;
export const ANNUAL_DISCOUNT_LABEL = "Ahorra 20%";

export const PLANS: Plan[] = [
  {
    id: "starter",
    tier: "STARTER",
    name: "Equipos en Inicio",
    description:
      "Para pequeños negocios y equipos de calle que necesitan centralizar facturas sin papeleos.",
    prices: { monthly: 49, annual: 39 },
    features: [
      { text: "Hasta 5 usuarios activos" },
      { text: "150 facturas / comprobantes al mes" },
      { text: "Ingesta directa de fotos y PDFs vía WhatsApp" },
      { text: "Extracción contable con IA (Base imponible, IVA 16% y Exento)" },
      { text: "Conversión bimonetaria automática (USD / VES con tasa oficial)" },
      { text: "Detección anti-fraude de facturas duplicadas (Hash SHA-256)" },
      { text: "Panel web para liquidación y exportación a Excel" },
    ],
  },
  {
    id: "growth",
    tier: "GROWTH",
    name: "Empresas en Expansión",
    description:
      "Para organizaciones con fuerza de ventas, logística o proyectos que requieren control financiero estricto.",
    prices: { monthly: 119, annual: 95 },
    featured: true,
    features: [
      { text: "Hasta 15 usuarios activos", emphasis: "strong" },
      { text: "500 facturas / comprobantes al mes", emphasis: "strong" },
      { text: "Todo lo del plan Starter, más:", emphasis: "highlight" },
      { text: "Desglose fiscal completo (IGTF 3%, IVA, Base y Exento)" },
      { text: "Control de múltiples viáticos y proyectos en paralelo" },
      { text: "Alertas automáticas de sobregiro de presupuesto" },
      { text: "Módulo de reembolsos con carga de comprobantes bancarios" },
      { text: "Notificaciones transaccionales automáticas por WhatsApp" },
      { text: "Soporte prioritario vía WhatsApp" },
    ],
  },
  {
    id: "enterprise",
    tier: "ENTERPRISE",
    name: "Corporativo & Auditoría",
    description:
      "Para medianas empresas con alto volumen de gastos, múltiples departamentos y supervisión gerencial.",
    prices: { monthly: 249, annual: 199 },
    features: [
      { text: "Hasta 40 usuarios activos", emphasis: "strong" },
      { text: "1,500 facturas / comprobantes al mes", emphasis: "strong" },
      { text: "Todo lo del plan Growth, más:", emphasis: "highlight" },
      { text: "Aprobación y rechazo interactivo por WhatsApp para gerentes" },
      { text: "Políticas y límites de gastos personalizados por empleado" },
      { text: "Cierre y liquidación contable de carpetas de viáticos" },
      { text: "Formato listo para el Libro de Compras formal" },
      { text: "Asistencia técnica y onboarding personalizado" },
    ],
  },
];

export function planPrice(plan: Plan, cycle: BillingCycle): string {
  return `$${plan.prices[cycle]}`;
}

export function billingNote(cycle: BillingCycle): string {
  const when = cycle === "annual" ? "anualmente" : "mensualmente";
  return `Facturado ${when} • $${SETUP_FEE_USD} USD Setup inicial`;
}
