"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bike,
  CheckCircle2,
  Clock3,
  IndianRupee,
  MapPin,
  Package,
  Plus,
  Search,
  ShieldCheck,
  Star,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { StaffShell } from "@/components/staff-shell";
import { useApp } from "@/components/providers";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  KeyValue,
  Modal,
  SectionTitle,
  Select,
  Skeleton,
  Stat,
  Tabs,
} from "@/components/ui";
import { RankedBars } from "@/components/charts";
import { api, patch, post } from "@/lib/client";
import { ORDER_LABELS, type InventoryItem, type Medicine, type Order } from "@/lib/types";
import { dateTime, inr, relativeTime } from "@/lib/utils";

type Tab = "new" | "active" | "completed" | "inventory" | "earnings" | "ratings";

interface InventoryRow extends InventoryItem {
  medicine?: Medicine;
}

export default function PharmacyDashboard() {
  const { user, toast } = useApp();
  const [tab, setTab] = useState<Tab>("new");
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [catalogue, setCatalogue] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [invQuery, setInvQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ medicineId: "", stock: 10, price: 0 });

  const load = useCallback(async () => {
    try {
      const [o, inv] = await Promise.all([
        api<{ orders: Order[] }>("/api/orders"),
        api<{ inventory: InventoryRow[]; catalogue: Medicine[] }>("/api/inventory"),
      ]);
      setOrders(o.orders);
      setInventory(inv.inventory);
      setCatalogue(inv.catalogue);
    } catch {
      /* handled by shell auth guard */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [user, load]);

  const newOrders = orders.filter((o) => o.status === "PLACED");
  const activeOrders = orders.filter((o) =>
    ["PREPARING", "READY", "OUT_FOR_DELIVERY"].includes(o.status),
  );
  const completed = orders.filter((o) =>
    ["DELIVERED", "CANCELLED", "REJECTED"].includes(o.status),
  );

  const act = async (order: Order, action: string) => {
    setBusyId(order.id);
    try {
      await patch(`/api/orders/${order.id}`, { action });
      toast({ kind: "success", title: `Order ${order.code} updated` });
      await load();
    } catch (e) {
      toast({ kind: "error", title: "Update failed", body: (e as Error).message });
    } finally {
      setBusyId(null);
    }
  };

  const updateStock = async (item: InventoryRow, stock: number, price?: number) => {
    setInventory((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, stock, price: price ?? i.price } : i)),
    );
    try {
      await patch("/api/inventory", { id: item.id, stock, price });
    } catch {
      toast({ kind: "error", title: "Could not save stock" });
      await load();
    }
  };

  /* ------------------------------- earnings ------------------------------ */
  const earnings = useMemo(() => {
    const delivered = orders.filter((o) => o.status === "DELIVERED");
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const today = delivered.filter((o) => new Date(o.createdAt) >= startOfToday);
    const week = delivered.filter(
      (o) => Date.now() - new Date(o.createdAt).getTime() < 7 * 864e5,
    );
    const sum = (list: Order[]) => list.reduce((s, o) => s + o.subtotal, 0);
    return {
      today: sum(today),
      week: sum(week),
      allTime: sum(delivered),
      orders: delivered.length,
      avg: delivered.length ? Math.round(sum(delivered) / delivered.length) : 0,
      topMedicines: Object.entries(
        delivered
          .flatMap((o) => o.items)
          .reduce<Record<string, number>>((acc, i) => {
            acc[i.name] = (acc[i.name] ?? 0) + i.qty;
            return acc;
          }, {}),
      )
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6),
    };
  }, [orders]);

  const filteredInventory = inventory.filter((i) =>
    invQuery ? i.medicine?.name.toLowerCase().includes(invQuery.toLowerCase()) : true,
  );
  const outOfStock = inventory.filter((i) => i.stock === 0).length;
  const lowStock = inventory.filter((i) => i.stock > 0 && i.stock <= 5).length;

  return (
    <StaffShell role="pharmacy">
      <SectionTitle
        title={user?.name ?? "Pharmacy"}
        subtitle="Incoming orders, stock and earnings for your store."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="New orders" value={newOrders.length} tone="amber" icon={<Package size={15} />} />
        <Stat label="Active" value={activeOrders.length} tone="brand" icon={<Bike size={15} />} />
        <Stat label="Out of stock" value={outOfStock} tone="red" icon={<XCircle size={15} />} hint={`${lowStock} low`} />
        <Stat label="Earnings today" value={inr(earnings.today)} tone="green" icon={<IndianRupee size={15} />} />
      </div>

      <Tabs<Tab>
        tabs={[
          { id: "new", label: "New Orders", count: newOrders.length },
          { id: "active", label: "Active Orders", count: activeOrders.length },
          { id: "completed", label: "Completed", count: completed.length },
          { id: "inventory", label: "Inventory", count: inventory.length },
          { id: "earnings", label: "Earnings" },
          { id: "ratings", label: "Ratings" },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="mt-4">
        {loading && <Skeleton className="h-48" />}

        {/* ------------------------------ orders ------------------------------ */}
        {!loading && (tab === "new" || tab === "active" || tab === "completed") && (
          <div className="grid gap-3 lg:grid-cols-2">
            {(tab === "new" ? newOrders : tab === "active" ? activeOrders : completed).length === 0 ? (
              <div className="lg:col-span-2">
                <EmptyState
                  icon={<Package size={38} />}
                  title={tab === "new" ? "No new orders right now" : "Nothing here yet"}
                  body="New customer orders appear here automatically."
                />
              </div>
            ) : (
              (tab === "new" ? newOrders : tab === "active" ? activeOrders : completed).map((o) => (
                <Card key={o.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-bold text-ink-900">{o.code}</p>
                      <p className="text-xs text-ink-500">
                        {dateTime(o.createdAt)} · {relativeTime(o.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge tone={o.type === "RX" ? "amber" : "green"}>
                        {o.type === "RX" ? "Prescription" : "OTC"}
                      </Badge>
                      {o.type === "RX" && (
                        <Badge tone="green" icon={<ShieldCheck size={11} />}>
                          Prescription Verified ✓
                        </Badge>
                      )}
                    </div>
                  </div>

                  <ul className="mt-3 divide-y divide-ink-100 rounded-xl bg-ink-50 px-3">
                    {o.items.map((i) => (
                      <li key={i.medicineId} className="flex items-center justify-between gap-2 py-2 text-sm">
                        <span className="min-w-0 truncate text-ink-800">
                          {i.name} <span className="text-ink-400">({i.form})</span>
                        </span>
                        <span className="shrink-0 font-semibold text-ink-900">× {i.qty}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-ink-600">
                    <span className="flex items-center gap-1">
                      <MapPin size={12} className="text-ink-400" />
                      {o.locality} · {o.distanceKm} km
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock3 size={12} className="text-ink-400" />
                      ETA {o.etaMinFrom}–{o.etaMinTo} min
                    </span>
                    <span className="flex items-center gap-1">
                      <Bike size={12} className="text-ink-400" />
                      {o.deliveryPartnerName ?? "Rider not assigned"}
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-ink-800">
                      <IndianRupee size={12} className="text-ink-400" />
                      {inr(o.total)} · {o.paymentMode}
                    </span>
                  </div>

                  <p className="mt-2 text-xs font-medium text-ink-700">{ORDER_LABELS[o.status]}</p>

                  {/* actions */}
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-100 pt-3">
                    {o.status === "PLACED" && (
                      <>
                        <Button
                          size="sm"
                          variant="success"
                          loading={busyId === o.id}
                          icon={<CheckCircle2 size={14} />}
                          onClick={() => act(o, "accept")}
                        >
                          Accept Order
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          loading={busyId === o.id}
                          onClick={() => act(o, "reject")}
                        >
                          Reject / Out of Stock
                        </Button>
                      </>
                    )}
                    {o.status === "PREPARING" && (
                      <Button size="sm" loading={busyId === o.id} onClick={() => act(o, "ready")}>
                        Ready for Pickup
                      </Button>
                    )}
                    {o.status === "READY" && (
                      <Badge tone="blue">Waiting for delivery partner pickup</Badge>
                    )}
                    {o.status === "OUT_FOR_DELIVERY" && <Badge tone="brand">Out for delivery</Badge>}
                    {["DELIVERED", "CANCELLED", "REJECTED"].includes(o.status) && (
                      <Badge tone={o.status === "DELIVERED" ? "green" : "red"}>
                        {ORDER_LABELS[o.status]}
                      </Badge>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {/* ---------------------------- inventory ---------------------------- */}
        {!loading && tab === "inventory" && (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="relative min-w-56 flex-1">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
                />
                <Input
                  value={invQuery}
                  onChange={(e) => setInvQuery(e.target.value)}
                  placeholder="Filter your shelf…"
                  className="pl-9"
                />
              </div>
              <Button icon={<Plus size={16} />} onClick={() => setAddOpen(true)}>
                Add medicine
              </Button>
            </div>

            <p className="mb-2 text-xs text-ink-500">
              Availability shown to customers updates instantly from this list. Stock reaching 0
              removes the medicine from nearby-search results.
            </p>

            <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="px-3 py-2.5">Medicine</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Price</th>
                    <th className="px-3 py-2.5">Stock</th>
                    <th className="px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {filteredInventory.map((i) => (
                    <tr key={i.id}>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-ink-900">{i.medicine?.name}</p>
                        <p className="text-xs text-ink-500">
                          {i.medicine?.brand} · {i.medicine?.strength} · {i.medicine?.form}
                        </p>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={i.medicine?.type === "OTC" ? "green" : "amber"}>
                          {i.medicine?.type}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="number"
                          value={i.price}
                          min={0}
                          onChange={(e) => updateStock(i, i.stock, Number(e.target.value))}
                          className="w-20 rounded-lg border border-ink-200 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateStock(i, Math.max(0, i.stock - 1))}
                            className="h-7 w-7 rounded-lg border border-ink-200 text-ink-600 hover:bg-ink-50"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            value={i.stock}
                            min={0}
                            onChange={(e) => updateStock(i, Math.max(0, Number(e.target.value)))}
                            className="w-16 rounded-lg border border-ink-200 px-2 py-1 text-center text-sm"
                          />
                          <button
                            onClick={() => updateStock(i, i.stock + 1)}
                            className="h-7 w-7 rounded-lg border border-ink-200 text-ink-600 hover:bg-ink-50"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        {i.stock === 0 ? (
                          <Badge tone="red">Out of Stock</Badge>
                        ) : i.stock <= 5 ? (
                          <Badge tone="amber">Low · {i.stock}</Badge>
                        ) : (
                          <Badge tone="green">Available</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredInventory.length === 0 && (
                <p className="p-6 text-center text-sm text-ink-500">No matching medicines.</p>
              )}
            </div>
          </>
        )}

        {/* ----------------------------- earnings ---------------------------- */}
        {!loading && tab === "earnings" && (
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat label="Today" value={inr(earnings.today)} tone="green" icon={<IndianRupee size={15} />} />
              <Stat label="Last 7 days" value={inr(earnings.week)} tone="brand" icon={<TrendingUp size={15} />} />
              <Stat label="All time" value={inr(earnings.allTime)} tone="slate" />
              <Stat label="Avg. basket" value={inr(earnings.avg)} tone="blue" hint={`${earnings.orders} orders`} />
            </div>
            <Card>
              <SectionTitle title="Top selling from your shelf" />
              {earnings.topMedicines.length ? (
                <RankedBars items={earnings.topMedicines} unit="units" />
              ) : (
                <p className="text-sm text-ink-500">No completed orders yet.</p>
              )}
            </Card>
            <Card className="lg:col-span-2">
              <p className="text-xs text-ink-500">
                Earnings shown are medicine subtotals. Delivery fees are collected by DawaQuick and
                settled with the delivery partner. Settlement, invoicing and GST reporting are out
                of scope for this prototype.
              </p>
            </Card>
          </div>
        )}

        {/* ----------------------------- ratings ----------------------------- */}
        {!loading && tab === "ratings" && (
          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <SectionTitle title="Your rating" />
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-4xl font-bold text-ink-900">4.7</p>
                  <p className="flex items-center justify-center gap-0.5 text-amber-500">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={14} className={i < 5 ? "fill-amber-400 text-amber-400" : ""} />
                    ))}
                  </p>
                  <p className="mt-1 text-xs text-ink-500">1,284 ratings</p>
                </div>
                <div className="flex-1 space-y-1">
                  {[
                    [5, 78],
                    [4, 14],
                    [3, 5],
                    [2, 2],
                    [1, 1],
                  ].map(([star, pct]) => (
                    <div key={star} className="flex items-center gap-2 text-xs">
                      <span className="w-3 text-ink-500">{star}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
                        <span
                          className="block h-full rounded-full bg-amber-400"
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                      <span className="w-8 text-right text-ink-400">{pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
            <Card>
              <SectionTitle title="Recent customer feedback" />
              <ul className="space-y-2.5">
                {[
                  { name: "Aarav M.", text: "Delivered in 22 minutes at 11 PM. Lifesaver.", stars: 5 },
                  { name: "Priya N.", text: "Pharmacist called to confirm my mother's refill. Very reassuring.", stars: 5 },
                  { name: "Rahul S.", text: "One item was substituted after a call. Handled well.", stars: 4 },
                ].map((r) => (
                  <li key={r.name} className="rounded-xl bg-ink-50 p-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                      {r.name}
                      <span className="flex text-amber-500">
                        {Array.from({ length: r.stars }).map((_, i) => (
                          <Star key={i} size={12} className="fill-amber-400 text-amber-400" />
                        ))}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-ink-600">{r.text}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </div>

      {/* --------------------------- add medicine --------------------------- */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add medicine to your shelf"
        footer={
          <Button
            full
            disabled={!addForm.medicineId}
            onClick={async () => {
              try {
                await post("/api/inventory", addForm);
                toast({ kind: "success", title: "Inventory updated" });
                setAddOpen(false);
                setAddForm({ medicineId: "", stock: 10, price: 0 });
                await load();
              } catch (e) {
                toast({ kind: "error", title: "Could not add", body: (e as Error).message });
              }
            }}
          >
            Save to inventory
          </Button>
        }
      >
        <Field label="Medicine (from the DawaQuick catalogue)" required>
          <Select
            value={addForm.medicineId}
            onChange={(e) => {
              const med = catalogue.find((m) => m.id === e.target.value);
              setAddForm({ ...addForm, medicineId: e.target.value, price: med?.mrp ?? 0 });
            }}
          >
            <option value="">— select —</option>
            {catalogue.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} · {m.brand} ({m.type})
              </option>
            ))}
          </Select>
        </Field>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Available quantity">
            <Input
              type="number"
              min={0}
              value={addForm.stock}
              onChange={(e) => setAddForm({ ...addForm, stock: Number(e.target.value) })}
            />
          </Field>
          <Field label="Your price (₹)">
            <Input
              type="number"
              min={0}
              value={addForm.price}
              onChange={(e) => setAddForm({ ...addForm, price: Number(e.target.value) })}
            />
          </Field>
        </div>
        {addForm.medicineId && (
          <div className="mt-3 rounded-xl bg-ink-50 p-3">
            {(() => {
              const m = catalogue.find((x) => x.id === addForm.medicineId)!;
              return (
                <>
                  <KeyValue label="Brand" value={m.brand} />
                  <KeyValue label="Strength" value={m.strength} />
                  <KeyValue label="Dosage form" value={m.form} />
                  <KeyValue label="Classification" value={m.type === "OTC" ? "OTC" : "Prescription (℞)"} />
                  <KeyValue label="Indicative MRP" value={inr(m.mrp)} />
                </>
              );
            })()}
          </div>
        )}
      </Modal>
    </StaffShell>
  );
}
