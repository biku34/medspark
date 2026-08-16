/**
 * Pure booking helpers shared by the browser and the server.
 *
 * Deliberately free of any database import so the booking screens can use the
 * exact same date and pricing maths the API enforces — one rule, two callers.
 */

import type { ServiceRateConfig, ServiceSettings, ServiceType } from "./types";

export const dateKey = (d: Date): string => {
  // Local calendar date, not UTC — a booking "date" is a wall-clock day.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/**
 * Earliest date a customer may book.
 * With minAdvanceDays = 1 and today = 15 Aug, this returns 16 Aug.
 */
export function earliestBookableDate(minAdvanceDays: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + Math.max(1, minAdvanceDays));
  return dateKey(d);
}

/** Selectable dates for the booking form — never includes today. */
export function bookableDates(minAdvanceDays: number, count = 14, from = new Date()): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + Math.max(1, minAdvanceDays) + i);
    out.push(dateKey(d));
  }
  return out;
}

export function isBookableDate(date: string, minAdvanceDays: number, from = new Date()): boolean {
  return date >= earliestBookableDate(minAdvanceDays, from);
}

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

/** "09:00-11:00" -> 2 hours. Handles overnight windows like "20:00-08:00". */
export function slotHours(slot: string): number {
  const [start, end] = slot.split("-");
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  let diff = toMin(end) - toMin(start);
  if (diff <= 0) diff += 24 * 60;
  return Math.round(diff / 60);
}

export function rateConfigFor(settings: ServiceSettings, type: ServiceType): ServiceRateConfig {
  return type === "PHYSIO" ? settings.physio : settings.nursing;
}

export interface PriceBreakdown {
  rate: number;
  hours: number;
  serviceCharge: number;
  platformFee: number;
  total: number;
}

/** Service rate × hours, plus the platform charge shown as a separate line. */
export function priceBooking(rate: number, hours: number, platformFee: number): PriceBreakdown {
  const serviceCharge = Math.round(rate * hours);
  return { rate, hours, serviceCharge, platformFee, total: serviceCharge + platformFee };
}

/** Friendly "Sat, 16 Aug" for date chips. */
export function bookingDateLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
