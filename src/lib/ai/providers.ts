/**
 * The two providers, behind one shape.
 *
 * A deliberate asymmetry, discovered rather than designed: this Groq account
 * serves text models only, so Gemini does every job that needs eyes. That
 * turns out to be useful — Groq never sees the image, only the transcription,
 * which makes its opinion on "which catalogue medicine is this" genuinely
 * independent rather than a second look at the same pixels.
 */

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

export async function geminiJson(call: AiCall, model = MODELS.geminiText): Promise<AiResult> {
  return withKey("gemini", async (key) => {
    const parts: Array<Record<string, unknown>> = [{ text: call.prompt }];
    if (call.image) {
      parts.unshift({
        inline_data: { mime_type: call.image.mimeType, data: call.image.base64 },
      });
    }

    const res = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: call.system }] },
          contents: [{ role: "user", parts }],
          generationConfig: {
            // Deterministic: this is extraction, not writing.
            temperature: 0,
            responseMimeType: "application/json",
            maxOutputTokens: call.maxTokens ?? 2048,
          },
        }),
      },
    );

    const body = await res.text();
    if (!res.ok) throw classify(res.status, body);

    let text = "";
    try {
      const json = JSON.parse(body) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    } catch {
      throw new AiError("Gemini returned unparseable envelope", res.status, true);
    }
    if (!text.trim()) throw new AiError("Gemini returned nothing", res.status, true);

    return { provider: "gemini", model, raw: text };
  });
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
        max_tokens: call.maxTokens ?? 2048,
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
