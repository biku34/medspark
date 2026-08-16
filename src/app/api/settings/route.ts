import { bad, guard, ok, readJson } from "@/lib/api";
import { getStore } from "@/lib/db";
import { getServiceSettings } from "@/lib/home-care";
import { SETTINGS_ID } from "@/lib/seed-home-care";
import type { ServiceRateConfig, ServiceSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Public: the booking screens need the live rates and the advance-notice rule. */
export async function GET() {
  return ok({ settings: await getServiceSettings() });
}

/** Admin: adjust home-visit pricing and the advance-booking window. */
export async function PATCH(req: Request) {
  const g = await guard("admin");
  if ("error" in g) return g.error;

  const body = await readJson<{
    physio?: Partial<ServiceRateConfig>;
    nursing?: Partial<ServiceRateConfig>;
    minAdvanceDays?: number;
  }>(req);
  if (!body) return bad("Nothing to update");

  const current = await getServiceSettings();

  const merge = (base: ServiceRateConfig, patch?: Partial<ServiceRateConfig>) => ({
    rate: Math.max(0, Number(patch?.rate ?? base.rate)),
    platformFee: Math.max(0, Number(patch?.platformFee ?? base.platformFee)),
    minHours: Math.max(1, Number(patch?.minHours ?? base.minHours)),
    maxHours: Math.max(1, Number(patch?.maxHours ?? base.maxHours)),
  });

  const next: ServiceSettings = {
    id: SETTINGS_ID,
    physio: merge(current.physio, body.physio),
    nursing: merge(current.nursing, body.nursing),
    // Never allow same-day booking to be switched on from the dashboard.
    minAdvanceDays: Math.max(1, Number(body.minAdvanceDays ?? current.minAdvanceDays)),
    updatedAt: new Date().toISOString(),
  };

  const store = await getStore();
  const existing = await store.one<ServiceSettings>("settings", { id: SETTINGS_ID });
  if (existing) await store.update<ServiceSettings>("settings", SETTINGS_ID, next);
  else await store.insert("settings", next);

  return ok({ settings: next });
}
