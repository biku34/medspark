import { guard, ok } from "@/lib/api";
import { adminStats } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await guard("admin");
  if ("error" in g) return g.error;
  return ok(await adminStats());
}
