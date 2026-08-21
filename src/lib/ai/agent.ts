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

import { getStore } from "../db";
import type { Session } from "../session";
import type { ChatMessage, Engine } from "./engines";
import { engines } from "./engines";
import { parseJson } from "./providers";
import { AiError } from "./router";
import { TOOL_MAP } from "./tools";

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
  /** Which provider produced this, so a slow answer can be explained. */
  engine: string;
  /** True when served from the shift cache rather than freshly gathered. */
  cached: boolean;
  createdAt: string;
}

const SYSTEM = `You are the operations assistant for a pharmacy on the DawaQuick network. You are talking to the pharmacy team, not to a patient.

How you work:
- Find things out by calling tools. Never state a number, a code or a name you did not get from a tool result.
- Ask for every tool you need in ONE go. You can request several at once, and you should: a useful briefing looks at the order queue, the shelf, the verification queue and what is due soon, so ask for all of them together on your first turn rather than one at a time.
- Prioritise by what costs the pharmacy or the customer most if ignored: a customer waiting, an order that cannot be filled, a repeat that will fail.
- Be specific. "3 orders waiting over 10 minutes, oldest DQ-4TR7QK at 14 minutes" beats "some orders are waiting".
- Roll repetitive findings into one line. Nine medicines low on the shelf is a single "9 lines running low, worst: X (3 left), Y (3 left)" — not nine separate lines. A briefing someone has to scroll is not a briefing.
- Eight lines is the most anyone reads. If you have more, merge the small ones.
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
/**
 * One round of looking, then the write-up. Two requests, and that is the
 * whole budget.
 *
 * The free tier's binding limit is requests per day, not tokens, and every
 * turn is a request. The first version asked for one tool per turn and spent
 * six; batching the calls brought it to three, and the third was pure
 * ceremony — a turn whose only content was the model saying it had finished.
 *
 * So the model gets one turn to decide what to look at, and it can ask for
 * every tool at once. It still chooses; it just does not get to change its
 * mind, which at seven tools in a single round it has never needed to. A
 * pharmacist who wants a second angle asks a follow-up question, and that is
 * a request worth spending.
 */
const MAX_STEPS = 1;

/**
 * Tool results are trimmed hard before going back to the model.
 *
 * The full result is kept for grounding checks; the model only needs enough to
 * reason over, and a 6KB JSON blob per call is what pushed the first version
 * over the rate limit mid-briefing.
 */
const MAX_TOOL_CHARS = 1400;

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
/**
 * One briefing per pharmacy, held briefly.
 *
 * A shift briefing is a property of the shift, not of the page load. Without
 * this, every staff member opening a desk spent a full agent run — and since
 * one run costs about half the account's per-minute token budget, two people
 * arriving together locked everyone out. The cache makes the common case free
 * and keeps the quota for people who actually ask something.
 *
 * Typed questions are never served from here; only the default briefing is.
 */
const CACHE_MS = 15 * 60_000;

interface CachedBriefing {
  id: string;
  pharmacyId: string;
  at: number;
  briefing: AgentBriefing;
}

/**
 * The cache lives in the database, not in a module variable.
 *
 * A module-level Map is per-instance, and the thing being protected — the
 * token allowance — is per-account. On serverless that is the worst possible
 * pairing: every cold instance thinks the cache is empty and spends the
 * budget the other instances were relying on. One shared row fixes it.
 */
async function readCache(pharmacyId: string): Promise<CachedBriefing | null> {
  try {
    const store = await getStore();
    return await store.one<CachedBriefing>("briefings", { pharmacyId });
  } catch {
    return null;
  }
}

async function writeCache(pharmacyId: string, briefing: AgentBriefing): Promise<void> {
  try {
    const store = await getStore();
    const row = { id: `bf_${pharmacyId}`, pharmacyId, at: Date.now(), briefing };
    const existing = await store.one<CachedBriefing>("briefings", { pharmacyId });
    if (existing) await store.update<CachedBriefing>("briefings", existing.id, row);
    else await store.insert<CachedBriefing>("briefings", row);
  } catch {
    // A briefing we could not cache is still a briefing worth showing.
  }
}

/** Run the gather-and-write loop on one engine. */
async function runWith(
  engine: Engine,
  session: Session,
  ask: string,
  createdAt: string,
): Promise<AgentBriefing> {
  const steps: AgentBriefing["steps"] = [];
  const notes: string[] = [];

  const fail = (reason: string): AgentBriefing => ({
    ok: false,
    headline: "",
    items: [],
    steps,
    notes: [reason],
    model: engine.model,
    engine: engine.name,
    cached: false,
    createdAt,
  });

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    { role: "user", content: ask },
  ];

  /** Everything a tool has told us, so claims can be checked against it. */
  let evidence = "";

  const write = async () => {
    const prompt = `${ask}

