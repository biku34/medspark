import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { Role, User } from "./types";
import { getStore } from "./db";

/**
 * Prototype session handling: a signed (not encrypted) cookie.
 * Production should move to a real auth provider — see README, "Production gaps".
 */

const COOKIE = "medspark_session";
const MAX_AGE = 60 * 60 * 24 * 7;

export interface Session {
  userId: string;
  role: Role;
  name: string;
  pharmacyId?: string;
}

function secret(): string {
  return process.env.SESSION_SECRET || "medspark-dev-secret-change-me";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(session: Session): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  const expected = sign(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return decode(jar.get(COOKIE)?.value);
}

export async function setSession(user: User): Promise<Session> {
  const session: Session = {
    userId: user.id,
    role: user.role,
    name: user.name,
    pharmacyId: user.pharmacyId,
  };
  const jar = await cookies();
  jar.set(COOKIE, encode(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
  return session;
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session) return null;
  const store = await getStore();
  return store.one<User>("users", { id: session.userId });
}

/** Returns the session if the role matches, otherwise null (callers redirect). */
export async function sessionWithRole(...roles: Role[]): Promise<Session | null> {
  const session = await getSession();
  if (!session || !roles.includes(session.role)) return null;
  return session;
}

export const ROLE_HOME: Record<Role, string> = {
  customer: "/",
  provider: "/provider",
  pharmacist: "/pharmacist",
  pharmacy: "/pharmacy",
  delivery: "/delivery",
  admin: "/admin",
};
