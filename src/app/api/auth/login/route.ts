import { bad, ok, readJson } from "@/lib/api";
import { getStore } from "@/lib/db";
import { ROLE_HOME, setSession } from "@/lib/session";
import type { User } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Demo credential check. Passwords are seeded in plaintext purely so the
 * prototype is self-contained — production must hash + rate-limit here.
 */
export async function POST(req: Request) {
  const body = await readJson<{ email?: string; password?: string; otp?: string }>(req);
  const email = body?.email?.trim().toLowerCase();
  if (!email) return bad("Email is required");

  const store = await getStore();
  const user = await store.one<User>("users", { email });
  if (!user) return bad("No account found for that email", 401);
  if (!user.active) return bad("This account is inactive. Contact MedSpark support.", 403);

  // Two prototype paths: password, or the simulated OTP shown on the login screen.
  const otpOk = body?.otp && body.otp === (process.env.OTP_DEMO_CODE || "123456");
  if (!otpOk && body?.password !== user.password) return bad("Incorrect password", 401);

  const session = await setSession(user);
  return ok({ session, home: ROLE_HOME[user.role], user: { ...user, password: undefined } });
}