Here is exactly what the tools returned. Use nothing else.
${evidence.slice(0, 6000)}

Write the briefing now. JSON only, in the shape given in your instructions.`;
    const text = await engine.compose(SYSTEM, prompt);
    return finalise(text, evidence, steps, notes, engine, createdAt);
  };

  for (let step = 0; step < MAX_STEPS; step++) {
    let turn;
    try {
      turn = await engine.chat(messages);
    } catch (err) {
      // Let the caller decide whether another engine is worth trying.
      if (err instanceof AiError && (err.status === 429 || (err.status ?? 0) >= 500)) throw err;
      return fail(human(err));
    }

    const calls = turn.message.tool_calls ?? [];

    if (calls.length === 0) {
      // It has looked at enough. Ask for the write-up in a shape we can use.
      try {
        return await write();
      } catch (err) {
        return fail(human(err));
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
      evidence += `
${call.function.name}: ${serialised}`;
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: serialised.slice(0, MAX_TOOL_CHARS),
      });
    }
  }

  // The tools it asked for have run; write up what they returned.
  try {
    return await write();
  } catch (err) {
    return fail(human(err));
  }
}

export async function runOperationsAgent(
  session: Session,
  question?: string,
  opts: { force?: boolean } = {},
): Promise<AgentBriefing> {
  const createdAt = new Date().toISOString();
  const available = engines();

  const empty = (reason: string): AgentBriefing => ({
    ok: false,
    headline: "",
    items: [],
    steps: [],
    notes: [reason],
    model: available[0]?.model ?? "",
    engine: available[0]?.name ?? "none",
    cached: false,
    createdAt,
  });

  if (!available.length) return empty("No agent provider is configured.");
  if (!session.pharmacyId) return empty("This account is not linked to a pharmacy.");

  const asked = question?.trim();
  const key = session.pharmacyId;

  if (!asked && !opts.force) {
    const hit = await readCache(key);
    if (hit && Date.now() - hit.at < CACHE_MS) {
      return { ...hit.briefing, cached: true };
    }
  }

  const ask =
    asked || "Give me the shift briefing. What needs my attention right now, and what is coming?";

  /**
   * Try each engine in turn. A 429 or a dead upstream is worth carrying to the
   * next provider, because their quotas are entirely separate — which is the
   * whole reason there is more than one.
   */
  let lastError: unknown = null;
  for (const engine of available) {
    try {
      const briefing = await runWith(engine, session, ask, createdAt);
      if (briefing.ok && !asked) await writeCache(key, briefing);
      return briefing;
    } catch (err) {
      lastError = err;
    }
  }

  /**
   * Everything is rate-limited. A stale briefing beats a red error box: it is
   * clearly labelled with its age, and the queue it describes moves in minutes,
   * not seconds.
   */
  const stale = await readCache(key);
  if (stale) {
    return {
      ...stale.briefing,
      cached: true,
      notes: [
        ...stale.briefing.notes,
        "Every AI provider is busy, so this is the last briefing rather than a new one.",
      ],
    };
  }
  return empty(human(lastError));
}

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
  engine: Engine,
  createdAt: string,
): AgentBriefing {
  let parsed: { headline?: unknown; items?: unknown };
  try {
    parsed = parseJson<{ headline?: unknown; items?: unknown }>({
      provider: engine.name,
      model: engine.model,
      raw: text,
    });
  } catch {
    return {
      ok: false,
      headline: "",
      items: [],
      steps,
      notes: [...notes, "The agent's answer was not usable."],
      model: engine.model,
      engine: engine.name,
      cached: false,
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

  /**
   * A cap the prompt asks for and this enforces. Left to itself the model will
   * happily emit one line per low-stock medicine, which buries the two orders
   * that have been waiting a day under nine lines about shampoo.
   */
  const MAX_ITEMS = 8;
  if (items.length > MAX_ITEMS) {
    const hidden = items.length - MAX_ITEMS;
    items.length = MAX_ITEMS;
    notes.push(`${hidden} lower-priority item(s) not shown.`);
  }

  return {
    ok: true,
    headline: typeof parsed.headline === "string" ? parsed.headline.trim() : "",
    items,
    steps,
    notes,
    model: engine.model,
    engine: engine.name,
    cached: false,
    createdAt,
  };
}
