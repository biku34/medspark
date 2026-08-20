import { bad, guard, ok, readJson } from "@/lib/api";
import { getStore } from "@/lib/db";
import { notify } from "@/lib/services";
import type {
  Prescription,
  PrescriptionMedicine,
  VerificationCall,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if ("error" in g) return g.error;

  const { id } = await ctx.params;
  const store = await getStore();
  const prescription = await store.one<Prescription>("prescriptions", { id });
  if (!prescription) return bad("Prescription not found", 404);

  const { session } = g;
  if (session.role === "customer" && prescription.customerId !== session.userId) {
    return bad("Not allowed", 403);
  }
  return ok({ prescription });
}

/**
 * PATCH /api/prescriptions/:id
 *
 * Pharmacist actions: start_review | update_medicines | clarify | log_call |
 *                     approve | reject
 * Customer action:    reply (answer a clarification request)
 *
 * APPROVAL RULE: a prescription can only be approved after a verification call
 * has been logged with outcome VERIFIED. There is no bypass — the pharmacy
 * dashboard and the order API both refuse unverified prescriptions.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if ("error" in g) return g.error;
  const { session } = g;

  const { id } = await ctx.params;
  const store = await getStore();
  const rx = await store.one<Prescription>("prescriptions", { id });
  if (!rx) return bad("Prescription not found", 404);

  const body = await readJson<{
    action?: string;
    message?: string;
    note?: string;
    reason?: string;
    medicines?: PrescriptionMedicine[];
    call?: Partial<VerificationCall>;
    /** Repeat dispensings the pharmacist is willing to authorise. */
    refillsAuthorised?: number;
    /** YYYY-MM-DD after which this prescription may no longer be dispensed. */
    validUntil?: string;
  }>(req);

  const action = body?.action;
  const isPharmacist = session.role === "pharmacist" || session.role === "admin";

  /* ------------------------------- customer ----------------------------- */
  if (action === "reply") {
    if (session.role !== "customer" || rx.customerId !== session.userId) {
      return bad("Not allowed", 403);
    }
    const updated = await store.update<Prescription>("prescriptions", id, {
      status: "PENDING",
      note: `${rx.note ? rx.note + " · " : ""}Customer reply: ${body?.message ?? ""}`,
      clarificationMessage: undefined,
    });
    return ok({ prescription: updated });
  }

  if (!isPharmacist) return bad("Only a registered pharmacist can review prescriptions", 403);

  switch (action) {
    case "start_review": {
      const updated = await store.update<Prescription>("prescriptions", id, {
        status: "IN_REVIEW",
        verifiedById: session.userId,
        verifiedByName: session.name,
      });
      return ok({ prescription: updated });
    }

    case "update_medicines": {
      const updated = await store.update<Prescription>("prescriptions", id, {
        extractedMedicines: body?.medicines ?? [],
      });
      return ok({ prescription: updated });
    }

    case "clarify": {
      if (!body?.message?.trim()) return bad("Clarification message required");
      const updated = await store.update<Prescription>("prescriptions", id, {
        status: "CLARIFICATION",
        clarificationMessage: body.message.trim(),
        verifiedById: session.userId,
        verifiedByName: session.name,
      });
      await notify(rx.customerId, {
        kind: "PRESCRIPTION",
        title: "Pharmacist needs a clarification",
        body: `${rx.ref}: ${body.message.trim()}`,
        href: `/prescriptions/${rx.id}`,
      });
      return ok({ prescription: updated });
    }

    case "log_call": {
      const call: VerificationCall = {
        calledAt: new Date().toISOString(),
        durationSec: Math.max(0, Number(body?.call?.durationSec ?? 0)),
        checklist: {
          identity: !!body?.call?.checklist?.identity,
          medicine: !!body?.call?.checklist?.medicine,
          quantity: !!body?.call?.checklist?.quantity,
          prescriptionDetails: !!body?.call?.checklist?.prescriptionDetails,
          address: !!body?.call?.checklist?.address,
          orderConfirmed: !!body?.call?.checklist?.orderConfirmed,
        },
        outcome: body?.call?.outcome ?? "UNREACHABLE",
      };
      const updated = await store.update<Prescription>("prescriptions", id, {
        call,
        status: rx.status === "PENDING" ? "IN_REVIEW" : rx.status,
        verifiedById: session.userId,
        verifiedByName: session.name,
      });
      return ok({ prescription: updated });
    }

    case "approve": {
      if (!rx.call || rx.call.outcome !== "VERIFIED") {
        return bad(
          "Customer verification call must be completed before approval. Use “Call Customer for Verification” first.",
          409,
        );
      }
      const allChecked = Object.values(rx.call.checklist).every(Boolean);
      if (!allChecked) {
        return bad("All verification checks must be confirmed during the call", 409);
      }
      if (!body?.note?.trim()) return bad("A verification note is required");
      if (!rx.extractedMedicines.length) {
        return bad("Add at least one prescribed medicine before approving", 409);
      }

      /* --------------------------------------------------------------- */
      /* Repeat authorisation.                                            */
      /*                                                                  */
      /* A verified prescription is not an open-ended licence to dispense */
      /* forever. The pharmacist says how many repeats they are willing   */
      /* to cover and until when, and the repeat-delivery runner may only */
      /* draw down against those two numbers.                             */
      /* --------------------------------------------------------------- */
      const refillsAuthorised = Math.max(
        0,
        Math.min(12, Math.round(Number(body.refillsAuthorised ?? 0))),
      );
      const validUntil =
        typeof body.validUntil === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.validUntil)
          ? body.validUntil
          : undefined;

      if (refillsAuthorised > 0 && !validUntil) {
        return bad("Set an expiry date when authorising repeat dispensings", 422);
      }
      if (validUntil && validUntil <= new Date().toISOString().slice(0, 10)) {
        return bad("The expiry date must be in the future", 422);
      }

      const updated = await store.update<Prescription>("prescriptions", id, {
        status: "APPROVED",
        verificationNote: body.note.trim(),
        verifiedById: session.userId,
        verifiedByName: session.name,
        refillsAuthorised,
        refillsUsed: rx.refillsUsed ?? 0,
        validUntil,
        reviewedAt: new Date().toISOString(),
      });

      const repeatLine = refillsAuthorised
        ? ` ${refillsAuthorised} repeat dispensing(s) authorised until ${validUntil}.`
        : "";
      await notify(rx.customerId, {
        kind: "PRESCRIPTION",
        title: "Prescription verified ✓",
        body: `${rx.ref} was verified by ${session.name}. You can now choose a nearby pharmacy.${repeatLine}`,
        href: `/prescriptions/${rx.id}`,
      });
      return ok({ prescription: updated });
    }

    case "reject": {
      if (!body?.reason?.trim()) return bad("A rejection reason is required");
      const updated = await store.update<Prescription>("prescriptions", id, {
        status: "REJECTED",
        rejectionReason: body.reason.trim(),
        verifiedById: session.userId,
        verifiedByName: session.name,
        reviewedAt: new Date().toISOString(),
      });
      await notify(rx.customerId, {
        kind: "PRESCRIPTION",
        title: "Prescription could not be verified",
        body: `${rx.ref}: ${body.reason.trim()}`,
        href: `/prescriptions/${rx.id}`,
      });
      return ok({ prescription: updated });
    }

    default:
      return bad(`Unknown action "${action}"`);
  }
}
