'use client';

import { useRef, useState, type PointerEvent } from "react";

import { Counter, ProgressBar, Reveal, SectionHeading } from "./primitives";

const METRICS = [
  {
    label: "Presupuesto Ejecutado",
    value: 48920,
    prefix: "$",
    valueClass: "text-on-surface",
    bar: "bg-primary-container",
    percent: 64,
    note: "64% del tope asignado",
    noteClass: "text-primary-container",
    hover: "hover:border-primary/40",
  },
  {
    label: "Reembolsos Procesados",
    value: 142,
    valueClass: "text-secondary",
    bar: "bg-secondary",
    percent: 85,
    note: "Tiempo promedio: 1.4 días",
    noteClass: "text-secondary",
    hover: "hover:border-secondary/40",
  },
  {
    label: "Alertas de Exceso",
    value: 3,
    valueClass: "text-tertiary",
    bar: "bg-tertiary-container",
    percent: 30,
    note: "En revisión de gerencia",
    noteClass: "text-tertiary",
    hover: "hover:border-tertiary-container/40",
  },
  {
    label: "Cumplimiento Fiscal",
    value: 99.8,
    suffix: "%",
    valueClass: "text-primary",
    bar: "bg-primary",
    percent: 99.8,
    note: "Validación CFDI / Tax ID",
    noteClass: "text-primary-container",
    hover: "hover:border-primary-fixed-dim/40",
  },
];

const NODES = [
  { x: 0, y: 130, amount: "$4,120 USD", week: "Semana 1", r: 8, dot: 4.5, delay: "0s" },
  { x: 250, y: 90, amount: "$8,390 USD", week: "Semana 2", r: 8, dot: 4.5, delay: "0.5s" },
  { x: 500, y: 60, amount: "$12,450 USD", week: "Semana 3", r: 10, dot: 5, delay: "1s" },
  { x: 750, y: 40, amount: "$21,800 USD", week: "Semana 4", r: 8, dot: 4.5, delay: "1.5s" },
  { x: 995, y: 20, amount: "$48,920 USD", week: "Cierre Actual", r: 10, dot: 6, delay: "2s", final: true },
];

const PILLARS = [
  {
    n: "01 / Panel Ejecutivo",
    color: "text-primary",
    dot: "bg-primary",
    text: "Visualiza los indicadores financieros clave con telemetría en tiempo real.",
  },
  {
    n: "02 / Monitoreo Integral",
    color: "text-secondary",
    dot: "bg-secondary",
    text: "Supervisa gastos individuales, categorías y estados de aprobación al instante.",
  },
  {
    n: "03 / Reportes por Proyecto",
    color: "text-tertiary",
    dot: "bg-tertiary",
    text: "Comprende cómo se distribuyen los recursos por centro de costo y cliente.",
  },
  {
    n: "04 / Control Organizacional",
    color: "text-primary-fixed-dim",
    dot: "bg-primary-fixed-dim",
    text: "Configura jerarquías de aprobación de acuerdo a la estructura de la empresa.",
  },
];

const LINE = "M0,130 Q120,110 250,90 T500,60 T750,40 T1000,20";

function SpendChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; amount: string; week: string } | null>(
    null,
  );

  const show = (e: PointerEvent<SVGGElement>, node: (typeof NODES)[number]) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTip({
      x: e.clientX - rect.left + 10,
      y: e.clientY - rect.top - 45,
      amount: node.amount,
      week: node.week,
    });
  };

  return (
    <div
      ref={containerRef}
      className="w-full bg-surface-container-low rounded-2xl p-6 mb-8 border border-outline-variant/20 relative"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <span className="text-label-md font-semibold text-on-surface">
          Curva de Gasto Semanal vs Presupuesto Proyectado
        </span>
        <div className="flex items-center gap-4 text-label-sm">
          <span className="text-primary-container flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-primary-container inline-block" />
            Real acumulado
          </span>
          <span className="text-on-surface-variant flex items-center gap-1.5">
            <span className="w-3 border-t-2 border-dashed border-outline inline-block" />
            Proyección mensual
          </span>
        </div>
      </div>

      <div
        role="status"
        className="absolute z-30 pointer-events-none transition-opacity duration-200 px-3 py-1.5 rounded-xl bg-surface-container-highest/95 backdrop-blur-md border border-primary-container/40 text-on-surface text-label-sm shadow-xl"
        style={{
          opacity: tip ? 1 : 0,
          left: tip ? tip.x : "50%",
          top: tip ? tip.y : 50,
        }}
      >
        <span className="font-bold text-primary-container block">{tip?.amount ?? "$12,450 USD"}</span>
        <span className="text-on-surface-variant text-[10px] font-normal tracking-normal">
          {tip ? `${tip.week} • Rendición confirmada` : "Semana 3 • Auditado"}
        </span>
      </div>

      <div className="w-full h-48 relative flex items-end">
        <svg
          className="w-full h-full overflow-visible"
          fill="none"
          preserveAspectRatio="none"
          viewBox="0 0 1000 160"
          role="img"
          aria-label="Curva de gasto semanal frente al presupuesto proyectado"
        >
          <defs>
            <linearGradient id="primaryAreaGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--primary-container)" stopOpacity="0.32" />
              <stop offset="60%" stopColor="var(--primary-container)" stopOpacity="0.08" />
              <stop offset="100%" stopColor="var(--primary-container)" stopOpacity="0" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur result="blur" stdDeviation="3" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path d={`${LINE} L1000,160 L0,160 Z`} fill="url(#primaryAreaGrad)" />
          <path
            d="M0,140 Q150,130 350,110 T700,80 T1000,50"
            stroke="var(--outline-variant)"
            strokeDasharray="6,6"
            strokeWidth="2"
          />
          <path
            className="chart-animated-path"
            d={LINE}
            filter="url(#glow)"
            stroke="var(--primary-container)"
            strokeLinecap="round"
            strokeWidth="3.5"
          />
          {NODES.map((node) => {
            const color = node.final ? "var(--primary-fixed)" : "var(--primary-container)";
            return (
              <g
                key={node.week}
                className="cursor-pointer"
                transform={`translate(${node.x}, ${node.y})`}
                onPointerEnter={(e) => show(e, node)}
                onPointerMove={(e) => show(e, node)}
                onPointerLeave={() => setTip(null)}
              >
                <circle r={16} fill="transparent" />
                <circle
                  className="animate-ping"
                  fill={color}
                  opacity={0.3}
                  r={node.r}
                  style={{ animationDelay: node.delay, transformBox: "fill-box", transformOrigin: "center" }}
                />
                <circle
                  fill={color}
                  r={node.dot}
                  stroke="var(--background)"
                  strokeWidth={node.final ? 2.5 : 2}
                />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex justify-between items-center text-label-sm text-on-surface-variant pt-2 border-t border-outline-variant/20 mt-1">
        {NODES.map((n) => (
          <span key={n.week} className={n.final ? "" : "max-sm:hidden first:inline"}>
            {n.week}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ShowcaseSection() {
  return (
    <section className="w-full bg-surface-container-lowest py-24 relative overflow-hidden">
      <div className="max-w-[1320px] mx-auto px-6">
        <SectionHeading
          eyebrow="Experiencia Ejecutiva"
          title="Una visión completa de las finanzas de tu organización."
          description="Consulta los indicadores más importantes, identifica tendencias y mantén el control de cada movimiento financiero desde un único lugar."
        />

        <Reveal className="relative w-full rounded-3xl bg-surface-container p-6 md:p-10 shadow-2xl overflow-hidden border border-outline-variant/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-8 border-b border-outline-variant/20">
            <div>
              <h3 className="font-display text-headline-md font-bold text-on-surface flex flex-wrap items-center gap-3">
                <span>Consola Financiera Global</span>
                <span className="px-2.5 py-0.5 rounded-full text-label-sm font-semibold bg-primary-container/15 text-primary-container flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse" />
                  En sincronía
                </span>
              </h3>
              <p className="text-body-md text-on-surface-variant">
                Periodo Fiscal Activo • Q1 2026
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="px-3.5 py-1.5 rounded-lg bg-surface-container-high text-on-surface text-label-md hover:bg-surface-bright transition-all"
              >
                Filtro: Todos los proyectos
              </button>
              <button
                type="button"
                className="px-4 py-1.5 rounded-lg bg-primary-container text-on-primary-fixed text-label-md font-bold shadow-glow-sm hover:shadow-glow-md hover:-translate-y-0.5 active:scale-95 transition-all"
              >
                Exportar ERP / SAT
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-8">
            {METRICS.map((m) => (
              <div
                key={m.label}
                className={`p-5 rounded-2xl bg-surface-container-low border border-outline-variant/20 transition-colors ${m.hover}`}
              >
                <span className="text-label-sm text-on-surface-variant">{m.label}</span>
                <Counter
                  value={m.value}
                  prefix={m.prefix}
                  suffix={m.suffix}
                  className={`font-display text-headline-lg font-bold mt-1 ${m.valueClass}`}
                />
                <ProgressBar percent={m.percent} barClassName={m.bar} trackClassName="mt-2 h-1.5" />
                <span className={`text-label-sm block mt-1.5 ${m.noteClass}`}>{m.note}</span>
              </div>
            ))}
          </div>

          <SpendChart />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
            {PILLARS.map((p) => (
              <div
                key={p.n}
                className="flex flex-col gap-2 p-3 rounded-xl hover:bg-surface-container-low transition-colors"
              >
                <span className={`text-label-md font-bold flex items-center gap-1.5 ${p.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
                  {p.n}
                </span>
                <p className="text-body-md text-on-surface-variant">{p.text}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
