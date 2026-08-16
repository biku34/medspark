"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  ChevronRight,
  FileText,
  LogOut,
  MapPin,
  Package,
  Phone,
  RefreshCcw,
  User as UserIcon,
} from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { useApp } from "@/components/providers";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  KeyValue,
  SectionTitle,
  Skeleton,
  Tabs,
} from "@/components/ui";
import { MiniTracker } from "@/components/order-tracker";
import { api, patch, post } from "@/lib/client";
import { ORDER_LABELS, PRESCRIPTION_LABELS, type Notification, type Order, type Prescription } from "@/lib/types";
import { dateTime, inr, relativeTime } from "@/lib/utils";

type Tab = "profile" | "orders" | "prescriptions" | "notifications";

export default function ProfilePage() {
  const { user, userLoading, signOut, toast, location } = useApp();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("profile");
  const [orders, setOrders] = useState<Order[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    Promise.all([
      api<{ orders: Order[] }>("/api/orders"),
      api<{ prescriptions: Prescription[] }>("/api/prescriptions"),
      api<{ notifications: Notification[] }>("/api/notifications"),
    ])
      .then(([o, p, n]) => {
        setOrders(o.orders);
        setPrescriptions(p.prescriptions);
        setNotifications(n.notifications);
      })
      .finally(() => setLoading(false));
  }, [user, userLoading]);

  if (!userLoading && !user) {
    return (
      <CustomerShell>
        <EmptyState
          icon={<UserIcon size={38} />}
          title="Sign in to view your profile"
          action={<Button onClick={() => router.push("/login?next=/profile")}>Sign in</Button>}
        />
      </CustomerShell>
    );
  }

  const unread = notifications.filter((n) => !n.read).length;
  const active = orders.filter((o) => !["DELIVERED", "CANCELLED", "REJECTED"].includes(o.status));
  const previous = orders.filter((o) => ["DELIVERED", "CANCELLED", "REJECTED"].includes(o.status));

  return (
    <CustomerShell>
      <div className="mb-4 flex items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-bold text-white">
          {user?.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-ink-900">{user?.name}</h1>
          <p className="truncate text-sm text-ink-500">{user?.phone}</p>
        </div>
      </div>

      <Tabs<Tab>
        tabs={[
          { id: "profile", label: "My Profile" },
          { id: "orders", label: "My Orders", count: orders.length },
          { id: "prescriptions", label: "Prescriptions", count: prescriptions.length },
          { id: "notifications", label: "Notifications", count: unread },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="mt-4">
        {loading && <Skeleton className="h-52" />}

        {!loading && tab === "profile" && (
          <>
            <Card>
              <SectionTitle title="Account details" />
              <KeyValue label="Name" value={user?.name} />
              <KeyValue label="Phone" value={user?.phone} />
              <KeyValue label="Email" value={user?.email} />
              <KeyValue label="Default address" value={user?.address ?? "—"} />
              <KeyValue label="Current delivery locality" value={location?.locality ?? "Not set"} />
            </Card>

            <Card className="mt-3">
              <SectionTitle title="Saved locations" subtitle="Deliver to home, hostel or family" />
              {user?.savedLocations?.length ? (
                <ul className="space-y-2">
                  {user.savedLocations.map((l) => (
                    <li key={l.id} className="flex items-start gap-3 rounded-xl bg-ink-50 p-3">
                      <MapPin size={16} className="mt-0.5 shrink-0 text-brand-600" />
                      <span>
                        <span className="block text-sm font-semibold text-ink-900">{l.label}</span>
                        <span className="block text-xs text-ink-500">{l.address}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-500">No saved locations yet.</p>
              )}
            </Card>

            <Card className="mt-3">
              <SectionTitle title="Account" subtitle="Session" />
              <div className="flex flex-wrap gap-2">
                {/* Resetting wipes shared live data, so it is admin-only.
                    The API enforces this too — this just hides a dead button. */}
                {user?.role === "admin" && (
                  <Button
                    variant="outline"
                    icon={<RefreshCcw size={15} />}
                    onClick={async () => {
                      try {
                        await post("/api/seed", {});
                        toast({ kind: "success", title: "Demo data reset" });
                        window.location.reload();
                      } catch (e) {
                        toast({
                          kind: "error",
                          title: "Could not reset",
                          body: (e as Error).message,
                        });
                      }
                    }}
                  >
                    Reset demo data
                  </Button>
                )}
                <Button
                  variant="danger"
                  icon={<LogOut size={15} />}
                  onClick={async () => {
                    await signOut();
                    toast({ kind: "info", title: "Signed out" });
                    router.push("/login");
                  }}
                >
                  Sign out
                </Button>
              </div>
            </Card>
          </>
        )}

        {!loading && tab === "orders" && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-semibold text-ink-700">Active ({active.length})</p>
              {active.length === 0 ? (
                <p className="text-sm text-ink-400">No active orders.</p>
              ) : (
                <ul className="space-y-2">
                  {active.map((o) => (
                    <li key={o.id}>
                      <Link href={`/orders/${o.id}`}>
                        <Card>
                          <p className="text-sm font-semibold text-ink-900">{ORDER_LABELS[o.status]}</p>
                          <p className="text-xs text-ink-500">
                            {o.code} · {o.pharmacyName}
                          </p>
                          <div className="mt-2">
                            <MiniTracker status={o.status} />
                          </div>
                        </Card>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-ink-700">
                Previous orders ({previous.length})
              </p>
              <ul className="space-y-2">
                {previous.map((o) => (
                  <li key={o.id}>
                    <Link href={`/orders/${o.id}`}>
                      <Card className="flex items-center gap-3">
                        <Package size={18} className="shrink-0 text-ink-400" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink-900">
                            {o.items.map((i) => i.name).join(", ")}
                          </span>
                          <span className="block text-xs text-ink-500">
                            {dateTime(o.createdAt)} · {inr(o.total)}
                          </span>
                        </span>
                        <ChevronRight size={16} className="shrink-0 text-ink-400" />
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {!loading && tab === "prescriptions" && (
          <ul className="space-y-2">
            {prescriptions.length === 0 && (
              <EmptyState
                icon={<FileText size={36} />}
                title="No prescriptions yet"
                action={
                  <Button onClick={() => router.push("/prescriptions/upload")}>
                    Upload prescription
                  </Button>
                }
              />
            )}
            {prescriptions.map((p) => (
              <li key={p.id}>
                <Link href={`/prescriptions/${p.id}`}>
                  <Card className="flex items-center gap-3">
                    <FileText size={18} className="shrink-0 text-ink-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink-900">{p.ref}</span>
                      <span className="block text-xs text-ink-500">
                        {p.patientName} · {dateTime(p.createdAt)}
                      </span>
                    </span>
                    <Badge tone={p.status === "APPROVED" ? "green" : p.status === "REJECTED" ? "red" : "amber"}>
                      {PRESCRIPTION_LABELS[p.status]}
                    </Badge>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {!loading && tab === "notifications" && (
          <>
            {unread > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="mb-2"
                onClick={async () => {
                  await patch("/api/notifications", { all: true });
                  setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                }}
              >
                Mark all as read
              </Button>
            )}
            <ul className="space-y-2">
              {notifications.length === 0 && (
                <EmptyState icon={<Bell size={36} />} title="No notifications yet" />
              )}
              {notifications.map((n) => (
                <li key={n.id}>
                  <Link href={n.href ?? "#"}>
                    <Card className={n.read ? "" : "border-brand-200 bg-brand-50/40"}>
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white">
                          {n.kind === "PRESCRIPTION" ? (
                            <FileText size={15} className="text-amber-600" />
                          ) : n.kind === "DELIVERY" ? (
                            <Package size={15} className="text-brand-600" />
                          ) : n.kind === "STOCK" ? (
                            <Bell size={15} className="text-sky-600" />
                          ) : (
                            <Phone size={15} className="text-ink-500" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-ink-900">{n.title}</p>
                          <p className="text-xs text-ink-600">{n.body}</p>
                          <p className="mt-0.5 text-[11px] text-ink-400">
                            {relativeTime(n.createdAt)}
                          </p>
                        </div>
                        {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                      </div>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </CustomerShell>
  );
}
