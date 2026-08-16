import { bad, guard, ok, readJson } from "@/lib/api";
import { getStore } from "@/lib/db";
import { notify } from "@/lib/services";
import { isClosedBooking } from "@/lib/home-care";
import {
  SERVICE_META,
  bookingLabel,
  type BookingStatus,
  type ServiceBooking,
  type ServiceProvider,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if ("error" in g) return g.error;

  const { id } = await ctx.params;
  const store = await getStore();
  const booking = await store.one<ServiceBooking>("bookings", { id });
  if (!booking) return bad("Booking not found", 404);

  const { session } = g;
  const mine =
    session.role === "admin" ||
    booking.customerId === session.userId ||
    session.role === "provider";
  if (!mine) return bad("Not allowed", 403);

  const provider = booking.providerId
    ? await store.one<ServiceProvider>("providers", { id: booking.providerId })
    : null;

  return ok({ booking, provider });
}

/**
 * PATCH /api/bookings/:id
 *   provider: accept | reject | confirm | start_visit | complete
 *   customer: cancel | rate
 *   admin:    assign (to a named provider) | cancel
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if ("error" in g) return g.error;
  const { session } = g;

  const { id } = await ctx.params;
  const store = await getStore();
  const booking = await store.one<ServiceBooking>("bookings", { id });
  if (!booking) return bad("Booking not found", 404);

  const body = await readJson<{
    action?: string;
    note?: string;
    providerId?: string;
    rating?: number;
  }>(req);
  const action = body?.action;
  if (!action) return bad("action required");

  const me =
    session.role === "provider"
      ? await store.one<ServiceProvider>("providers", { userId: session.userId })
      : null;
  const isAssignedProvider = !!me && booking.providerId === me.id;
  const isOwner = booking.customerId === session.userId;
  const isAdmin = session.role === "admin";
  const meta = SERVICE_META[booking.serviceType];

  /** Applies a transition, appends history and notifies the customer. */
  const advance = async (
    status: BookingStatus,
    patch: Partial<ServiceBooking> = {},
    note?: string,
  ) => {
    const updated = await store.update<ServiceBooking>("bookings", id, {
      ...patch,
      status,
      history: [...booking.history, { status, at: new Date().toISOString(), note }],
    });
    await notify(booking.customerId, {
      kind: "ORDER",
      title: bookingLabel(booking.serviceType, status),
      body:
        status === "COMPLETED"
          ? `${booking.code} — visit completed. Thank you!`
          : `${booking.code} · ${booking.date} ${booking.slot}${
              patch.providerName ? ` · ${patch.providerName}` : ""
            }`,
      href: `/bookings/${id}`,
    });
    return updated;
  };

  switch (action) {
    /* ------------------------------ provider ----------------------------- */
    case "accept": {
      if (!me) return bad("Not allowed", 403);
      if (booking.providerId && booking.providerId !== me.id) {
        return bad("Another provider has already taken this booking", 409);
      }
      if (booking.status !== "REQUESTED") return bad("This booking is no longer open", 409);
      if (me.type !== booking.serviceType) return bad("Wrong service type for this booking", 409);
      if (!me.verified || me.status !== "ACTIVE") {
        return bad("Your profile must be verified before accepting bookings", 403);
      }
      const updated = await advance(
        "ASSIGNED",
        { providerId: me.id, providerName: me.name },
        `Accepted by ${me.name}`,
      );
      return ok({ booking: updated });
    }

    case "reject": {
      if (!me) return bad("Not allowed", 403);
      // Declining an unassigned request just leaves it for another provider.
      if (!booking.providerId) {
        return ok({ booking, declined: true });
      }
      if (!isAssignedProvider) return bad("Not allowed", 403);
      const updated = await advance("REJECTED", {}, body?.note ?? "Declined by provider");
      return ok({ booking: updated });
    }

    case "confirm": {
      if (!isAssignedProvider && !isAdmin) return bad("Not allowed", 403);
      if (booking.status !== "ASSIGNED") return bad("Booking is not awaiting confirmation", 409);
      const updated = await advance("CONFIRMED", {}, body?.note);
      return ok({ booking: updated });
    }

    case "start_visit": {
      if (!isAssignedProvider && !isAdmin) return bad("Not allowed", 403);
      if (booking.serviceType !== "NURSING") {
        return bad("Only nursing bookings have a separate visit stage", 409);
      }
      if (booking.status !== "CONFIRMED") return bad("Booking is not confirmed yet", 409);
      const updated = await advance("IN_VISIT", {}, body?.note);
      return ok({ booking: updated });
    }

    case "complete": {
      if (!isAssignedProvider && !isAdmin) return bad("Not allowed", 403);
      const allowedFrom: BookingStatus[] =
        booking.serviceType === "NURSING" ? ["IN_VISIT"] : ["CONFIRMED"];
      if (!allowedFrom.includes(booking.status)) {
        return bad(`Cannot complete a booking in state ${booking.status}`, 409);
      }
      const updated = await advance(
        "COMPLETED",
        { paymentStatus: "PAID" },
        body?.note ?? "Visit completed",
      );
      if (me) {
        await store.update<ServiceProvider>("providers", me.id, {
          completedVisits: me.completedVisits + 1,
        });
      }
      return ok({ booking: updated });
    }

    /* ------------------------------ customer ----------------------------- */
    case "cancel": {
      if (!isOwner && !isAdmin) return bad("Not allowed", 403);
      if (isClosedBooking(booking.status)) return bad("Booking is already closed", 409);
      if (booking.status === "IN_VISIT") {
        return bad("The visit is already in progress — please contact support", 409);
      }
      const updated = await store.update<ServiceBooking>("bookings", id, {
        status: "CANCELLED",
        history: [
          ...booking.history,
          {
            status: "CANCELLED" as BookingStatus,
            at: new Date().toISOString(),
            note: body?.note ?? (isOwner ? "Cancelled by customer" : "Cancelled by DawaQuick"),
          },
        ],
      });
      if (booking.providerId) {
        const provider = await store.one<ServiceProvider>("providers", {
          id: booking.providerId,
        });
        if (provider) {
          await notify(provider.userId, {
            kind: "ORDER",
            title: "Booking cancelled",
            body: `${booking.code} on ${booking.date} was cancelled.`,
            href: "/provider",
          });
        }
      }
      return ok({ booking: updated });
    }

    case "rate": {
      if (!isOwner) return bad("Not allowed", 403);
      if (booking.status !== "COMPLETED") return bad("You can rate after the visit", 409);
      const rating = Math.max(1, Math.min(5, Number(body?.rating ?? 0)));
      if (!rating) return bad("A rating between 1 and 5 is required");
      const updated = await store.update<ServiceBooking>("bookings", id, { rating });

      if (booking.providerId) {
        const provider = await store.one<ServiceProvider>("providers", {
          id: booking.providerId,
        });
        if (provider) {
          const count = provider.ratingCount + 1;
          const avg = (provider.rating * provider.ratingCount + rating) / count;
          await store.update<ServiceProvider>("providers", provider.id, {
            rating: Math.round(avg * 10) / 10,
            ratingCount: count,
          });
        }
      }
      return ok({ booking: updated });
    }

    /* -------------------------------- admin ------------------------------ */
    case "assign": {
      if (!isAdmin) return bad("Only an admin can assign a provider", 403);
      if (!body?.providerId) return bad("providerId required");
      const provider = await store.one<ServiceProvider>("providers", { id: body.providerId });
      if (!provider) return bad("Provider not found", 404);
      if (provider.type !== booking.serviceType) return bad("Wrong service type", 409);
      if (!provider.verified || provider.status !== "ACTIVE") {
        return bad("That provider is not active and verified", 409);
      }
      const updated = await advance(
        "ASSIGNED",
        { providerId: provider.id, providerName: provider.name },
        `Assigned by DawaQuick to ${provider.name}`,
      );
      await notify(provider.userId, {
        kind: "ORDER",
        title: `${meta.short} booking assigned to you`,
        body: `${booking.code} · ${booking.date} ${booking.slot} · ${booking.locality}`,
        href: "/provider",
      });
      return ok({ booking: updated });
    }

    default:
      return bad(`Unknown action "${action}"`);
  }
}
