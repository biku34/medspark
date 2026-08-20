import { bad, guard, ok, readJson } from "@/lib/api";
import { getStore } from "@/lib/db";
import { readPrescription } from "@/lib/ai/prescription";
import { aiEnabled } from "@/lib/ai/router";
import type { Prescription } from "@/lib/types";

export const dynamic = "force-dynamic";
// Two model round-trips; the default serverless window is not generous enough.
export const maxDuration = 60;

/**
 * POST /api/ai/prescription — draft the medicine lines on a prescription.
 *
 * Pharmacist-only, and deliberately so. The draft is a starting point on the
 * verification desk; it changes no status, authorises no refill and releases no
 * order. Everything this returns still has to be read, edited and approved by
 * the person whose licence is on the line.
 */
export async function POST(req: Request) {
  const g = await guard("pharmacist", "admin");
  if ("error" in g) return g.error;

  if (!aiEnabled()) {
    return bad("No AI provider is configured. Enter the lines by hand.", 503);
  }

  const body = await readJson<{
    prescriptionId?: string;
    /** PNG/JPEG base64, already rasterised and flattened by the client. */
    imageBase64?: string;
    mimeType?: string;
  }>(req);

  if (!body?.prescriptionId) return bad("A prescription is required");
  if (!body.imageBase64) {
    return bad("Send the rasterised page — the browser prepares it before upload");
  }

  const store = await getStore();
  const rx = await store.one<Prescription>("prescriptions", { id: body.prescriptionId });
  if (!rx) return bad("Prescription not found", 404);

  const draft = await readPrescription({
    mimeType: body.mimeType ?? "image/png",
    base64: body.imageBase64,
  });

  /* ---------------------------------------------------------------------- */
  /* The audit trail.                                                       */
  /*                                                                        */
  /* Stored on the prescription so a pharmacist — or anyone auditing a       */
  /* dispensing decision later — can see exactly what the models said, which */
  /* lines survived the filters, and which were thrown away.                 */
  /* ---------------------------------------------------------------------- */
  await store.update<Prescription>("prescriptions", rx.id, {
    aiDraft: {
      ...draft,
      // Never let the draft masquerade as a decision.
      appliedAt: undefined,
    },
  });

  return ok({ draft });
}
