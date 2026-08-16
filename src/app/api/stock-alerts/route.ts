import { bad, guard, ok, readJson } from "@/lib/api";
import { getStore } from "@/lib/db";
import type { Medicine, StockAlert, User } from "@/lib/types";
import { newId } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** "Notify me when available" for a medicine no nearby pharmacy currently stocks. */
export async function POST(req: Request) {
  const g = await guard("customer");
  if ("error" in g) return g.error;

  const body = await readJson<{ medicineId?: string }>(req);
  if (!body?.medicineId) return bad("medicineId required");

  const store = await getStore();
  const medicine = await store.one<Medicine>("medicines", { id: body.medicineId });
  if (!medicine) return bad("Medicine not found", 404);

  const existing = await store.one<StockAlert>("stockAlerts", {
    medicineId: body.medicineId,
    userId: g.session.userId,
  });
  if (existing) return ok({ alert: existing, alreadySubscribed: true });

  const user = await store.one<User>("users", { id: g.session.userId });
  const alert: StockAlert = {
    id: newId("alert"),
    medicineId: medicine.id,
    medicineName: medicine.name,
    userId: g.session.userId,
    phone: user?.phone ?? "—",
    createdAt: new Date().toISOString(),
  };
  await store.insert("stockAlerts", alert);
  return ok({ alert }, 201);
}

export async function GET() {
  const g = await guard("customer", "admin");
  if ("error" in g) return g.error;
  const store = await getStore();
  const alerts = await store.list<StockAlert>("stockAlerts");
  return ok({
    alerts: g.session.role === "admin" ? alerts : alerts.filter((a) => a.userId === g.session.userId),
  });
}
