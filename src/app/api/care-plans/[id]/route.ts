import { bad, guard, ok, readJson } from "@/lib/api";
import { createBooking } from "@/lib/booking-service";
import {
  deliverableMedicines,
  isEditableByCareTeam,
  needsPrescription,
  repeatMedicines,
  validatePlanForProposal,
  visitDates,
} from "@/lib/care";
import { getStore } from "@/lib/db";
import { createOrder } from "@/lib/order-service";
import { notify } from "@/lib/services";
import { addDays, frequencyLabel, intervalFor, todayStr } from "@/lib/subscriptions";
import {
  REPEAT_DISCOUNT_PCT,
  type CarePlan,
  type CarePlanEvent,
  type CarePlanFollowUp,
  type CarePlanMedicine,
  type CarePlanStatus,
  type CarePlanVisit,
  type Pharmacy,
  type Prescription,
  type Subscription,
  type SubscriptionItem,
  type User,
} from "@/lib/types";
import { newId, randomCode } from "@/lib/utils";
import { pharmacyDistanceKm } from "@/lib/utils";
import { SERVICE_RADIUS_KM } from "@/lib/zones";

export const dynamic = "force-dynamic";

type Action =
  | "claim"
  | "save"
  | "propose"
  | "request_changes"
  | "approve"
  | "cancel"
  | "complete";

