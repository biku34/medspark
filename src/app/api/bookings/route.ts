import { bad, guard, ok, readJson } from "@/lib/api";
import { getStore } from "@/lib/db";
import { notify } from "@/lib/services";
import {
  earliestBookableDate,
  getServiceSettings,
  isBookableDate,
  matchProviders,
  priceBooking,
  rateConfigFor,
  slotHours,
  weekdayOf,
} from "@/lib/home-care";
import { SERVICE_META, type ServiceBooking, type ServiceProvider, type ServiceType, type User } from "@/lib/types";
import { newId, randomCode } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** GET /api/bookings — scoped to the caller's role. */
export async function GET(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  const { session } = g;

  const store = await getStore();
  let bookings = await store.list<ServiceBooking>("bookings");

  if (session.role === "customer") {
    bookings = bookings.filter((b) => b.customerId === session.userId);
  } else if (session.role === "provider") {
    const me = await store.one<ServiceProvider>("providers", { userId: session.userId });
    if (!me) return ok({ bookings: [], provider: null });
    // Own jobs, plus open requests this provider is eligible to accept.
    bookings = bookings.filter(
      (b) =>
        b.providerId === me.id ||
        (b.status === "REQUESTED" &&
          !b.providerId &&
          b.serviceType === me.type &&
          (!b.preferredProviderId || b.preferredProviderId === me.id)),
    );
    bookings.sort((a, b) => a.date.localeCompare(b.date));
    return ok({ bookings, provider: me });
  } else if (session.role !== "admin") {
    return bad("Not allowed", 403);
  }

  const type = new URL(req.url).searchParams.get("type");
  if (type) bookings = bookings.filter((b) => b.serviceType === type);

  bookings.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  return ok({ bookings });
}

/** POST /api/bookings — request a home visit. */
export async function POST(req: Request) {
  const g = await guard("customer");
  if ("error" in g) return g.error;
  const { session } = g;

  const body = await readJson<{
    serviceType?: ServiceType;
    date?: string;
    slot?: string;
    hours?: number;
    address?: string;
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
  }>(req);

  const serviceType = body?.serviceType;
  if (serviceType !== "PHYSIO" && serviceType !== "NURSING") {
    return bad("Unknown service type");
  }
  if (!body?.date || !body.slot) return bad("Date and time slot are required");
  if (!body.address?.trim()) return bad("A visit address is required");

  const settings = await getServiceSettings();
  const cfg = rateConfigFor(settings, serviceType);

  /* ---------------------------------------------------------------------- */
  /* Advance-booking rule — same-day visits are never accepted.             */
  /* ---------------------------------------------------------------------- */
  if (!isBookableDate(body.date, settings.minAdvanceDays)) {
    return bad(
      `Home visits need at least ${settings.minAdvanceDays} day's advance notice. The earliest available date is ${earliestBookableDate(settings.minAdvanceDays)}.`,
      409,
    );
  }

  const hours = Math.round(Number(body.hours ?? slotHours(body.slot)));
  if (!Number.isFinite(hours) || hours < cfg.minHours || hours > cfg.maxHours) {
    return bad(`Duration must be between ${cfg.minHours} and ${cfg.maxHours} hours`);
  }

  const store = await getStore();
  const customer = await store.one<User>("users", { id: session.userId });
  if (!customer) return bad("Customer not found", 404);

  const origin = {
    lat: Number(body.lat ?? 0) || 23.227,
    lng: Number(body.lng ?? 0) || 72.642,
  };

  // There must be at least one verified provider who covers this address.
  const offers = await matchProviders(serviceType, origin, body.date);
  if (offers.length === 0) {
    return bad(
      `No verified ${SERVICE_META[serviceType].providerNoun.toLowerCase()} currently covers this address. Please try another area.`,
      409,
    );
  }

  let rate = cfg.rate;
  let preferred: ServiceProvider | undefined;
  if (body.preferredProviderId) {
    const match = offers.find((o) => o.provider.id === body.preferredProviderId);
    if (!match) {
      return bad("That provider is not available for the selected date and address", 409);
    }
    if (!match.provider.availability.weekdays.includes(weekdayOf(body.date))) {
      return bad("That provider does not work on the selected day", 409);
    }
    if (!match.freeSlots.includes(body.slot)) {
      return bad("That time slot is no longer free for the selected provider", 409);
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
    patientName: body.patientName?.trim() || customer.name,
    address: body.address.trim(),
    locality: body.locality ?? customer.locality ?? "—",
    city: body.city ?? "—",
    lat: origin.lat,
    lng: origin.lng,
    date: body.date,
    slot: body.slot,
    hours,
    preferredProviderId: preferred?.id,
    reason: serviceType === "PHYSIO" ? body.reason?.trim() : undefined,
    assistanceTypes: serviceType === "NURSING" ? (body.assistanceTypes ?? []) : [],
    patientNotes: body.patientNotes?.trim() || undefined,
    rate: price.rate,
    serviceCharge: price.serviceCharge,
    platformFee: price.platformFee,
    total: price.total,
    paymentMode: body.paymentMode ?? "COD",
    paymentStatus: "PENDING",
    status: "REQUESTED",
    history: [{ status: "REQUESTED", at: createdAt }],
    createdAt,
  };

  await store.insert("bookings", booking);

  const meta = SERVICE_META[serviceType];
  await notify(customer.id, {
    kind: "ORDER",
    title: `${meta.short} booking requested`,
    body: `${booking.code} for ${booking.date}, ${booking.slot}. We're assigning a ${meta.providerNoun.toLowerCase()}.`,
    href: `/bookings/${booking.id}`,
  });

  // Tell the eligible providers there is work waiting.
  for (const offer of preferred ? offers.filter((o) => o.provider.id === preferred!.id) : offers) {
    await notify(offer.provider.userId, {
      kind: "ORDER",
      title: `New ${meta.short.toLowerCase()} request`,
      body: `${booking.code} · ${booking.date} ${booking.slot} · ${booking.locality}`,
      href: `/provider`,
    });
  }

  return ok({ booking }, 201);
}
