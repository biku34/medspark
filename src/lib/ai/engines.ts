/**
 * Two engines that can drive a tool-calling loop, behind one interface.
 *
 * This exists because of a quota, not because of taste. Groq's tokens-per-
 * minute allowance belongs to the account, not to the key, and it is 8,000.
 * One briefing costs roughly 4,000 — so two staff opening their dashboards
 * exhausted the whole company's budget for the minute, and adding more Groq
 * keys did nothing at all because they all draw from the same bucket.
 *
 * Gemini's free allowance for the same work is about thirty times larger, so
 * it leads and Groq follows. Both speak the same shape here: the OpenAI
 * message format, because Groq is native to it and translating one engine is
 * cheaper than translating two.
 */

import { geminiRequest } from "./gemini";
import { MODELS } from "./providers";
import { AiError, classify, fetchWithTimeout, hasProvider, withKey } from "./router";
import { toolSchemas } from "./tools";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
    /**
     * Gemini stamps each function call with a signature and refuses the next
     * turn if it is not handed back verbatim. It is meaningless to Groq, which
     * simply ignores the extra field, so it rides along on the shared shape.
     */
    thoughtSignature?: string;
  }>;
  tool_call_id?: string;
}

export interface Turn {
  message: ChatMessage;
  finish: string;
}

export interface Engine {
  name: "gemini" | "groq";
  model: string;
  /** One turn with the tools attached, so the model can ask for a look-up. */
  chat(messages: ChatMessage[]): Promise<Turn>;
  /** The write-up turn: no tools, JSON enforced. */
  compose(system: string, prompt: string): Promise<string>;
}

const debug = (engine: string, usage: unknown) => {
  if (process.env.AI_DEBUG) console.log(`[agent:${engine}] tokens`, JSON.stringify(usage));
};

/* -------------------------------------------------------------------------- */
/* groq                                                                       */
/* -------------------------------------------------------------------------- */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

async function groqCall(payload: Record<string, unknown>): Promise<string> {
  return withKey("groq", async (key) => {
    const res = await fetchWithTimeout(
      GROQ_URL,
      {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify(payload),
      },
      40_000,
    );
    const body = await res.text();
    if (!res.ok) throw classify(res.status, body);
    return body;
  });
}

const groqEngine: Engine = {
  name: "groq",
  model: MODELS.groqText,

  async chat(messages) {
    const body = await groqCall({
      model: MODELS.groqText,
      temperature: 0,
      max_tokens: 1200,
      // Choosing a tool needs no deep reasoning, and reasoning is billed.
      reasoning_effort: "low",
      messages,
      tools: toolSchemas(),
      tool_choice: "auto",
    });
    try {
      const json = JSON.parse(body) as {
        choices?: Array<{ finish_reason?: string; message?: ChatMessage }>;
        usage?: unknown;
      };
      debug("groq", json.usage);
      const choice = json.choices?.[0];
      if (!choice?.message) throw new AiError("Groq returned no message", 502, true);
      return { message: choice.message, finish: choice.finish_reason ?? "" };
    } catch (err) {
      if (err instanceof AiError) throw err;
      throw new AiError("Groq returned an unparseable envelope", 502, true);
    }
  },

  async compose(system, prompt) {
    const body = await groqCall({
      model: MODELS.groqText,
      temperature: 0,
      max_tokens: 2000,
      /**
       * gpt-oss thinks out of the same completion budget it answers from. At
       * its default it spent the whole allowance reasoning and returned an
       * empty string, which Groq then rejects as invalid JSON — an error that
       * reads like a bad prompt when the cause is the budget.
       */
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    });
    const json = JSON.parse(body) as { choices?: Array<{ message?: { content?: string } }> };
    return json.choices?.[0]?.message?.content ?? "";
  },
};

/* -------------------------------------------------------------------------- */
/* gemini                                                                     */
/* -------------------------------------------------------------------------- */

