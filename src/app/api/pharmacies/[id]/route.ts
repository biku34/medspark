import { bad, guard, ok, readJson } from "@/lib/api";
import { getStore } from "@/lib/db";
import type { InventoryItem, Pharmacy } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const store = await getStore();
  const pharmacy = await store.one<Pharmacy>("pharmacies", { id });
  if (!pharmacy) return bad("Pharmacy not found", 404);
  const inventory = await store.list<InventoryItem>("inventory", { pharmacyId: id });
  return ok({ pharmacy, inventory });
}

/** Admin: verify / suspend / reactivate a pharmacy. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("admin");
  if ("error" in g) return g.error;

  const { id } = await ctx.params;
  const body = await readJson<{ action?: string }>(req);
  const patch: Partial<Pharmacy> = {};

  switch (body?.action) {
    case "verify":
      patch.verified = true;
      patch.status = "ACTIVE";
      break;
    case "suspend":
      patch.status = "SUSPENDED";
      break;
    case "reactivate":
      patch.status = "ACTIVE";
      break;
    default:
      return bad("Unknown action");
  }

  const store = await getStore();
  const pharmacy = await store.update<Pharmacy>("pharmacies", id, patch);
  if (!pharmacy) return bad("Pharmacy not found", 404);
  return ok({ pharmacy });
}
