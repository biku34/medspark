import { bad, guard, ok, readJson } from "@/lib/api";
import { getStore } from "@/lib/db";
import type { Role, User } from "@/lib/types";
import { newId } from "@/lib/utils";

export const dynamic = "force-dynamic";

const scrub = (u: User) => ({ ...u, password: undefined });

/** Admin: list platform users, optionally filtered by role. */
export async function GET(req: Request) {
  const g = await guard("admin");
  if ("error" in g) return g.error;

  const role = new URL(req.url).searchParams.get("role") as Role | null;
  const store = await getStore();
  const users = await store.list<User>("users", role ? { role } : {});
  users.sort((a, b) => a.name.localeCompare(b.name));
  return ok({ users: users.map(scrub) });
}

/** Admin: onboard a pharmacist (or other staff role). */
export async function POST(req: Request) {
  const g = await guard("admin");
  if ("error" in g) return g.error;

  const body = await readJson<Partial<User>>(req);
  if (!body?.name || !body.email) return bad("Name and email are required");

  const store = await getStore();
  const existing = await store.one<User>("users", { email: body.email.toLowerCase() });
  if (existing) return bad("A user with that email already exists", 409);

  const user: User = {
    id: newId("usr"),
    role: (body.role as Role) ?? "pharmacist",
    name: body.name,
    email: body.email.toLowerCase(),
    phone: body.phone ?? "—",
    password: body.password ?? "demo1234",
    licenseNo: body.licenseNo,
    pharmacyId: body.pharmacyId,
    active: true,
    createdAt: new Date().toISOString(),
  };
  await store.insert("users", user);
  return ok({ user: scrub(user) }, 201);
}

/** Admin: activate / deactivate an account. */
export async function PATCH(req: Request) {
  const g = await guard("admin");
  if ("error" in g) return g.error;

  const body = await readJson<{ id?: string; active?: boolean }>(req);
  if (!body?.id) return bad("id required");

  const store = await getStore();
  const user = await store.update<User>("users", body.id, { active: !!body.active });
  if (!user) return bad("User not found", 404);
  return ok({ user: scrub(user) });
}
