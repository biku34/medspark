"use client";

import clsx from "clsx";
import { Check, CircleDashed, XCircle } from "lucide-react";
import { ORDER_FLOW, ORDER_LABELS, type Order, type OrderStatus } from "@/lib/types";
import { timeOfDay } from "@/lib/utils";

/** Vertical progress rail: Confirmed → Preparing → Ready → Out for delivery → Delivered. */
export function OrderTracker({ order }: { order: Order }) {
  const failed = order.status === "CANCELLED" || order.status === "REJECTED";
  const currentIdx = ORDER_FLOW.indexOf(order.status);

  if (failed) {
    const event = order.history[order.history.length - 1];
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
        <XCircle size={22} className="mt-0.5 shrink-0 text-red-600" />
        <div>
          <p className="font-semibold text-red-800">{ORDER_LABELS[order.status]}</p>
          {event?.note && <p className="mt-0.5 text-sm text-red-700">{event.note}</p>}
          <p className="mt-1 text-xs text-red-600">{timeOfDay(event.at)}</p>
        </div>
      </div>
    );
  }

  return (
    <ol className="relative">
      {ORDER_FLOW.map((step, i) => {
        const event = order.history.find((h) => h.status === step);
        const done = i < currentIdx || order.status === "DELIVERED";
        const active = i === currentIdx;
        const last = i === ORDER_FLOW.length - 1;

        return (
          <li key={step} className="relative flex gap-3.5 pb-6 last:pb-0">
            {!last && (
              <span
                aria-hidden
                className={clsx(
                  "absolute left-[15px] top-8 h-full w-0.5",
                  done ? "bg-brand-500" : "bg-ink-200",
                )}
              />
            )}
            <span
              className={clsx(
                "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
                done
                  ? "border-brand-600 bg-brand-600 text-white"
                  : active
                    ? "border-brand-600 bg-white text-brand-700"
                    : "border-ink-200 bg-white text-ink-300",
              )}
            >
              {done ? (
                <Check size={16} strokeWidth={3} />
              ) : active ? (
                <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />
              ) : (
                <CircleDashed size={15} />
              )}
              {active && (
                <span className="absolute inset-0 rounded-full bg-brand-500/30 pulse-ring" />
              )}
            </span>
            <div className="min-w-0 pt-1">
              <p
                className={clsx(
                  "text-sm font-semibold",
                  done || active ? "text-ink-900" : "text-ink-400",
                )}
              >
                {ORDER_LABELS[step]}
              </p>
              {event && (
                <p className="text-xs text-ink-500">
                  {timeOfDay(event.at)}
                  {event.note ? ` · ${event.note}` : ""}
                </p>
              )}
              {active && !event && <p className="text-xs text-brand-700">In progress…</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Compact horizontal version used in order lists. */
export function MiniTracker({ status }: { status: OrderStatus }) {
  const failed = status === "CANCELLED" || status === "REJECTED";
  const idx = ORDER_FLOW.indexOf(status);
  return (
    <div className="flex items-center gap-1" aria-label={ORDER_LABELS[status]}>
      {ORDER_FLOW.map((s, i) => (
        <span
          key={s}
          className={clsx(
            "h-1.5 flex-1 rounded-full",
            failed ? "bg-red-200" : i <= idx ? "bg-brand-500" : "bg-ink-200",
          )}
        />
      ))}
    </div>
  );
}
