/**
 * Repeat delivery ("subscriptions").
 *
 * A chronic patient should not have to re-place the same order twelve times a
 * year. But an automatic refill is exactly where a medicine platform can drift
 * out of compliance: dispensing a Schedule H medicine again and again against
 * one old prescription is a real exposure, not a paperwork detail.
 *
 * So a repeat schedule here is deliberately not "charge them monthly forever".
 * It draws down against refills a pharmacist explicitly authorised, it stops
 * itself the moment those run out or the prescription passes its expiry, and it
 * never silently switches pharmacy or quietly substitutes a medicine.
 */

import { getStore, type Store } from "./db";
import { addDays, isDue, todayStr, type RefillCover } from "./repeat-utils";
import { createOrder } from "./order-service";
import { notify } from "./services";
import type {
  Prescription,
  Subscription,
  SubscriptionEvent,
  SubscriptionStatus,
} from "./types";

// Re-exported so server code has one import site for the whole feature.
export * from "./repeat-utils";

/* -------------------------------------------------------------------------- */
/* prescription cover                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Can this schedule legally raise one more order right now?
 *
 * OTC baskets always can. An ℞ basket needs a live, verified prescription with
 * repeat authorisation left on it.
 */
export function checkRefillCover(
  sub: Pick<Subscription, "type">,
  prescription: Prescription | null,
  on: string = todayStr(),
): RefillCover {
  if (sub.type !== "RX") return { ok: true, remaining: Infinity };

  if (!prescription) {
    return { ok: false, remaining: 0, reason: "No prescription is linked to this repeat." };
  }
  if (prescription.status !== "APPROVED") {
    return {
      ok: false,
      remaining: 0,
      reason: "The linked prescription is not pharmacist-verified.",
    };
  }
  if (prescription.validUntil && prescription.validUntil < on) {
    return {
      ok: false,
      remaining: 0,
      validUntil: prescription.validUntil,
      reason: `The prescription expired on ${prescription.validUntil}.`,
    };
  }

  const remaining = (prescription.refillsAuthorised ?? 0) - (prescription.refillsUsed ?? 0);
  if (remaining <= 0) {
    return {
      ok: false,
      remaining: 0,
      validUntil: prescription.validUntil,
      reason: "All repeat dispensings authorised on this prescription have been used.",
    };
  }

  return { ok: true, remaining, validUntil: prescription.validUntil };
}

/* -------------------------------------------------------------------------- */
/* the runner                                                                 */
/* -------------------------------------------------------------------------- */

async function log(
  store: Store,
  sub: Subscription,
  event: SubscriptionEvent,
  patch: Partial<Subscription> = {},
): Promise<Subscription | null> {
  return store.update<Subscription>("subscriptions", sub.id, {
    history: [...sub.history, event].slice(-50),
    updatedAt: new Date().toISOString(),
    lastRunAt: new Date().toISOString(),
    ...patch,
  });
}

export interface RunOutcome {
  ref: string;
  subscriptionId: string;
  result: "ORDERED" | "SKIPPED" | "PAUSED_RX" | "OUT_OF_STOCK" | "FAILED";
  orderId?: string;
  note?: string;
}

/**
 * Processes one due schedule. Split out from runDueSubscriptions so a customer
 * can also press "deliver now" on a single schedule.
 */
