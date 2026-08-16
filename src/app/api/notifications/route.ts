import { guard, ok, readJson } from "@/lib/api";
import { getStore } from "@/lib/db";
import type { Notification } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await guard();
  if ("error" in g) return g.error;

  const store = await getStore();
  const list = await store.list<Notification>("notifications", { userId: g.session.userId });
  list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  return ok({ notifications: list, unread: list.filter((n) => !n.read).length });
}

/** Mark one notification (or all) as read. */
export async function PATCH(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;

  const body = await readJson<{ id?: string; all?: boolean }>(req);
  const store = await getStore();

  if (body?.all) {
    const list = await store.list<Notification>("notifications", { userId: g.session.userId });
    for (const n of list.filter((x) => !x.read)) {
      await store.update<Notification>("notifications", n.id, { read: true });
    }
    return ok({ updated: true });
  }

  if (body?.id) await store.update<Notification>("notifications", body.id, { read: true });
  return ok({ updated: true });
}
