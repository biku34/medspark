/**
 * One way in to Gemini, because the scarce resource is requests, not tokens.
 *
 * The free tier's binding limit is `GenerateRequestsPerDayPerProjectPerModel`
 * — a few hundred calls per day, counted per model and per project. Two facts
 * follow from the name, and this file is built on both:
 *
 *   per model   — a second model is a second daily allowance, so a ladder of
 *                 models buys real head-room rather than just retrying.
 *   per project — each API key belongs to its own project, so key rotation
 *                 buys head-room too. That part `withKey` already does.
 *
 * So a request walks two axes: every key for a model, then the next model. A
 * model that reports its day is gone gets rested rather than hammered.
 */

import { getStore } from "../db";
import { AiError, classify, fetchWithTimeout, withKey } from "./router";

export interface GeminiModel {
  id: string;
  /**
   * Whether the model accepts `thinkingConfig`. The `-latest` aliases reject
   * it outright with a 400, which costs a request to discover — so it is
   * recorded here instead of probed.
   */
  thinking: boolean;
}

/**
 * Cheapest-and-most-plentiful first for text, because text work is high volume
 * and low stakes: a shift briefing that reads a queue does not need the best
 * model on the shelf.
 */
export const TEXT_LADDER: GeminiModel[] = [
  { id: "gemini-flash-lite-latest", thinking: false },
  { id: "gemini-flash-latest", thinking: false },
  { id: "gemini-2.5-flash", thinking: true },
];

/**
 * Best-first for documents. Reading a prescription wrong is a clinical risk,
 * not an inconvenience, so accuracy leads and quota follows.
 */
export const VISION_LADDER: GeminiModel[] = [
  { id: "gemini-2.5-flash", thinking: true },
  { id: "gemini-flash-latest", thinking: false },
  { id: "gemini-flash-lite-latest", thinking: false },
];

/**
 * Models resting because they reported their daily allowance was gone.
 *
 * Six hours, not until midnight: the quota resets on Google's clock, not ours,
 * and being wrong in the direction of "try again later" costs one request
 * while being wrong the other way costs a working feature for a day.
 */
const DAILY_REST_MS = 6 * 60 * 60_000;
const resting = new Map<string, number>();

/**
 * The rest list is shared, because the quota it protects is shared.
 *
 * Kept in memory for speed and mirrored to the database for truth. A
 * process-local map would make every cold instance re-learn that a model is
 * exhausted, and at twenty requests a day for the best model, two wasted
 * probes per cold start is a tenth of the budget spent discovering something
 * another instance already knew.
 */
const REST_DOC = "ai_model_rest";
let loaded = false;

interface RestDoc {
  id: string;
  models: Record<string, number>;
}

async function loadRest(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const store = await getStore();
    const doc = await store.one<RestDoc>("settings", { id: REST_DOC });
    for (const [model, until] of Object.entries(doc?.models ?? {})) {
      // Keep only the later of what we know and what was stored.
      if (until > (resting.get(model) ?? 0)) resting.set(model, until);
    }
  } catch {
    // No database is a reason to be less efficient, not to stop working.
  }
}

async function saveRest(): Promise<void> {
  try {
    const store = await getStore();
    const now = Date.now();
    const models = Object.fromEntries([...resting].filter(([, until]) => until > now));
    const existing = await store.one<RestDoc>("settings", { id: REST_DOC });
    if (existing) await store.update<RestDoc>("settings", REST_DOC, { models });
    else await store.insert<RestDoc>("settings", { id: REST_DOC, models });
  } catch {
    // Same: best effort.
  }
}

const isDailyQuota = (err: unknown) =>
  err instanceof AiError && err.status === 429 && /PerDay/i.test(err.message);

/** True when this model is worth trying right now. */
function awake(model: GeminiModel): boolean {
  const until = resting.get(model.id) ?? 0;
  return until <= Date.now();
}

export interface GeminiCall {
  /** The request body, minus the model-specific generation settings. */
  body: Record<string, unknown>;
  /** Merged into generationConfig; `thinkingConfig` is added per model. */
  generationConfig: Record<string, unknown>;
  ladder?: GeminiModel[];
  timeoutMs?: number;
}

export interface GeminiResponse {
  json: Record<string, unknown>;
  model: string;
}

/**
 * Send one request, walking the ladder until a model answers.
 *
 * Errors that are not about quota abort immediately — a malformed request will
 * be just as malformed on the next model, and spending three daily requests to
 * confirm that is exactly the waste this file exists to avoid.
 */
export async function geminiRequest(call: GeminiCall): Promise<GeminiResponse> {
  await loadRest();
  const ladder = call.ladder ?? TEXT_LADDER;
  const usable = ladder.filter(awake);
  // Everything is resting: try the whole ladder anyway rather than fail dry.
  const order = usable.length > 0 ? usable : ladder;

  let lastError: unknown = new AiError("No Gemini model was reachable", 503, true);

  for (const model of order) {
    const generationConfig = {
      ...call.generationConfig,
      ...(model.thinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    };

    try {
      const json = await withKey("gemini", async (key) => {
        const res = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent`,
          {
            method: "POST",
            headers: { "content-type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify({ ...call.body, generationConfig }),
          },
          call.timeoutMs ?? 40_000,
        );
        const text = await res.text();
        if (!res.ok) throw classify(res.status, text);
        try {
          return JSON.parse(text) as Record<string, unknown>;
        } catch {
          throw new AiError("Gemini returned an unparseable envelope", 502, true);
        }
      });

      resting.delete(model.id);
      if (process.env.AI_DEBUG) console.log(`[gemini] request -> ${model.id}`);
      return { json, model: model.id };
    } catch (err) {
      lastError = err;

      if (isDailyQuota(err)) {
        if (process.env.AI_DEBUG) console.log(`[gemini] ${model.id} out of daily quota, resting`);
        resting.set(model.id, Date.now() + DAILY_REST_MS);
        void saveRest();
        continue;
      }
      // A plain rate limit or a dead upstream: the next model may be fine.
      if (err instanceof AiError && (err.status === 429 || (err.status ?? 0) >= 500)) {
        continue;
      }
      if (process.env.AI_DEBUG) {
        console.log(`[gemini] ${model.id} hard error:`, (err as Error).message?.slice(0, 400));
      }
      throw err;
    }
  }

  throw lastError;
}

/** For the diagnostics endpoint: which models are rested, and until when. */
export function geminiRestState(): Array<{ model: string; restingForMs: number }> {
  const now = Date.now();
  return [...resting.entries()]
    .filter(([, until]) => until > now)
    .map(([model, until]) => ({ model, restingForMs: until - now }));
}
