import { ok, readOrigin } from "@/lib/api";
import { logSearch, searchMedicines } from "@/lib/services";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const category = url.searchParams.get("category") ?? undefined;
  const subcategory = url.searchParams.get("sub") ?? undefined;
  const shelfOnly = url.searchParams.get("shelf") === "1";
  const limit = Number(url.searchParams.get("limit") ?? 60);
  const track = url.searchParams.get("track") === "1";

  // Availability is always relative to where the customer actually is.
  const results = await searchMedicines(q, {
    category,
    subcategory,
    shelfOnly,
    limit,
    origin: readOrigin(url),
  });

  if (track && q.trim()) {
    const session = await getSession();
    await logSearch(q, session?.userId, results[0]?.medicine.id);
  }

  return ok({ query: q, count: results.length, results });
}
