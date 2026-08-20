"use client";

import clsx from "clsx";
import Link from "next/link";
import {
  forwardRef,
  useEffect,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Check, Loader2, Minus, Plus, Star, X } from "lucide-react";

/* ========================================================================== */
/* Button                                                                     */
/* ========================================================================== */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "outline";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800",
  secondary: "bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200",
  ghost: "bg-transparent text-ink-600 hover:bg-ink-100",
  danger: "bg-white text-red-700 border-[1.5px] border-red-300 hover:bg-red-50",
  success: "bg-brand-600 text-white hover:bg-brand-700",
  outline: "bg-white text-ink-700 border-[1.5px] border-ink-300 hover:border-ink-400 hover:bg-ink-50",
};

const SIZES: Record<Size, string> = {
  sm: "text-[13px] h-9 px-3 gap-1.5 rounded-lg font-bold",
  md: "text-[14px] h-11 px-4 gap-1.5 rounded-xl font-extrabold",
  lg: "text-[15px] h-12 px-5 gap-2 rounded-xl font-extrabold",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  full?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, full, icon, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      {...rest}
      disabled={rest.disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center whitespace-nowrap transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        full && "w-full",
        className,
      )}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  );
});

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  full,
  icon,
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  full?: boolean;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      data-tap
      className={clsx(
        "inline-flex items-center justify-center whitespace-nowrap transition-colors",
        VARIANTS[variant],
        SIZES[size],
        full && "w-full",
        className,
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

/* ========================================================================== */
/* Card / section                                                             */
/* ========================================================================== */

export function Card({
  className,
  children,
  as: As = "div",
}: {
  className?: string;
  children: ReactNode;
  as?: "div" | "section" | "li" | "article";
}) {
  return <As className={clsx("card p-3.5 sm:p-4", className)}>{children}</As>;
}

export function SectionTitle({
  title,
  action,
  subtitle,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[19px] font-extrabold text-ink-900 sm:text-[21px]">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ========================================================================== */
/* Badge / pills                                                              */
/* ========================================================================== */

type Tone = "brand" | "green" | "amber" | "red" | "blue" | "slate" | "purple";

const TONES: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-800 border-brand-200",
  green: "bg-ok-100 text-ok-800 border-ok-200",
  amber: "bg-rx-100 text-rx-800 border-rx-200",
  red: "bg-red-50 text-red-700 border-red-200",
  blue: "bg-care-100 text-care-800 border-care-200",
  slate: "bg-ink-100 text-ink-600 border-ink-200",
  purple: "bg-care-100 text-care-800 border-care-200",
};

export function Badge({
  tone = "slate",
  children,
  className,
  icon,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-extrabold whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function RxBadge({ type }: { type: "OTC" | "RX" }) {
  return type === "OTC" ? (
    <Badge tone="green">OTC · No prescription</Badge>
  ) : (
    <Badge tone="amber">℞ Prescription required</Badge>
  );
}

export function Stars({ value, count }: { value: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm font-semibold text-ink-700">
      <Star size={14} className="fill-amber-400 text-amber-400" />
      {value > 0 ? value.toFixed(1) : "New"}
      {count !== undefined && count > 0 && (
        <span className="font-normal text-ink-400">({count.toLocaleString("en-IN")})</span>
      )}
    </span>
  );
}

/* ========================================================================== */
/* Form fields                                                                */
/* ========================================================================== */

export function Field({
  label,
  hint,
  children,
  required,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-400">{hint}</span>}
    </label>
  );
}

const inputBase =
  "w-full rounded-lg border border-ink-300 bg-white px-3.5 py-2.5 text-[15px] text-ink-800 " +
  "placeholder:text-ink-400 transition-colors hover:border-ink-400 focus:border-brand-500";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} {...rest} className={clsx(inputBase, className)} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} {...rest} className={clsx(inputBase, "min-h-24", className)} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select ref={ref} {...rest} className={clsx(inputBase, "pr-8", className)}>
        {children}
      </select>
    );
  },
);

