import type { ReactNode } from "react";

import { Icon, ProgressBar, SectionHeading, Reveal } from "./primitives";

function FeatureCard({
  icon,
  iconClass,
  title,
  text,
  children,
}: {
  icon: string;
  iconClass: string;
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <Reveal className="p-7 rounded-3xl bg-surface-container flex flex-col justify-between shadow-sm feature-card-glow">
      <div>
        <div
          className={`w-12 h-12 rounded-2xl bg-surface-bright flex items-center justify-center mb-6 ${iconClass}`}
        >
          <Icon name={icon} className="text-[26px]" />
        </div>
        <h3 className="font-display text-headline-sm font-bold mb-2">{title}</h3>
        <p className="text-body-md text-on-surface-variant">{text}</p>
      </div>
      <div className="mt-6 p-4 rounded-2xl bg-surface-container-low border border-outline-variant/20">
        {children}
      </div>
    </Reveal>
  );
}

export function FeaturesSection() {
  return (
    <section id="funcionalidades" className="w-full bg-surface-container-high py-24 text-on-surface">
      <div className="max-w-[1320px] mx-auto px-6">
        <SectionHeading
          eyebrow="Capacidades de Vanguardia"
          eyebrowClassName="text-secondary"
          title="Todo lo que necesitas para gestionar los gastos de tu empresa."
          description="Una plataforma diseñada para simplificar cada etapa del ciclo de gestión de gastos corporativos."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <FeatureCard
            icon="commute"
            iconClass="text-primary-container"
            title="Gestión de viáticos"
            text="Administra las solicitudes de viáticos, controla las aprobaciones y mantén seguimiento de los fondos asignados a cada empleado."
          >
            <div className="flex justify-between items-center text-label-sm text-on-surface-variant mb-2 gap-2">
              <span>Drew Martin • Gira Comercial</span>
              <span className="px-2 py-0.5 rounded bg-primary-container/20 text-primary-container font-semibold">
                Aprobado
              </span>
            </div>
            <div className="flex justify-between items-baseline gap-2">
              <span className="font-display text-headline-sm font-bold text-on-surface">
                $450.00 USD
              </span>
              <span className="text-label-sm text-secondary">Anticipo asignado</span>
            </div>
          </FeatureCard>

          <FeatureCard
            icon="fact_check"
            iconClass="text-secondary"
            title="Justificación de gastos"
            text="Controla el progreso de las justificaciones y consulta qué gastos han sido reportados y cuáles continúan pendientes."
          >
            <div className="flex justify-between items-center text-label-sm mb-1.5">
              <span className="text-on-surface font-semibold">Progreso de rendición</span>
              <span className="text-primary font-bold">78%</span>
            </div>
            <ProgressBar percent={78} slow barClassName="bg-primary-container" trackClassName="h-2 mb-2" />
            <p className="text-label-sm text-on-surface-variant">
              14 comprobantes válidos • $110.00 pendientes
            </p>
          </FeatureCard>

          <FeatureCard
            icon="category"
            iconClass="text-tertiary"
            title="Gastos de empresa"
            text="Centraliza los gastos corporativos y organiza cada movimiento por categoría, proyecto, comercio, fecha y moneda."
          >
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-label-sm text-on-surface">
                <span className="font-medium">Software / Servidores</span>
                <span className="font-bold">$1,240 USD</span>
              </div>
              <div className="flex justify-between text-label-sm text-on-surface">
                <span className="font-medium">Hospedajes &amp; Transporte</span>
                <span className="font-bold">$890 USD</span>
              </div>
              <div className="flex justify-between text-label-sm text-on-surface-variant">
                <span>Alimentos &amp; Representación</span>
                <span>$430 USD</span>
              </div>
            </div>
          </FeatureCard>

          <FeatureCard
            icon="payments"
            iconClass="text-primary-container"
            title="Gestión de reembolsos"
            text="Facilita la recepción, revisión y seguimiento de los gastos que los empleados solicitan reembolsar en un solo clic."
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-label-sm text-on-surface-variant">Solicitud #4829</p>
                <p className="font-display text-label-md font-bold text-on-surface">$128.50 USD</p>
              </div>
              <span className="px-3 py-1 rounded-full text-label-sm font-semibold bg-secondary/15 text-secondary">
                Listo p/ dispersar
              </span>
            </div>
          </FeatureCard>

          <FeatureCard
            icon="currency_ruble"
            iconClass="text-secondary"
            title="Control multidivisa"
            text="Visualiza los gastos registrados en diferentes monedas y consulta sus equivalencias en una moneda de referencia contable."
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-surface-bright text-label-sm font-bold text-on-surface">
                  USD
                </span>
                <span className="text-on-surface-variant text-[14px]">⇌</span>
                <span className="px-2 py-0.5 rounded bg-surface-bright text-label-sm font-bold text-on-surface">
                  MXN
                </span>
              </div>
              <span className="text-label-sm text-on-surface-variant text-right">
                T.C. Oficial del día sincronizado
              </span>
            </div>
          </FeatureCard>

          <FeatureCard
            icon="chat"
            iconClass="text-primary-container"
            title="Registro vía WhatsApp"
            text="Facilita el envío de comprobantes y solicitudes de gastos mediante un bot conectado a WhatsApp con lectura OCR inteligente."
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Icon name="photo_camera" className="text-primary-container text-[18px]" />
              </div>
              <div className="min-w-0">
                <p className="text-label-sm text-on-surface font-semibold truncate">
                  "Ticket #294 Todd's Tacos leído"
                </p>
                <p className="text-label-sm text-primary-container">
                  Importe detectado: $67.00 USD
                </p>
              </div>
            </div>
          </FeatureCard>
        </div>
      </div>
    </section>
  );
}
