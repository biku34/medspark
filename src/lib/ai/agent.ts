/**
 * The operations agent.
 *
 * Everything else the AI does here is single-shot: hand it a page, get a
 * reading. This one is a loop — it decides what it needs to know, calls tools
 * to find out, and keeps going until it can answer. That is the difference
 * between a model and an agent, and it is why a pharmacist can ask "what needs
 * me right now" instead of opening six tabs and comparing them.
 *
 * The safety model is the tool surface, not the prompt. Every tool is
 * read-only and scoped to the caller's own pharmacy, so the worst a confused
 * agent can do is describe the wrong thing. It never dispenses, never
 * approves, never edits stock. Each item it raises must cite the tool that
 * produced it, and anything citing a fact we never fetched is dropped before
 * the pharmacist sees it.
 */

import type { Session } from "../session";
import { MODELS, parseJson } from "./providers";
import { AiError, classify, fetchWithTimeout, hasProvider, withKey } from "./router";
import { TOOL_MAP, toolSchemas } from "./tools";

/* -------------------------------------------------------------------------- */
/* shapes                                                                     */
/* -------------------------------------------------------------------------- */

export interface AgentItem {
  /** 1 = do this now, 3 = worth knowing. */
  priority: 1 | 2 | 3;
  title: string;
  detail: string;
  /** The tool whose result this came from. */
  source: string;
  /** Where the human goes to act on it. */
  href?: string;
}

export interface AgentBriefing {
  ok: boolean;
  headline: string;
  items: AgentItem[];
  /** Tools the agent actually called, in order. */
  steps: Array<{ tool: string; args: Record<string, unknown> }>;
  notes: string[];
  model: string;
  createdAt: string;
}

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

const SYSTEM = `You are the operations assistant for a pharmacy on the DawaQuick network. You are talking to the pharmacy team, not to a patient.

How you work:
- Find things out by calling tools. Never state a number, a code or a name you did not get from a tool result.
- Call several tools before answering. A useful briefing looks at the order queue, the shelf, the verification queue and what is due soon.
- Prioritise by what costs the pharmacy or the customer most if ignored: a customer waiting, an order that cannot be filled, a repeat that will fail.
- Be specific. "3 orders waiting over 10 minutes, oldest DQ-4TR7QK at 14 minutes" beats "some orders are waiting".
- Copy figures exactly as the tool wrote them. Money already carries its symbol and waiting times are already in hours and minutes — reformat nothing, convert nothing.
- Say nothing when there is nothing to say. An empty list is a good morning, not a failure.

Hard limits:
- You do not give clinical or dosing advice. You are looking at operations: queues, stock, timing.
- You cannot change anything. You describe what you found and where to go. The team decides.

When you have enough, answer with JSON only:
{"headline":"one line summary of the shift","items":[{"priority":1,"title":"","detail":"","source":"tool_name","href":"/pharmacy"}]}
Priority 1 = needs doing now, 2 = today, 3 = worth knowing.`;

/* -------------------------------------------------------------------------- */
/* the loop                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Four look-ups is plenty for a briefing, and every extra turn re-sends the
 * whole conversation — on a free tier metered by tokens per minute, the loop
 * length is the cost.
 */
const MAX_STEPS = 4;

/**
 * Tool results are trimmed hard before going back to the model.
 *
 * The full result is kept for grounding checks; the model only needs enough to
 * reason over, and a 6KB JSON blob per call is what pushed the first version
 * over the rate limit mid-briefing.
 */
const MAX_TOOL_CHARS = 1400;

/** One turn against Groq's chat API, with tools attached. */
async function chat(messages: ChatMessage[], model: string) {
  return withKey("groq", async (key) => {
    const res = await fetchWithTimeout(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 1200,
          // Deciding which tool to call needs no deep reasoning either.
          reasoning_effort: "low",
          messages,
          tools: toolSchemas(),
          tool_choice: "auto",
        }),
      },
      40_000,
    );

    const body = await res.text();
    if (!res.ok) throw classify(res.status, body);

    try {
      const json = JSON.parse(body) as {
        choices?: Array<{ finish_reason?: string; message?: ChatMessage }>;
      };
      const choice = json.choices?.[0];
      if (!choice?.message) throw new AiError("Groq returned no message", res.status, true);
      return { message: choice.message, finish: choice.finish_reason ?? "" };
    } catch (err) {
      if (err instanceof AiError) throw err;
      throw new AiError("Groq returned an unparseable envelope", res.status, true);
    }
  });
}