interface GeminiPart {
  text?: string;
  thoughtSignature?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

/**
 * Translate the OpenAI message list into Gemini's `contents`.
 *
 * The fiddly part is tool results: OpenAI ties a result to a call by id,
 * Gemini ties it by function name. So we walk forward remembering which id
 * belonged to which name, and look it up when the result arrives.
 */
function toGemini(messages: ChatMessage[]) {
  const nameOfCall = new Map<string, string>();
  const contents: Array<{ role: "user" | "model"; parts: GeminiPart[] }> = [];
  let system = "";

  for (const m of messages) {
    if (m.role === "system") {
      system = m.content ?? "";
      continue;
    }

    if (m.role === "assistant") {
      const parts: GeminiPart[] = [];
      if (m.content) parts.push({ text: m.content });
      for (const call of m.tool_calls ?? []) {
        nameOfCall.set(call.id, call.function.name);
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          args = {};
        }
        parts.push({
          functionCall: { name: call.function.name, args },
          ...(call.thoughtSignature ? { thoughtSignature: call.thoughtSignature } : {}),
        });
      }
      if (parts.length) contents.push({ role: "model", parts });
      continue;
    }

    if (m.role === "tool") {
      const name = nameOfCall.get(m.tool_call_id ?? "") ?? "tool";
      let response: Record<string, unknown>;
      try {
        response = JSON.parse(m.content ?? "{}");
      } catch {
        response = { result: m.content };
      }
      contents.push({
        role: "user",
        parts: [{ functionResponse: { name, response } }],
      });
      continue;
    }

    contents.push({ role: "user", parts: [{ text: m.content ?? "" }] });
  }

  return { system, contents };
}

/** Gemini's declarations are the OpenAI schemas without the wrapper. */
const geminiTools = () => [
  {
    functionDeclarations: toolSchemas().map((t) => ({
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    })),
  },
];

let lastGeminiModel: string = MODELS.geminiText;

async function geminiCall(
  body: Record<string, unknown>,
  generationConfig: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { json, model } = await geminiRequest({ body, generationConfig });
  lastGeminiModel = model;
  return json;
}

let callSeq = 0;

const geminiEngine: Engine = {
  name: "gemini",
  get model() {
    return lastGeminiModel;
  },

  async chat(messages) {
    const { system, contents } = toGemini(messages);
    const json = (await geminiCall(
      {
        contents,
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        tools: geminiTools(),
      },
      { temperature: 0, maxOutputTokens: 2000 },
    )) as {
      candidates?: Array<{ finishReason?: string; content?: { parts?: GeminiPart[] } }>;
      usageMetadata?: unknown;
    };
    debug("gemini", json.usageMetadata);

    const candidate = json.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const calls = parts.filter((p) => p.functionCall);

    const message: ChatMessage = {
      role: "assistant",
      content: parts.map((p) => p.text ?? "").join("") || null,
      ...(calls.length
        ? {
            tool_calls: calls.map((p) => ({
              id: `gem_${++callSeq}`,
              type: "function" as const,
              function: {
                name: p.functionCall!.name,
                arguments: JSON.stringify(p.functionCall!.args ?? {}),
              },
              ...(p.thoughtSignature ? { thoughtSignature: p.thoughtSignature } : {}),
            })),
          }
        : {}),
    };

    if (!message.content && !calls.length) {
      throw new AiError("Gemini returned nothing usable", 502, true);
    }
    return { message, finish: candidate?.finishReason ?? "" };
  },

  async compose(system, prompt) {
    const json = (await geminiCall(
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: system }] },
      },
      { temperature: 0, maxOutputTokens: 3000, responseMimeType: "application/json" },
    )) as { candidates?: Array<{ content?: { parts?: GeminiPart[] } }> };
    return json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  },
};

/* -------------------------------------------------------------------------- */

/**
 * Engines to try, best-supplied first.
 *
 * Gemini leads purely on head-room. If it is unconfigured or rate-limited the
 * loop falls through to Groq, which is faster but has almost no budget.
 */
export function engines(): Engine[] {
  const list: Engine[] = [];
  if (hasProvider("gemini")) list.push(geminiEngine);
  if (hasProvider("groq")) list.push(groqEngine);
  return list;
}
