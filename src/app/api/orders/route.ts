import { bad, guard, ok, readJson } from "@/lib/api";
import { getStore } from "@/lib/db";
import { DEFAULT_ORIGIN, notify } from "@/lib/services";
import type {
  InventoryItem,
  Medicine,
  Order,
  OrderItem,
  Pharmacy,
  Prescription,
  User,
} from "@/lib/types";
import { etaWindow, newId, orderCode, pharmacyDistanceKm } from "@/lib/utils";
import { SERVICE_RADIUS_KM } from "@/lib/zones";

export const dynamic = "force-dynamic";

/** GET /api/orders — scoped to the caller's role. */
export async function GET(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  const { session } = g;

  const store = await getStore();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");

  let orders = await store.list<Order>("orders");

  if (session.role === "customer") {
    orders = orders.filter((o) => o.customerId === session.userId);
  } else if (session.role === "pharmacy" || session.role === "pharmacist") {
    orders = orders.filter((o) => o.pharmacyId === session.pharmacyId);
  } else if (session.role === "delivery") {
    // Riders see unassigned pickups plus their own runs.
    orders = orders.filter(
      (o) =>
        (!o.deliveryPartnerId && (o.status === "READY" || o.status === "PREPARING")) ||
        o.deliveryPartnerId === session.userId,
    );
  }

  if (status) orders = orders.filter((o) => o.status === status);
  orders.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  return ok({ orders });
}

/** POST /api/orders — place an order with a chosen pharmacy. */
export async function POST(req: Request) {
  const g = await guard("customer");
  if ("error" in g) return g.error;
  const { session } = g;

  const body = await readJson<{
    pharmacyId?: string;
    items?: Array<{ medicineId: string; qty: number }>;
    prescriptionId?: string;
    paymentMode?: Order["paymentMode"];
    address?: string;
    locality?: string;
    /** Customer coordinates, so the delivery distance is the real one. */
    lat?: number;
    lng?: number;
  }>(req);

  if (!body?.pharmacyId || !body.items?.length) return bad("Pharmacy and items are required");

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

  /* ---------------------------------------------------------------------- */
  /* Compliance gate — the core safety rule of the platform.                */
  /* ---------------------------------------------------------------------- */

  const rxLines = body.items.filter((i) => medById.get(i.medicineId)?.type === "RX");
  const restricted = body.items.find((i) => medById.get(i.medicineId)?.restricted);

  if (restricted) {
    return bad(
      "This medicine is classified as restricted/scheduled and cannot be dispensed through the app.",
      403,
    );
  }

  let prescription: Prescription | null = null;
  if (rxLines.length > 0) {
    if (!body.prescriptionId) {
      return bad("Prescription medicines require a pharmacist-verified prescription", 403);
    }
    prescription = await store.one<Prescription>("prescriptions", { id: body.prescriptionId });
    if (!prescription) return bad("Prescription not found", 404);
    if (prescription.customerId !== session.userId) {
      return bad("This prescription belongs to another customer", 403);
    }
    if (prescription.status !== "APPROVED") {
      return bad("Prescription has not been verified by a pharmacist yet", 403);
    }
    // Every Rx line must appear on the verified prescription.
    const approvedIds = new Set(
      prescription.extractedMedicines.map((m) => m.medicineId).filter(Boolean) as string[],
    );
    const stray = rxLines.find((l) => !approvedIds.has(l.medicineId));
    if (stray) {
      const name = medById.get(stray.medicineId)?.name ?? stray.medicineId;
      return bad(`${name} is not on the verified prescription`, 403);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Price + stock are always taken from the pharmacy's own shelf.          */
  /* ---------------------------------------------------------------------- */

  const items: OrderItem[] = [];
  for (const line of body.items) {
    const med = medById.get(line.medicineId);
    if (!med) return bad(`Unknown medicine ${line.medicineId}`, 404);
    const inv = await store.one<InventoryItem>("inventory", {
      pharmacyId: pharmacy.id,
      medicineId: line.medicineId,
    });
    const qty = Math.max(1, Number(line.qty) || 1);
    if (!inv || inv.stock < qty) {
      return bad(`${med.name} is no longer available at ${pharmacy.name}`, 409);
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
  const origin =
    Number.isFinite(body.lat) && Number.isFinite(body.lng)
      ? { lat: body.lat!, lng: body.lng! }
      : DEFAULT_ORIGIN;
  const distanceKm = pharmacyDistanceKm(pharmacy, origin);

  // Hyperlocal guarantee, enforced server-side: a pharmacy that cannot reach
  // this address in a sane delivery window must not be able to take the order,
  // even if a client asks for it directly.
  if (distanceKm > SERVICE_RADIUS_KM) {
    return bad(
      `${pharmacy.name} is ${distanceKm} km away and does not deliver to this address. Please choose a pharmacy near you.`,
      409,
    );
  }

  const eta = etaWindow(distanceKm, pharmacy.prepMinutes);
  const createdAt = new Date();

  const order: Order = {
    id: newId("ord"),
    code: orderCode(),
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    address: body.address || customer.address || "—",
    locality: body.locality || customer.locality || "—",
    pharmacyId: pharmacy.id,
    pharmacyName: pharmacy.name,
    type: rxLines.length ? "RX" : "OTC",
    prescriptionId: prescription?.id,
    items,
    subtotal,
    deliveryFee: pharmacy.deliveryFee,
    total: subtotal + pharmacy.deliveryFee,
    paymentMode: body.paymentMode ?? "COD",
    paymentStatus: body.paymentMode && body.paymentMode !== "COD" ? "PAID" : "PENDING",
    distanceKm,
    etaMinFrom: eta.from,
    etaMinTo: eta.to,
    promisedFrom: new Date(createdAt.getTime() + eta.from * 60_000).toISOString(),
    promisedTo: new Date(createdAt.getTime() + eta.to * 60_000).toISOString(),
    status: "PLACED",
    history: [{ status: "PLACED", at: createdAt.toISOString() }],
    createdAt: createdAt.toISOString(),
  };

  await store.insert("orders", order);

  if (prescription) {
    await store.update<Prescription>("prescriptions", prescription.id, { orderId: order.id });
  }

  await notify(customer.id, {
    kind: "ORDER",
    title: "Order confirmed",
    body: `${order.code} placed with ${pharmacy.name}. Arriving in ${eta.from}–${eta.to} minutes.`,
    href: `/orders/${order.id}`,
  });

  return ok({ order }, 201);
}
