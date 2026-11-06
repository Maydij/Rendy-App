import { Counter, Icon, Reveal } from "./primitives";

const LEDGER = [
  {
    icon: "flight",
    iconClass: "text-secondary",
    title: "LATAM Airlines",
    meta: "Viáticos • Gira Comercial",
    amount: "$540.00 USD",
    status: "Auditado",
    statusClass: "bg-primary-container/15 text-primary-container",
  },
  {
    icon: "restaurant",
    iconClass: "text-tertiary",
    title: "Todd's Tacos & Business Grill",
    meta: "Reembolso • Drew Martin",
    amount: "$67.00 USD",
    status: "Pendiente",
    statusClass: "bg-tertiary-container/15 text-tertiary",
  },
  {
    icon: "developer_board",
    iconClass: "text-primary",
    title: "Velocitech Cloud Services",
    meta: "Suscripción SaaS • TI",
    amount: "$289.90 USD",
    status: "Auditado",
    statusClass: "bg-primary-container/15 text-primary-container",
  },
];

function FloatingBadge({
  className,
  icon,
  iconWrap,
  iconClass,
  label,
  value,
  valueClass,
  style,
}: {
  className: string;
  icon: string;
  iconWrap: string;
  iconClass: string;
  label: string;
  value: string;
  valueClass: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className={`hidden sm:flex absolute z-20 items-center gap-3 px-4 py-3 rounded-2xl bg-surface-container/95 backdrop-blur-md shadow-xl border border-outline-variant/40 ${className}`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${iconWrap}`}>
        <Icon name={icon} className={`text-[18px] ${iconClass}`} />
      </div>
      <div>
        <p className="text-label-sm text-on-surface-variant">{label}</p>
        <p className={`text-label-md ${valueClass}`}>{value}</p>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section
      id="inicio"
      className="relative w-full bg-surface-container-lowest overflow-hidden py-16 md:py-24"
    >
      <div className="absolute -top-32 left-1/4 w-[520px] h-[520px] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 right-[-10%] w-[600px] h-[600px] bg-secondary/10 rounded-full blur-[160px] pointer-events-none" />

      <div className="max-w-[1320px] mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          <Reveal className="lg:col-span-6 flex flex-col items-start gap-6">
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-surface-container-high shadow-sm border border-outline-variant/30">
              <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                <span className="animate-radar absolute inline-flex h-full w-full rounded-full bg-primary-container opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-container" />
              </span>
              <span className="text-label-sm text-primary uppercase tracking-widest">
                CONTROL FINANCIERO INTELIGENTE
              </span>
            </div>

            <h1 className="font-display text-headline-xl-mobile sm:text-headline-xl text-on-surface font-extrabold tracking-tight">
              Todos los gastos de tu empresa.{" "}
              <span className="text-primary-container">Bajo control.</span>
            </h1>

            <p className="text-body-lg text-on-surface-variant max-w-xl">
              Gestiona viáticos, gastos corporativos y reembolsos desde una sola plataforma. Más
              visibilidad financiera, menos procesos manuales y decisiones más inteligentes.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2 w-full sm:w-auto">
              <a
                href="#solicitar-demo"
                className="inline-flex items-center justify-center font-display text-label-md font-bold px-7 py-4 rounded-xl bg-primary-container text-on-primary-fixed shadow-glow-md hover:shadow-glow-lg hover:-translate-y-0.5 active:scale-95 transition-all"
              >
                Solicitar una demo
              </a>
              <a
                href="#funcionalidades"
                className="inline-flex items-center justify-center text-label-md font-semibold px-6 py-4 rounded-xl bg-surface-container text-on-surface hover:bg-surface-container-high hover:text-secondary-fixed transition-colors"
              >
                Explorar funcionalidades
              </a>
            </div>

            <div className="flex items-center gap-3 pt-4">
              <Icon name="verified_user" className="text-primary text-[20px]" />
              <p className="text-label-md text-on-surface-variant">
                Una nueva forma de gestionar las finanzas de tu empresa.
              </p>
            </div>
          </Reveal>

          <div className="lg:col-span-6 relative">
            <FloatingBadge
              className="-top-5 -left-4 animate-float-slow"
              icon="check_circle"
              iconWrap="bg-primary-container/20"
              iconClass="text-primary-container"
              label="Gasto Aprobado"
              value="$67.00 USD"
              valueClass="font-display font-bold text-on-surface"
            />
            <FloatingBadge
              className="-bottom-6 -left-2 animate-float-delayed"
              icon="currency_exchange"
              iconWrap="bg-secondary/20"
              iconClass="text-secondary"
              label="Multidivisa nativa"
              value="USD • MXN • EUR"
              valueClass="font-semibold text-secondary-fixed"
            />
            <FloatingBadge
              className="-top-3 -right-3 animate-float-slow"
              style={{ animationDelay: "2.2s" }}
              icon="trending_up"
              iconWrap="bg-tertiary-container/20"
              iconClass="text-tertiary-fixed-dim"
              label="Resumen de Cierre"
              value="94% Rendido"
              valueClass="font-display font-bold text-tertiary-fixed-dim"
            />

            <div className="p-px rounded-2xl shimmer-card-border shadow-2xl">
              <div className="w-full rounded-2xl bg-surface-container-low overflow-hidden">
                <div className="h-10 bg-surface-container px-4 flex items-center justify-between border-b border-outline-variant/20">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-error-container" />
                    <span className="w-3 h-3 rounded-full bg-tertiary-container" />
                    <span className="w-3 h-3 rounded-full bg-primary-container" />
                  </div>
                  <div className="px-4 py-1 rounded bg-surface-container-lowest text-on-surface-variant text-label-sm flex items-center gap-2 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse" />
                    app.rendy.io/dashboard/overview
                  </div>
                  <Icon name="tune" className="text-on-surface-variant text-[18px]" />
                </div>

                <div className="p-4 sm:p-6 flex flex-col gap-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/20 hover:border-primary-container/40 transition-colors">
                      <p className="text-label-sm text-on-surface-variant">Total Gastos</p>
                      <Counter
                        value={12450}
                        prefix="$"
                        suffix=".00"
                        className="font-display text-headline-sm font-bold text-on-surface mt-1"
                      />
                      <span className="text-label-sm text-primary-container">USD mensual</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/20 hover:border-tertiary-container/40 transition-colors">
                      <p className="text-label-sm text-on-surface-variant">Pendientes</p>
                      <Counter
                        value={8}
                        className="font-display text-headline-sm font-bold text-tertiary-container mt-1"
                      />
                      <span className="text-label-sm text-on-surface-variant">Por autorizar</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/20 hover:border-secondary/40 transition-colors">
                      <p className="text-label-sm text-on-surface-variant">Comprobantes</p>
                      <Counter
                        value={14}
                        className="font-display text-headline-sm font-bold text-secondary mt-1"
                      />
                      <span className="text-label-sm text-on-surface-variant">Verificados SAT</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/20 hover:border-primary/40 transition-colors">
                      <p className="text-label-sm text-on-surface-variant">Rendición</p>
                      <Counter
                        value={94}
                        suffix="%"
                        className="font-display text-headline-sm font-bold text-primary mt-1"
                      />
                      <span className="text-label-sm text-on-surface-variant">+6% vs mes ant.</span>
                    </div>
                  </div>

                  <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-3 border border-outline-variant/20">
                    <div className="flex items-center justify-between pb-2 gap-2">
                      <span className="text-label-md font-semibold text-on-surface flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse" />
                        Movimientos recientes en vivo
                      </span>
                      <span className="text-label-sm text-primary cursor-pointer hover:underline shrink-0">
                        Ver todos (42)
                      </span>
                    </div>
                    {LEDGER.map((row) => (
                      <div
                        key={row.title}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-surface-container-high/60 hover:bg-surface-container-high transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-surface-bright flex items-center justify-center shrink-0">
                            <Icon name={row.icon} className={`text-[18px] ${row.iconClass}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-label-md font-medium text-on-surface truncate">
                              {row.title}
                            </p>
                            <p className="text-label-sm font-normal text-on-surface-variant truncate">
                              {row.meta}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-label-md font-bold text-on-surface">{row.amount}</p>
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-label-sm font-semibold ${row.statusClass}`}
                          >
                            {row.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
