import { bad, guard, ok } from "@/lib/api";
import { describeMongoError, driverName, getStore, reseed } from "@/lib/db";
import type { User } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Wipes and re-seeds demo data.
 *
 * Access rules, in order:
 *   1. An empty database may be seeded by anyone — this is the first-run
 *      bootstrap for a fresh Atlas cluster, when no admin exists yet.
 *   2. Once there is data, only a signed-in admin may reset it. Without this,
 *      any visitor could destroy every live order, booking and prescription.
 *   3. A SEED_TOKEN header also works, for CI or scripted re-seeding.
 */
export async function POST(req: Request) {
  const store = await getStore();
  const users = await store.list<User>("users");
  const isEmpty = users.length === 0;

  if (!isEmpty) {
    const token = process.env.SEED_TOKEN;
    const provided = req.headers.get("x-seed-token");
    const tokenOk = !!token && provided === token;

    if (!tokenOk) {
      const g = await guard("admin");
      if ("error" in g) {
        return bad(
          "This database already holds live data. Sign in as an admin (or send a valid x-seed-token) to reset it.",
          403,
        );
      }
    }
  }

  await reseed();
  return ok({ reseeded: true, bootstrap: isEmpty, driver: driverName() });
}

/** Health check: which driver is live and whether the data is seeded. */
export async function GET() {
  const driver = driverName();
  try {
    const store = await getStore();
    const [users, medicines, orders] = await Promise.all([
      store.list<User>("users"),
      store.list("medicines"),
      store.list("orders"),
    ]);
    return ok({
      driver,
      connected: true,
      seeded: users.length > 0,
      counts: { users: users.length, medicines: medicines.length, orders: orders.length },
    });
  } catch (err) {
    // Surface the real reason *and* what to do about it — a missing Atlas IP
    // allowlist entry shows up only as an opaque OpenSSL alert otherwise.
    const { message, hint } = describeMongoError(err);
    return ok({ driver, connected: false, error: message, hint }, 200);
  }
}
