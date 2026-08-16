import { bad, ok, readOrigin } from "@/lib/api";
import { medicineById, DEFAULT_ORIGIN } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const result = await medicineById(id, readOrigin(new URL(req.url)) ?? DEFAULT_ORIGIN);
  if (!result) return bad("Medicine not found", 404);
  return ok(result);
}
