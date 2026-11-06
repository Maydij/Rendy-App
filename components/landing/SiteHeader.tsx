"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { RendyLogo } from "@/components/rendy-logo";
import { cn } from "@/lib/utils";

import { Icon } from "./primitives";

export const NAV_ITEMS = [
  { id: "inicio", label: "Inicio" },
  { id: "funcionalidades", label: "Funcionalidades" },
  { id: "como-funciona", label: "Cómo funciona" },
  { id: "beneficios", label: "Beneficios" },
  { id: "planes", label: "Planes" },
  { id: "faq", label: "FAQ" },
] as const;

function useActiveSection() {
  const [active, setActive] = useState<string>("inicio");
  useEffect(() => {
    const onScroll = () => {
      const offset = window.scrollY + 140;
      let current = "inicio";
      for (const item of NAV_ITEMS) {
        const el = document.getElementById(item.id);
        if (el && el.offsetTop <= offset) current = item.id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return active;
}

export function SiteHeader() {
  const active = useActiveSection();
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface-container-lowest/85 backdrop-blur-md shadow-header">
      <div className="h-20 max-w-[1320px] mx-auto px-6 flex items-center justify-between gap-6">
        <a href="#inicio" className="flex items-center shrink-0" aria-label="Rendy — inicio">
          <RendyLogo className="h-8 w-auto" />
        </a>

        <nav className="hidden xl:flex items-center gap-8" aria-label="Principal">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              aria-current={active === item.id ? "page" : undefined}
              className={cn(
                "text-label-md transition-colors",
                active === item.id
                  ? "text-primary-container font-semibold"
                  : "text-on-surface-variant hover:text-on-surface",
              )}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4 shrink-0">
          <Link
            href="/login"
            className="hidden sm:inline-flex items-center justify-center text-label-md px-4 py-2 text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Iniciar sesión
          </Link>
          <a
            href="#solicitar-demo"
            className="hidden md:inline-flex items-center justify-center text-label-md font-semibold bg-primary-container text-on-primary-fixed rounded-xl px-5 py-2.5 transition-all shadow-glow hover:shadow-glow-lg hover:-translate-y-0.5 active:scale-95"
          >
            Solicitar una demo
          </a>
          <Link
            href="/login"
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 hover:opacity-90 transition-opacity"
            aria-label="Iniciar sesión"
          >
            <Icon name="person" className="text-on-primary text-[18px]" />
          </Link>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              className="xl:hidden w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
              aria-label="Abrir menú"
            >
              <Icon name="menu" className="text-[22px]" />
            </SheetTrigger>
            <SheetContent
              side="right"
              className="flex flex-col bg-surface-container-lowest border-outline-variant/40 text-on-surface"
            >
              <SheetTitle className="sr-only">Menú</SheetTitle>
              <RendyLogo className="h-8 w-auto self-start mt-2" />
              <nav className="flex flex-col gap-1 mt-8" aria-label="Móvil">
                {NAV_ITEMS.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "px-3 py-3 rounded-xl text-body-md transition-colors",
                      active === item.id
                        ? "text-primary-container font-semibold bg-surface-container"
                        : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container",
                    )}
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
              <a
                href="#solicitar-demo"
                onClick={() => setOpen(false)}
                className="mt-6 inline-flex items-center justify-center text-label-md font-semibold bg-primary-container text-on-primary-fixed rounded-xl px-5 py-3 shadow-glow"
              >
                Solicitar una demo
              </a>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
