/**
 * Drafting a care plan from the documents a customer uploaded.
 *
 * Higher value and higher risk than reading a prescription, so the constraints
 * are tighter, not looser:
 *
 *   - Medicines come from the catalogue or not at all, exactly as in the
 *     prescription pipeline, and a ℞ line can only be drafted if the attached
 *     prescription is already pharmacist-verified.
 *   - The model never computes a date. It says "3 visits, every 2 days,
 *     starting 1 day after discharge"; visitDates() in lib/care.ts turns that
 *     into actual dates. Anything a computer can work out exactly is not left
 *     to a language model.
 *   - "Stop taking this" is the most consequential thing a plan can say, so a
 *     stop is only drafted when the document itself says so, and it is flagged
 *     for the pharmacist rather than applied.
 *   - Nothing here proposes the plan to the customer or books anything. It
 *     fills the builder; the pharmacist edits and presses Send.
 */

import { getStore } from "../db";
import type {
  CarePlan,
  CarePlanFollowUp,
  CarePlanMedicine,
  CarePlanVisit,
  Medicine,
  Prescription,
  ReconciliationVerdict,
  ServiceType,
} from "../types";
import { MODELS, geminiJson, parseJson } from "./providers";
import { hasProvider } from "./router";

export interface CarePlanDraft {
  ok: boolean;
  summary: string;
  safetyNotes: string;
  medicines: CarePlanMedicine[];
  visits: CarePlanVisit[];
  followUps: CarePlanFollowUp[];
  /** Read from the documents but not matched to the catalogue. */
  unmatched: string[];
  notes: string[];
  models: string[];
  createdAt: string;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const int = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

const VERDICTS: ReconciliationVerdict[] = ["CONTINUE", "NEW", "DOSE_CHANGE", "STOP"];
const SLOTS = ["08:00-12:00", "10:00-11:00", "12:00-16:00", "16:00-17:00", "16:00-20:00"];

const SYSTEM = `You are assisting a licensed pharmacist who is building a home-care plan. A human will read, edit and approve everything you produce. You are not talking to the patient.

Absolute rules:
- Use ONLY what the documents say. Never infer a medicine, a dose, a diagnosis or an instruction that is not written down.
- You may ONLY reference catalogue ids that were given to you. Never invent one.
- Do not calculate dates. Say how many visits, how many days apart, and how many days after discharge to begin.
- Mark a medicine STOP only if a document explicitly says to stop it or it plainly conflicts with something else written there. Explain why in "note", quoting the document.
- If the documents do not support a field, leave it empty. An empty plan is a correct answer for an unreadable document.
- Never write dosing advice of your own. Copy the dose as written.

Return JSON only:
{"summary":"plain language, for the customer","safetyNotes":"allergies, interactions, when to call","medicines":[{"medicineId":"","reads":"verbatim text from the document","dosage":"","durationDays":0,"qtyPerCycle":1,"verdict":"CONTINUE|NEW|DOSE_CHANGE|STOP","repeat":false,"intervalDays":30,"note":""}],"visits":[{"serviceType":"NURSING|PHYSIO","reason":"","assistanceTypes":[],"hours":4,"visits":3,"everyDays":2,"startAfterDays":1,"note":""}],"followUps":[{"label":"","afterDays":14,"note":""}]}`;

/** YYYY-MM-DD, n days from today. Dates are ours, never the model's. */
function dateIn(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

let seq = 0;
const rid = (p: string) => `${p}_ai${Date.now().toString(36)}${++seq}`;

/**
 * Reads a plan's documents and fills the builder.
 *
 * The page arrives already rasterised and flattened by the browser, for the
 * same reason the prescription flow does it: documents are stored as SVG data
 * URLs, and a vision model needs PNG bytes. Doing it client-side also means a
 * real uploaded discharge summary gets the same greyscale contrast stretch.
 */
export async function draftCarePlan(
  plan: CarePlan,
  page: { mimeType: string; base64: string },
): Promise<CarePlanDraft> {
  const notes: string[] = [];
  const models: string[] = [];
  const createdAt = new Date().toISOString();

  const empty = (reason: string): CarePlanDraft => ({
    ok: false,
    summary: "",
    safetyNotes: "",
    medicines: [],
    visits: [],
    followUps: [],
    unmatched: [],
    notes: [reason],
    models,
    createdAt,
  });

  if (!hasProvider("gemini")) return empty("No vision provider is configured.");

  if (!page?.base64) return empty("No prepared page was supplied.");

  const store = await getStore();
  const catalogue = await store.list<Medicine>("medicines");
  const byId = new Map(catalogue.map((m) => [m.id, m]));

  /* ---------------------------------------------------------------------- */
  /* ℞ cover. A plan may only draft a prescription medicine when a           */
  /* pharmacist has already verified the script behind it — the same gate     */
  /* the propose action enforces, applied early so the draft cannot even      */
  /* suggest something that could never be sent.                             */
  /* ---------------------------------------------------------------------- */
  const prescription = plan.prescriptionId
    ? await store.one<Prescription>("prescriptions", { id: plan.prescriptionId })
    : null;
  const rxAllowed = prescription?.status === "APPROVED";
  const rxOnScript = new Set(
    (prescription?.extractedMedicines ?? [])
      .map((m) => m.medicineId)
      .filter((id): id is string => Boolean(id)),
  );

  const offerable = catalogue.filter((m) => !m.restricted);
  const catalogueBlock = offerable
    .map((m) => `${m.id}\t${m.name}\t${m.genericName}\t${m.strength}\t${m.form}\t${m.type}`)
    .join("\n");

  const context = [
    `Patient: ${plan.patientName}${plan.patientAge ? `, ${plan.patientAge}` : ""}`,
    plan.condition ? `Stated condition: ${plan.condition}` : "",
    plan.hospitalName ? `Hospital: ${plan.hospitalName}` : "",
    plan.dischargeDate ? `Discharged: ${plan.dischargeDate}` : "",
    plan.allergies ? `ALLERGIES: ${plan.allergies}` : "",
    plan.customerNote ? `What the family said: ${plan.customerNote}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  /* ---- read every document, then draft from all of them ---------------- */
  let parsed: Record<string, unknown>;
  try {
    // Gemini takes one image per call here; the first document is the one that
    // carries the plan (a discharge summary), the rest add context via text.
    const result = await geminiJson(
      {
        system: SYSTEM,
        prompt: `${context}

Catalogue (id<TAB>name<TAB>generic<TAB>strength<TAB>form<TAB>type):
${catalogueBlock}

Read the attached document and draft the plan. Quote the document in "reads" for every medicine line.`,
        image: { mimeType: page.mimeType, base64: page.base64 },
        maxTokens: 3072,
      },
      MODELS.vision,
    );
    models.push(`${result.provider}:${result.model}`);
    parsed = parseJson<Record<string, unknown>>(result);
  } catch (err) {
    return empty(err instanceof Error ? err.message : "Could not read the documents.");
  }

  if (plan.documents.length > 1) {
    notes.push(
      `${plan.documents.length - 1} further document(s) were not read — check them yourself.`,
    );
  }

  /* ---- medicines: closed vocabulary + ℞ gate --------------------------- */
  const medicines: CarePlanMedicine[] = [];
  const unmatched: string[] = [];

  for (const row of asArray(parsed.medicines)) {
    const id = str(row.medicineId);
    const med = id ? byId.get(id) : undefined;
    const reads = str(row.reads);

    if (!med || med.restricted) {
      if (reads) unmatched.push(reads);
      continue;
    }

    // A prescription medicine needs a verified script that actually lists it.
    if (med.type === "RX" && (!rxAllowed || !rxOnScript.has(med.id))) {
      unmatched.push(
        `${med.name} — ${rxAllowed ? "not on the verified prescription" : "no verified prescription attached"}`,
      );
      continue;
    }

    const verdictRaw = str(row.verdict).toUpperCase() as ReconciliationVerdict;
    const verdict: ReconciliationVerdict = VERDICTS.includes(verdictRaw) ? verdictRaw : "NEW";

    medicines.push({
      id: rid("cpm"),
      medicineId: med.id,
      name: med.name,
      strength: med.strength,
      dosage: str(row.dosage),
      durationDays: int(row.durationDays, 0, 365, 30),
      qtyPerCycle: int(row.qtyPerCycle, 0, 30, 1),
      type: med.type,
      reconciliation: verdict,
      repeat: verdict !== "STOP" && row.repeat === true,
      intervalDays: int(row.intervalDays, 3, 90, 30),
      note: str(row.note) || undefined,
    });

    if (verdict === "STOP") {
      notes.push(`"${med.name}" was drafted as STOP — check the document before sending.`);
    }
  }

  /* ---- visits: the model counts, we do the calendar -------------------- */
  const visits: CarePlanVisit[] = [];
  for (const row of asArray(parsed.visits)) {
    const type = str(row.serviceType).toUpperCase();
    if (type !== "NURSING" && type !== "PHYSIO") continue;

    const slot = SLOTS.includes(str(row.slot)) ? str(row.slot) : type === "PHYSIO" ? "16:00-17:00" : "08:00-12:00";
    // Never same-day: the advance-notice rule is the platform's, not the model's.
    const startAfter = Math.max(1, int(row.startAfterDays, 1, 60, 1));

    visits.push({
      id: rid("cpv"),
      serviceType: type as ServiceType,
      reason: type === "PHYSIO" ? str(row.reason) || undefined : undefined,
      assistanceTypes:
        type === "NURSING" && Array.isArray(row.assistanceTypes)
          ? (row.assistanceTypes as unknown[]).map(str).filter(Boolean).slice(0, 6)
          : [],
      hours: int(row.hours, 1, 12, type === "PHYSIO" ? 1 : 4),
      visits: int(row.visits, 1, 30, 3),
      everyDays: int(row.everyDays, 1, 30, 2),
      firstDate: dateIn(startAfter),
      slot,
      note: str(row.note) || undefined,
    });
  }

  /* ---- follow-ups ------------------------------------------------------ */
  const followUps: CarePlanFollowUp[] = [];
  for (const row of asArray(parsed.followUps)) {
    const label = str(row.label);
    if (!label) continue;
    followUps.push({
      id: rid("cpf"),
      label,
      dueDate: dateIn(int(row.afterDays, 1, 365, 14)),
      note: str(row.note) || undefined,
    });
  }

  if (plan.allergies) {
    notes.push(`Allergies on file: ${plan.allergies}. Check every drafted line against them.`);
  }

  const summary = str(parsed.summary);

  return {
    // A lab report carries no medicines, and refusing to invent any is the
    // pipeline working — so a grounded summary on its own still counts as a
    // useful draft rather than a failure.
    ok: Boolean(summary) || medicines.length > 0 || visits.length > 0 || followUps.length > 0,
    summary,
    safetyNotes: str(parsed.safetyNotes),
    medicines,
    visits,
    followUps,
    unmatched,
    notes,
    models,
    createdAt,
  };
}

function asArray(v: unknown): Array<Record<string, unknown>> {
  return Array.isArray(v) ? (v as Array<Record<string, unknown>>) : [];
}
