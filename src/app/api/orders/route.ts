import { bad, guard, ok, readJson } from "@/lib/api";
import { getStore } from "@/lib/db";
import { createOrder } from "@/lib/order-service";
import type { Order } from "@/lib/types";

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

/**
 * POST /api/orders — place an order with a chosen pharmacy.
 *
 * Every compliance and availability check lives in createOrder(), shared with
 * the repeat-delivery runner and care-plan scheduling.
 */
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

  const result = await createOrder({
    customerId: session.userId,
    pharmacyId: body.pharmacyId,
    items: body.items,
    prescriptionId: body.prescriptionId,
    paymentMode: body.paymentMode,
    address: body.address,
    locality: body.locality,
    origin:
      Number.isFinite(body.lat) && Number.isFinite(body.lng)
        ? { lat: body.lat!, lng: body.lng! }
        : undefined,
  });

  if (!result.ok) return bad(result.message, result.status);
  return ok({ order: result.order }, 201);
}
