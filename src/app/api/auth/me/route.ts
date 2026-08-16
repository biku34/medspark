import { ok } from "@/lib/api";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return ok({ user: null });
  return ok({ user: { ...user, password: undefined } });
}
