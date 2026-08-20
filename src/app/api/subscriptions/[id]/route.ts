import { bad, guard, ok, readJson } from "@/lib/api";
import { getStore } from "@/lib/db";
import { notify } from "@/lib/services";
import {
  addDays,
  checkRefillCover,
  frequencyLabel,
  intervalFor,
  runSubscription,
  todayStr,
} from "@/lib/subscriptions";
import {
  type Order,
  type Pharmacy,
  type Prescription,
  type RepeatFrequency,
  type Subscription,
  type SubscriptionEvent,
} from "@/lib/types";
import { pharmacyDistanceKm } from "@/lib/utils";
import { SERVICE_RADIUS_KM } from "@/lib/zones";

export const dynamic = "force-dynamic";

type Action =
  | "pause"
  | "resume"
  | "skip_next"
  | "unskip"
  | "set_frequency"
  | "set_pharmacy"
  | "set_address"
  | "set_prescription"
  | "deliver_now"
  | "cancel";

async function load(id: string) {
  const store = await getStore();
  const sub = await store.one<Subscription>("subscriptions", { id });
  return { store, sub };
}

/** GET — one schedule, with its orders and prescription cover. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if ("error" in g) return g.error;
  const { session } = g;

  const { id } = await ctx.params;
  const { store, sub } = await load(id);
  if (!sub) return bad("Repeat delivery not found", 404);

  const mine =
    session.role === "admin" ||
    (session.role === "customer" && sub.customerId === session.userId) ||
    ((session.role === "pharmacy" || session.role === "pharmacist") &&
      sub.pharmacyId === session.pharmacyId);
  if (!mine) return bad("Not allowed", 403);

  const [allOrders, prescription] = await Promise.all([
    store.list<Order>("orders", { subscriptionId: sub.id }),
    sub.prescriptionId
      ? store.one<Prescription>("prescriptions", { id: sub.prescriptionId })
      : Promise.resolve(null),
  ]);

  const orders = allOrders.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  return ok({
    subscription: sub,
    orders,
    prescription,
    cover: checkRefillCover(sub, prescription),
  });
}

/** PATCH — the customer manages their own schedule. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("customer", "admin");
  if ("error" in g) return g.error;
  const { session } = g;

  const { id } = await ctx.params;
  const { store, sub } = await load(id);
  if (!sub) return bad("Repeat delivery not found", 404);
  if (session.role === "customer" && sub.customerId !== session.userId) {
    return bad("Not allowed", 403);
  }
  if (sub.status === "CANCELLED") return bad("This repeat delivery is already cancelled", 409);

  const body = await readJson<{
    action?: Action;
    frequency?: RepeatFrequency;
    customDays?: number;
    pharmacyId?: string;
    address?: string;
    locality?: string;
    lat?: number;
    lng?: number;
    prescriptionId?: string;
    note?: string;
  }>(req);

  const action = body?.action;
  if (!action) return bad("An action is required");

  const now = new Date().toISOString();
  const event = (e: SubscriptionEvent["event"], note?: string): SubscriptionEvent => ({
    at: now,
    event: e,
    note,
  });

  const save = async (patch: Partial<Subscription>, ev: SubscriptionEvent) => {
    const updated = await store.update<Subscription>("subscriptions", sub.id, {
      ...patch,
      history: [...sub.history, ev].slice(-50),
      updatedAt: now,
    });
    return ok({ subscription: updated });
  };

  switch (action) {
    case "pause":
      return save({ status: "PAUSED" }, event("PAUSED", "Paused by the customer."));

    case "resume": {
      // Coming back from a pause should not dump a backlog of missed cycles on
      // the customer — the next delivery is simply the next interval from now.
      const nextDate = sub.nextDate > todayStr() ? sub.nextDate : addDays(todayStr(), 1);

      if (sub.type === "RX") {
        const prescription = sub.prescriptionId
          ? await store.one<Prescription>("prescriptions", { id: sub.prescriptionId })
          : null;
        const cover = checkRefillCover(sub, prescription);
        if (!cover.ok) {
          return bad(`${cover.reason} Link a current prescription before resuming.`, 409);
        }
      }
      return save(
        { status: "ACTIVE", nextDate },
        event("RESUMED", `Resumed. Next delivery ${nextDate}.`),
      );
    }

    case "skip_next": {
      if (sub.status !== "ACTIVE") return bad("Only an active schedule can skip a cycle", 409);
      return save({ skipNext: true }, event("SKIPPED", `Will skip the ${sub.nextDate} cycle.`));
    }

    case "unskip":
      return save({ skipNext: false }, event("UPDATED", "Skip cancelled."));

    case "set_frequency": {
      const frequency = body.frequency ?? sub.frequency;
      const intervalDays = intervalFor(frequency, body.customDays ?? sub.intervalDays);
      const nextDate = addDays(todayStr(), Math.min(intervalDays, 7));
      return save(
        { frequency, intervalDays, nextDate },
        event(
          "UPDATED",
          `Now ${frequencyLabel({ frequency, intervalDays }).toLowerCase()}. Next delivery ${nextDate}.`,
        ),
      );
    }

    case "set_pharmacy": {
      if (!body.pharmacyId) return bad("A pharmacy is required");
      const pharmacy = await store.one<Pharmacy>("pharmacies", { id: body.pharmacyId });
      if (!pharmacy) return bad("Pharmacy not found", 404);
      if (!pharmacy.verified || pharmacy.status !== "ACTIVE") {
        return bad("That pharmacy is not currently accepting orders", 409);
      }
      const distanceKm = pharmacyDistanceKm(pharmacy, { lat: sub.lat, lng: sub.lng });
      if (distanceKm > SERVICE_RADIUS_KM) {
        return bad(`${pharmacy.name} is ${distanceKm} km away and does not deliver here.`, 409);
      }
      return save(
        { pharmacyId: pharmacy.id, pharmacyName: pharmacy.name },
        event("UPDATED", `Pharmacy changed to ${pharmacy.name}.`),
      );
    }

    case "set_address": {
      if (!body.address?.trim()) return bad("An address is required");
      const lat = Number.isFinite(body.lat) ? body.lat! : sub.lat;
      const lng = Number.isFinite(body.lng) ? body.lng! : sub.lng;

      // The chosen pharmacy has to still reach the new address, or the repeat
      // would quietly start failing every cycle.
      const pharmacy = await store.one<Pharmacy>("pharmacies", { id: sub.pharmacyId });
      if (pharmacy) {
        const distanceKm = pharmacyDistanceKm(pharmacy, { lat, lng });
        if (distanceKm > SERVICE_RADIUS_KM) {
          return bad(
            `${pharmacy.name} is ${distanceKm} km from that address. Choose a pharmacy nearer to it first.`,
            409,
          );
        }
      }
      return save(
        { address: body.address.trim(), locality: body.locality ?? sub.locality, lat, lng },
        event("UPDATED", "Delivery address updated."),
      );
    }

    case "set_prescription": {
      if (!body.prescriptionId) return bad("A prescription is required");
      const prescription = await store.one<Prescription>("prescriptions", {
        id: body.prescriptionId,
      });
      if (!prescription) return bad("Prescription not found", 404);
      if (prescription.customerId !== sub.customerId) return bad("Not your prescription", 403);
      if (prescription.status !== "APPROVED") {
        return bad("That prescription has not been verified by a pharmacist yet", 403);
      }
      const cover = checkRefillCover(sub, prescription);
      if (!cover.ok) return bad(cover.reason ?? "That prescription cannot cover a repeat", 409);

      const approvedIds = new Set(
        prescription.extractedMedicines.map((m) => m.medicineId).filter(Boolean) as string[],
      );
      const stray = sub.items.find((i) => i.type === "RX" && !approvedIds.has(i.medicineId));
      if (stray) return bad(`${stray.name} is not on that prescription`, 403);

      const nextDate = sub.nextDate > todayStr() ? sub.nextDate : addDays(todayStr(), 1);
      return save(
        { prescriptionId: prescription.id, status: "ACTIVE", nextDate },
        event("RESUMED", `Now covered by ${prescription.ref}. Next delivery ${nextDate}.`),
      );
    }

    case "deliver_now": {
      if (sub.status !== "ACTIVE") return bad("Only an active schedule can deliver now", 409);
      const outcome = await runSubscription({ ...sub, skipNext: false }, { force: true });
      if (outcome.result !== "ORDERED") {
        return bad(outcome.note ?? "Could not place this delivery", 409);
      }
      const updated = await store.one<Subscription>("subscriptions", { id: sub.id });
      return ok({ subscription: updated, orderId: outcome.orderId });
    }

    case "cancel": {
      await notify(sub.customerId, {
        kind: "REPEAT",
        title: "Repeat delivery cancelled",
        body: `${sub.ref} will not deliver again.`,
        href: "/subscriptions",
      });
      return save(
        { status: "CANCELLED", skipNext: false },
        event("CANCELLED", body.note?.trim() || "Cancelled by the customer."),
      );
    }

    default:
      return bad("Unknown action");
  }
}
