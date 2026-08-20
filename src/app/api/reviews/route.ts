import { bad, guard, ok, readJson } from "@/lib/api";
import { getStore } from "@/lib/db";
import { summariseRatings } from "@/lib/services";
import type { Order, Pharmacy, Review } from "@/lib/types";
import { newId } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/reviews?medicineId=…  |  ?pharmacyId=…  |  ?orderId=…
 *
 * Public: the point of a review is that people who have not bought yet can
 * read it.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const medicineId = url.searchParams.get("medicineId");
  const pharmacyId = url.searchParams.get("pharmacyId");
  const orderId = url.searchParams.get("orderId");

  const store = await getStore();
  const filter = medicineId
    ? { medicineId }
    : pharmacyId
      ? { pharmacyId }
      : orderId
        ? { orderId }
        : null;
  if (!filter) return bad("Ask for reviews of a medicine, a pharmacy or an order");

  const reviews = (await store.list<Review>("reviews", filter)).sort(
    (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
  );

  return ok({
    reviews: reviews.slice(0, 50),
    summary: summariseRatings(reviews.map((r) => r.rating)),
  });
}

/**
 * POST /api/reviews — rate a delivered order.
 *
 * The order is the proof of purchase, so it carries every rule: it has to be
 * yours, it has to have arrived, any medicine rated has to have been in it,
 * and it can only be rated once.
 */
export async function POST(req: Request) {
  const g = await guard("customer");
  if ("error" in g) return g.error;
  const { session } = g;

  const body = await readJson<{
    orderId?: string;
    rating?: number;
    text?: string;
    /** Ratings for individual lines, keyed by medicine id. */
    items?: Record<string, number>;
  }>(req);

  if (!body?.orderId) return bad("An order is required");

  const rating = Math.round(Number(body.rating));
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return bad("Give the order a rating between 1 and 5");
  }

  const store = await getStore();
  const order = await store.one<Order>("orders", { id: body.orderId });
  if (!order) return bad("Order not found", 404);
  if (order.customerId !== session.userId) return bad("That is not your order", 403);
  if (order.status !== "DELIVERED") {
    return bad("You can rate an order once it has been delivered", 409);
  }

  const already = await store.list<Review>("reviews", { orderId: order.id });
  if (already.length > 0) return bad("You have already rated this order", 409);

  const now = new Date().toISOString();
  const base = {
    orderId: order.id,
    customerId: session.userId,
    customerName: order.customerName,
    pharmacyId: order.pharmacyId,
    createdAt: now,
  };

  const written: Review[] = [];

  // The service rating, against the pharmacy that dispensed.
  const serviceReview: Review = {
    id: newId("rev"),
    ...base,
    rating,
    text: body.text?.trim() || undefined,
  };
  await store.insert("reviews", serviceReview);
  written.push(serviceReview);

  // Per-medicine ratings, but only for lines that were actually in the order.
  const inOrder = new Set(order.items.map((i) => i.medicineId));
  for (const [medicineId, value] of Object.entries(body.items ?? {})) {
    if (!inOrder.has(medicineId)) continue;
    const v = Math.round(Number(value));
    if (!Number.isFinite(v) || v < 1 || v > 5) continue;
    const itemReview: Review = { id: newId("rev"), ...base, medicineId, rating: v };
    await store.insert("reviews", itemReview);
    written.push(itemReview);
  }

  /* ---------------------------------------------------------------------- */
  /* Keep the pharmacy's headline rating honest.                            */
  /*                                                                        */
  /* The seed ships each shop a plausible rating and count; folding the new  */
  /* score into that running average is what a real deployment does, rather  */
  /* than throwing away history the moment the first review lands.          */
  /* ---------------------------------------------------------------------- */
  const pharmacy = await store.one<Pharmacy>("pharmacies", { id: order.pharmacyId });
  if (pharmacy) {
    const count = pharmacy.ratingCount + 1;
    const average = (pharmacy.rating * pharmacy.ratingCount + rating) / count;
    await store.update<Pharmacy>("pharmacies", pharmacy.id, {
      rating: Math.round(average * 10) / 10,
      ratingCount: count,
    });
  }

  return ok({ reviews: written }, 201);
}