/**
 * The writing turn: no tools, JSON enforced.
 *
 * Groq will not honour response_format while tools are attached, so gathering
 * and writing are deliberately separate calls. The first version let the model
 * decide when to stop and write, and it answered in prose that failed to parse
 * — the loop had done its work and the report was thrown away.
 */
/**
 * The writing turn: a clean conversation, no tools, JSON enforced.
 *
 * Deliberately NOT a replay of the tool exchange. Groq will not honour
 * response_format while tools are attached, and sending a history full of
 * tool_calls without the matching schemas made it generate nothing at all.
 * Handing it the gathered evidence as plain text is smaller, cheaper and
 * reliable.
 */
async function compose(
  question: string,
  evidence: string,
  model: string,
): Promise<string> {
  return withKey("groq", async (key) => {
    const res = await fetchWithTimeout(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 2000,
          /**
           * gpt-oss reasons before it answers, out of the same completion
           * budget. Left at its default it spent the whole allowance thinking
           * and returned an empty string, which Groq rejects as invalid JSON —
           * an error that points at the prompt when the cause is the budget.
           * Low effort is right for a write-up from facts already gathered.
           */
          reasoning_effort: "low",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM },
            {
              role: "user",
              content: `${question}

Here is exactly what the tools returned. Use nothing else.
${evidence.slice(0, 6000)}

Write the briefing now. JSON only, in the shape given in your instructions.`,
            },
          ],
        }),
      },
      40_000,
    );
    const body = await res.text();
    if (!res.ok) throw classify(res.status, body);
    const json = JSON.parse(body) as { choices?: Array<{ message?: { content?: string } }> };
    return json.choices?.[0]?.message?.content ?? "";
  });
}

/**
 * Runs the agent for one pharmacy session.
 *
 * `question` lets a pharmacist ask something specific; left empty it produces
 * the standing shift briefing.
 */
/**
 * Provider errors are written for whoever is holding the API key, not for
 * whoever is holding the prescription. A pharmacist reading a raw 429 envelope
 * learns nothing they can act on, so every failure exit goes through here.
 */
function human(err: unknown): string {
  const status = (err instanceof AiError ? err.status : 0) ?? 0;
  if (status === 429) {
    return "The AI account has used its tokens for this minute. Try again in a moment.";
  }
  if (status === 401 || status === 403) {
    return "The AI key was refused. An administrator needs to check it.";
  }
  if (status >= 500 || status === 0) {
    return "The AI service did not respond. Your queue below is unaffected.";
  }
  return "The assistant could not finish this look-up. Try again in a moment.";
}

