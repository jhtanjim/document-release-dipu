"use client";

import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { AlertTriangle, Info, Lightbulb, Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink border-accent hover:brightness-110",
  secondary: "bg-surface text-ink border-line hover:border-accent",
  ghost: "bg-transparent text-ink border-transparent hover:bg-sunk",
  danger: "bg-transparent text-crit border-crit hover:bg-crit-bg",
};

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed ${
        size === "sm" ? "px-3 py-1 text-[13px]" : "px-4 py-2 text-sm"
      } ${variants[variant]} ${className}`}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/** A destructive button that asks for a second click instead of a browser confirm(). */
export function ConfirmButton({
  onConfirm,
  children,
  confirmText = "নিশ্চিত? আবার চাপুন",
  ...props
}: { onConfirm: () => void; children: ReactNode; confirmText?: string } & Omit<
  Parameters<typeof Button>[0],
  "onClick" | "children"
>) {
  const [armed, setArmed] = useState(false);
  return (
    <Button
      variant="danger"
      {...props}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      onBlur={() => setArmed(false)}
    >
      {armed ? confirmText : children}
    </Button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5 ${className}`}>{children}</section>;
}

/**
 * "How to use this page": always open at the top of every page, each step a numbered card
 * so a first-time user can follow along without reading a paragraph.
 */
export function Guide({ steps, note }: { id?: string; steps: ReactNode[]; note?: ReactNode }) {
  return (
    <section className="no-print rounded-2xl border border-accent/25 bg-accent-soft/60 p-4 sm:p-5" aria-label="কীভাবে ব্যবহার করবেন">
      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-accent">
        <span className="grid size-7 place-items-center rounded-lg bg-accent text-accent-ink">
          <Lightbulb className="size-4" aria-hidden />
        </span>
        কীভাবে ব্যবহার করবেন
      </h2>
      <ol className="grid gap-2 sm:grid-cols-2">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 rounded-xl bg-surface/80 p-3 text-[14.5px] leading-relaxed">
            <span className="num grid size-6 shrink-0 place-items-center rounded-full bg-accent text-[12px] font-bold text-accent-ink">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      {note && (
        <p className="mt-3 flex gap-2 text-[13.5px] text-muted">
          <Info className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
          <span>{note}</span>
        </p>
      )}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold text-balance sm:text-[26px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[14.5px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export const inputCls =
  "w-full min-w-0 rounded-lg border border-line bg-surface px-3 py-2.5 text-[15px] text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:bg-sunk disabled:text-muted";

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[13px] font-semibold text-crit">{error}</p>
      ) : hint ? (
        <p className="text-[12.5px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

const tones = {
  neutral: "bg-sunk text-muted",
  info: "bg-accent-soft text-accent",
  good: "bg-good-bg text-good",
  warn: "bg-warn-bg text-warn",
  crit: "bg-crit-bg text-crit",
};

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Loading({ label = "লোড হচ্ছে…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-10 text-muted" role="status">
      <Loader2 className="size-5 animate-spin" aria-hidden /> {label}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-crit bg-crit-bg p-4 text-crit" role="alert">
      <AlertTriangle className="size-5 shrink-0" aria-hidden />
      <span className="font-semibold">{message}</span>
      {onRetry && (
        <Button size="sm" onClick={onRetry} className="ml-auto">
          আবার চেষ্টা করুন
        </Button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-muted">{children}</div>;
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      {label && <span className="mr-1 min-w-[90px] text-[12.5px] font-bold text-muted">{label}</span>}
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full border px-3 py-1 text-sm transition ${
            value === o.value ? "border-ink bg-ink text-surface" : "border-line bg-surface hover:border-accent"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
