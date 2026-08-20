/**
 * Reading a prescription with AI, without letting it invent one.
 *
 * No model is promised not to hallucinate. What this pipeline guarantees is
 * that a hallucination cannot become a dispensable line, through four filters
 * that a wrong answer has to survive:
 *
 *   1. Closed vocabulary — a line only exists if it maps to a medicine already
 *      in the catalogue. Free text is never dispensable.
 *   2. Verbatim grounding — every line must quote the text it was read from,
 *      and that quote must actually appear in the transcription. A model
 *      cannot cite words that are not there.
 *   3. Two independent opinions — Gemini reads the image; Groq is shown only
 *      the transcription and maps it to the catalogue on its own. The step that
 *      matters (which product, what dose) gets two votes from two vendors.
 *   4. The human gate, untouched — everything here is a draft on the
 *      pharmacist's desk. Nothing in this file can approve, dispense, or set a
 *      refill count.
 *
 * A line both models agree on is marked high confidence. A line only one found
 * is still shown, flagged, and never pre-ticked.
 */

import { getStore } from "../db";
import type { Medicine, PrescriptionMedicine } from "../types";
import { MODELS, geminiJson, groqJson, parseJson, type AiResult } from "./providers";
import { hasProvider } from "./router";

/* -------------------------------------------------------------------------- */
/* shapes                                                                     */
/* -------------------------------------------------------------------------- */

interface RawLine {
  /** Exactly as written on the document. */
  sourceText?: unknown;
  name?: unknown;
  strength?: unknown;
  dosage?: unknown;
  quantity?: unknown;
}

interface RawRead {
  unreadable?: unknown;
  transcription?: unknown;
  doctorName?: unknown;
  patientName?: unknown;
  lines?: unknown;
}

export interface DraftLine extends PrescriptionMedicine {
  /** The words on the page this line came from. */
  sourceText: string;
  /** Both models landed on the same catalogue medicine. */
  agreed: boolean;
  /** Which models proposed it. */
  proposedBy: string[];
}

export interface PrescriptionDraft {
  ok: boolean;
  unreadable: boolean;
  transcription: string;
  doctorName?: string;
  patientName?: string;
  lines: DraftLine[];
  /** Text the models read but that matched nothing in the catalogue. */
  unmatched: string[];
  notes: string[];
  models: string[];
  createdAt: string;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(30, Math.round(n)) : 1;
};

/* -------------------------------------------------------------------------- */
/* prompts                                                                    */
/* -------------------------------------------------------------------------- */

const READ_SYSTEM = `You transcribe medical prescriptions for a licensed pharmacist who will check your work.

Absolute rules:
- Transcribe only what is visibly written. Never infer, complete, correct or guess a medicine name, strength or dose.
- If the image is blurry, cropped, or is not a prescription, set "unreadable": true and return no lines.
- For every line, "sourceText" must be the exact characters you read, copied verbatim from the page.
- If a field is not written on the page, use an empty string. Do not fill it from typical practice.
- Never add a medicine that is not written down, however common it would be for the condition.

Return JSON only:
{"unreadable":false,"transcription":"<everything you can read, verbatim>","doctorName":"","patientName":"","lines":[{"sourceText":"","name":"","strength":"","dosage":"","quantity":1}]}`;

const MATCH_SYSTEM = `You map prescription text to a fixed product catalogue for a pharmacy.

Absolute rules:
- You may ONLY return ids that appear in the catalogue given to you. Never invent an id.
- Match on the active ingredient and strength. If the text does not clearly match a catalogue entry, omit that line rather than returning the closest guess.
- A wrong match is far worse than no match.
- Refer to each line by the exact label it was given (L1, L2, ...). Do not echo the text back.

Return JSON only:
{"matches":[{"line":"L1","medicineId":"","confident":true}]}`;

/* -------------------------------------------------------------------------- */
/* the pipeline                                                               */
/* -------------------------------------------------------------------------- */

