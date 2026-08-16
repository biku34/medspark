import { NextResponse } from "next/server";
import { getSession, type Session } from "./session";
import type { Role } from "./types";

export function ok<T>(data: T, init?: number) {
  return NextResponse.json(data, { status: init ?? 200 });
}

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Guards a route handler by role. Returns either the session or a ready-made
 * error response — callers do `if ("error" in guard) return guard.error;`.
 */
export async function guard(
  ...roles: Role[]
): Promise<{ session: Session } | { error: NextResponse }> {
  const session = await getSession();
  if (!session) return { error: bad("Not signed in", 401) };
  if (roles.length && !roles.includes(session.role)) {
    return { error: bad("Not allowed for this role", 403) };
  }
  return { session };
}

/**
 * Reads the customer's coordinates from `?lat=&lng=`.
 * Returns undefined when absent so callers fall back to the default area.
 */
export function readOrigin(url: URL): { lat: number; lng: number } | undefined {
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  if (lat === 0 && lng === 0) return undefined;
  return { lat, lng };
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
