import { Icon, Reveal } from "./primitives";

const PILLARS = [
  {
    icon: "hub",
    wrap: "bg-primary/10 text-primary-container",
    hover: "hover:border-primary-container/40",
    title: "Gestión centralizada",
    text: "Todo en un único lugar unificado, eliminando la dispersión de boletas físicas y chats sin control.",
  },
  {
    icon: "bolt",
    wrap: "bg-secondary/10 text-secondary",
    hover: "hover:border-secondary/40",
    title: "Procesos más ágiles",
    text: "Tiempos de rendición reducidos en más del 70%, acelerando reembolsos y revisiones contables.",
  },
  {
    icon: "history_edu",
    wrap: "bg-tertiary-container/10 text-tertiary",
    hover: "hover:border-tertiary-container/40",
    title: "Mayor trazabilidad",
    text: "Registro inmutable de cada comprobante, quién lo cargó y en qué centro de costo impacta.",
  },
  {
    icon: "visibility",
    wrap: "bg-primary-fixed-dim/15 text-primary-fixed-dim",
    hover: "hover:border-primary-fixed-dim/40",
    title: "Visibilidad financiera",
    text: "Monitoreo continuo de presupuestos vigentes y límites corporativos en tiempo real.",
  },
];

export function TrustSection() {
  return (
    <section className="w-full bg-surface-container py-14">
      <div className="max-w-[1320px] mx-auto px-6">
        <Reveal className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="font-display text-headline-lg-mobile md:text-headline-lg font-bold text-on-surface">
            El control financiero que tu empresa necesita.
          </h2>
          <p className="text-body-md text-on-surface-variant mt-3">
            Centraliza tus operaciones financieras y obtén una visión más clara de cómo se utilizan
            los recursos de tu organización.
          </p>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PILLARS.map((p) => (
            <Reveal
              key={p.title}
              className={`p-6 rounded-2xl bg-surface-container-low flex flex-col gap-3 hover:-translate-y-1.5 transition-all duration-300 border border-outline-variant/20 ${p.hover}`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${p.wrap}`}>
                <Icon name={p.icon} className="text-[26px]" />
              </div>
              <h3 className="font-display text-headline-sm font-bold text-on-surface">{p.title}</h3>
              <p className="text-body-md text-on-surface-variant">{p.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const BEFORE = [
  "Información de gastos dispersa en hojas de cálculo propensas a errores.",
  "Seguimiento manual de reembolsos con tickets perdidos o arrugados.",
  "Falta de visibilidad sobre el gasto corporativo hasta el cierre mensual.",
  "Dificultades severas para monitorear anticipos y viáticos de viaje.",
  "Validación lenta y tediosa de comprobantes fiscales y facturas.",
  "Trazabilidad financiera limitada y cierres contables tardíos.",
];

const AFTER = [
  "Gestión centralizada y en tiempo real de todos los gastos corporativos.",
  "Flujos de reembolso organizados, automatizados y completamente transparentes.",
  "Visibilidad financiera al instante con alertas predictivas de presupuesto.",
  "Seguimiento estructurado de anticipos vinculados a centros de costo y proyectos.",
  "Estado de justificación claro con comprobantes digitales organizados y auditados.",
  "Información financiera consolidada para toma de decisiones ejecutivas en segundos.",
];

export function ComparisonSection() {
  return (
    <section className="w-full bg-surface-container-lowest py-20">
      <div className="max-w-[1320px] mx-auto px-6">
        <Reveal className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-label-sm text-primary uppercase tracking-widest font-semibold">
            Transformación Operativa
          </span>
          <h2 className="font-display text-headline-xl-mobile md:text-headline-xl font-bold text-on-surface mt-2">
            De procesos dispersos a control total.
          </h2>
          <p className="text-body-md text-on-surface-variant mt-3">
            Compara la gestión tradicional frente al estándar moderno de Rendy.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          <Reveal className="rounded-3xl bg-surface-container p-8 md:p-10 flex flex-col justify-between shadow-md border border-outline-variant/20">
            <div>
              <div className="flex items-center justify-between mb-8">
                <span className="px-3.5 py-1 rounded-full text-label-sm uppercase tracking-wider bg-error-container text-white font-bold">
                  Antes de Rendy
                </span>
                <Icon name="cancel" className="text-error text-[28px]" />
              </div>
              <h3 className="font-display text-headline-md font-bold text-on-surface mb-6">
                El caos de la administración fragmentada
              </h3>
              <ul className="flex flex-col gap-4">
                {BEFORE.map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <Icon name="close" className="text-error text-[20px] mt-0.5 shrink-0" />
                    <span className="text-body-md text-on-surface-variant">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-8 bg-surface-container-high/40 rounded-xl p-4">
              <p className="text-label-md text-error">
                Impacto: Pérdida del 15% de gastos deducibles y fricción con empleados.
              </p>
            </div>
          </Reveal>

          <Reveal className="rounded-3xl bg-surface-container-low p-8 md:p-10 flex flex-col justify-between shadow-glow-panel border border-primary-container/30">
            <div>
              <div className="flex items-center justify-between mb-8">
                <span className="px-3.5 py-1 rounded-full text-label-sm uppercase tracking-wider bg-primary-container text-on-primary-fixed font-bold">
                  Con Rendy
                </span>
                <Icon name="check_circle" className="text-primary-container text-[28px]" />
              </div>
              <h3 className="font-display text-headline-md font-bold text-on-surface mb-6">
                Control financiero sin fricción ni retrasos
              </h3>
              <ul className="flex flex-col gap-4">
                {AFTER.map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <Icon
                      name="task_alt"
                      className="text-primary-container text-[20px] mt-0.5 shrink-0"
                    />
                    <span className="text-body-md text-on-surface">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-8 bg-surface-container rounded-xl p-4 border border-primary-container/20">
              <p className="text-label-md text-primary-container font-semibold">
                Resultado: Cierres mensuales en 24 horas y 100% de trazabilidad contable.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
