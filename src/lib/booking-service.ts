/**
 * Home-visit booking creation, in one place.
 *
 * Both a customer booking a visit directly and an approved care plan
 * scheduling a course of visits come through here, so the advance-notice rule
 * and the "somebody verified actually covers this address" rule cannot drift
 * apart between the two paths.
 */

import { getStore } from "./db";
import {
  earliestBookableDate,
  getServiceSettings,
  isBookableDate,
  matchProviders,
  priceBooking,
  rateConfigFor,
  slotHours,
  weekdayOf,
} from "./home-care";
import { notify } from "./services";
import {
  SERVICE_META,
  type ServiceBooking,
  type ServiceProvider,
  type ServiceType,
  type User,
} from "./types";
import { newId, randomCode } from "./utils";

export interface CreateBookingInput {
  customerId: string;
  serviceType: ServiceType;
  /** YYYY-MM-DD */
  date: string;
  slot: string;
  hours?: number;
  address: string;
  locality?: string;
  city?: string;
  lat?: number;
  lng?: number;
  patientName?: string;
  reason?: string;
  assistanceTypes?: string[];
  patientNotes?: string;
  preferredProviderId?: string;
  paymentMode?: ServiceBooking["paymentMode"];
  carePlanId?: string;
  /** Caller sends its own summary notification instead. */
  quiet?: boolean;
}

export type CreateBookingResult =
  | { ok: true; booking: ServiceBooking }
  | { ok: false; message: string; status: number };

const fail = (message: string, status = 400): CreateBookingResult => ({
  ok: false,
  message,
  status,
});

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const { serviceType } = input;
  if (serviceType !== "PHYSIO" && serviceType !== "NURSING") return fail("Unknown service type");
  if (!input.date || !input.slot) return fail("Date and time slot are required");
  if (!input.address?.trim()) return fail("A visit address is required");

  const settings = await getServiceSettings();
  const cfg = rateConfigFor(settings, serviceType);

  /* ---------------------------------------------------------------------- */
  /* Advance-booking rule — same-day visits are never accepted.             */
  /* ---------------------------------------------------------------------- */
  if (!isBookableDate(input.date, settings.minAdvanceDays)) {
    return fail(
      `Home visits need at least ${settings.minAdvanceDays} day's advance notice. The earliest available date is ${earliestBookableDate(settings.minAdvanceDays)}.`,
      409,
    );
  }

  const hours = Math.round(Number(input.hours ?? slotHours(input.slot)));
  if (!Number.isFinite(hours) || hours < cfg.minHours || hours > cfg.maxHours) {
    return fail(`Duration must be between ${cfg.minHours} and ${cfg.maxHours} hours`);
  }

  const store = await getStore();
  const customer = await store.one<User>("users", { id: input.customerId });
  if (!customer) return fail("Customer not found", 404);

  const origin = {
    lat: Number(input.lat ?? 0) || 23.227,
    lng: Number(input.lng ?? 0) || 72.642,
  };

  // There must be at least one verified provider who covers this address.
  const offers = await matchProviders(serviceType, origin, input.date);
  if (offers.length === 0) {
    return fail(
      `No verified ${SERVICE_META[serviceType].providerNoun.toLowerCase()} currently covers this address. Please try another area.`,
      409,
    );
  }

  let rate = cfg.rate;
  let preferred: ServiceProvider | undefined;
  if (input.preferredProviderId) {
    const match = offers.find((o) => o.provider.id === input.preferredProviderId);
    if (!match) return fail("That provider is not available for the selected date and address", 409);
    if (!match.provider.availability.weekdays.includes(weekdayOf(input.date))) {
      return fail("That provider does not work on the selected day", 409);
    }
    if (!match.freeSlots.includes(input.slot)) {
      return fail("That time slot is no longer free for the selected provider", 409);
    }
    preferred = match.provider;
    rate = match.provider.hourlyRate;
  }

  const price = priceBooking(rate, hours, cfg.platformFee);
  const createdAt = new Date().toISOString();

  const booking: ServiceBooking = {
    id: newId("bkg"),
    code: `BK-${randomCode(5)}`,
    serviceType,
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    patientName: input.patientName?.trim() || customer.name,
    address: input.address.trim(),
    locality: input.locality ?? customer.locality ?? "—",
    city: input.city ?? "—",
    lat: origin.lat,
    lng: origin.lng,
    date: input.date,
    slot: input.slot,
    hours,
    preferredProviderId: preferred?.id,
    reason: serviceType === "PHYSIO" ? input.reason?.trim() : undefined,
    assistanceTypes: serviceType === "NURSING" ? (input.assistanceTypes ?? []) : [],
    patientNotes: input.patientNotes?.trim() || undefined,
    rate: price.rate,
    serviceCharge: price.serviceCharge,
    platformFee: price.platformFee,
    total: price.total,
    paymentMode: input.paymentMode ?? "COD",
    paymentStatus: "PENDING",
    status: "REQUESTED",
    history: [
      {
        status: "REQUESTED",
        at: createdAt,
        note: input.carePlanId ? "Scheduled from an approved care plan" : undefined,
      },
    ],
    createdAt,
  };

  await store.insert("bookings", booking);

  const meta = SERVICE_META[serviceType];
  if (!input.quiet) {
    await notify(customer.id, {
      kind: "ORDER",
      title: `${meta.short} booking requested`,
      body: `${booking.code} for ${booking.date}, ${booking.slot}. We're assigning a ${meta.providerNoun.toLowerCase()}.`,
      href: `/bookings/${booking.id}`,
    });
  }

  // Tell the eligible providers there is work waiting.
  const audience = preferred ? offers.filter((o) => o.provider.id === preferred.id) : offers;
  for (const offer of audience) {
    await notify(offer.provider.userId, {
      kind: "ORDER",
      title: `New ${meta.short.toLowerCase()} request`,
      body: `${booking.code} · ${booking.date} ${booking.slot} · ${booking.locality}`,
      href: `/provider`,
    });
  }

  return { ok: true, booking };
}
