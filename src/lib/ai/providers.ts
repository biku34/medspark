/**
 * The two providers, behind one shape.
 *
 * A deliberate asymmetry, discovered rather than designed: this Groq account
 * serves text models only, so Gemini does every job that needs eyes. That
 * turns out to be useful — Groq never sees the image, only the transcription,
 * which makes its opinion on "which catalogue medicine is this" genuinely
 * independent rather than a second look at the same pixels.
 */

import { TEXT_LADDER, VISION_LADDER, geminiRequest } from "./gemini";
import { AiError, classify, fetchWithTimeout, withKey } from "./router";

export const MODELS = {
  /** Reads documents. The only model here with eyes. */
  vision: "gemini-2.5-flash",
  /** Gemini's text tier, for drafting. */
  geminiText: "gemini-2.5-flash",
  /** Groq's text tier, for the independent second opinion. */
  groqText: "openai/gpt-oss-20b",
  /** Used when a judgement is worth more tokens. */
  groqStrong: "openai/gpt-oss-120b",
} as const;

export interface AiCall {
  /** What the model is being asked to be. */
  system: string;
  /** The actual task. */
  prompt: string;
  /** Optional document, already rasterised to png/jpeg by the client. */
  image?: { mimeType: string; base64: string };
  /** Hard cap; these tasks are all small structured answers. */
  maxTokens?: number;
}

export interface AiResult {
  provider: "groq" | "gemini";
  model: string;
  /** Raw text, kept verbatim for the audit trail. */
  raw: string;
}

/* -------------------------------------------------------------------------- */
/* Gemini                                                                     */
/* -------------------------------------------------------------------------- */

export async function geminiJson(call: AiCall, model?: string): Promise<AiResult> {
  const parts: Array<Record<string, unknown>> = [{ text: call.prompt }];
  if (call.image) {
    parts.unshift({
      inline_data: { mime_type: call.image.mimeType, data: call.image.base64 },
    });
  }

  /**
   * Documents go up the accuracy-first ladder, prose up the quota-first one.
   * An explicit `model` still wins, so callers that must pin one can.
   */
  const ladder = model
    ? [{ id: model, thinking: !model.includes("-latest") }]
    : call.image
      ? VISION_LADDER
      : TEXT_LADDER;

  const { json, model: used } = await geminiRequest({
    ladder,
    body: {
      systemInstruction: { parts: [{ text: call.system }] },
      contents: [{ role: "user", parts }],
    },
    generationConfig: {
      // Deterministic: this is extraction, not writing.
      temperature: 0,
      responseMimeType: "application/json",
      /**
       * Gemini spends output tokens on internal reasoning, out of the same
       * budget as the answer. A real prescription blew the old 2048 cap on
       * thinking alone and the JSON came back truncated mid-string. Models
       * that accept it get thinking switched off; the rest get room instead.
       */
      maxOutputTokens: call.maxTokens ?? 8192,
    },
  });

  const typed = json as {
    candidates?: Array<{
      finishReason?: string;
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const candidate = typed.candidates?.[0];
  const finishReason = candidate?.finishReason ?? "";
  const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";

  /**
   * A truncated answer is not "bad JSON" — it is a budget problem, and saying
   * so is the difference between a useful error and a confusing one.
   */
  if (finishReason === "MAX_TOKENS") {
    throw new AiError(
      "The page was too dense to transcribe in one answer — try a tighter crop, or one page at a time.",
      429,
      true,
    );
  }
  if (finishReason === "SAFETY" || finishReason === "PROHIBITED_CONTENT") {
    throw new AiError("The provider declined to process this image.", 400, false);
  }
  if (!text.trim()) throw new AiError("Gemini returned nothing", 502, true);

  return { provider: "gemini", model: used, raw: text };
}

/* -------------------------------------------------------------------------- */
/* Groq                                                                       */
/* -------------------------------------------------------------------------- */

export async function groqJson(call: AiCall, model = MODELS.groqText): Promise<AiResult> {
  if (call.image) {
    throw new AiError("This Groq account has no vision model", undefined, false);
  }

  return withKey("groq", async (key) => {
    const res = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: call.maxTokens ?? 4096,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: call.system },
          { role: "user", content: call.prompt },
        ],
      }),
    });

    const body = await res.text();
    if (!res.ok) throw classify(res.status, body);

    let text = "";
    try {
      const json = JSON.parse(body) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      text = json.choices?.[0]?.message?.content ?? "";
    } catch {
      throw new AiError("Groq returned unparseable envelope", res.status, true);
    }
    if (!text.trim()) throw new AiError("Groq returned nothing", res.status, true);

    return { provider: "groq", model, raw: text };
  });
}

/* -------------------------------------------------------------------------- */
/* parsing                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Parses a model's answer as JSON, with no repair attempts.
 *
 * A model that cannot follow "return JSON" is a model whose content should not
 * be trusted either, so a parse failure is treated as a failed call rather than
 * something to coax into shape.
 */
export function parseJson<T>(result: AiResult): T {
  const text = result.raw.trim();
  // Some models still wrap JSON in a fence despite being told not to.
  const cleaned = text.startsWith("```")
    ? text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "")
    : text;
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new AiError(
      `${result.provider} did not return JSON: ${cleaned.slice(0, 200)}`,
      undefined,
      false,
    );
  }
}
