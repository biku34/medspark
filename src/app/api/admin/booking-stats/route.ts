import { guard, ok } from "@/lib/api";
import { bookingAnalytics } from "@/lib/home-care";

export const dynamic = "force-dynamic";

/** Home-healthcare booking analytics for the admin dashboard. */
export async function GET() {
  const g = await guard("admin");
  if ("error" in g) return g.error;
  return ok(await bookingAnalytics());
}
