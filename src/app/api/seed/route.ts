import { ok } from "@/lib/api";
import { driverName, reseed } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Wipes and re-seeds demo data. Wired to the "Reset demo data" button. */
export async function POST() {
  await reseed();
  return ok({ reseeded: true, driver: driverName() });
}

export async function GET() {
  return ok({ driver: driverName() });
}
