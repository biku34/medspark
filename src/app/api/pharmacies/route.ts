import { bad, guard, ok, readJson, readOrigin } from "@/lib/api";
import { getStore } from "@/lib/db";
import { DEFAULT_ORIGIN, pharmacyOffers, servingPharmacies, type SortKey } from "@/lib/services";
import type { Pharmacy } from "@/lib/types";
import { newId } from "@/lib/utils";
import { DEFAULT_AREA, SERVICE_AREAS } from "@/lib/zones";

export const dynamic = "force-dynamic";

/**
 * GET /api/pharmacies
 *   ?items=<medicineId:qty,medicineId:qty>&sort=fastest|nearest|cheapest|rating
 *      -> pharmacies matched against a basket (customer pharmacy-choice screen)
 *   ?all=1  -> raw pharmacy list (admin)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);

  if (url.searchParams.get("all") === "1") {
    const store = await getStore();
    const pharmacies = await store.list<Pharmacy>("pharmacies");
    return ok({ pharmacies });
  }

  const itemsParam = url.searchParams.get("items") ?? "";
  const sort = (url.searchParams.get("sort") ?? "fastest") as SortKey;
  const origin = readOrigin(url) ?? DEFAULT_ORIGIN;

  const basket = itemsParam
    .split(",")
    .filter(Boolean)
    .map((chunk) => {
      const [medicineId, qty] = chunk.split(":");
      return { medicineId, qty: Math.max(1, Number(qty) || 1) };
    });

  if (!basket.length) {
    return ok({ offers: [], pharmacies: await servingPharmacies(origin) });
  }

  const offers = await pharmacyOffers(basket, sort, origin);
  return ok({ offers, sort });
}

/** Admin: onboard a pharmacy (starts unverified / PENDING). */
export async function POST(req: Request) {
  const g = await guard("admin");
  if ("error" in g) return g.error;

  const body = await readJson<Partial<Pharmacy>>(req);
  if (!body?.name || !body.licenseNo) return bad("Pharmacy name and licence number required");

  // Anchor a new pharmacy to the service area it says it is in.
  const area =
    SERVICE_AREAS.find((a) => a.name === body.locality && a.city === body.city) ??
    SERVICE_AREAS.find((a) => a.name === body.locality) ??
    DEFAULT_AREA;

  const store = await getStore();
  const pharmacy: Pharmacy = {
    id: newId("ph"),
    name: body.name,
    ownerName: body.ownerName ?? "—",
    phone: body.phone ?? "—",
    licenseNo: body.licenseNo,
    address: body.address ?? "—",
    locality: body.locality ?? area.name,
    city: body.city ?? area.city,
    // Jitter by ~150 m so co-located pharmacies don't stack on the map.
    lat: body.lat ?? area.lat + (Math.random() - 0.5) * 0.003,
    lng: body.lng ?? area.lng + (Math.random() - 0.5) * 0.003,
    rating: 0,
    ratingCount: 0,
    deliveryFee: body.deliveryFee ?? 25,
    prepMinutes: body.prepMinutes ?? 12,
    openTime: body.openTime ?? "09:00",
    closeTime: body.closeTime ?? "22:00",
    status: "PENDING",
    verified: false,
    createdAt: new Date().toISOString(),
  };
  await store.insert("pharmacies", pharmacy);
  return ok({ pharmacy }, 201);
}
