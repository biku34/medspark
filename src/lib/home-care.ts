/**
 * Home-healthcare business logic: provider matching, slot availability,
 * pricing and the advance-booking rule.
 *
 * The core scheduling rule lives here: **a home visit can never be booked for
 * today**. Both the booking API and the UI derive their earliest date from
 * `earliestBookableDate()`, so there is a single source of truth.
 */

import { getStore } from "./db";
import { SETTINGS_ID, providerDistanceKm } from "./seed-home-care";
import { dateKey, weekdayOf } from "./booking-utils";
import type {
  BookingStatus,
  GeoPoint,
  ServiceBooking,
  ServiceProvider,
  ServiceSettings,
  ServiceType,
} from "./types";
import { BOOKING_FLOW } from "./types";

/* -------------------------------------------------------------------------- */
/* settings                                                                   */
/* -------------------------------------------------------------------------- */

const FALLBACK_SETTINGS: ServiceSettings = {
  id: SETTINGS_ID,
  physio: { rate: 500, platformFee: 49, minHours: 1, maxHours: 4 },
  nursing: { rate: 300, platformFee: 39, minHours: 2, maxHours: 12 },
  minAdvanceDays: 1,
  updatedAt: new Date().toISOString(),
};

export async function getServiceSettings(): Promise<ServiceSettings> {
  const store = await getStore();
  const found = await store.one<ServiceSettings>("settings", { id: SETTINGS_ID });
  return found ?? FALLBACK_SETTINGS;
}

/* -------------------------------------------------------------------------- */
/* dates & pricing — pure helpers shared with the browser                     */
/* -------------------------------------------------------------------------- */

export {
  dateKey,
  earliestBookableDate,
  bookableDates,
  isBookableDate,
  weekdayOf,
  slotHours,
  rateConfigFor,
  priceBooking,
  type PriceBreakdown,
} from "./booking-utils";

/* -------------------------------------------------------------------------- */
/* provider matching                                                          */
/* -------------------------------------------------------------------------- */

export interface ProviderOffer {
  provider: ServiceProvider;
  distanceKm: number;
  hourlyRate: number;
  /** Slots free on the requested date (empty when no date supplied). */
  freeSlots: string[];
}

/**
 * Verified, active providers of the right type who cover the patient's address.
 * Coverage is a real distance check against the provider's service radius.
 */
export async function matchProviders(
  type: ServiceType,
  origin: GeoPoint,
  date?: string,
): Promise<ProviderOffer[]> {
  const store = await getStore();
  const [providers, bookings] = await Promise.all([
    store.list<ServiceProvider>("providers", { type }),
    date ? store.list<ServiceBooking>("bookings", { date }) : Promise.resolve([]),
  ]);

  /**
   * A slot is taken once it is assigned to a provider *or* requested against a
   * specific one — a pending request soft-holds the slot, so the same provider
   * cannot be double-booked while they are still deciding.
   */
  const busy = new Set<string>();
  for (const b of bookings) {
    if (["CANCELLED", "REJECTED"].includes(b.status)) continue;
    const holder = b.providerId ?? b.preferredProviderId;
    if (holder) busy.add(`${holder}|${b.slot}`);
  }

  return providers
    .filter((p) => p.status === "ACTIVE" && p.verified)
    .map((provider) => {
      const distanceKm = providerDistanceKm(provider, origin);
      const worksThatDay = date ? provider.availability.weekdays.includes(weekdayOf(date)) : true;
      const freeSlots =
        date && worksThatDay
          ? provider.availability.slots.filter((s) => !busy.has(`${provider.id}|${s}`))
          : [];
      return { provider, distanceKm, hourlyRate: provider.hourlyRate, freeSlots };
    })
    .filter((o) => o.distanceKm <= o.provider.serviceRadiusKm)
    .sort((a, b) => b.provider.rating - a.provider.rating || a.distanceKm - b.distanceKm);
}

/* -------------------------------------------------------------------------- */
/* status transitions                                                         */
/* -------------------------------------------------------------------------- */

export function nextBookingStatus(
  type: ServiceType,
  current: BookingStatus,
): BookingStatus | null {
  const flow = BOOKING_FLOW[type];
  const idx = flow.indexOf(current);
  if (idx === -1 || idx === flow.length - 1) return null;
  return flow[idx + 1];
}

export function isClosedBooking(status: BookingStatus): boolean {
  return ["COMPLETED", "CANCELLED", "REJECTED"].includes(status);
}

/* -------------------------------------------------------------------------- */
/* analytics                                                                  */
/* -------------------------------------------------------------------------- */

export interface BookingAnalytics {
  physioBookings: number;
  nursingBookings: number;
  upcoming: number;
  completed: number;
  cancelled: number;
  revenue: number;
  averageValue: number;
  perDay: Array<{ day: string; physio: number; nursing: number }>;
  topProviders: Array<{ label: string; value: number; hint?: string }>;
}

export async function bookingAnalytics(): Promise<BookingAnalytics> {
  const store = await getStore();
  const bookings = await store.list<ServiceBooking>("bookings");
  const today = dateKey(new Date());

  const completed = bookings.filter((b) => b.status === "COMPLETED");
  const cancelled = bookings.filter((b) => ["CANCELLED", "REJECTED"].includes(b.status));
  const upcoming = bookings.filter((b) => !isClosedBooking(b.status) && b.date >= today);
  const revenue = completed.reduce((s, b) => s + b.total, 0);

  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(dateKey(d));
  }
  const perDay = days.map((day) => ({
    day,
    physio: bookings.filter((b) => b.date === day && b.serviceType === "PHYSIO").length,
    nursing: bookings.filter((b) => b.date === day && b.serviceType === "NURSING").length,
  }));

  const agg = new Map<string, { label: string; value: number; revenue: number }>();
  for (const b of completed) {
    if (!b.providerName) continue;
    const entry = agg.get(b.providerName) ?? { label: b.providerName, value: 0, revenue: 0 };
    entry.value += 1;
    entry.revenue += b.total;
    agg.set(b.providerName, entry);
  }

  return {
    physioBookings: bookings.filter((b) => b.serviceType === "PHYSIO").length,
    nursingBookings: bookings.filter((b) => b.serviceType === "NURSING").length,
    upcoming: upcoming.length,
    completed: completed.length,
    cancelled: cancelled.length,
    revenue,
    averageValue: completed.length ? Math.round(revenue / completed.length) : 0,
    perDay,
    topProviders: [...agg.values()]
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
      .map((p) => ({ label: p.label, value: p.value, hint: `₹${p.revenue}` })),
  };
}
