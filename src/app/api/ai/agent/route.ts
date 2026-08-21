import { bad, guard, ok, readJson } from "@/lib/api";
import { runOperationsAgent } from "@/lib/ai/agent";
import { aiEnabled } from "@/lib/ai/router";

export const dynamic = "force-dynamic";
// A loop of tool calls, so it needs more room than a single completion.
export const maxDuration = 60;

/**
 * POST /api/ai/agent — the shift briefing, or an answer to one question.
 *
 * Pharmacy and pharmacist only, and the agent is scoped to their own pharmacy
 * by the tools themselves rather than by the prompt. It reads and reports; it
 * has no tool that can change anything.
 */
export async function POST(req: Request) {
  const g = await guard("pharmacy", "pharmacist", "admin");
  if ("error" in g) return g.error;

  if (!aiEnabled()) {
    return bad("No AI provider is configured.", 503);
  }
  if (!g.session.pharmacyId) {
    return bad("This account is not linked to a pharmacy.", 409);
  }

  const body = await readJson<{ question?: string }>(req);
  const briefing = await runOperationsAgent(g.session, body?.question);
  return ok({ briefing });
}
