import { ok } from "@/lib/api";
import { clearSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearSession();
  return ok({ signedOut: true });
}
