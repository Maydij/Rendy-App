'use client';

import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export const LOGO_URL = "/rendy-logo.png?v=2";

export function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("material-symbols-outlined select-none", className)}>
      {name}
    </span>
  );
}

export function useInView<T extends Element>(threshold = 0.2, rootMargin = "0px") {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold, rootMargin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold, rootMargin, inView]);

  return { ref, inView };
}

/** Fades + lifts its content into view on scroll. */
export function Reveal({
  as: Tag = "div",
  className,
  children,
}: {
  as?: "div" | "li";
  className?: string;
  children: ReactNode;
}) {
  const { ref, inView } = useInView<HTMLDivElement>(0.12, "0px 0px -40px 0px");
  return (
    <Tag ref={ref as never} className={cn("reveal", inView && "revealed", className)}>
      {children}
    </Tag>
  );
}

/** Counts up from 0 to `value` once visible. */
export function Counter({
  value,
  prefix = "",
  suffix = "",
  className,
}: {
  value: number;
  prefix?: string | undefined;
  suffix?: string | undefined;
  className?: string | undefined;
}) {
  const { ref, inView } = useInView<HTMLParagraphElement>(0.3);
  const isDecimal = !Number.isInteger(value);
  const format = (n: number) =>
    isDecimal ? n.toFixed(1) : Math.floor(n).toLocaleString("en-US");
  const [display, setDisplay] = useState(format(value));

  useEffect(() => {
    if (!inView) return;
    const duration = 1800;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(format(p < 1 ? value * eased : value));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, value]);

  return (
    <p ref={ref} className={className}>
      {prefix}
      {display}
      {suffix}
    </p>
  );
}

/** Progress bar that animates to `percent` once visible. */
export function ProgressBar({
  percent,
  barClassName,
  trackClassName,
  slow = false,
}: {
  percent: number;
  barClassName: string;
  trackClassName?: string;
  slow?: boolean;
}) {
  const { ref, inView } = useInView<HTMLDivElement>(0.2);
  return (
    <div
      ref={ref}
      className={cn(
        "w-full rounded-full bg-surface-container-highest overflow-hidden",
        trackClassName,
      )}
    >
      <div
        className={cn("h-full rounded-full shimmer-bar", barClassName)}
        style={{
          width: inView ? `${percent}%` : "0%",
          transition: slow
            ? "width 1.4s cubic-bezier(0.16, 1, 0.3, 1)"
            : "width 1.4s ease-out",
        }}
      />
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  eyebrowClassName = "text-primary",
  title,
  description,
  className,
  titleClassName,
}: {
  eyebrow?: string;
  eyebrowClassName?: string;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
  titleClassName?: string;
}) {
  return (
    <Reveal className={cn("text-center max-w-3xl mx-auto mb-16", className)}>
      {eyebrow && (
        <span
          className={cn(
            "text-label-sm uppercase tracking-widest font-semibold",
            eyebrowClassName,
          )}
        >
          {eyebrow}
        </span>
      )}
      <h2
        className={cn(
          "font-display text-headline-xl-mobile md:text-headline-xl font-bold text-on-surface mt-2",
          titleClassName,
        )}
      >
        {title}
      </h2>
      {description && (
        <p className="text-body-md text-on-surface-variant mt-3">{description}</p>
      )}
    </Reveal>
  );
}
