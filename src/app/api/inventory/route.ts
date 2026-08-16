import { bad, guard, ok, readJson } from "@/lib/api";
import { getStore } from "@/lib/db";
import type { InventoryItem, Medicine, StockAlert } from "@/lib/types";
import { newId } from "@/lib/utils";
import { notify } from "@/lib/services";

export const dynamic = "force-dynamic";

/** GET /api/inventory?pharmacyId=... — inventory joined with the catalogue. */
export async function GET(req: Request) {
  const g = await guard("pharmacy", "pharmacist", "admin");
  if ("error" in g) return g.error;

  const url = new URL(req.url);
  const pharmacyId = url.searchParams.get("pharmacyId") || g.session.pharmacyId;
  if (!pharmacyId) return bad("pharmacyId required");

  const store = await getStore();
  const [inventory, medicines] = await Promise.all([
    store.list<InventoryItem>("inventory", { pharmacyId }),
    store.list<Medicine>("medicines"),
  ]);
  const medById = new Map(medicines.map((m) => [m.id, m]));

  const rows = inventory
    .map((item) => ({ ...item, medicine: medById.get(item.medicineId) }))
    .filter((r) => r.medicine)
    .sort((a, b) => a.medicine!.name.localeCompare(b.medicine!.name));

  return ok({ inventory: rows, catalogue: medicines });
}

/** POST — add a catalogue medicine to this pharmacy's shelf. */
export async function POST(req: Request) {
  const g = await guard("pharmacy", "pharmacist", "admin");
  if ("error" in g) return g.error;

  const body = await readJson<{
    pharmacyId?: string;
    medicineId?: string;
    stock?: number;
    price?: number;
  }>(req);
  const pharmacyId = body?.pharmacyId || g.session.pharmacyId;
  if (!pharmacyId || !body?.medicineId) return bad("pharmacyId and medicineId required");

  const store = await getStore();
  const medicine = await store.one<Medicine>("medicines", { id: body.medicineId });
  if (!medicine) return bad("Unknown medicine", 404);

  const existing = await store.one<InventoryItem>("inventory", {
    pharmacyId,
    medicineId: body.medicineId,
  });

  const stock = Math.max(0, Number(body.stock ?? 0));
  const price = Math.max(0, Number(body.price ?? medicine.mrp));

  if (existing) {
    const updated = await store.update<InventoryItem>("inventory", existing.id, {
      stock,
      price,
      updatedAt: new Date().toISOString(),
    });
    await fireStockAlerts(body.medicineId, existing.stock, stock, medicine.name);
    return ok({ item: updated });
  }

  const item: InventoryItem = {
    id: newId("inv"),
    pharmacyId,
    medicineId: body.medicineId,
    stock,
    price,
    updatedAt: new Date().toISOString(),
  };
  await store.insert("inventory", item);
  await fireStockAlerts(body.medicineId, 0, stock, medicine.name);
  return ok({ item }, 201);
}

/** PATCH — adjust stock/price of an existing shelf line. */
export async function PATCH(req: Request) {
  const g = await guard("pharmacy", "pharmacist", "admin");
  if ("error" in g) return g.error;

  const body = await readJson<{ id?: string; stock?: number; price?: number }>(req);
  if (!body?.id) return bad("Inventory id required");

  const store = await getStore();
  const existing = await store.one<InventoryItem>("inventory", { id: body.id });
  if (!existing) return bad("Inventory line not found", 404);

  const patch: Partial<InventoryItem> = { updatedAt: new Date().toISOString() };
  if (body.stock !== undefined) patch.stock = Math.max(0, Number(body.stock));
  if (body.price !== undefined) patch.price = Math.max(0, Number(body.price));

  const updated = await store.update<InventoryItem>("inventory", body.id, patch);

  if (patch.stock !== undefined) {
    const medicine = await store.one<Medicine>("medicines", { id: existing.medicineId });
    await fireStockAlerts(existing.medicineId, existing.stock, patch.stock, medicine?.name ?? "");
  }
  return ok({ item: updated });
}

export async function DELETE(req: Request) {
  const g = await guard("pharmacy", "pharmacist", "admin");
  if ("error" in g) return g.error;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return bad("id required");

  const store = await getStore();
  const removed = await store.remove("inventory", id);
  return ok({ removed });
}

/** "Notify me when available" — fires when stock crosses 0 -> positive. */
async function fireStockAlerts(
  medicineId: string,
  before: number,
  after: number,
  medicineName: string,
) {
  if (!(before === 0 && after > 0)) return;
  const store = await getStore();
  const alerts = await store.list<StockAlert>("stockAlerts", { medicineId });
  for (const alert of alerts) {
    await notify(alert.userId, {
      kind: "STOCK",
      title: "Back in stock",
      body: `${medicineName} is available again at a pharmacy near you.`,
      href: `/medicine/${medicineId}`,
    });
    await store.remove("stockAlerts", alert.id);
  }
}
