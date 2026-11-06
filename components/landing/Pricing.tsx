'use client';

import { useState } from "react";

import {
  ANNUAL_DISCOUNT_LABEL,
  PLANS,
  billingNote,
  planPrice,
  type BillingCycle,
} from "@/lib/pricing";
import { cn } from "@/lib/utils";

import { Icon, Reveal } from "./primitives";

export function PricingSection() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  const toggleClass = (active: boolean) =>
    cn(
      "px-5 py-2 rounded-xl text-label-md font-semibold transition-all duration-300 flex items-center gap-2",
      active
        ? "text-on-surface bg-surface-bright shadow-sm"
        : "text-on-surface-variant hover:text-on-surface",
    );

  return (
    <section id="planes" className="w-full bg-surface-container-lowest py-24">
      <div className="max-w-[1320px] mx-auto px-6">
        <Reveal className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-label-sm text-primary uppercase tracking-widest font-semibold">
            PLANES TRANSPARENTES
          </span>
          <h2 className="font-display text-headline-xl-mobile md:text-headline-xl font-bold text-on-surface mt-2">
            Encuentra el plan adecuado para tu empresa.
          </h2>
          <p className="text-body-md text-on-surface-variant mt-3 max-w-2xl mx-auto">
            Automatiza la rendición de viáticos y reembolsos por WhatsApp con IA contable. 7 días
            de prueba gratis en todos los planes, cancela cuando quieras.
          </p>
          <div
            role="group"
            aria-label="Ciclo de facturación"
            className="mt-8 inline-flex flex-wrap justify-center items-center p-1.5 rounded-2xl bg-surface-container-high/60 backdrop-blur-md shadow-inner gap-2 border border-outline-variant/20"
          >
            <button
              type="button"
              aria-pressed={cycle === "monthly"}
              onClick={() => setCycle("monthly")}
              className={toggleClass(cycle === "monthly")}
            >
              Facturación Mensual
            </button>
            <button
              type="button"
              aria-pressed={cycle === "annual"}
              onClick={() => setCycle("annual")}
              className={toggleClass(cycle === "annual")}
            >
              <span>Facturación Anual</span>
              <span className="px-2 py-0.5 rounded-full text-label-sm font-bold bg-primary-container text-on-primary-fixed">
                {ANNUAL_DISCOUNT_LABEL}
              </span>
            </button>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {PLANS.map((plan) => (
            <Reveal
              key={plan.id}
              className={cn(
                "p-8 rounded-3xl flex flex-col justify-between relative transition-all",
                plan.featured
                  ? "bg-surface-container-low shadow-glow-plan border-2 border-primary-container mt-4 lg:mt-0"
                  : "bg-surface-container shadow-sm border border-outline-variant/30 hover:border-outline-variant/60",
              )}
            >
              <div>
                {plan.featured && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary-container text-on-primary-fixed text-label-sm font-bold uppercase tracking-wider shadow-md whitespace-nowrap">
                    RECOMENDADO • MÁS VENDIDO
                  </div>
                )}
                <span
                  className={cn(
                    "text-label-sm uppercase font-bold tracking-wider",
                    plan.featured ? "text-primary" : "text-on-surface-variant",
                  )}
                >
                  {plan.tier}
                </span>
                <h3 className="font-display text-headline-md font-bold text-on-surface mt-2">
                  {plan.name}
                </h3>
                <p className="text-body-md text-on-surface-variant mt-2 mb-6">{plan.description}</p>
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-headline-xl font-extrabold text-on-surface">
                      {planPrice(plan, cycle)}
                    </span>
                    <span className="text-body-md text-on-surface-variant">/mes</span>
                  </div>
                  <span className="text-label-sm text-on-surface-variant block mt-1">
                    {billingNote(cycle)}
                  </span>
                </div>
                <ul className="flex flex-col gap-3 text-body-md text-on-surface-variant">
                  {plan.features.map((f) => (
                    <li key={f.text} className="flex items-start gap-2.5">
                      <Icon
                        name="check"
                        className="text-primary-container text-[20px] shrink-0 mt-0.5"
                      />
                      <span
                        className={cn(
                          f.emphasis === "strong" && "text-on-surface font-medium",
                          f.emphasis === "highlight" && "text-primary font-semibold",
                        )}
                      >
                        {f.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <a
                href="#solicitar-demo"
                className={cn(
                  "mt-8 w-full py-3.5 rounded-xl text-center text-label-md transition-all active:scale-95",
                  plan.featured
                    ? "font-bold bg-primary-container text-on-primary-fixed shadow-glow-md hover:shadow-glow-lg hover:-translate-y-0.5"
                    : "font-semibold border border-outline-variant/60 text-on-surface hover:bg-surface-bright",
                )}
              >
                Probar 7 días gratis
              </a>
            </Reveal>
          ))}
        </div>

        <div className="mt-14 text-center border-t border-outline-variant/20 pt-8">
          <p className="text-body-md text-on-surface-variant">
            Todos los planes incluyen 7 días de prueba sin costo. ¿Tu empresa procesa más de 1,500
            facturas al mes?{" "}
            <a
              href="#solicitar-demo"
              className="text-primary-container underline hover:opacity-80 font-medium transition-opacity"
            >
              Habla con un asesor para un plan a medida
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
