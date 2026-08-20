/**
 * Order creation, in one place.
 *
 * Three things now raise orders: a customer checking out, a repeat-delivery
 * schedule coming due, and an approved care plan. They must all pass exactly
 * the same compliance gates — a restricted medicine blocked at checkout but
 * waved through by the repeat runner would be worse than having no gate at
 * all, because nobody would be looking. So the gates live here and the callers
 * have none of their own.
 */

import { getStore } from "./db";
import { DEFAULT_ORIGIN, notify } from "./services";
import type {
  GeoPoint,
  InventoryItem,
  Medicine,
  Order,
  OrderItem,
  Pharmacy,
  Prescription,
  User,
} from "./types";
import { etaWindow, newId, orderCode, pharmacyDistanceKm } from "./utils";
import { SERVICE_RADIUS_KM } from "./zones";

export interface CreateOrderInput {
  customerId: string;
  pharmacyId: string;
  items: Array<{ medicineId: string; qty: number }>;
  prescriptionId?: string;
  paymentMode?: Order["paymentMode"];
  address?: string;
  locality?: string;
  origin?: GeoPoint;
  /** Repeat schedule that raised this order, when there is one. */
  subscriptionId?: string;
  carePlanId?: string;
  /** Subscriber saving, applied to the medicine subtotal. */
  discountPct?: number;
  /**
   * Spend one pharmacist-authorised refill. Only repeat deliveries do this;
   * a one-off checkout does not consume the customer's remaining refills.
   */
  consumeRefill?: boolean;
  /** Skips the customer notification — the caller sends a better one. */
  quiet?: boolean;
}

/** Why an order could not be raised. Callers map this to HTTP or to a pause. */
export type OrderFailure =
  | "PHARMACY_UNKNOWN"
  | "PHARMACY_CLOSED"
  | "CUSTOMER_UNKNOWN"
  | "RESTRICTED"
  | "RX_REQUIRED"
  | "RX_INVALID"
  | "RX_EXPIRED"
  | "RX_EXHAUSTED"
  | "OUT_OF_STOCK"
  | "OUT_OF_RANGE"
  | "BAD_REQUEST";

export type CreateOrderResult =
  | { ok: true; order: Order }
  | { ok: false; reason: OrderFailure; message: string; status: number };

const fail = (
  reason: OrderFailure,
  message: string,
  status = 400,
): CreateOrderResult => ({ ok: false, reason, message, status });

