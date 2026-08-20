"use client";

import clsx from "clsx";
import { useEffect, useState, type ReactNode } from "react";

/* ========================================================================== */
/* Metric strip                                                               */
/* ========================================================================== */

type MetricTone = "neutral" | "green" | "amber" | "red" | "blue" | "violet";

const METRIC_TONES: Record<MetricTone, string> = {
  neutral: "text-ink-900",
  green: "text-ok-700",
  amber: "text-amber-600",
  red: "text-red-600",
  blue: "text-sky-700",
  violet: "text-violet-700",
};

/**
 * A compact KPI cell. Operations screens are read at a glance, so the number
 * is the loudest thing and the label sits quietly under it.
 */
export function Metric({
  label,
  value,
  hint,
  tone = "neutral",
  live,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: MetricTone;
  /** Adds a pulsing dot — used for queues that need attention now. */
  live?: boolean;
}) {
  return (
    <div className="rounded-lg border border-ink-200 bg-white px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-500">
        {live && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 pulse-ring" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
          </span>
        )}
        {label}
      </p>
      <p className={clsx("mt-1 text-[22px] font-extrabold leading-none tabular-nums", METRIC_TONES[tone])}>
        {value}
      </p>
      {hint && <p className="mt-1 text-[10px] text-ink-400">{hint}</p>}
    </div>
  );
}

export function MetricRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{children}</div>;
}

/* ========================================================================== */
/* Status pill                                                                */
/* ========================================================================== */

type PillTone = "green" | "amber" | "red" | "blue" | "grey" | "violet";

const PILL_TONES: Record<PillTone, string> = {
  green: "bg-ok-600 text-white",
  amber: "bg-amber-500 text-white",
  red: "bg-red-600 text-white",
  blue: "bg-sky-600 text-white",
  grey: "bg-ink-200 text-ink-700",
  violet: "bg-violet-600 text-white",
};

/** Solid, high-contrast state marker. Reads across a crowded queue. */
export function Pill({
  tone = "grey",
  children,
  className,
}: {
  tone?: PillTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide whitespace-nowrap",
        PILL_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ========================================================================== */
/* SLA timer                                                                  */
/* ========================================================================== */

function elapsed(since: string): { text: string; minutes: number } {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 60000));
  if (mins < 60) return { text: `${mins}m`, minutes: mins };
  const h = Math.floor(mins / 60);
  if (h < 24) return { text: `${h}h ${mins % 60}m`, minutes: mins };
  return { text: `${Math.floor(h / 24)}d`, minutes: mins };
}

/**
 * Ticking "waiting for N minutes" counter.
 *
 * A pharmacy queue is judged on how long a customer has been waiting, so the
 * number goes amber then red as it ages rather than sitting there politely.
 */
export function WaitTimer({
  since,
  warnAfter = 3,
  breachAfter = 8,
}: {
  since: string;
  warnAfter?: number;
  breachAfter?: number;
}) {
  const [, tick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const { text, minutes } = elapsed(since);
  const tone =
    minutes >= breachAfter
      ? "bg-red-100 text-red-700"
      : minutes >= warnAfter
        ? "bg-amber-100 text-amber-700"
        : "bg-ink-100 text-ink-600";

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums",
        tone,
      )}
      title={`Waiting ${text}`}
    >
      {text}
    </span>
  );
}

/* ========================================================================== */
/* Job ticket                                                                 */
/* ========================================================================== */

/**
 * The unit of work on every staff screen: a code, a state, the facts, and the
 * actions — in that order, with actions on a separate row so they are always
 * a full-width tap target on a phone.
 */
export function Ticket({
  code,
  state,
  meta,
  timer,
  children,
  actions,
  accent,
}: {
  code: string;
  state: ReactNode;
  meta?: ReactNode;
  timer?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  /** Left edge colour — lets a queue be scanned by state alone. */
  accent?: "green" | "amber" | "red" | "blue" | "grey";
}) {
  const bar = {
    green: "before:bg-ok-600",
    amber: "before:bg-amber-500",
    red: "before:bg-red-500",
    blue: "before:bg-sky-500",
    grey: "before:bg-ink-300",
  }[accent ?? "grey"];

  return (
    <article
      className={clsx(
        "relative overflow-hidden rounded-lg border border-ink-200 bg-white pl-3",
        "before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-['']",
        bar,
      )}
    >
      <div className="flex items-start justify-between gap-2 px-2.5 pt-2.5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5">
            <span className="font-mono text-[13px] font-bold text-ink-900">{code}</span>
            {timer}
          </p>
          {meta && <div className="mt-0.5 text-[11px] text-ink-500">{meta}</div>}
        </div>
        {state}
      </div>

      {children && <div className="px-2.5 pb-2.5 pt-2">{children}</div>}

      {actions && (
        <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 bg-ink-50 px-2.5 py-2">
          {actions}
        </div>
      )}
    </article>
  );
}

/** Primary/secondary action buttons sized for a queue, not a form. */
export function ActionButton({
  tone = "primary",
  loading,
  disabled,
  onClick,
  children,
  icon,
}: {
  tone?: "primary" | "danger" | "neutral";
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  icon?: ReactNode;
}) {
  const tones = {
    primary: "bg-brand-600 text-white hover:bg-brand-700",
    danger: "bg-white text-red-700 border border-red-300 hover:bg-red-50",
    neutral: "bg-white text-ink-700 border border-ink-300 hover:bg-ink-100",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-[13px] font-bold transition-colors disabled:opacity-50 sm:flex-none",
        tones[tone],
      )}
    >
      {loading ? "…" : icon}
      {children}
    </button>
  );
}

/* ========================================================================== */
/* Table                                                                      */
/* ========================================================================== */

export function DataTable({
  head,
  children,
  empty,
}: {
  head: ReactNode[];
  children: ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-ink-200 bg-white">
      <table className="w-full min-w-[640px] text-[13px]">
        <thead className="border-b border-ink-200 bg-ink-50">
          <tr>
            {head.map((h, i) => (
              <th
                key={i}
                className="px-3 py-2 text-left text-[10px] font-extrabold uppercase tracking-wide text-ink-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">{children}</tbody>
      </table>
      {empty && <p className="px-3 py-8 text-center text-[13px] text-ink-400">Nothing here yet.</p>}
    </div>
  );
}

/** Sticky section header inside a panel. */
export function PanelTitle({
  title,
  count,
  action,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-[15px] font-extrabold tracking-tight text-ink-900">
        {title}
        {count !== undefined && (
          <span className="rounded bg-ink-200 px-1.5 py-0.5 text-[11px] font-bold text-ink-600">
            {count}
          </span>
        )}
      </h2>
      {action}
    </div>
  );
}