/** GET — one plan, plus whatever it has already created. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if ("error" in g) return g.error;
  const { session } = g;

  const { id } = await ctx.params;
  const store = await getStore();
  const plan = await store.one<CarePlan>("carePlans", { id });
  if (!plan) return bad("Care plan not found", 404);

  const mine =
    session.role === "admin" ||
    session.role === "pharmacist" ||
    (session.role === "customer" && plan.customerId === session.userId);
  if (!mine) return bad("Not allowed", 403);

  const prescription = plan.prescriptionId
    ? await store.one<Prescription>("prescriptions", { id: plan.prescriptionId })
    : null;

  return ok({ carePlan: plan, prescription });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if ("error" in g) return g.error;
  const { session } = g;

  const { id } = await ctx.params;
  const store = await getStore();
  const plan = await store.one<CarePlan>("carePlans", { id });
  if (!plan) return bad("Care plan not found", 404);

  const body = await readJson<{
    action?: Action;
    summary?: string;
    safetyNotes?: string;
    medicines?: CarePlanMedicine[];
    visits?: CarePlanVisit[];
    followUps?: CarePlanFollowUp[];
    note?: string;
    /* approval payload */
    pharmacyId?: string;
    address?: string;
    locality?: string;
    city?: string;
    lat?: number;
    lng?: number;
    paymentMode?: "COD" | "UPI" | "CARD";
    startRepeat?: boolean;
  }>(req);

  const action = body?.action;
  if (!action) return bad("An action is required");

  const isCareTeam = session.role === "pharmacist" || session.role === "admin";
  const isOwner = session.role === "customer" && plan.customerId === session.userId;
  if (!isCareTeam && !isOwner) return bad("Not allowed", 403);

  const now = new Date().toISOString();
  const actor = session.name ?? session.role;

  const commit = async (patch: Partial<CarePlan>, event?: CarePlanEvent) => {
    const updated = await store.update<CarePlan>("carePlans", plan.id, {
      ...patch,
      updatedAt: now,
      ...(event ? { history: [...plan.history, event].slice(-60) } : {}),
    });
    return ok({ carePlan: updated });
  };

  /* ====================================================================== */
  /* Care team                                                              */
  /* ====================================================================== */

  if (action === "claim") {
    if (!isCareTeam) return bad("Not allowed", 403);
    if (!isEditableByCareTeam(plan.status)) return bad("This plan is no longer editable", 409);
    return commit(
      {
        status: "IN_REVIEW",
        coordinatorId: session.userId,
        coordinatorName: session.name,
      },
      { status: "IN_REVIEW", at: now, by: actor, note: "Care team started the review." },
    );
  }

  if (action === "save") {
    if (!isCareTeam) return bad("Not allowed", 403);
    if (!isEditableByCareTeam(plan.status)) return bad("This plan is no longer editable", 409);
    return commit({
      summary: body.summary,
      safetyNotes: body.safetyNotes,
      medicines: body.medicines ?? plan.medicines,
      visits: body.visits ?? plan.visits,
      followUps: body.followUps ?? plan.followUps,
      coordinatorId: plan.coordinatorId ?? session.userId,
      coordinatorName: plan.coordinatorName ?? session.name,
      status: plan.status === "SUBMITTED" ? "IN_REVIEW" : plan.status,
    });
  }

  if (action === "propose") {
    if (!isCareTeam) return bad("Not allowed", 403);
    if (!isEditableByCareTeam(plan.status)) return bad("This plan is no longer editable", 409);

    const draft = {
      summary: body.summary ?? plan.summary,
      medicines: body.medicines ?? plan.medicines,
      visits: body.visits ?? plan.visits,
      followUps: body.followUps ?? plan.followUps,
    };

    const problems = validatePlanForProposal(draft);
    if (problems.length) {
      return bad(problems.map((p) => p.message).join(" "), 422);
    }

    /* ------------------------------------------------------------------ */
    /* An ℞ line may only be proposed once its prescription is verified.  */
    /* ------------------------------------------------------------------ */
    if (needsPrescription({ medicines: draft.medicines })) {
      const prescription = plan.prescriptionId
        ? await store.one<Prescription>("prescriptions", { id: plan.prescriptionId })
        : null;
      if (!prescription) {
        return bad(
          "This plan contains prescription medicines but no prescription is attached. Ask the customer to upload one.",
          409,
        );
      }
      if (prescription.status !== "APPROVED") {
        return bad(
          `Verify prescription ${prescription.ref} before sending this plan to the customer.`,
          409,
        );
      }
    }

    await commit(
      {
        ...draft,
        safetyNotes: body.safetyNotes ?? plan.safetyNotes,
        status: "PLAN_READY",
        changeRequest: undefined,
      },
      { status: "PLAN_READY", at: now, by: actor, note: "Plan sent to the customer." },
    );

    await notify(plan.customerId, {
      kind: "CARE_PLAN",
      title: "Your care plan is ready",
      body: `${plan.ref}: ${draft.medicines.length} medicine(s), ${draft.visits.length} visit course(s). Review and approve to schedule it.`,
      href: `/care/${plan.id}`,
    });

    const updated = await store.one<CarePlan>("carePlans", { id: plan.id });
    return ok({ carePlan: updated });
  }

  if (action === "complete") {
    if (!isCareTeam) return bad("Not allowed", 403);
    return commit(
      { status: "COMPLETED" },
      { status: "COMPLETED", at: now, by: actor, note: body.note?.trim() },
    );
  }

  /* ====================================================================== */
  /* Customer                                                               */
  /* ====================================================================== */

  if (action === "request_changes") {
    if (!isOwner) return bad("Only the customer can request changes", 403);
    if (plan.status !== "PLAN_READY") return bad("There is no plan awaiting your answer", 409);
    if (!body.note?.trim()) return bad("Tell the care team what you'd like changed");

    await commit(
      { status: "CHANGES_REQUESTED", changeRequest: body.note.trim() },
      { status: "CHANGES_REQUESTED", at: now, by: actor, note: body.note.trim() },
    );

    if (plan.coordinatorId) {
      await notify(plan.coordinatorId, {
        kind: "CARE_PLAN",
        title: "Customer asked for changes",
        body: `${plan.ref}: ${body.note.trim()}`,
        href: `/pharmacist/care-plans/${plan.id}`,
      });
    }
    const updated = await store.one<CarePlan>("carePlans", { id: plan.id });
    return ok({ carePlan: updated });
  }

  if (action === "cancel") {
    if (!isOwner && !isCareTeam) return bad("Not allowed", 403);
    return commit(
      { status: "CANCELLED" },
      { status: "CANCELLED", at: now, by: actor, note: body.note?.trim() },
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Approval — the only place a care plan turns into real work.            */
  /* ---------------------------------------------------------------------- */
  if (action === "approve") {
    if (!isOwner) return bad("Only the customer can approve their care plan", 403);
    if (plan.status !== "PLAN_READY") return bad("This plan is not awaiting approval", 409);

    const customer = await store.one<User>("users", { id: plan.customerId });
    if (!customer) return bad("Customer not found", 404);

    const address = body.address?.trim() || customer.address || "";
    const locality = body.locality || customer.locality || "—";
    if (!address) return bad("A delivery address is required");

    const meds = deliverableMedicines(plan);
    const repeats = repeatMedicines(plan);

    /* Medicines: the customer picks the pharmacy. Always. ---------------- */
    let pharmacy: Pharmacy | null = null;
    if (meds.length) {
      if (!body.pharmacyId) {
        return bad("Choose the pharmacy that should dispense your medicines", 400);
      }
      pharmacy = await store.one<Pharmacy>("pharmacies", { id: body.pharmacyId });
      if (!pharmacy) return bad("Pharmacy not found", 404);
      if (!pharmacy.verified || pharmacy.status !== "ACTIVE") {
        return bad("That pharmacy is not currently accepting orders", 409);
      }
      const origin = {
        lat: Number.isFinite(body.lat) ? body.lat! : pharmacy.lat,
        lng: Number.isFinite(body.lng) ? body.lng! : pharmacy.lng,
      };
      const distanceKm = pharmacyDistanceKm(pharmacy, origin);
      if (distanceKm > SERVICE_RADIUS_KM) {
        return bad(`${pharmacy.name} is ${distanceKm} km away and does not deliver here.`, 409);
      }
    }

    const origin = {
      lat: Number.isFinite(body.lat) ? body.lat! : pharmacy?.lat ?? 23.227,
      lng: Number.isFinite(body.lng) ? body.lng! : pharmacy?.lng ?? 72.642,
    };

    const orderIds: string[] = [];
    const bookingIds: string[] = [];
    const subscriptionIds: string[] = [];
    const problems: string[] = [];

    /* 1 — the first delivery of medicines --------------------------------- */
    if (pharmacy && meds.length) {
      const result = await createOrder({
        customerId: plan.customerId,
        pharmacyId: pharmacy.id,
        items: meds.map((m) => ({ medicineId: m.medicineId!, qty: m.qtyPerCycle })),
        prescriptionId: plan.prescriptionId,
        paymentMode: body.paymentMode ?? "COD",
        address,
        locality,
        origin,
        carePlanId: plan.id,
        quiet: true,
      });
      if (result.ok) orderIds.push(result.order.id);
      else problems.push(result.message);
    }

    /* 2 — the repeat schedule, when the care team suggested one ----------- */
    if (pharmacy && repeats.length && body.startRepeat !== false) {
      const intervalDays = intervalFor(
        "CUSTOM",
        repeats[0]?.intervalDays ?? repeats[0]?.durationDays ?? 30,
      );
      const items: SubscriptionItem[] = repeats.map((m) => ({
        medicineId: m.medicineId!,
        name: m.name,
        strength: m.strength ?? "",
        form: "",
        qty: m.qtyPerCycle,
        type: m.type,
      }));
      const type = items.some((i) => i.type === "RX") ? "RX" : "OTC";

      // An ℞ repeat needs pharmacist-authorised refills left on the script.
      let coverOk = true;
      if (type === "RX") {
        const prescription = plan.prescriptionId
          ? await store.one<Prescription>("prescriptions", { id: plan.prescriptionId })
          : null;
        const remaining =
          (prescription?.refillsAuthorised ?? 0) - (prescription?.refillsUsed ?? 0);
        coverOk = Boolean(prescription && prescription.status === "APPROVED" && remaining > 0);
        if (!coverOk) {
          problems.push(
            "Repeat delivery was not started: the prescription has no repeat dispensings authorised.",
          );
        }
      }

      if (coverOk) {
        const start = addDays(todayStr(), intervalDays);
        const sub: Subscription = {
          id: newId("sub"),
          ref: `RD-${randomCode(5)}`,
          customerId: plan.customerId,
          customerName: plan.customerName,
          customerPhone: plan.customerPhone,
          pharmacyId: pharmacy.id,
          pharmacyName: pharmacy.name,
          address,
          locality,
          lat: origin.lat,
          lng: origin.lng,
          items,
          type,
          prescriptionId: plan.prescriptionId,
          frequency: "CUSTOM",
          intervalDays,
          startDate: start,
          nextDate: start,
          skipNext: false,
          status: "ACTIVE",
          paymentMode: body.paymentMode ?? "COD",
          discountPct: REPEAT_DISCOUNT_PCT,
          deliveriesMade: 0,
          carePlanId: plan.id,
          history: [
            {
              at: now,
              event: "CREATED",
              note: `Started from care plan ${plan.ref} — ${frequencyLabel({ frequency: "CUSTOM", intervalDays })}.`,
            },
          ],
          createdAt: now,
          updatedAt: now,
        };
        await store.insert("subscriptions", sub);
        subscriptionIds.push(sub.id);
      }
    }

    /* 3 — the home visits ------------------------------------------------- */
    for (const visit of plan.visits) {
      for (const date of visitDates(visit)) {
        const result = await createBooking({
          customerId: plan.customerId,
          serviceType: visit.serviceType,
          date,
          slot: visit.slot,
          hours: visit.hours,
          address,
          locality,
          city: body.city,
          lat: origin.lat,
          lng: origin.lng,
          patientName: plan.patientName,
          reason: visit.reason,
          assistanceTypes: visit.assistanceTypes,
          patientNotes: visit.note ?? plan.summary,
          paymentMode: body.paymentMode ?? "COD",
          carePlanId: plan.id,
          quiet: true,
        });
        if (result.ok) bookingIds.push(result.booking.id);
        else problems.push(`${date}: ${result.message}`);
      }
    }

    if (!orderIds.length && !bookingIds.length && !subscriptionIds.length) {
      return bad(
        problems.length ? problems.join(" ") : "Nothing in this plan could be scheduled.",
        409,
      );
    }

    const noteParts = [
      orderIds.length ? `${orderIds.length} order` : null,
      subscriptionIds.length ? `${subscriptionIds.length} repeat delivery` : null,
      bookingIds.length ? `${bookingIds.length} home visit(s)` : null,
    ].filter(Boolean);

    await store.update<CarePlan>("carePlans", plan.id, {
      status: "ACTIVE" satisfies CarePlanStatus,
      approvedAt: now,
      scheduled: {
        orderIds: [...plan.scheduled.orderIds, ...orderIds],
        bookingIds: [...plan.scheduled.bookingIds, ...bookingIds],
        subscriptionIds: [...plan.scheduled.subscriptionIds, ...subscriptionIds],
      },
      updatedAt: now,
      history: [
        ...plan.history,
        {
          status: "ACTIVE" as CarePlanStatus,
          at: now,
          by: actor,
          note: `Approved by the customer — scheduled ${noteParts.join(", ")}.`,
        },
      ].slice(-60),
    });

    await notify(plan.customerId, {
      kind: "CARE_PLAN",
      title: "Care plan approved",
      body: `${plan.ref} is active — scheduled ${noteParts.join(", ")}.`,
      href: `/care/${plan.id}`,
    });

    if (plan.coordinatorId) {
      await notify(plan.coordinatorId, {
        kind: "CARE_PLAN",
        title: "Care plan approved",
        body: `${plan.ref} approved by ${plan.customerName}.`,
        href: `/pharmacist/care-plans/${plan.id}`,
      });
    }

    const updated = await store.one<CarePlan>("carePlans", { id: plan.id });
    return ok({ carePlan: updated, scheduled: { orderIds, bookingIds, subscriptionIds }, problems });
  }

  return bad("Unknown action");
}