/** YYYY-MM-DD for "today", so date-only prescription validity compares cleanly. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  if (!input.pharmacyId || !input.items?.length) {
    return fail("BAD_REQUEST", "Pharmacy and items are required");
  }

  const store = await getStore();
  const [pharmacy, customer, medicines] = await Promise.all([
    store.one<Pharmacy>("pharmacies", { id: input.pharmacyId }),
    store.one<User>("users", { id: input.customerId }),
    store.list<Medicine>("medicines"),
  ]);

  if (!pharmacy) return fail("PHARMACY_UNKNOWN", "Pharmacy not found", 404);
  if (!pharmacy.verified || pharmacy.status !== "ACTIVE") {
    return fail("PHARMACY_CLOSED", "This pharmacy is not currently accepting orders", 409);
  }
  if (!customer) return fail("CUSTOMER_UNKNOWN", "Customer not found", 404);

  const medById = new Map(medicines.map((m) => [m.id, m]));

  /* ---------------------------------------------------------------------- */
  /* Compliance gate — the core safety rule of the platform.                */
  /* ---------------------------------------------------------------------- */

  const rxLines = input.items.filter((i) => medById.get(i.medicineId)?.type === "RX");
  const restricted = input.items.find((i) => medById.get(i.medicineId)?.restricted);

  if (restricted) {
    return fail(
      "RESTRICTED",
      "This medicine is classified as restricted/scheduled and cannot be dispensed through the app.",
      403,
    );
  }

  let prescription: Prescription | null = null;
  if (rxLines.length > 0) {
    if (!input.prescriptionId) {
      return fail(
        "RX_REQUIRED",
        "Prescription medicines require a pharmacist-verified prescription",
        403,
      );
    }
    prescription = await store.one<Prescription>("prescriptions", { id: input.prescriptionId });
    if (!prescription) return fail("RX_INVALID", "Prescription not found", 404);
    if (prescription.customerId !== input.customerId) {
      return fail("RX_INVALID", "This prescription belongs to another customer", 403);
    }
    if (prescription.status !== "APPROVED") {
      return fail("RX_INVALID", "Prescription has not been verified by a pharmacist yet", 403);
    }

    // Every Rx line must appear on the verified prescription.
    const approvedIds = new Set(
      prescription.extractedMedicines.map((m) => m.medicineId).filter(Boolean) as string[],
    );
    const stray = rxLines.find((l) => !approvedIds.has(l.medicineId));
    if (stray) {
      const name = medById.get(stray.medicineId)?.name ?? stray.medicineId;
      return fail("RX_INVALID", `${name} is not on the verified prescription`, 403);
    }

    // A prescription is not an open-ended licence to dispense. If the
    // pharmacist put an expiry on it, honour it — for one-off checkouts too,
    // not only for repeats.
    if (prescription.validUntil && prescription.validUntil < today()) {
      return fail(
        "RX_EXPIRED",
        `This prescription expired on ${prescription.validUntil}. Please upload a current one.`,
        403,
      );
    }

    if (input.consumeRefill) {
      const authorised = prescription.refillsAuthorised ?? 0;
      const used = prescription.refillsUsed ?? 0;
      if (used >= authorised) {
        return fail(
          "RX_EXHAUSTED",
          "No repeat dispensings remain on this prescription. A fresh prescription is needed.",
          403,
        );
      }
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Price + stock are always taken from the pharmacy's own shelf.          */
  /* ---------------------------------------------------------------------- */

  const items: OrderItem[] = [];
  for (const line of input.items) {
    const med = medById.get(line.medicineId);
    if (!med) return fail("BAD_REQUEST", `Unknown medicine ${line.medicineId}`, 404);
    const inv = await store.one<InventoryItem>("inventory", {
      pharmacyId: pharmacy.id,
      medicineId: line.medicineId,
    });
    const qty = Math.max(1, Number(line.qty) || 1);
    if (!inv || inv.stock < qty) {
      return fail(
        "OUT_OF_STOCK",
        `${med.name} is no longer available at ${pharmacy.name}`,
        409,
      );
    }
    items.push({
      medicineId: med.id,
      name: med.name,
      strength: med.strength,
      form: med.form,
      qty,
      price: inv.price,
      type: med.type,
    });
  }

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const discountPct = Math.max(0, Math.min(50, input.discountPct ?? 0));
  const discount = discountPct ? Math.round((subtotal * discountPct) / 100) : 0;

  const origin = input.origin ?? DEFAULT_ORIGIN;
  const distanceKm = pharmacyDistanceKm(pharmacy, origin);

  // Hyperlocal guarantee, enforced server-side: a pharmacy that cannot reach
  // this address in a sane delivery window must not be able to take the order,
  // even if a client asks for it directly.
  if (distanceKm > SERVICE_RADIUS_KM) {
    return fail(
      "OUT_OF_RANGE",
      `${pharmacy.name} is ${distanceKm} km away and does not deliver to this address. Please choose a pharmacy near you.`,
      409,
    );
  }

  const eta = etaWindow(distanceKm, pharmacy.prepMinutes);
  const createdAt = new Date();
  const paymentMode = input.paymentMode ?? "COD";

  const order: Order = {
    id: newId("ord"),
    code: orderCode(),
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    address: input.address || customer.address || "—",
    locality: input.locality || customer.locality || "—",
    pharmacyId: pharmacy.id,
    pharmacyName: pharmacy.name,
    type: rxLines.length ? "RX" : "OTC",
    prescriptionId: prescription?.id,
    items,
    subtotal,
    discount: discount || undefined,
    deliveryFee: pharmacy.deliveryFee,
    total: subtotal - discount + pharmacy.deliveryFee,
    paymentMode,
    paymentStatus: paymentMode !== "COD" ? "PAID" : "PENDING",
    distanceKm,
    etaMinFrom: eta.from,
    etaMinTo: eta.to,
    promisedFrom: new Date(createdAt.getTime() + eta.from * 60_000).toISOString(),
    promisedTo: new Date(createdAt.getTime() + eta.to * 60_000).toISOString(),
    status: "PLACED",
    history: [{ status: "PLACED", at: createdAt.toISOString() }],
    subscriptionId: input.subscriptionId,
    carePlanId: input.carePlanId,
    createdAt: createdAt.toISOString(),
  };

  await store.insert("orders", order);

  if (prescription) {
    await store.update<Prescription>("prescriptions", prescription.id, {
      orderId: order.id,
      ...(input.consumeRefill
        ? { refillsUsed: (prescription.refillsUsed ?? 0) + 1 }
        : {}),
    });
  }

  if (!input.quiet) {
    await notify(customer.id, {
      kind: "ORDER",
      title: "Order confirmed",
      body: `${order.code} placed with ${pharmacy.name}. Arriving in ${eta.from}–${eta.to} minutes.`,
      href: `/orders/${order.id}`,
    });
  }

  return { ok: true, order };
}
