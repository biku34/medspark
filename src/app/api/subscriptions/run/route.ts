import { bad, ok } from "@/lib/api";
import { getSession } from "@/lib/session";
import { runDueSubscriptions } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

/**
 * POST /api/subscriptions/run — process every repeat delivery that is due.
 *
 * In production this is what a Vercel Cron entry hits once a morning:
 *
 *   { "crons": [{ "path": "/api/subscriptions/run", "schedule": "0 3 * * *" }] }
 *
 * Vercel signs cron calls with CRON_SECRET, so accept either that bearer token
 * or a signed-in admin. It must never be open: it creates real orders.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  const viaCron = Boolean(secret) && bearer === secret;
  if (!viaCron) {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return bad("Not allowed — admin session or CRON_SECRET required", 403);
    }
  }

  const outcomes = await runDueSubscriptions(100);

  return ok({
    ranAt: new Date().toISOString(),
    processed: outcomes.length,
    ordered: outcomes.filter((o) => o.result === "ORDERED").length,
    skipped: outcomes.filter((o) => o.result === "SKIPPED").length,
    heldForPrescription: outcomes.filter((o) => o.result === "PAUSED_RX").length,
    outOfStock: outcomes.filter((o) => o.result === "OUT_OF_STOCK").length,
    outcomes,
  });
}

/** GET — same thing, so a browser or curl can trigger it during the demo. */
export async function GET(req: Request) {
  return POST(req);
}
