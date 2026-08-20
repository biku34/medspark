import { bad, guard, ok, readJson } from "@/lib/api";
import { getStore } from "@/lib/db";
import { notify } from "@/lib/services";
import {
  addDays,
  frequencyLabel,
  intervalFor,
  runDueSubscriptions,
  todayStr,
} from "@/lib/subscriptions";
import {
  REPEAT_DISCOUNT_PCT,
  type Medicine,
  type Pharmacy,
  type Prescription,
  type RepeatFrequency,
  type Subscription,
  type SubscriptionItem,
  type User,
} from "@/lib/types";
import { newId, randomCode } from "@/lib/utils";
import { SERVICE_RADIUS_KM } from "@/lib/zones";
import { pharmacyDistanceKm } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/subscriptions — the caller's repeat schedules.
 *
 * Opportunistically processes anything that has come due first, so the demo
 * behaves like a cron-driven deployment without needing one.
 */
export async function GET(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  const { session } = g;

  if (new URL(req.url).searchParams.get("run") !== "0") {
    await runDueSubscriptions();
  }

  const store = await getStore();
  let subs = await store.list<Subscription>("subscriptions");

  if (session.role === "customer") {
    subs = subs.filter((s) => s.customerId === session.userId);
  } else if (session.role === "pharmacy" || session.role === "pharmacist") {
    subs = subs.filter((s) => s.pharmacyId === session.pharmacyId);
  } else if (session.role !== "admin") {
    return bad("Not allowed", 403);
  }

  subs.sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  return ok({ subscriptions: subs });
}

/** POST /api/subscriptions — start a repeat schedule with a chosen pharmacy. */
export async function POST(req: Request) {
  const g = await guard("customer");
  if ("error" in g) return g.error;
  const { session } = g;

  const body = await readJson<{
    pharmacyId?: string;
    items?: Array<{ medicineId: string; qty: number }>;
    frequency?: RepeatFrequency;
    customDays?: number;
    startDate?: string;
    prescriptionId?: string;
    paymentMode?: Subscription["paymentMode"];
    address?: string;
    locality?: string;
    lat?: number;
    lng?: number;
    carePlanId?: string;
  }>(req);

  if (!body?.pharmacyId || !body.items?.length) {
    return bad("A pharmacy and at least one medicine are required");
  }

  const frequency = body.frequency ?? "MONTHLY";
  const intervalDays = intervalFor(frequency, body.customDays);

  const store = await getStore();
  const [pharmacy, customer, medicines] = await Promise.all([
    store.one<Pharmacy>("pharmacies", { id: body.pharmacyId }),
    store.one<User>("users", { id: session.userId }),
    store.list<Medicine>("medicines"),
  ]);

  if (!pharmacy) return bad("Pharmacy not found", 404);
  if (!pharmacy.verified || pharmacy.status !== "ACTIVE") {
    return bad("This pharmacy is not currently accepting orders", 409);
  }
  if (!customer) return bad("Customer not found", 404);

  const medById = new Map(medicines.map((m) => [m.id, m]));
  const items: SubscriptionItem[] = [];

  for (const line of body.items) {
    const med = medById.get(line.medicineId);
    if (!med) return bad(`Unknown medicine ${line.medicineId}`, 404);
    // A scheduled medicine on an unattended repeat is the last thing this
    // platform should ever ship.
    if (med.restricted) {
      return bad(`${med.name} is restricted and cannot be put on a repeat delivery.`, 403);
    }
    items.push({
      medicineId: med.id,
      name: med.name,
      strength: med.strength,
      form: med.form,
      qty: Math.max(1, Number(line.qty) || 1),
      type: med.type,
    });
  }

  const type = items.some((i) => i.type === "RX") ? "RX" : "OTC";

  /* ---------------------------------------------------------------------- */
  /* Repeat authorisation — the gate that makes an unattended refill safe.  */
  /* ---------------------------------------------------------------------- */
  let prescription: Prescription | null = null;
  if (type === "RX") {
    if (!body.prescriptionId) {
      return bad("Prescription medicines need a pharmacist-verified prescription", 403);
    }
    prescription = await store.one<Prescription>("prescriptions", { id: body.prescriptionId });
    if (!prescription) return bad("Prescription not found", 404);
    if (prescription.customerId !== session.userId) {
      return bad("This prescription belongs to another customer", 403);
    }
    if (prescription.status !== "APPROVED") {
      return bad("That prescription has not been verified by a pharmacist yet", 403);
    }
    const approvedIds = new Set(
      prescription.extractedMedicines.map((m) => m.medicineId).filter(Boolean) as string[],
    );
    const stray = items.find((i) => i.type === "RX" && !approvedIds.has(i.medicineId));
    if (stray) return bad(`${stray.name} is not on the verified prescription`, 403);

    const remaining = (prescription.refillsAuthorised ?? 0) - (prescription.refillsUsed ?? 0);
    if (remaining <= 0) {
      return bad(
        "That prescription has no repeat dispensings left. Ask the pharmacist to authorise repeats, or upload a current prescription.",
        403,
      );
    }
  }

  const origin = {
    lat: Number.isFinite(body.lat) ? body.lat! : pharmacy.lat,
    lng: Number.isFinite(body.lng) ? body.lng! : pharmacy.lng,
  };
  const distanceKm = pharmacyDistanceKm(pharmacy, origin);
  if (distanceKm > SERVICE_RADIUS_KM) {
    return bad(
      `${pharmacy.name} is ${distanceKm} km away and does not deliver to this address.`,
      409,
    );
  }

  const start = body.startDate && body.startDate > todayStr()
    ? body.startDate
    : addDays(todayStr(), intervalDays);

  const now = new Date().toISOString();
  const sub: Subscription = {
    id: newId("sub"),
    ref: `RD-${randomCode(5)}`,
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    pharmacyId: pharmacy.id,
    pharmacyName: pharmacy.name,
    address: body.address || customer.address || "—",
    locality: body.locality || customer.locality || "—",
    lat: origin.lat,
    lng: origin.lng,
    items,
    type,
    prescriptionId: prescription?.id,
    frequency,
    intervalDays,
    startDate: start,
    nextDate: start,
    skipNext: false,
    status: "ACTIVE",
    paymentMode: body.paymentMode ?? "COD",
    discountPct: REPEAT_DISCOUNT_PCT,
    deliveriesMade: 0,
    carePlanId: body.carePlanId,
    history: [
      {
        at: now,
        event: "CREATED",
        note: `${frequencyLabel({ frequency, intervalDays })} from ${pharmacy.name}, starting ${start}.`,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  await store.insert("subscriptions", sub);

  await notify(customer.id, {
    kind: "REPEAT",
    title: "Repeat delivery set up",
    body: `${sub.ref} · ${frequencyLabel(sub)} from ${pharmacy.name}. First delivery ${start}.`,
    href: `/subscriptions/${sub.id}`,
  });

  return ok({ subscription: sub }, 201);
}