export async function runSubscription(
  sub: Subscription,
  opts: { force?: boolean } = {},
): Promise<RunOutcome> {
  const store = await getStore();
  const now = new Date().toISOString();
  const on = todayStr();

  /* the customer asked to miss exactly one cycle ------------------------- */
  if (sub.skipNext && !opts.force) {
    const nextDate = addDays(sub.nextDate, sub.intervalDays);
    await log(
      store,
      sub,
      { at: now, event: "SKIPPED", note: `Cycle of ${sub.nextDate} skipped on request.` },
      { skipNext: false, nextDate },
    );
    await notify(sub.customerId, {
      kind: "REPEAT",
      title: "Repeat delivery skipped",
      body: `${sub.ref} skipped this cycle. Next delivery ${nextDate}.`,
      href: `/subscriptions/${sub.id}`,
    });
    return { ref: sub.ref, subscriptionId: sub.id, result: "SKIPPED", note: "Skipped on request" };
  }

  /* prescription cover --------------------------------------------------- */
  const prescription = sub.prescriptionId
    ? await store.one<Prescription>("prescriptions", { id: sub.prescriptionId })
    : null;
  const cover = checkRefillCover(sub, prescription, on);

  if (!cover.ok) {
    await log(
      store,
      sub,
      { at: now, event: "RX_REQUIRED", note: cover.reason },
      { status: "AWAITING_RX" satisfies SubscriptionStatus },
    );
    await notify(sub.customerId, {
      kind: "REPEAT",
      title: "Repeat delivery paused — prescription needed",
      body: `${sub.ref}: ${cover.reason} Upload a current prescription to resume.`,
      href: `/subscriptions/${sub.id}`,
    });
    return {
      ref: sub.ref,
      subscriptionId: sub.id,
      result: "PAUSED_RX",
      note: cover.reason,
    };
  }

  /* raise the order through the same gates as a manual checkout ---------- */
  const result = await createOrder({
    customerId: sub.customerId,
    pharmacyId: sub.pharmacyId,
    items: sub.items.map((i) => ({ medicineId: i.medicineId, qty: i.qty })),
    prescriptionId: sub.prescriptionId,
    paymentMode: sub.paymentMode,
    address: sub.address,
    locality: sub.locality,
    origin: { lat: sub.lat, lng: sub.lng },
    subscriptionId: sub.id,
    carePlanId: sub.carePlanId,
    discountPct: sub.discountPct,
    consumeRefill: sub.type === "RX",
    quiet: true,
  });

  if (!result.ok) {
    // Stock and range problems are the pharmacy's to fix, not the customer's
    // fault — hold the schedule where it is and tell them, rather than
    // silently moving the date or picking a different shop for them.
    const rxProblem = result.reason.startsWith("RX_");
    await log(
      store,
      sub,
      {
        at: now,
        event: rxProblem ? "RX_REQUIRED" : "OUT_OF_STOCK",
        note: result.message,
      },
      rxProblem ? { status: "AWAITING_RX" } : {},
    );
    await notify(sub.customerId, {
      kind: "REPEAT",
      title: rxProblem ? "Repeat delivery needs a prescription" : "Repeat delivery needs attention",
      body: `${sub.ref}: ${result.message}`,
      href: `/subscriptions/${sub.id}`,
    });
    return {
      ref: sub.ref,
      subscriptionId: sub.id,
      result: rxProblem ? "PAUSED_RX" : "OUT_OF_STOCK",
      note: result.message,
    };
  }

  const order = result.order;
  const nextDate = addDays(sub.nextDate > on ? sub.nextDate : on, sub.intervalDays);

  await log(
    store,
    sub,
    { at: now, event: "ORDER_PLACED", orderId: order.id, note: order.code },
    {
      nextDate,
      deliveriesMade: sub.deliveriesMade + 1,
      lastOrderId: order.id,
    },
  );

  const saved = order.discount ? ` You saved ${order.discount} on this cycle.` : "";
  await notify(sub.customerId, {
    kind: "REPEAT",
    title: "Repeat delivery on its way",
    body: `${order.code} placed with ${order.pharmacyName}.${saved} Next delivery ${nextDate}.`,
    href: `/orders/${order.id}`,
  });

  return { ref: sub.ref, subscriptionId: sub.id, result: "ORDERED", orderId: order.id };
}

/**
 * Processes every schedule that has come due.
 *
 * Vercel's cron would call this on a timer in production. The prototype also
 * calls it opportunistically whenever a customer or admin looks at their
 * schedules, so the demo works without waiting for a cron window.
 */
export async function runDueSubscriptions(limit = 25): Promise<RunOutcome[]> {
  const store = await getStore();
  const all = await store.list<Subscription>("subscriptions", { status: "ACTIVE" });
  const due = all.filter((s) => isDue(s)).slice(0, limit);

  const outcomes: RunOutcome[] = [];
  for (const sub of due) {
    try {
      outcomes.push(await runSubscription(sub));
    } catch (err) {
      outcomes.push({
        ref: sub.ref,
        subscriptionId: sub.id,
        result: "FAILED",
        note: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return outcomes;
}
