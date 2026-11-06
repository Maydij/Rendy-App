import { Icon, Reveal, SectionHeading } from "./primitives";

const STEPS = [
  {
    n: 1,
    badge: "bg-primary-container text-on-primary-fixed shadow-glow-sm",
    title: "Registra",
    text: "Empleados o administradores registran gastos, solicitudes de anticipo o reembolsos desde la web o directamente vía WhatsApp con una foto.",
  },
  {
    n: 2,
    badge: "bg-secondary text-on-secondary shadow-glow-cyan",
    title: "Revisa",
    text: "El equipo financiero o administrativo revisa la información enviada, comprobando validez fiscal y adecuación a las políticas internas.",
  },
  {
    n: 3,
    badge: "bg-tertiary-container text-on-tertiary-fixed shadow-glow-amber",
    title: "Gestiona",
    text: "Da seguimiento a aprobaciones, comprobantes, justificaciones y progreso sin perseguir comprobantes ni intercambiar planillas confusas.",
  },
  {
    n: 4,
    badge: "bg-primary-fixed-dim text-on-primary-fixed shadow-glow-sm",
    title: "Controla",
    text: "Accede a reportes centralizados e indicadores financieros para gobernar los recursos con sincronización directa hacia tu ERP contable.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="como-funciona" className="w-full bg-surface-container py-24">
      <div className="max-w-[1320px] mx-auto px-6">
        <SectionHeading
          className="max-w-2xl"
          eyebrow="Simplicidad en 4 Pasos"
          title="Gestionar gastos nunca había sido tan sencillo."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
          {STEPS.map((s) => (
            <Reveal
              key={s.n}
              className="p-6 rounded-2xl bg-surface-container-low flex flex-col gap-4 relative border border-outline-variant/20 hover:-translate-y-1 transition-all duration-300"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-display text-headline-sm font-bold ${s.badge}`}
              >
                {s.n}
              </div>
              <h3 className="font-display text-headline-sm font-bold text-on-surface">{s.title}</h3>
              <p className="text-body-md text-on-surface-variant">{s.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const BENEFITS = [
  {
    icon: "schedule",
    wrap: "bg-primary/10 text-primary-container",
    hover: "hover:border-primary-container/40",
    title: "Ahorro de tiempo administrativo",
    text: "Reduce hasta un 80% de las horas dedicadas a compilar tickets, cotejar facturas con estados de cuenta y perseguir aprobaciones por correo electrónico.",
  },
  {
    icon: "query_stats",
    wrap: "bg-secondary/10 text-secondary",
    hover: "hover:border-secondary/40",
    title: "Mayor visibilidad de gastos",
    text: "Conoce exactamente en qué se gasta cada peso en el instante en que ocurre, evitando desvíos presupuestarios imprevistos a fin de mes.",
  },
  {
    icon: "verified",
    wrap: "bg-tertiary-container/10 text-tertiary",
    hover: "hover:border-tertiary-container/40",
    title: "Mayor trazabilidad financiera",
    text: "Auditoría continua con registro inalterable de quién autorizó, quién pagó y la documentación fiscal comprobatoria asociada.",
  },
  {
    icon: "lightbulb",
    wrap: "bg-primary-fixed-dim/15 text-primary-fixed-dim",
    hover: "hover:border-primary-fixed-dim/40",
    title: "Decisiones mejor informadas",
    text: "Identifica patrones de consumo repetitivos, negocia mejores condiciones comerciales con proveedores y optimiza la asignación de capital.",
  },
];

export function BenefitsSection() {
  return (
    <section id="beneficios" className="w-full bg-surface-container-lowest py-24">
      <div className="max-w-[1320px] mx-auto px-6">
        <SectionHeading
          eyebrow="Impacto en el Negocio"
          title="Más que gestionar gastos. Mejorar la forma de administrar tu empresa."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {BENEFITS.map((b) => (
            <Reveal
              key={b.title}
              className={`p-8 rounded-3xl bg-surface-container flex flex-col sm:flex-row items-start gap-6 hover:bg-surface-container-high transition-all duration-300 border border-outline-variant/20 ${b.hover}`}
            >
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${b.wrap}`}
              >
                <Icon name={b.icon} className="text-[32px]" />
              </div>
              <div>
                <h3 className="font-display text-headline-sm font-bold text-on-surface mb-2">
                  {b.title}
                </h3>
                <p className="text-body-md text-on-surface-variant">{b.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const ROLES = [
  {
    icon: "account_balance",
    wrap: "bg-primary/10 text-primary-container",
    check: "text-primary-container",
    tag: "text-primary",
    hover: "hover:border-primary-container/40",
    title: "Finanzas y Contabilidad",
    text: "Centraliza el control de flujos de salida, supervisa reembolsos pendientes y genera cierres mensuales en tiempo récord con exportación a tu ERP.",
    points: [
      "Gastos centralizados sin papeles físicos",
      "Seguimiento automático de reembolsos",
      "Conciliación con reglas de deducibilidad",
    ],
    footer: "Cero discrepancias al cierre",
  },
  {
    icon: "manage_accounts",
    wrap: "bg-secondary/10 text-secondary",
    check: "text-secondary",
    tag: "text-secondary",
    hover: "hover:border-secondary/40",
    title: "Administradores y Gerentes",
    text: "Otorga presupuestos con límites claros, aprueba viáticos con un toque y mantén la supervisión financiera de cada departamento o proyecto comercial.",
    points: [
      "Monitoreo activo de viáticos y viajes",
      "Flujos de aprobación configurables",
      "Supervisión por centros de costo",
    ],
    footer: "Gobernanza clara de recursos",
  },
  {
    icon: "badge",
    wrap: "bg-tertiary-container/10 text-tertiary",
    check: "text-tertiary",
    tag: "text-tertiary",
    hover: "hover:border-tertiary-container/40",
    title: "Empleados y Colaboradores",
    text: "Despídete de guardar recibos de papel en la billetera. Reporta gastos en segundos desde tu teléfono y recibe reembolsos más rápido y sin fricciones.",
    points: [
      "Registro simple de gastos vía foto",
      "Solicitudes de reembolso en 1 clic",
      "Visibilidad en vivo del estado del trámite",
    ],
    footer: "Reembolsos sin burocracia",
  },
];

export function RolesSection() {
  return (
    <section className="w-full bg-surface-container py-24">
      <div className="max-w-[1320px] mx-auto px-6">
        <SectionHeading
          className="max-w-2xl"
          eyebrow="Diseñado para Toda la Organización"
          eyebrowClassName="text-secondary"
          title="Una plataforma. Diferentes perspectivas. Un mismo control."
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {ROLES.map((r) => (
            <Reveal
              key={r.title}
              className={`p-8 rounded-3xl bg-surface-container-low flex flex-col justify-between shadow-lg border border-outline-variant/20 transition-all ${r.hover}`}
            >
              <div>
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${r.wrap}`}
                >
                  <Icon name={r.icon} className="text-[26px]" />
                </div>
                <h3 className="font-display text-headline-md font-bold text-on-surface mb-3">
                  {r.title}
                </h3>
                <p className="text-body-md text-on-surface-variant mb-6">{r.text}</p>
                <ul className="flex flex-col gap-3 text-body-md text-on-surface-variant">
                  {r.points.map((p) => (
                    <li key={p} className="flex items-center gap-2">
                      <Icon name="done" className={`text-[18px] ${r.check}`} />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-8 pt-4">
                <span className={`text-label-sm uppercase font-bold tracking-wider ${r.tag}`}>
                  {r.footer}
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
