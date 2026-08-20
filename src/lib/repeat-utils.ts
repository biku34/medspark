/**
 * Repeat-delivery helpers with no server dependencies.
 *
 * Kept apart from lib/subscriptions.ts so client components can format a
 * schedule without dragging the Mongo driver into the browser bundle.
 */

import { REPEAT_META, type RepeatFrequency, type Subscription } from "./types";

export const todayStr = (): string => new Date().toISOString().slice(0, 10);

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Resolves a frequency to a concrete interval, clamped to something sane. */
export function intervalFor(frequency: RepeatFrequency, customDays?: number): number {
  if (frequency === "CUSTOM") {
    const n = Math.round(Number(customDays) || 0);
    return Math.min(90, Math.max(3, n));
  }
  return REPEAT_META[frequency].days;
}

export function frequencyLabel(sub: Pick<Subscription, "frequency" | "intervalDays">): string {
  if (sub.frequency === "CUSTOM") return `Every ${sub.intervalDays} days`;
  return REPEAT_META[sub.frequency].label;
}

/** Human summary for the schedule card: "in 3 days", "today", "2 days overdue". */
export function nextDeliveryLabel(sub: Subscription): string {
  if (sub.status === "CANCELLED") return "Cancelled";
  if (sub.status === "COMPLETED") return "Finished";
  if (sub.status === "AWAITING_RX") return "Waiting for a prescription";
  if (sub.status === "PAUSED") return "Paused";

  const diff = daysBetween(todayStr(), sub.nextDate);
  if (diff < 0) return `Due ${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"} ago`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Tomorrow";
  return `In ${diff} days`;
}

/** Result of asking whether a schedule may raise one more order right now. */
export interface RefillCover {
  ok: boolean;
  /** Remaining pharmacist-authorised dispensings, when known. */
  remaining: number;
  validUntil?: string;
  reason?: string;
}

/**
 * A schedule is due when its next date has arrived and it has not already been
 * looked at today — the second half stops a repeatedly-failing schedule from
 * spamming the customer once per page load.
 */
export function isDue(sub: Subscription, on: string = todayStr()): boolean {
  if (sub.status !== "ACTIVE") return false;
  if (sub.nextDate > on) return false;
  return (sub.lastRunAt ?? "").slice(0, 10) !== on;
}
