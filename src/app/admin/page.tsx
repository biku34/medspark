"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Bike,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  HeartPulse,
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
import {
  ORDER_LABELS,
  SERVICE_META,
  bookingLabel,
  type Order,
  type Pharmacy,
  type ServiceBooking,
  type ServiceProvider,
  type ServiceSettings,
  type User,
} from "@/lib/types";
import type { BookingAnalytics } from "@/lib/home-care";
import { bookingDateLabel } from "@/lib/booking-utils";
import { CITIES, areasFor, type City } from "@/lib/zones";
import { dateTime, inr } from "@/lib/utils";

type Tab =
  | "overview"
  | "pharmacies"
  | "pharmacists"
  | "orders"
  | "homecare"
  | "analytics";
type OrderFilter = "all" | "OTC" | "RX" | "CANCELLED";

export default function AdminDashboard() {
  const { user, toast } = useApp();
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [bookingStats, setBookingStats] = useState<BookingAnalytics | null>(null);
  const [settings, setSettings] = useState<ServiceSettings | null>(null);
  const [homeTab, setHomeTab] = useState<"PHYSIO" | "NURSING" | "bookings" | "pricing">("PHYSIO");
  const [loading, setLoading] = useState(true);
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const [addPharmacyOpen, setAddPharmacyOpen] = useState(false);
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [addProviderOpen, setAddProviderOpen] = useState(false);
  const [providerForm, setProviderForm] = useState({
    name: "",
    email: "",
    phone: "",
    type: "PHYSIO" as "PHYSIO" | "NURSING",
    registrationNo: "",
    headline: "",
    qualifications: "",
    experienceYears: 5,
    hourlyRate: 500,
    serviceRadiusKm: 10,
    city: "Gandhinagar",
    serviceArea: "",
  });

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
      const [s, p, u, o, pr, bk, st] = await Promise.all([
        api<AdminStats>("/api/admin/stats"),
        api<{ pharmacies: Pharmacy[] }>("/api/pharmacies?all=1"),
        api<{ users: User[] }>("/api/users"),
        api<{ orders: Order[] }>("/api/orders"),
        api<{ providers: ServiceProvider[] }>("/api/providers?all=1"),
        api<{ bookings: ServiceBooking[] }>("/api/bookings"),
        api<{ settings: ServiceSettings }>("/api/settings"),
      ]);
      setStats(s);
      setPharmacies(p.pharmacies);
      setStaff(u.users);
      setOrders(o.orders);
      setProviders(pr.providers);
      setBookings(bk.bookings);
      setSettings(st.settings);
      setBookingStats(await api<BookingAnalytics>("/api/admin/booking-stats"));
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

  const providerAction = async (
    id: string,
    action: string,
    extra: Record<string, unknown> = {},
  ) => {
    try {
      await patch(`/api/providers/${id}`, { action, ...extra });
      toast({ kind: "success", title: `Provider ${action.replace("_", " ")}d` });
      await load();
    } catch (e) {
      toast({ kind: "error", title: "Could not update", body: (e as Error).message });
    }
  };

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
          { id: "homecare", label: "Home Healthcare", count: providers.length },
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

      {/* --------------------------- home healthcare ------------------------ */}
      {tab === "homecare" && (
        <div className="mt-4 space-y-4">
          {/* Booking analytics */}
          {bookingStats && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat
                  label="Physiotherapy bookings"
                  value={bookingStats.physioBookings}
                  tone="brand"
                  icon={<HeartPulse size={15} />}
                />
                <Stat
                  label="Nursing bookings"
                  value={bookingStats.nursingBookings}
                  tone="purple"
                  icon={<Stethoscope size={15} />}
                />
                <Stat
                  label="Upcoming bookings"
                  value={bookingStats.upcoming}
                  tone="amber"
                  icon={<CalendarDays size={15} />}
                />
                <Stat
                  label="Completed visits"
                  value={bookingStats.completed}
                  tone="green"
                  icon={<CheckCircle2 size={15} />}
                />
                <Stat
                  label="Cancelled bookings"
                  value={bookingStats.cancelled}
                  tone={bookingStats.cancelled > 0 ? "red" : "slate"}
                  icon={<XCircle size={15} />}
                />
                <Stat
                  label="Revenue generated"
                  value={inr(bookingStats.revenue)}
                  tone="green"
                  icon={<IndianRupee size={15} />}
                />
                <Stat
                  label="Average booking value"
                  value={inr(bookingStats.averageValue)}
                  tone="blue"
                />
                <Stat
                  label="Active providers"
                  value={providers.filter((p) => p.status === "ACTIVE" && p.verified).length}
                  hint={`${providers.length} onboarded`}
                  tone="brand"
                  icon={<Users size={15} />}
                />
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <Card>
                  <SectionTitle title="Bookings per day" subtitle="Physiotherapy vs nursing" />
                  <GroupedBars
                    data={bookingStats.perDay.map((d) => ({
                      day: d.day,
                      otc: d.physio,
                      rx: d.nursing,
                    }))}
                  />
                  <p className="mt-1 text-xs text-ink-400">
                    Teal = physiotherapy · orange = nursing
                  </p>
                </Card>
                <Card>
                  <SectionTitle title="Most active providers" subtitle="Completed visits" />
                  {bookingStats.topProviders.length ? (
                    <RankedBars items={bookingStats.topProviders} unit="visits" />
                  ) : (
                    <p className="text-sm text-ink-500">No completed visits yet.</p>
                  )}
                </Card>
              </div>
            </>
          )}

          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {(
              [
                ["PHYSIO", `Physiotherapists (${providers.filter((p) => p.type === "PHYSIO").length})`],
                ["NURSING", `Nursing staff (${providers.filter((p) => p.type === "NURSING").length})`],
                ["bookings", `All bookings (${bookings.length})`],
                ["pricing", "Pricing & rules"],
              ] as Array<[typeof homeTab, string]>
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setHomeTab(id)}
                className={
                  "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium " +
                  (homeTab === id
                    ? "bg-ink-900 text-white"
                    : "border border-ink-200 bg-white text-ink-600 hover:bg-ink-50")
                }
              >
                {label}
              </button>
            ))}
          </div>

          {/* ---------------------------- providers --------------------------- */}
          {(homeTab === "PHYSIO" || homeTab === "NURSING") && (
            <>
              <div className="flex justify-end">
                <Button icon={<Plus size={16} />} onClick={() => setAddProviderOpen(true)}>
                  Add provider
                </Button>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {providers
                  .filter((p) => p.type === homeTab)
                  .map((p) => (
                    <Card key={p.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 gap-3">
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-2xl">
                            {p.emoji}
                          </span>
                          <div className="min-w-0">
                            <h3 className="truncate font-semibold text-ink-900">{p.name}</h3>
                            <p className="truncate text-xs text-ink-500">{p.headline}</p>
                            <p className="text-xs text-ink-400">
                              Reg. {p.registrationNo} · {p.experienceYears} yrs · {inr(p.hourlyRate)}/hr
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge
                            tone={
                              p.status === "ACTIVE" ? "green" : p.status === "PENDING" ? "amber" : "red"
                            }
                          >
                            {p.status}
                          </Badge>
                          {p.verified ? (
                            <Badge tone="blue" icon={<ShieldCheck size={11} />}>
                              Verified ✓
                            </Badge>
                          ) : (
                            <Badge tone="slate">Unverified</Badge>
                          )}
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-ink-500">
                        <Stars value={p.rating} count={p.ratingCount} />
                        <span>{p.completedVisits} visits</span>
                        <span>
                          {p.serviceAreas.join(", ")} · {p.city} · {p.serviceRadiusKm} km radius
                        </span>
                      </div>

                      {/* credentials */}
                      <div className="mt-3 rounded-xl bg-ink-50 p-3">
                        <p className="mb-1.5 text-xs font-semibold text-ink-700">Credentials</p>
                        {p.credentials.length === 0 ? (
                          <p className="text-xs text-ink-500">None uploaded yet.</p>
                        ) : (
                          <ul className="space-y-1">
                            {p.credentials.map((c) => (
                              <li
                                key={c.id}
                                className="flex items-center justify-between gap-2 text-xs"
                              >
                                <span className="min-w-0 truncate text-ink-600">
                                  {c.name} · {c.fileName}
                                </span>
                                {c.status === "VERIFIED" ? (
                                  <Badge tone="green">Verified</Badge>
                                ) : (
                                  <button
                                    onClick={() => providerAction(p.id, "verify_credential", { credentialId: c.id })}
                                    className="shrink-0 rounded-lg bg-ink-900 px-2 py-1 font-semibold text-white"
                                  >
                                    Verify
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-100 pt-3">
                        {!p.verified && (
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => providerAction(p.id, "approve")}
                          >
                            Verify &amp; approve
                          </Button>
                        )}
                        {p.status === "ACTIVE" ? (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => providerAction(p.id, "suspend")}
                          >
                            Suspend
                          </Button>
                        ) : p.status === "SUSPENDED" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => providerAction(p.id, "reactivate")}
                          >
                            Reactivate
                          </Button>
                        ) : null}
                        <Badge tone="slate">
                          {bookings.filter((b) => b.providerId === p.id).length} bookings
                        </Badge>
                      </div>
                    </Card>
                  ))}
              </div>
            </>
          )}

          {/* ---------------------------- bookings ---------------------------- */}
          {homeTab === "bookings" && (
            <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
              <table className="w-full min-w-3xl text-sm">
                <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="px-3 py-2.5">Booking</th>
                    <th className="px-3 py-2.5">Service</th>
                    <th className="px-3 py-2.5">Customer</th>
                    <th className="px-3 py-2.5">Provider</th>
                    <th className="px-3 py-2.5">When</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {bookings.map((b) => (
                    <tr key={b.id}>
                      <td className="px-3 py-2.5">
                        <p className="font-mono text-xs font-semibold text-ink-900">{b.code}</p>
                        <p className="text-[11px] text-ink-400">{dateTime(b.createdAt)}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={b.serviceType === "PHYSIO" ? "brand" : "purple"}>
                          {SERVICE_META[b.serviceType].short}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {b.customerName}
                        <span className="block text-[11px] text-ink-400">{b.locality}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs">{b.providerName ?? "—"}</td>
                      <td className="px-3 py-2.5 text-xs">
                        {bookingDateLabel(b.date)}
                        <span className="block text-[11px] text-ink-400">
                          {b.slot} · {b.hours}h
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {bookingLabel(b.serviceType, b.status)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs font-semibold">
                        {inr(b.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {bookings.length === 0 && <EmptyState title="No bookings yet" />}
            </div>
          )}

          {/* ----------------------------- pricing ---------------------------- */}
          {homeTab === "pricing" && settings && (
            <div className="grid gap-3 lg:grid-cols-2">
              {(["physio", "nursing"] as const).map((key) => {
                const cfg = settings[key];
                const label = key === "physio" ? "Physiotherapy" : "Nursing Assistance";
                return (
                  <Card key={key}>
                    <SectionTitle title={`${label} pricing`} />
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Rate ₹/hour">
                        <Input
                          type="number"
                          value={cfg.rate}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              [key]: { ...cfg, rate: Number(e.target.value) },
                            })
                          }
                        />
                      </Field>
                      <Field label="Platform fee ₹">
                        <Input
                          type="number"
                          value={cfg.platformFee}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              [key]: { ...cfg, platformFee: Number(e.target.value) },
                            })
                          }
                        />
                      </Field>
                      <Field label="Min hours">
                        <Input
                          type="number"
                          value={cfg.minHours}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              [key]: { ...cfg, minHours: Number(e.target.value) },
                            })
                          }
                        />
                      </Field>
                      <Field label="Max hours">
                        <Input
                          type="number"
                          value={cfg.maxHours}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              [key]: { ...cfg, maxHours: Number(e.target.value) },
                            })
                          }
                        />
                      </Field>
                    </div>
                    <p className="mt-2 text-xs text-ink-500">
                      A {cfg.minHours}-hour visit costs {inr(cfg.rate * cfg.minHours)} +{" "}
                      {inr(cfg.platformFee)} platform fee ={" "}
                      <strong>{inr(cfg.rate * cfg.minHours + cfg.platformFee)}</strong>
                    </p>
                  </Card>
                );
              })}

              <Card className="lg:col-span-2">
                <SectionTitle title="Booking rules" />
                <Field
                  label="Minimum advance notice (days)"
                  hint="Cannot be set below 1 — same-day home visits are never offered."
                >
                  <Input
                    type="number"
                    min={1}
                    value={settings.minAdvanceDays}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        minAdvanceDays: Math.max(1, Number(e.target.value)),
                      })
                    }
                  />
                </Field>
                <Button
                  className="mt-3"
                  onClick={async () => {
                    try {
                      const d = await patch<{ settings: ServiceSettings }>("/api/settings", {
                        physio: settings.physio,
                        nursing: settings.nursing,
                        minAdvanceDays: settings.minAdvanceDays,
                      });
                      setSettings(d.settings);
                      toast({ kind: "success", title: "Pricing updated" });
                    } catch (e) {
                      toast({ kind: "error", title: "Could not save", body: (e as Error).message });
                    }
                  }}
                >
                  Save pricing &amp; rules
                </Button>
                <p className="mt-2 text-xs text-ink-500">
                  Changes apply immediately to new bookings on the customer app.
                </p>
              </Card>
            </div>
          )}
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

      {/* --------------------------- add provider --------------------------- */}
      <Modal
        open={addProviderOpen}
        onClose={() => setAddProviderOpen(false)}
        title="Onboard a home-healthcare provider"
        footer={
          <Button
            full
            disabled={!providerForm.name || !providerForm.email || !providerForm.registrationNo}
            onClick={async () => {
              try {
                await post("/api/providers", {
                  ...providerForm,
                  qualifications: providerForm.qualifications
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                  serviceAreas: providerForm.serviceArea ? [providerForm.serviceArea] : [],
                  password: "demo1234",
                });
                toast({
                  kind: "success",
                  title: "Provider added",
                  body: "Starts PENDING until credentials are verified. Password: demo1234",
                });
                setAddProviderOpen(false);
                await load();
              } catch (e) {
                toast({ kind: "error", title: "Could not add", body: (e as Error).message });
              }
            }}
          >
            Add provider
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Service" required>
              <Select
                value={providerForm.type}
                onChange={(e) =>
                  setProviderForm({
                    ...providerForm,
                    type: e.target.value as "PHYSIO" | "NURSING",
                    hourlyRate: e.target.value === "PHYSIO" ? 500 : 300,
                  })
                }
              >
                <option value="PHYSIO">Physiotherapist</option>
                <option value="NURSING">Nurse</option>
              </Select>
            </Field>
            <Field label="Council registration no." required>
              <Input
                value={providerForm.registrationNo}
                onChange={(e) =>
                  setProviderForm({ ...providerForm, registrationNo: e.target.value })
                }
                placeholder="GSCPT-… / GNC-RN-…"
              />
            </Field>
          </div>
          <Field label="Full name" required>
            <Input
              value={providerForm.name}
              onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Login email" required>
              <Input
                type="email"
                value={providerForm.email}
                onChange={(e) => setProviderForm({ ...providerForm, email: e.target.value })}
              />
            </Field>
            <Field label="Phone">
              <Input
                value={providerForm.phone}
                onChange={(e) => setProviderForm({ ...providerForm, phone: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Headline">
            <Input
              value={providerForm.headline}
              onChange={(e) => setProviderForm({ ...providerForm, headline: e.target.value })}
              placeholder="e.g. Post-operative & musculoskeletal rehabilitation"
            />
          </Field>
          <Field label="Qualifications" hint="Comma separated">
            <Input
              value={providerForm.qualifications}
              onChange={(e) =>
                setProviderForm({ ...providerForm, qualifications: e.target.value })
              }
              placeholder="BPT, MPT (Orthopaedics)"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City">
              <Select
                value={providerForm.city}
                onChange={(e) =>
                  setProviderForm({ ...providerForm, city: e.target.value, serviceArea: "" })
                }
              >
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Base locality">
              <Select
                value={providerForm.serviceArea}
                onChange={(e) =>
                  setProviderForm({ ...providerForm, serviceArea: e.target.value })
                }
              >
                <option value="">— select —</option>
                {areasFor(providerForm.city as City).map((a) => (
                  <option key={a.id} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Experience (yrs)">
              <Input
                type="number"
                value={providerForm.experienceYears}
                onChange={(e) =>
                  setProviderForm({ ...providerForm, experienceYears: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Rate ₹/hr">
              <Input
                type="number"
                value={providerForm.hourlyRate}
                onChange={(e) =>
                  setProviderForm({ ...providerForm, hourlyRate: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Radius (km)">
              <Input
                type="number"
                value={providerForm.serviceRadiusKm}
                onChange={(e) =>
                  setProviderForm({ ...providerForm, serviceRadiusKm: Number(e.target.value) })
                }
              />
            </Field>
          </div>
          <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
            The provider is created as <strong>PENDING</strong> and cannot accept bookings until
            they upload credentials and an admin verifies them.
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