export async function runOperationsAgent(
  session: Session,
  question?: string,
): Promise<AgentBriefing> {
  const createdAt = new Date().toISOString();
  const steps: AgentBriefing["steps"] = [];
  const notes: string[] = [];
  const model = MODELS.groqText;

  const empty = (reason: string): AgentBriefing => ({
    ok: false,
    headline: "",
    items: [],
    steps,
    notes: [reason],
    model,
    createdAt,
  });

  if (!hasProvider("groq")) return empty("No agent provider is configured.");
  if (!session.pharmacyId) return empty("This account is not linked to a pharmacy.");

  const ask =
    question?.trim() ||
    "Give me the shift briefing. What needs my attention right now, and what is coming?";

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    { role: "user", content: ask },
  ];

  /** Everything a tool has told us, so claims can be checked against it. */
  let evidence = "";

  for (let step = 0; step < MAX_STEPS; step++) {
    let turn;
    try {
      turn = await chat(messages, model);
    } catch (err) {
      /**
       * A tokens-per-minute limit belongs to the account, not the key, so
       * rotating to another key hits the same wall. Waiting is the only thing
       * that helps, and one short wait is usually enough.
       */
      const rateLimited = err instanceof AiError && err.status === 429;
      if (rateLimited && step === 0) {
        await new Promise((r) => setTimeout(r, 4000));
        try {
          turn = await chat(messages, model);
        } catch {
          return empty(
            "The AI account is out of tokens for this minute. Try again shortly.",
          );
        }
      } else if (rateLimited) {
        return empty("The AI account is out of tokens for this minute. Try again shortly.");
      } else {
        return empty(human(err));
      }
    }

    const calls = turn.message.tool_calls ?? [];

    if (calls.length === 0) {
      // It has looked at enough. Ask for the write-up in a shape we can use.
      try {
        const text = await compose(ask, evidence, model);
        return finalise(text, evidence, steps, notes, model, createdAt);
      } catch (err) {
        return empty(human(err));
      }
    }

    messages.push({
      role: "assistant",
      content: turn.message.content ?? null,
      tool_calls: calls,
    });

    for (const call of calls) {
      const tool = TOOL_MAP.get(call.function.name);
      let result: unknown;

      if (!tool) {
        // The model invented a tool. Say so plainly rather than failing.
        result = { error: `No such tool: ${call.function.name}` };
        notes.push(`The agent asked for a tool that does not exist (${call.function.name}).`);
      } else {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
        } catch {
          args = {};
        }
        try {
          result = await tool.run(args, session);
          steps.push({ tool: tool.name, args });
        } catch (err) {
          result = { error: err instanceof Error ? err.message : "tool failed" };
        }
      }

      const serialised = JSON.stringify(result);
      evidence += `\n${call.function.name}: ${serialised}`;
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: serialised.slice(0, MAX_TOOL_CHARS),
      });
    }
  }

  // Out of look-ups, but the evidence gathered is still worth reporting.
  notes.push("The agent reached its look-up limit and wrote up what it had.");
  try {
    const text = await compose(ask, evidence, model);
    return finalise(text, evidence, steps, notes, model, createdAt);
  } catch (err) {
    return empty(human(err));
  }
}

/* -------------------------------------------------------------------------- */
/* grounding                                                                  */
/* -------------------------------------------------------------------------- */

const PRIORITIES = [1, 2, 3];

/**
 * Turns the final answer into a briefing, dropping anything ungrounded.
 *
 * Two checks. An item has to name a tool that actually ran — the agent cannot
 * report on the shelf if it never looked at the shelf. And any order code,
 * prescription ref or repeat ref it quotes has to appear in what the tools
 * returned, so a plausible-looking "DQ-XXXXXX" invented for illustration never
 * reaches somebody who would go looking for it.
 */
function finalise(
  text: string,
  evidence: string,
  steps: AgentBriefing["steps"],
  notes: string[],
  model: string,
  createdAt: string,
): AgentBriefing {
  let parsed: { headline?: unknown; items?: unknown };
  try {
    parsed = parseJson<{ headline?: unknown; items?: unknown }>({
      provider: "groq",
      model,
      raw: text,
    });
  } catch {
    return {
      ok: false,
      headline: "",
      items: [],
      steps,
      notes: [...notes, "The agent's answer was not usable."],
      model,
      createdAt,
    };
  }

  const called = new Set(steps.map((s) => s.tool));
  const rows = Array.isArray(parsed.items) ? (parsed.items as Array<Record<string, unknown>>) : [];
  const items: AgentItem[] = [];
  let dropped = 0;

  for (const row of rows) {
    const title = typeof row.title === "string" ? row.title.trim() : "";
    const detail = typeof row.detail === "string" ? row.detail.trim() : "";
    const source = typeof row.source === "string" ? row.source.trim() : "";
    if (!title || !source) {
      dropped++;
      continue;
    }
    if (!called.has(source)) {
      dropped++;
      continue;
    }

    // Every reference-looking code it quotes must be one we actually saw.
    const refs = `${title} ${detail}`.match(/\b(?:DQ|RX|RD|CP)-[A-Z0-9]{4,}\b/g) ?? [];
    if (refs.some((r) => !evidence.includes(r))) {
      dropped++;
      continue;
    }

    const priority = PRIORITIES.includes(Number(row.priority)) ? Number(row.priority) : 3;
    const href = typeof row.href === "string" && row.href.startsWith("/") ? row.href : undefined;

    items.push({ priority: priority as 1 | 2 | 3, title, detail, source, href });
  }

  if (dropped > 0) {
    notes.push(`${dropped} item(s) were dropped for citing something the tools never returned.`);
  }

  items.sort((a, b) => a.priority - b.priority);

  return {
    ok: true,
    headline: typeof parsed.headline === "string" ? parsed.headline.trim() : "",
    items,
    steps,
    notes,
    model,
    createdAt,
  };
}
