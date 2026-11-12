"use client";

import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { AlertTriangle, ChevronDown, Loader2 } from "lucide-react";
import { useLang } from "@/lib/i18n";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink border-accent hover:brightness-110",
  secondary: "bg-surface text-ink border-line hover:border-ink/40",
  ghost: "bg-transparent text-ink border-transparent hover:bg-sunk",
  danger: "bg-transparent text-crit border-crit/60 hover:bg-crit-bg",
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
      className={`inline-flex items-center justify-center gap-2 rounded-md border font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
        size === "sm" ? "px-3 py-1.5 text-[13.5px]" : "px-4 py-2.5 text-[15px]"
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
  confirmText,
  ...props
}: { onConfirm: () => void; children: ReactNode; confirmText?: string } & Omit<Parameters<typeof Button>[0], "onClick" | "children">) {
  const [armed, setArmed] = useState(false);
  const { t } = useLang();
  return (
    <Button variant="danger" {...props} onClick={() => (armed ? onConfirm() : setArmed(true))} onBlur={() => setArmed(false)}>
      {armed ? (confirmText ?? t("নিশ্চিত? আবার চাপুন", "Sure? Press again")) : children}
    </Button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-md border border-line bg-surface p-5 ${className}`}>{children}</section>;
}

/** "How to use this page": a quiet link that opens a short numbered list. */
export function Guide({ steps, note }: { id?: string; steps: ReactNode[]; note?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { t } = useLang();
  return (
    <section className="no-print">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-muted underline decoration-dotted underline-offset-4 hover:text-ink"
      >
        {t("এই পাতা কীভাবে ব্যবহার করবেন?", "How do I use this page?")}
        <ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div className="mt-2 rounded-md border border-line border-l-4 border-l-accent bg-surface px-5 py-4">
          <ol className="flex flex-col gap-1.5 text-[15px] leading-relaxed">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="num w-5 shrink-0 font-bold text-accent">{i + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          {note && <p className="mt-3 border-t border-line pt-2 text-[14px] text-muted">{note}</p>}
        </div>
      )}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
      <div className="min-w-0">
        <h1 className="text-[26px] font-bold leading-tight text-balance sm:text-[30px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export const inputCls =
  "w-full min-w-0 rounded-md border border-line bg-surface px-3 py-2.5 text-[15.5px] text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:bg-sunk disabled:text-muted";

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
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-[14.5px] font-semibold">
        {label}
      </label>
      {children}
      {error ? <p className="text-[13.5px] font-semibold text-crit">{error}</p> : hint ? <p className="text-[13px] text-muted">{hint}</p> : null}
    </div>
  );
}

const tones = {
  neutral: "bg-sunk text-muted",
  info: "bg-sunk text-ink",
  good: "bg-good-bg text-good",
  warn: "bg-warn-bg text-warn",
  crit: "bg-crit-bg text-crit",
};

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={`inline-block whitespace-nowrap rounded-sm px-2 py-0.5 text-[13px] font-semibold ${tones[tone]}`}>{children}</span>;
}

/** Loading text, centred in the page area (or the whole screen with `full`). */
export function Loading({ label, full }: { label?: string; full?: boolean }) {
  const { t } = useLang();
  return (
    <div className={`flex items-center justify-center gap-2.5 text-muted ${full ? "min-h-screen" : "min-h-[55vh]"}`} role="status">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span>{label ?? t("লোড হচ্ছে…", "Loading…")}</span>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useLang();
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-crit/40 border-l-4 border-l-crit bg-crit-bg p-4 text-crit" role="alert">
      <AlertTriangle className="size-5 shrink-0" aria-hidden />
      <span className="font-semibold">{message}</span>
      {onRetry && (
        <Button size="sm" onClick={onRetry} className="ml-auto">
          {t("আবার চেষ্টা করুন", "Try again")}
        </Button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-dashed border-line bg-surface p-8 text-center text-muted">{children}</div>;
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
      {label && <span className="mr-2 min-w-[96px] text-[14px] font-semibold text-muted">{label}</span>}
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md border px-3 py-1.5 text-[14.5px] transition ${
            value === o.value ? "border-ink bg-ink font-semibold text-surface" : "border-line bg-surface text-ink hover:border-ink/40"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
