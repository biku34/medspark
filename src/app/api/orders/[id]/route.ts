import { bad, guard, ok, readJson } from "@/lib/api";
import { getStore } from "@/lib/db";
import { NEXT_STATUS, transitionOrder } from "@/lib/services";
import type { Order, OrderStatus, User } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if ("error" in g) return g.error;

  const { id } = await ctx.params;
  const store = await getStore();
  const order = await store.one<Order>("orders", { id });
  if (!order) return bad("Order not found", 404);

  const { session } = g;
  const mayView =
    session.role === "admin" ||
    (session.role === "customer" && order.customerId === session.userId) ||
    ((session.role === "pharmacy" || session.role === "pharmacist") &&
      order.pharmacyId === session.pharmacyId) ||
    session.role === "delivery";
  if (!mayView) return bad("Not allowed", 403);

  return ok({ order });
}

/**
 * PATCH /api/orders/:id
 *   { action: "accept" | "reject" | "ready" | "advance" | "cancel"
 *           | "assign" | "picked" | "delivered", note? }
 *
 * Which transitions a role may perform is enforced here, not in the UI.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if ("error" in g) return g.error;
  const { session } = g;

  const { id } = await ctx.params;
  const body = await readJson<{ action?: string; note?: string }>(req);
  const action = body?.action;
  if (!action) return bad("action required");

  const store = await getStore();
  const order = await store.one<Order>("orders", { id });
  if (!order) return bad("Order not found", 404);

  const isPharmacySide =
    (session.role === "pharmacy" || session.role === "pharmacist") &&
    order.pharmacyId === session.pharmacyId;

  switch (action) {
    /* ------------------------------- pharmacy ---------------------------- */
    case "accept": {
      if (!isPharmacySide && session.role !== "admin") return bad("Not allowed", 403);
      if (order.status !== "PLACED") return bad("Order is not awaiting acceptance", 409);
      const updated = await transitionOrder(id, "PREPARING", {
        note: body?.note ?? "Accepted by pharmacy",
      });
      return ok({ order: updated });
    }
    case "reject": {
      if (!isPharmacySide && session.role !== "admin") return bad("Not allowed", 403);
      const updated = await transitionOrder(id, "REJECTED", {
        note: body?.note ?? "Out of stock at pharmacy",
      });
      return ok({ order: updated });
    }
    case "ready": {
      if (!isPharmacySide && session.role !== "admin") return bad("Not allowed", 403);
      if (order.status !== "PREPARING") return bad("Order is not being prepared", 409);
      const updated = await transitionOrder(id, "READY", { note: body?.note });
      return ok({ order: updated });
    }

    /* ------------------------------- delivery ---------------------------- */
    case "assign": {
      if (session.role !== "delivery" && session.role !== "admin") return bad("Not allowed", 403);
      if (order.deliveryPartnerId && order.deliveryPartnerId !== session.userId) {
        return bad("Another delivery partner already accepted this pickup", 409);
      }
      const rider = await store.one<User>("users", { id: session.userId });
      const updated = await store.update<Order>("orders", id, {
        deliveryPartnerId: session.userId,
        deliveryPartnerName: rider?.name ?? session.name,
      });
      return ok({ order: updated });
    }
    case "picked": {
      if (session.role !== "delivery" && session.role !== "admin") return bad("Not allowed", 403);
      if (order.status !== "READY") return bad("Order is not ready for pickup yet", 409);
      const rider = await store.one<User>("users", { id: session.userId });
      const updated = await transitionOrder(id, "OUT_FOR_DELIVERY", {
        note: `Picked up by ${rider?.name ?? session.name}`,
        deliveryPartnerId: session.userId,
        deliveryPartnerName: rider?.name ?? session.name,
      });
      return ok({ order: updated });
    }
    case "delivered": {
      if (session.role !== "delivery" && session.role !== "admin") return bad("Not allowed", 403);
      if (order.status !== "OUT_FOR_DELIVERY") return bad("Order is not out for delivery", 409);
      const updated = await transitionOrder(id, "DELIVERED", { note: body?.note });
      return ok({ order: updated });
    }

    /* ------------------------------- customer ---------------------------- */
    case "cancel": {
      const isOwner = session.role === "customer" && order.customerId === session.userId;
      if (!isOwner && session.role !== "admin") return bad("Not allowed", 403);
      if (["OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status)) {
        return bad("Order can no longer be cancelled — please contact support", 409);
      }
      const updated = await transitionOrder(id, "CANCELLED", {
        note: body?.note ?? "Cancelled by customer",
      });
      return ok({ order: updated });
    }

    /* ------------- demo helper: push the order one step forward ---------- */
    case "advance": {
      const involved =
        session.role === "admin" ||
        order.customerId === session.userId ||
        isPharmacySide ||
        session.role === "delivery";
      if (!involved) return bad("Not allowed", 403);
      const next = NEXT_STATUS[order.status];
      if (!next) return bad("Order is already in a final state", 409);
      const patch: { note?: string; deliveryPartnerId?: string; deliveryPartnerName?: string } = {
        note: "Simulated in demo mode",
      };
      if (next === "OUT_FOR_DELIVERY" && !order.deliveryPartnerId) {
        const rider = await store.one<User>("users", { role: "delivery" });
        patch.deliveryPartnerId = rider?.id;
        patch.deliveryPartnerName = rider?.name;
      }
      const updated = await transitionOrder(id, next as OrderStatus, patch);
      return ok({ order: updated });
    }

    default:
      return bad(`Unknown action "${action}"`);
  }
}
