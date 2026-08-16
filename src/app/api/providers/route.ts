import { bad, guard, ok, readJson, readOrigin } from "@/lib/api";
import { getStore } from "@/lib/db";
import { DEFAULT_ORIGIN } from "@/lib/services";
import { matchProviders } from "@/lib/home-care";
import type { ServiceProvider, ServiceType, User } from "@/lib/types";
import { newId } from "@/lib/utils";
import { SERVICE_AREAS, DEFAULT_AREA } from "@/lib/zones";

export const dynamic = "force-dynamic";

/**
 * GET /api/providers?type=PHYSIO|NURSING&lat=&lng=&date=YYYY-MM-DD
 *   -> verified providers who cover this address, with free slots for the date
 * GET /api/providers?all=1  -> raw list (admin)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);

  if (url.searchParams.get("all") === "1") {
    const g = await guard("admin");
    if ("error" in g) return g.error;
    const store = await getStore();
    const providers = await store.list<ServiceProvider>("providers");
    providers.sort((a, b) => a.name.localeCompare(b.name));
    return ok({ providers });
  }

  const type = (url.searchParams.get("type") ?? "PHYSIO") as ServiceType;
  if (type !== "PHYSIO" && type !== "NURSING") return bad("Unknown service type");

  const origin = readOrigin(url) ?? DEFAULT_ORIGIN;
  const date = url.searchParams.get("date") ?? undefined;

  const offers = await matchProviders(type, origin, date);
  return ok({ offers, type, date });
}

/** Admin: onboard a provider. Starts PENDING until credentials are verified. */
export async function POST(req: Request) {
  const g = await guard("admin");
  if ("error" in g) return g.error;

  const body = await readJson<
    Partial<ServiceProvider> & { email?: string; phone?: string; password?: string }
  >(req);
  if (!body?.name || !body.type || !body.registrationNo) {
    return bad("Name, service type and registration number are required");
  }
  if (body.type !== "PHYSIO" && body.type !== "NURSING") return bad("Unknown service type");

  const store = await getStore();

  // Every provider needs a login so they can manage their own bookings.
  const email = (body.email ?? "").trim().toLowerCase();
  if (!email) return bad("A login email is required for the provider");
  if (await store.one<User>("users", { email })) {
    return bad("A user with that email already exists", 409);
  }

  const area =
    SERVICE_AREAS.find((a) => a.name === body.serviceAreas?.[0] && a.city === body.city) ??
    SERVICE_AREAS.find((a) => a.city === body.city) ??
    DEFAULT_AREA;

  const user: User = {
    id: newId("usr"),
    role: "provider",
    name: body.name,
    email,
    phone: body.phone ?? "—",
    password: body.password ?? "demo1234",
    licenseNo: body.registrationNo,
    active: true,
    createdAt: new Date().toISOString(),
  };
  await store.insert("users", user);

  const provider: ServiceProvider = {
    id: newId("prv"),
    userId: user.id,
    type: body.type,
    name: body.name,
    emoji: body.type === "PHYSIO" ? "🧑‍⚕️" : "👩‍⚕️",
    headline: body.headline ?? "",
    bio: body.bio ?? "",
    qualifications: body.qualifications ?? [],
    registrationNo: body.registrationNo,
    experienceYears: Number(body.experienceYears ?? 0),
    languages: body.languages ?? ["Gujarati", "Hindi", "English"],
    specialities: body.specialities ?? [],
    serviceAreas: body.serviceAreas ?? [area.name],
    city: body.city ?? area.city,
    lat: body.lat ?? area.lat,
    lng: body.lng ?? area.lng,
    serviceRadiusKm: Number(body.serviceRadiusKm ?? 10),
    hourlyRate: Number(body.hourlyRate ?? (body.type === "PHYSIO" ? 500 : 300)),
    rating: 0,
    ratingCount: 0,
    completedVisits: 0,
    availability: body.availability ?? {
      weekdays: [1, 2, 3, 4, 5, 6],
      slots: ["08:00-10:00", "10:00-12:00", "16:00-18:00", "18:00-20:00"],
    },
    credentials: [],
    verified: false,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };
  await store.insert("providers", provider);

  return ok({ provider, loginEmail: email }, 201);
}
