'use client';

import { useState } from "react";

import { RendyLogo } from "@/components/rendy-logo";
import { cn } from "@/lib/utils";

import { Icon, Reveal } from "./primitives";

const FAQS = [
  {
    q: "¿Qué es Rendy?",
    a: "Rendy es una plataforma B2B de control financiero y gestión de gastos corporativos diseñada para que empresas de cualquier tamaño centralicen viáticos, reembolsos, autorizaciones y comprobantes fiscales en un entorno digital fluido.",
  },
  {
    q: "¿Qué tipo de empresas pueden utilizar Rendy?",
    a: "Desde pequeñas y medianas empresas en rápido crecimiento hasta corporativos con múltiples filiales internacionales. Rendy se adapta a organizaciones con equipos comerciales en terreno, consultores remotos o departamentos operativos que manejan presupuestos recurrentes.",
  },
  {
    q: "¿Cómo funciona la gestión de viáticos?",
    a: "Un colaborador solicita un anticipo indicando el destino y proyecto; la gerencia lo aprueba con un clic y el colaborador rinde gastos subiendo tickets durante su viaje. Rendy consolida el saldo utilizado versus el restante de forma automática.",
  },
  {
    q: "¿Cómo se realizan las solicitudes de reembolso?",
    a: "El colaborador toma una foto de su recibo o factura. La inteligencia artificial extrae los datos clave y envía la solicitud a su supervisor. Una vez autorizada, tesorería liquida la transferencia directamente a la cuenta del empleado.",
  },
  {
    q: "¿Puedo visualizar gastos en diferentes monedas?",
    a: "Sí. Rendy soporta transacciones en USD, EUR, MXN, COP y otras divisas globales, convirtiendo cada gasto en tiempo real a la moneda base de consolidación corporativa con tasas bancarias verificadas.",
  },
  {
    q: "¿Cómo funciona el registro de gastos mediante WhatsApp?",
    a: "Los colaboradores envían una imagen del ticket al contacto oficial de Rendy en WhatsApp. El bot procesa el comercio, la fecha, los impuestos y el total, confirmando la carga en su cuenta sin necesidad de abrir la computadora.",
  },
  {
    q: "¿Qué roles pueden utilizar la plataforma?",
    a: "Existen permisos diferenciados para Empleados (carga y consulta personal), Aprobadores de Área (autorizaciones de presupuesto), Contadores/Auditores (validación y conciliación) y Administradores Globales (configuración de políticas y gobernanza).",
  },
  {
    q: "¿Cómo puedo solicitar una demostración?",
    a: "Puedes hacer clic en el botón 'Solicitar una demo' en esta página. Un consultor financiero te agendará una sesión de 20 minutos adaptada a los flujos operativos de tu empresa.",
  },
  {
    q: "¿Qué planes ofrece Rendy?",
    a: "Ofrecemos planes Starter para equipos pequeños, Business para medianas empresas en aceleración con funciones automatizadas, y Enterprise para compañías que demandan parametrización ERP compleja y soporte contractual dedicado.",
  },
];

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="w-full bg-surface-container py-24">
      <div className="max-w-[900px] mx-auto px-6">
        <Reveal className="text-center mb-16">
          <span className="text-label-sm text-primary uppercase tracking-widest font-semibold">
            Resolviendo Dudas
          </span>
          <h2 className="font-display text-headline-xl-mobile md:text-headline-xl font-bold text-on-surface mt-2">
            Preguntas frecuentes.
          </h2>
        </Reveal>
        <div className="flex flex-col gap-4">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <Reveal
                key={item.q}
                className="rounded-2xl bg-surface-container-low overflow-hidden transition-all border border-outline-variant/20"
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`faq-${i}`}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 font-display text-headline-sm font-semibold text-on-surface hover:text-primary transition-colors"
                >
                  <span>{item.q}</span>
                  <Icon
                    name="expand_more"
                    className={cn("transition-transform duration-300", isOpen && "rotate-180")}
                  />
                </button>
                <div
                  id={`faq-${i}`}
                  className={cn(
                    "grid transition-all duration-300 px-6",
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="text-body-md text-on-surface-variant pb-6">{item.a}</p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function FinalCtaSection() {
  return (
    <section
      id="solicitar-demo"
      className="w-full bg-surface-container-lowest py-24 relative overflow-hidden"
    >
      <div className="max-w-[1320px] mx-auto px-6 relative z-10">
        <Reveal className="relative rounded-3xl bg-surface-container p-8 sm:p-10 md:p-16 text-center max-w-4xl mx-auto shadow-glow-cta overflow-hidden border border-outline-variant/30">
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-primary/20 blur-[80px] pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-secondary/20 blur-[80px] pointer-events-none" />
          <div className="relative z-10 flex flex-col items-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-container-high mb-6 border border-outline-variant/20">
              <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse" />
              <span className="text-label-sm text-primary uppercase font-bold tracking-wider">
                Únete a la evolución fintech
              </span>
            </div>
            <h2 className="font-display text-headline-xl-mobile md:text-headline-xl font-extrabold text-on-surface max-w-2xl">
              Tu empresa merece una forma más inteligente de gestionar sus gastos.
            </h2>
            <p className="text-body-lg text-on-surface-variant max-w-xl mt-4 mb-8">
              Descubre cómo Rendy puede ayudarte a centralizar tus operaciones financieras y tener
              mayor control sobre los recursos de tu organización.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 w-full sm:w-auto">
              <a
                href="#solicitar-demo"
                className="inline-flex items-center justify-center font-display text-label-md font-bold px-8 py-4 rounded-xl bg-primary-container text-on-primary-fixed shadow-glow-md hover:shadow-glow-lg hover:-translate-y-0.5 active:scale-95 transition-all"
              >
                Solicitar una demo
              </a>
              <a
                href="#solicitar-demo"
                className="inline-flex items-center justify-center text-label-md font-semibold px-7 py-4 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-bright transition-colors"
              >
                Contactar con nuestro equipo
              </a>
            </div>
            <p className="text-label-sm font-normal text-on-surface-variant mt-6">
              Implementación en menos de 48 horas • Sin contratos forzosos • Soporte en español
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const FOOTER_COLUMNS = [
  {
    title: "Producto",
    links: [
      ["Tarjetas Corporativas", "#funcionalidades"],
      ["Anticipos de Viaje", "#funcionalidades"],
      ["Automatización de Rendición", "#funcionalidades"],
      ["Integraciones ERP", "#funcionalidades"],
      ["Auditoría Fiscal", "#funcionalidades"],
    ],
  },
  {
    title: "Compañía",
    links: [
      ["Sobre Rendy", "#inicio"],
      ["Clientes & Casos", "#inicio"],
      ["Carreras", "#inicio"],
      ["Prensa & Medios", "#inicio"],
    ],
  },
  {
    title: "Recursos",
    links: [
      ["Centro de Ayuda / FAQ", "#faq"],
      ["Guías de Gestión", "#como-funciona"],
      ["API para Desarrolladores", "#como-funciona"],
      ["Calculadora de ROI", "#planes"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Privacidad de Datos", "#"],
      ["Términos del Servicio", "#"],
      ["Seguridad SOC-2 & PCI", "#"],
      ["Cumplimiento Normativo", "#"],
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="w-full bg-surface-container-lowest text-on-surface-variant pt-12 pb-12">
      <div className="max-w-[1320px] mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-y-12 gap-x-8 pb-12">
          <div className="col-span-2 flex flex-col gap-4">
            <a href="#inicio" className="flex items-center self-start" aria-label="Rendy — inicio">
              <RendyLogo className="h-8 w-auto" />
            </a>
            <p className="text-body-md text-on-surface-variant max-w-sm">
              Plataforma B2B inteligente de control de gastos corporativos, anticipos de viaje y
              gestión financiera en tiempo real para empresas de alto crecimiento.
            </p>
          </div>
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title} className="flex flex-col gap-3">
              <span className="text-label-md font-semibold text-on-surface uppercase tracking-wider">
                {col.title}
              </span>
              {col.links.map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  className="text-body-md text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  {label}
                </a>
              ))}
            </div>
          ))}
        </div>
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-body-md text-on-surface-variant/80">
          <p>© 2026 Rendy. Todos los derechos reservados.</p>
          <span className="text-label-sm text-on-surface-variant">
            Infraestructura financiera de grado bancario
          </span>
        </div>
      </div>
    </footer>
  );
}
