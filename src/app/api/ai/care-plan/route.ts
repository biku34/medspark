import { bad, guard, ok, readJson } from "@/lib/api";
import { draftCarePlan } from "@/lib/ai/care-plan";
import { aiEnabled } from "@/lib/ai/router";
import { isEditableByCareTeam } from "@/lib/care";
import { getStore } from "@/lib/db";
import type { CarePlan } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/ai/care-plan — draft a plan from the uploaded documents.
 *
 * Care team only. It returns a draft for the builder and writes nothing to the
 * plan: it cannot propose to the customer, cannot schedule, cannot book. The
 * pharmacist saves what they agree with, which is the same path a hand-typed
 * plan takes.
 */
export async function POST(req: Request) {
  const g = await guard("pharmacist", "admin");
  if ("error" in g) return g.error;

  if (!aiEnabled()) {
    return bad("No AI provider is configured. Build the plan by hand.", 503);
  }

  const body = await readJson<{
    carePlanId?: string;
    /** PNG/JPEG base64 — the browser rasterises the stored document first. */
    imageBase64?: string;
    mimeType?: string;
  }>(req);
  if (!body?.carePlanId) return bad("A care plan is required");
  if (!body.imageBase64) {
    return bad("Send the rasterised page — the browser prepares it before upload");
  }

  const store = await getStore();
  const plan = await store.one<CarePlan>("carePlans", { id: body.carePlanId });
  if (!plan) return bad("Care plan not found", 404);

  // Drafting over a plan the customer has already approved would be a way to
  // change what they agreed to after the fact.
  if (!isEditableByCareTeam(plan.status)) {
    return bad("This plan is no longer editable", 409);
  }

  const draft = await draftCarePlan(plan, {
    mimeType: body.mimeType ?? "image/png",
    base64: body.imageBase64,
  });
  return ok({ draft });
}