/** Normalises for comparison: lowercase, collapse space, drop punctuation. */
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Reads a prescription image and returns a draft for the pharmacist.
 *
 * `image` must already be a raster format — the client rasterises and
 * grey-scales before upload, because vision models do not accept SVG and read
 * a flattened, high-contrast page considerably better than a phone photo.
 */
export async function readPrescription(image: {
  mimeType: string;
  base64: string;
}): Promise<PrescriptionDraft> {
  const notes: string[] = [];
  const models: string[] = [];
  const createdAt = new Date().toISOString();

  const empty = (reason: string): PrescriptionDraft => ({
    ok: false,
    unreadable: true,
    transcription: "",
    lines: [],
    unmatched: [],
    notes: [reason],
    models,
    createdAt,
  });

  if (!hasProvider("gemini")) return empty("No vision provider is configured.");

  /* ---- 1. read the page ------------------------------------------------ */
  let read: RawRead;
  let readResult: AiResult;
  try {
    readResult = await geminiJson(
      {
        system: READ_SYSTEM,
        prompt:
          "Transcribe this prescription. Copy every medicine line verbatim into sourceText. Do not add anything that is not written.",
        image,
        maxTokens: 2048,
      },
      MODELS.vision,
    );
    models.push(`${readResult.provider}:${readResult.model}`);
    read = parseJson<RawRead>(readResult);
  } catch (err) {
    return empty(err instanceof Error ? err.message : "Could not read the document.");
  }

  if (read.unreadable === true) {
    return {
      ...empty("The model could not read this document confidently."),
      models,
    };
  }

  const transcription = str(read.transcription);
  const rawLines: RawLine[] = Array.isArray(read.lines) ? (read.lines as RawLine[]) : [];

  /* ---- 2. verbatim grounding ------------------------------------------- */
  const haystack = norm(transcription);
  const grounded = rawLines.filter((l) => {
    const src = str(l.sourceText);
    if (!src) return false;
    // The quote has to actually be on the page the model just transcribed.
    return haystack.includes(norm(src));
  });

  if (grounded.length < rawLines.length) {
    notes.push(
      `${rawLines.length - grounded.length} line(s) were dropped because the model could not point to them in the page.`,
    );
  }
  if (grounded.length === 0) {
    return {
      ok: false,
      unreadable: false,
      transcription,
      doctorName: str(read.doctorName) || undefined,
      patientName: str(read.patientName) || undefined,
      lines: [],
      unmatched: rawLines.map((l) => str(l.sourceText)).filter(Boolean),
      notes: [...notes, "Nothing on this prescription could be matched. Enter the lines by hand."],
      models,
      createdAt,
    };
  }

  /* ---- 3. closed-vocabulary matching, twice ---------------------------- */
  const store = await getStore();
  const catalogue = await store.list<Medicine>("medicines");
  const byId = new Map(catalogue.map((m) => [m.id, m]));

  // Only dispensable products are offered. A scheduled drug is never drafted.
  const offerable = catalogue.filter((m) => !m.restricted);

  const catalogueBlock = offerable
    .map((m) => `${m.id}\t${m.name}\t${m.genericName}\t${m.strength}\t${m.form}\t${m.type}`)
    .join("\n");

  const linesBlock = grounded
    .map((l, i) => `${i + 1}. ${str(l.sourceText)} | name=${str(l.name)} | strength=${str(l.strength)}`)
    .join("\n");

  const matchPrompt = `Catalogue (id<TAB>name<TAB>generic<TAB>strength<TAB>form<TAB>type):
${catalogueBlock}

Prescription lines to map:
${linesBlock}

Return one entry per line you can match confidently, using its label (L1, L2, ...). Omit lines you cannot match.`;

  const matchesByModel: Array<{ label: string; map: Map<number, string> }> = [];

  // Gemini's own mapping.
  try {
    const r = await geminiJson(
      { system: MATCH_SYSTEM, prompt: matchPrompt, maxTokens: 1536 },
      MODELS.geminiText,
    );
    models.push(`${r.provider}:${r.model}`);
    matchesByModel.push({
      label: `${r.provider}:${r.model}`,
      map: readMatches(r, byId, grounded.length),
    });
  } catch (err) {
    notes.push(`Gemini matching failed: ${err instanceof Error ? err.message : "unknown"}`);
  }

  // Groq's independent opinion — it never saw the image, only this text.
  if (hasProvider("groq")) {
    try {
      const r = await groqJson(
        { system: MATCH_SYSTEM, prompt: matchPrompt, maxTokens: 1536 },
        MODELS.groqText,
      );
      models.push(`${r.provider}:${r.model}`);
      matchesByModel.push({
        label: `${r.provider}:${r.model}`,
        map: readMatches(r, byId, grounded.length),
      });
    } catch (err) {
      notes.push(`Groq cross-check failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
  } else {
    notes.push("No Groq key configured, so lines carry a single opinion only.");
  }

  if (matchesByModel.length === 0) {
    return {
      ok: false,
      unreadable: false,
      transcription,
      doctorName: str(read.doctorName) || undefined,
      patientName: str(read.patientName) || undefined,
      lines: [],
      unmatched: grounded.map((l) => str(l.sourceText)),
      notes: [...notes, "No model could map these lines to the catalogue."],
      models,
      createdAt,
    };
  }

  /* ---- 4. assemble, marking agreement ---------------------------------- */
  const lines: DraftLine[] = [];
  const unmatched: string[] = [];

  grounded.forEach((l, index) => {
    const src = str(l.sourceText);
    const votes = matchesByModel
      .map((m) => ({ label: m.label, id: m.map.get(index) }))
      .filter((v): v is { label: string; id: string } => Boolean(v.id));

    if (votes.length === 0) {
      unmatched.push(src);
      return;
    }

    // Agreement means every model that had an opinion picked the same product.
    const ids = new Set(votes.map((v) => v.id));
    const agreed = ids.size === 1 && votes.length === matchesByModel.length;

    if (ids.size > 1) {
      notes.push(
        `"${src}" was read differently by each model, so it is left unticked for you to decide.`,
      );
    }

    const chosen = votes[0].id;
    const med = byId.get(chosen);
    if (!med || med.restricted) {
      unmatched.push(src);
      return;
    }

    lines.push({
      name: med.name,
      strength: med.strength,
      // Dosage is copied, never composed. Blank beats invented.
      dosage: str(l.dosage),
      qty: num(l.quantity),
      medicineId: med.id,
      sourceText: src,
      agreed,
      proposedBy: votes.map((v) => v.label),
    });
  });

  return {
    ok: lines.length > 0,
    unreadable: false,
    transcription,
    doctorName: str(read.doctorName) || undefined,
    patientName: str(read.patientName) || undefined,
    lines,
    unmatched,
    notes,
    models,
    createdAt,
  };
}

/**
 * Reads a matcher response into "line label -> catalogue id".
 *
 * Any id not in the catalogue is dropped here. This is the closed-vocabulary
 * rule, enforced rather than requested: whatever the prompt said, only real
 * products get out of this function.
 */
function readMatches(
  result: AiResult,
  byId: Map<string, Medicine>,
  lineCount: number,
): Map<number, string> {
  const out = new Map<number, string>();
  let parsed: { matches?: unknown };
  try {
    parsed = parseJson<{ matches?: unknown }>(result);
  } catch {
    return out;
  }
  const rows = Array.isArray(parsed.matches) ? parsed.matches : [];
  for (const row of rows as Array<Record<string, unknown>>) {
    const id = str(row.medicineId);
    if (!id || !byId.has(id)) continue;

    const label = str(row.line) || str(row.id);
    const n = Number(/^L?(\d+)$/i.exec(label)?.[1]);
    if (!Number.isFinite(n) || n < 1 || n > lineCount) continue;

    out.set(n - 1, id);
  }
  return out;
}