export function Checkbox({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={clsx(
        "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
        checked ? "border-brand-400 bg-brand-50" : "border-ink-200 bg-white hover:bg-ink-50",
      )}
    >
      <span
        className={clsx(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
          checked ? "border-brand-600 bg-brand-600 text-white" : "border-ink-300 bg-white",
        )}
      >
        {checked && <Check size={13} strokeWidth={3} />}
      </span>
      <span>
        <span className="block text-sm font-medium text-ink-800">{label}</span>
        {description && <span className="block text-xs text-ink-500">{description}</span>}
      </span>
    </button>
  );
}

/* ========================================================================== */
/* Quantity stepper                                                           */
/* ========================================================================== */

export function QtyStepper({
  value,
  onChange,
  min = 1,
  max = 20,
  size = "md",
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md";
}) {
  const btn =
    size === "sm"
      ? "h-8 w-8 rounded-lg"
      : "h-11 w-11 rounded-xl";
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-ink-200 bg-white p-1">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(Math.max(min - 1, value - 1))}
        className={clsx(
          btn,
          "flex items-center justify-center text-ink-700 transition-colors hover:bg-ink-100",
        )}
      >
        <Minus size={size === "sm" ? 14 : 18} />
      </button>
      <span
        className={clsx(
          "min-w-8 text-center font-semibold tabular-nums text-ink-900",
          size === "sm" ? "text-sm" : "text-lg",
        )}
      >
        {value}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(Math.min(max, value + 1))}
        className={clsx(
          btn,
          "flex items-center justify-center text-ink-700 transition-colors hover:bg-ink-100",
        )}
      >
        <Plus size={size === "sm" ? 14 : 18} />
      </button>
    </div>
  );
}

/* ========================================================================== */
/* Modal / sheet                                                              */
/* ========================================================================== */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink-900/45 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          "relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl rise sm:rounded-xl",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg",
        )}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <h3 className="text-lg font-semibold text-ink-900">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-ink-100 px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

/* ========================================================================== */
/* Tabs                                                                       */
/* ========================================================================== */

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: T; label: string; count?: number }>;
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={clsx(
            "flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors",
            active === t.id
              ? "bg-ink-900 text-white"
              : "bg-white text-ink-600 border border-ink-200 hover:bg-ink-50",
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span
              className={clsx(
                "rounded-full px-1.5 py-0.5 text-[11px] font-bold",
                active === t.id ? "bg-white/20" : "bg-ink-100 text-ink-600",
              )}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ========================================================================== */
/* Misc                                                                       */
/* ========================================================================== */

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-ink-300 bg-white px-6 py-10 text-center">
      {icon && <div className="mb-3 text-ink-300">{icon}</div>}
      <p className="text-base font-semibold text-ink-800">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-500">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-xl bg-ink-100", className)} />;
}

export function Stat({
  label,
  value,
  hint,
  tone = "slate",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
  icon?: ReactNode;
}) {
  return (
    <div className="surface p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-ink-500">{label}</p>
        {icon && (
          <span className={clsx("rounded-lg border p-1.5", TONES[tone])}>{icon}</span>
        )}
      </div>
      <p className="mt-1.5 text-[22px] font-extrabold tabular-nums leading-none text-ink-900">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-ink-500">{hint}</p>}
    </div>
  );
}

export function Divider({ label }: { label?: string }) {
  if (!label) return <hr className="my-4 border-ink-200" />;
  return (
    <div className="my-4 flex items-center gap-3">
      <hr className="flex-1 border-ink-200" />
      <span className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</span>
      <hr className="flex-1 border-ink-200" />
    </div>
  );
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-sm text-ink-500">{label}</span>
      <span className="text-right text-sm font-medium text-ink-800">{value}</span>
    </div>
  );
}
