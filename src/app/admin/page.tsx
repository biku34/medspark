"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Bike,
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  IndianRupee,
  Package,
  Plus,
  ShieldCheck,
  Stethoscope,
  Users,
  XCircle,
} from "lucide-react";
import { StaffShell } from "@/components/staff-shell";
import { useApp } from "@/components/providers";
import { Donut, GroupedBars, RankedBars, Sparkline } from "@/components/charts";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  SectionTitle,
  Select,
  Skeleton,
  Stat,
  Stars,
  Tabs,
} from "@/components/ui";
import { api, patch, post } from "@/lib/client";
import type { AdminStats } from "@/lib/services";
import { ORDER_LABELS, type Order, type Pharmacy, type User } from "@/lib/types";
import { CITIES, areasFor, type City } from "@/lib/zones";
import { dateTime, inr } from "@/lib/utils";

type Tab = "overview" | "pharmacies" | "pharmacists" | "orders" | "analytics";
type OrderFilter = "all" | "OTC" | "RX" | "CANCELLED";

export default function AdminDashboard() {
  const { user, toast } = useApp();
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const [addPharmacyOpen, setAddPharmacyOpen] = useState(false);
  const [addStaffOpen, setAddStaffOpen] = useState(false);

  const [pharmacyForm, setPharmacyForm] = useState({
    name: "",
    ownerName: "",
    phone: "",
    licenseNo: "",
    address: "",
    locality: "",
    city: "Gandhinagar",
    deliveryFee: 25,
    prepMinutes: 12,
  });
  const [staffForm, setStaffForm] = useState({
    name: "",
    email: "",
    phone: "",
    licenseNo: "",
    role: "pharmacist",
    pharmacyId: "",
  });

  const load = useCallback(async () => {
    try {
      const [s, p, u, o] = await Promise.all([
        api<AdminStats>("/api/admin/stats"),
        api<{ pharmacies: Pharmacy[] }>("/api/pharmacies?all=1"),
        api<{ users: User[] }>("/api/users"),
        api<{ orders: Order[] }>("/api/orders"),
      ]);
      setStats(s);
      setPharmacies(p.pharmacies);
      setStaff(u.users);
      setOrders(o.orders);
    } catch {
      /* guarded by shell */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user, load]);

  const pharmacyAction = async (id: string, action: string) => {
    await patch(`/api/pharmacies/${id}`, { action });
    toast({ kind: "success", title: `Pharmacy ${action}d` });
    await load();
  };

  if (loading || !stats) {
    return (
      <StaffShell role="admin">
        <Skeleton className="h-96" />
      </StaffShell>
    );
  }

  const t = stats.totals;
  const filteredOrders = orders.filter((o) =>
    orderFilter === "all"
      ? true
      : orderFilter === "CANCELLED"
        ? ["CANCELLED", "REJECTED"].includes(o.status)
        : o.type === orderFilter,
  );

  return (
    <StaffShell role="admin">
      <SectionTitle title="MedSpark network overview" subtitle="Live prototype data" />

      <Tabs<Tab>
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "pharmacies", label: "Pharmacy Management", count: pharmacies.length },
          { id: "pharmacists", label: "Pharmacist Management", count: t.pharmacists },
          { id: "orders", label: "Orders", count: orders.length },
          { id: "analytics", label: "Analytics" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {/* ------------------------------ overview ---------------------------- */}
      {tab === "overview" && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Total customers" value={t.customers.toLocaleString("en-IN")} tone="brand" icon={<Users size={15} />} />
            <Stat label="Active pharmacies" value={t.activePharmacies} hint={`${t.pharmacies} onboarded`} tone="green" icon={<Building2 size={15} />} />
            <Stat label="Pharmacists" value={t.pharmacists} tone="amber" icon={<Stethoscope size={15} />} />
            <Stat label="Delivery partners" value={t.riders} tone="blue" icon={<Bike size={15} />} />
            <Stat label="Orders today" value={t.ordersToday} tone="brand" icon={<Package size={15} />} />
            <Stat label="OTC orders today" value={t.otcToday} tone="green" />
            <Stat label="Prescription orders today" value={t.rxToday} tone="amber" />
            <Stat label="Completed deliveries" value={t.completedDeliveries} tone="green" icon={<CheckCircle2 size={15} />} />
            <Stat
              label="Pending ℞ verifications"
              value={t.pendingVerifications}
              tone={t.pendingVerifications > 0 ? "red" : "slate"}
              icon={<FileText size={15} />}
            />
            <Stat label="Avg. delivery time" value={`${t.avgDeliveryMinutes} min`} tone="blue" icon={<Clock3 size={15} />} />
            <Stat label="Revenue today" value={inr(t.revenueToday)} tone="purple" icon={<IndianRupee size={15} />} />
            <Stat label="Network health" value="Healthy" tone="green" icon={<Activity size={15} />} />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <SectionTitle title="Orders per day" subtitle="Last 7 days" />
              <GroupedBars data={stats.ordersPerDay} />
            </Card>
            <Card>
              <SectionTitle title="OTC vs prescription" />
              <Donut
                slices={[
                  { label: "OTC", value: stats.mix.otc, color: "var(--color-brand-600)" },
                  { label: "Prescription", value: stats.mix.rx, color: "var(--color-accent-500)" },
                ]}
              />
            </Card>
          </div>
        </div>
      )}

      {/* ---------------------------- pharmacies ---------------------------- */}
      {tab === "pharmacies" && (
        <div className="mt-4">
          <div className="mb-3 flex justify-end">
            <Button icon={<Plus size={16} />} onClick={() => setAddPharmacyOpen(true)}>
              Add pharmacy
            </Button>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {pharmacies.map((p) => (
              <Card key={p.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-ink-900">{p.name}</h3>
                    <p className="text-xs text-ink-500">
                      {p.locality}, {p.city} · Licence {p.licenseNo}
                    </p>
                    <p className="text-xs text-ink-400">
                      {p.ownerName} · {p.phone}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge
                      tone={p.status === "ACTIVE" ? "green" : p.status === "PENDING" ? "amber" : "red"}
                    >
                      {p.status}
                    </Badge>
                    {p.verified ? (
                      <Badge tone="blue" icon={<ShieldCheck size={11} />}>
                        Verified
                      </Badge>
                    ) : (
                      <Badge tone="slate">Unverified</Badge>
                    )}
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-ink-500">
                  <Stars value={p.rating} count={p.ratingCount} />
                  <span>Delivery {inr(p.deliveryFee)}</span>
                  <span>Prep {p.prepMinutes} min</span>
                  <span>
                    {p.openTime}–{p.closeTime}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-100 pt-3">
                  {!p.verified && (
                    <Button size="sm" variant="success" onClick={() => pharmacyAction(p.id, "verify")}>
                      Verify pharmacy
                    </Button>
                  )}
                  {p.status === "ACTIVE" ? (
                    <Button size="sm" variant="danger" onClick={() => pharmacyAction(p.id, "suspend")}>
                      Suspend
                    </Button>
                  ) : p.status === "SUSPENDED" ? (
                    <Button size="sm" variant="outline" onClick={() => pharmacyAction(p.id, "reactivate")}>
                      Reactivate
                    </Button>
                  ) : null}
                  <a
                    href={`/api/pharmacies/${p.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-lg border border-ink-300 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
                  >
                    View inventory (JSON)
                  </a>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* --------------------------- pharmacists ---------------------------- */}
      {tab === "pharmacists" && (
        <div className="mt-4">
          <div className="mb-3 flex justify-end">
            <Button icon={<Plus size={16} />} onClick={() => setAddStaffOpen(true)}>
              Add pharmacist
            </Button>
          </div>
          <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-3 py-2.5">Name</th>
                  <th className="px-3 py-2.5">Role</th>
                  <th className="px-3 py-2.5">Licence</th>
                  <th className="px-3 py-2.5">Pharmacy</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {staff
                  .filter((s) => s.role !== "customer")
                  .map((s) => (
                    <tr key={s.id}>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-ink-900">{s.name}</p>
                        <p className="text-xs text-ink-500">{s.email}</p>
                      </td>
                      <td className="px-3 py-2.5 capitalize">{s.role}</td>
                      <td className="px-3 py-2.5 text-xs">{s.licenseNo ?? "—"}</td>
                      <td className="px-3 py-2.5 text-xs">
                        {pharmacies.find((p) => p.id === s.pharmacyId)?.name ?? "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={s.active ? "green" : "red"}>
                          {s.active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            await patch("/api/users", { id: s.id, active: !s.active });
                            await load();
                          }}
                        >
                          {s.active ? "Deactivate" : "Activate"}
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------ orders ------------------------------ */}
      {tab === "orders" && (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {(
              [
                ["all", "All orders"],
                ["OTC", "OTC orders"],
                ["RX", "Prescription orders"],
                ["CANCELLED", "Cancelled / rejected"],
              ] as Array<[OrderFilter, string]>
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setOrderFilter(id)}
                className={
                  "rounded-full px-3.5 py-1.5 text-sm font-medium " +
                  (orderFilter === id
                    ? "bg-ink-900 text-white"
                    : "border border-ink-200 bg-white text-ink-600 hover:bg-ink-50")
                }
              >
                {label}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
            <table className="w-full min-w-3xl text-sm">
              <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-3 py-2.5">Order</th>
                  <th className="px-3 py-2.5">Customer</th>
                  <th className="px-3 py-2.5">Pharmacy</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Rider</th>
                  <th className="px-3 py-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filteredOrders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-3 py-2.5">
                      <p className="font-mono text-xs font-semibold text-ink-900">{o.code}</p>
                      <p className="text-[11px] text-ink-400">{dateTime(o.createdAt)}</p>
                    </td>
                    <td className="px-3 py-2.5 text-xs">{o.customerName}</td>
                    <td className="px-3 py-2.5 text-xs">{o.pharmacyName}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={o.type === "RX" ? "amber" : "green"}>{o.type}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-xs">{ORDER_LABELS[o.status]}</td>
                    <td className="px-3 py-2.5 text-xs">{o.deliveryPartnerName ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right text-xs font-semibold">{inr(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredOrders.length === 0 && (
              <EmptyState title="No orders in this view" />
            )}
          </div>
        </div>
      )}

      {/* ----------------------------- analytics ---------------------------- */}
      {tab === "analytics" && (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <Card>
            <SectionTitle title="Orders per day" subtitle="OTC vs prescription" />
            <GroupedBars data={stats.ordersPerDay} />
          </Card>
          <Card>
            <SectionTitle title="Average delivery time" subtitle="Minutes, last 7 days" />
            <Sparkline
              data={stats.deliveryTimes.map((d) => ({ day: d.day, value: d.minutes }))}
              suffix=" min"
            />
          </Card>
          <Card>
            <SectionTitle title="Most searched medicines" />
            <RankedBars items={stats.topSearches.map((s) => ({ label: s.term, value: s.count }))} unit="searches" />
          </Card>
          <Card>
            <SectionTitle title="Most active pharmacies" />
            <RankedBars
              items={stats.topPharmacies.map((p) => ({
                label: p.name,
                value: p.orders,
                hint: inr(p.revenue),
              }))}
              unit="orders"
            />
          </Card>
          <Card>
            <SectionTitle title="Customer growth" subtitle="Cumulative registered customers" />
            <Sparkline
              data={stats.customerGrowth.map((c) => ({ day: c.day, value: c.total }))}
              color="var(--color-accent-500)"
            />
          </Card>
          <Card>
            <SectionTitle title="OTC vs prescription mix" />
            <Donut
              slices={[
                { label: "OTC", value: stats.mix.otc, color: "var(--color-brand-600)" },
                { label: "Prescription", value: stats.mix.rx, color: "var(--color-accent-500)" },
              ]}
            />
            <p className="mt-3 text-xs text-ink-500">
              Every prescription order in this mix passed a pharmacist verification with a logged
              customer call. There is no path that bypasses it.
            </p>
          </Card>
        </div>
      )}

      {/* --------------------------- add pharmacy --------------------------- */}
      <Modal
        open={addPharmacyOpen}
        onClose={() => setAddPharmacyOpen(false)}
        title="Onboard a pharmacy"
        footer={
          <Button
            full
            disabled={!pharmacyForm.name || !pharmacyForm.licenseNo}
            onClick={async () => {
              try {
                await post("/api/pharmacies", pharmacyForm);
                toast({
                  kind: "success",
                  title: "Pharmacy added",
                  body: "It starts as PENDING until you verify the licence.",
                });
                setAddPharmacyOpen(false);
                await load();
              } catch (e) {
                toast({ kind: "error", title: "Could not add", body: (e as Error).message });
              }
            }}
          >
            Add pharmacy
          </Button>
        }
      >
        <div className="space-y-3">
          <Field label="Pharmacy name" required>
            <Input
              value={pharmacyForm.name}
              onChange={(e) => setPharmacyForm({ ...pharmacyForm, name: e.target.value })}
            />
          </Field>
          <Field label="Drug licence number" required hint="Verified manually before activation.">
            <Input
              value={pharmacyForm.licenseNo}
              onChange={(e) => setPharmacyForm({ ...pharmacyForm, licenseNo: e.target.value })}
              placeholder="GJ-GN-20B-… / GJ-AH-20B-…"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Owner name">
              <Input
                value={pharmacyForm.ownerName}
                onChange={(e) => setPharmacyForm({ ...pharmacyForm, ownerName: e.target.value })}
              />
            </Field>
            <Field label="Phone">
              <Input
                value={pharmacyForm.phone}
                onChange={(e) => setPharmacyForm({ ...pharmacyForm, phone: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Address">
            <Input
              value={pharmacyForm.address}
              onChange={(e) => setPharmacyForm({ ...pharmacyForm, address: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City">
              <Select
                value={pharmacyForm.city}
                onChange={(e) =>
                  setPharmacyForm({ ...pharmacyForm, city: e.target.value, locality: "" })
                }
              >
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Locality / sector" hint="Anchors the pharmacy on the map">
              <Select
                value={pharmacyForm.locality}
                onChange={(e) => setPharmacyForm({ ...pharmacyForm, locality: e.target.value })}
              >
                <option value="">— select —</option>
                {areasFor(pharmacyForm.city as City).map((a) => (
                  <option key={a.id} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Delivery fee">
              <Input
                type="number"
                value={pharmacyForm.deliveryFee}
                onChange={(e) =>
                  setPharmacyForm({ ...pharmacyForm, deliveryFee: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Prep min">
              <Input
                type="number"
                value={pharmacyForm.prepMinutes}
                onChange={(e) =>
                  setPharmacyForm({ ...pharmacyForm, prepMinutes: Number(e.target.value) })
                }
              />
            </Field>
          </div>
        </div>
      </Modal>

      {/* -------------------------- add pharmacist -------------------------- */}
      <Modal
        open={addStaffOpen}
        onClose={() => setAddStaffOpen(false)}
        title="Add a pharmacist"
        footer={
          <Button
            full
            disabled={!staffForm.name || !staffForm.email}
            onClick={async () => {
              try {
                await post("/api/users", { ...staffForm, password: "demo1234" });
                toast({ kind: "success", title: "Pharmacist added", body: "Password: demo1234" });
                setAddStaffOpen(false);
                await load();
              } catch (e) {
                toast({ kind: "error", title: "Could not add", body: (e as Error).message });
              }
            }}
          >
            Add user
          </Button>
        }
      >
        <div className="space-y-3">
          <Field label="Full name" required>
            <Input
              value={staffForm.name}
              onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
              placeholder="Dr. …"
            />
          </Field>
          <Field label="Email" required>
            <Input
              type="email"
              value={staffForm.email}
              onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <Input
                value={staffForm.phone}
                onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
              />
            </Field>
            <Field label="PCI registration no.">
              <Input
                value={staffForm.licenseNo}
                onChange={(e) => setStaffForm({ ...staffForm, licenseNo: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Role">
              <Select
                value={staffForm.role}
                onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
              >
                <option value="pharmacist">Pharmacist</option>
                <option value="pharmacy">Pharmacy desk</option>
                <option value="delivery">Delivery partner</option>
              </Select>
            </Field>
            <Field label="Attached pharmacy">
              <Select
                value={staffForm.pharmacyId}
                onChange={(e) => setStaffForm({ ...staffForm, pharmacyId: e.target.value })}
              >
                <option value="">— none —</option>
                {pharmacies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <p className="rounded-xl bg-ink-50 p-3 text-xs text-ink-500">
            Pharmacists must hold a valid registration. In production this screen would collect
            and verify registration documents before granting verification rights.
          </p>
        </div>
      </Modal>

      <p className="mt-6 flex items-center gap-2 rounded-2xl bg-ink-900 p-4 text-xs text-ink-200">
        <XCircle size={14} className="shrink-0 text-ink-400" />
        Admins can onboard, verify and suspend pharmacies — but cannot approve prescriptions. Only
        a registered pharmacist can do that.
      </p>
    </StaffShell>
  );
}
