import { bad, guard, ok, readJson } from "@/lib/api";
import { getStore } from "@/lib/db";
import { createBooking } from "@/lib/booking-service";
import type { ServiceBooking, ServiceProvider, ServiceType } from "@/lib/types";

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

/**
 * POST /api/bookings — request a home visit.
 *
 * The advance-notice and provider-coverage rules live in createBooking(),
 * shared with care-plan scheduling.
 */
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

  if (!body?.serviceType) return bad("Unknown service type");

  const result = await createBooking({
    customerId: session.userId,
    serviceType: body.serviceType,
    date: body.date ?? "",
    slot: body.slot ?? "",
    hours: body.hours,
    address: body.address ?? "",
    locality: body.locality,
    city: body.city,
    lat: body.lat,
    lng: body.lng,
    patientName: body.patientName,
    reason: body.reason,
    assistanceTypes: body.assistanceTypes,
    patientNotes: body.patientNotes,
    preferredProviderId: body.preferredProviderId,
    paymentMode: body.paymentMode,
  });

  if (!result.ok) return bad(result.message, result.status);
  return ok({ booking: result.booking }, 201);
}
