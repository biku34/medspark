"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bike,
  CheckCircle2,
  Clock3,
  IndianRupee,
  MapPin,
  Navigation,
  Package,
  Phone,
  Store,
} from "lucide-react";
import { StaffShell } from "@/components/staff-shell";
import { MapView } from "@/components/map-view";
import { useApp } from "@/components/providers";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  KeyValue,
  SectionTitle,
  Skeleton,
  Stat,
  Tabs,
} from "@/components/ui";
import { api, patch } from "@/lib/client";
import { ORDER_LABELS, type Order } from "@/lib/types";
import { inr, relativeTime, windowLabel } from "@/lib/utils";

type Tab = "available" | "mine" | "done";

export default function DeliveryDashboard() {
  const { user, toast } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("available");

  const load = useCallback(async () => {
    try {
      const d = await api<{ orders: Order[] }>("/api/orders");
      setOrders(d.orders);
    } catch {
      /* guarded by shell */
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

  const available = orders.filter(
    (o) => !o.deliveryPartnerId && ["PREPARING", "READY"].includes(o.status),
  );
  const mine = orders.filter(
    (o) => o.deliveryPartnerId === user?.id && ["READY", "OUT_FOR_DELIVERY"].includes(o.status),
  );
  const done = orders.filter((o) => o.deliveryPartnerId === user?.id && o.status === "DELIVERED");

  const act = async (order: Order, action: string) => {
    setBusyId(order.id);
    try {
      await patch(`/api/orders/${order.id}`, { action });
      toast({ kind: "success", title: `Order ${order.code} · ${action}` });
      await load();
      if (action === "assign") setTab("mine");
    } catch (e) {
      toast({ kind: "error", title: "Could not update", body: (e as Error).message });
    } finally {
      setBusyId(null);
    }
  };

  const todayEarnings = done
    .filter((o) => new Date(o.createdAt).toDateString() === new Date().toDateString())
    .reduce((s, o) => s + o.deliveryFee, 0);

  const list = tab === "available" ? available : tab === "mine" ? mine : done;

  return (
    <StaffShell role="delivery">
      <SectionTitle
        title={`Hello, ${user?.name?.split(" ")[0] ?? "partner"}`}
        subtitle="Pick up from the pharmacy, deliver to the customer."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Available pickups" value={available.length} tone="amber" icon={<Package size={15} />} />
        <Stat label="On hand" value={mine.length} tone="brand" icon={<Bike size={15} />} />
        <Stat label="Delivered" value={done.length} tone="green" icon={<CheckCircle2 size={15} />} />
        <Stat label="Earnings today" value={inr(todayEarnings)} tone="blue" icon={<IndianRupee size={15} />} />
      </div>

      <Tabs<Tab>
        tabs={[
          { id: "available", label: "New Pickups", count: available.length },
          { id: "mine", label: "My Deliveries", count: mine.length },
          { id: "done", label: "Completed", count: done.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-64" />)
        ) : list.length === 0 ? (
          <div className="lg:col-span-2">
            <EmptyState
              icon={<Bike size={38} />}
              title={
                tab === "available"
                  ? "No pickups waiting"
                  : tab === "mine"
                    ? "You have no active deliveries"
                    : "No completed deliveries yet"
              }
              body="Orders appear here as soon as a pharmacy accepts them."
            />
          </div>
        ) : (
          list.map((o) => (
            <Card key={o.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-bold text-ink-900">{o.code}</p>
                  <p className="text-xs text-ink-500">
                    {relativeTime(o.createdAt)} · {ORDER_LABELS[o.status]}
                  </p>
                </div>
                <Badge tone={o.type === "RX" ? "amber" : "green"}>{o.type}</Badge>
              </div>

              <div className="mt-3">
                <MapView
                  pharmacyName={o.pharmacyName}
                  customerLocality={o.locality}
                  distanceKm={o.distanceKm}
                  progress={o.status === "OUT_FOR_DELIVERY" ? 0.5 : 0}
                  riderName={o.deliveryPartnerName}
                  height={170}
                />
              </div>

              <div className="mt-3 space-y-1">
                <KeyValue
                  label="Pick up from"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <Store size={13} className="text-ink-400" />
                      {o.pharmacyName}
                    </span>
                  }
                />
                <KeyValue
                  label="Deliver to"
                  value={
                    <span className="inline-flex items-start gap-1.5 text-right">
                      <MapPin size={13} className="mt-0.5 shrink-0 text-ink-400" />
                      {o.address}
                    </span>
                  }
                />
                <KeyValue label="Distance" value={`${o.distanceKm} km`} />
                <KeyValue
                  label="Promised window"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 size={13} className="text-ink-400" />
                      {windowLabel(o.promisedFrom, o.promisedTo)}
                    </span>
                  }
                />
                <KeyValue label="Items" value={`${o.items.reduce((s, i) => s + i.qty, 0)} unit(s)`} />
                <KeyValue
                  label="Collect"
                  value={
                    o.paymentMode === "COD" && o.paymentStatus === "PENDING"
                      ? `${inr(o.total)} cash`
                      : "Prepaid"
                  }
                />
                <KeyValue label="Delivery fee (yours)" value={inr(o.deliveryFee)} />
              </div>

              <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-100 pt-3">
                {!o.deliveryPartnerId && (
                  <Button
                    size="sm"
                    loading={busyId === o.id}
                    icon={<Navigation size={14} />}
                    onClick={() => act(o, "assign")}
                  >
                    Accept Delivery
                  </Button>
                )}
                {o.deliveryPartnerId === user?.id && o.status === "READY" && (
                  <Button size="sm" loading={busyId === o.id} onClick={() => act(o, "picked")}>
                    Picked Up / Out for Delivery
                  </Button>
                )}
                {o.deliveryPartnerId === user?.id && o.status === "PREPARING" && (
                  <Badge tone="amber">Pharmacy still preparing</Badge>
                )}
                {o.status === "OUT_FOR_DELIVERY" && (
                  <Button
                    size="sm"
                    variant="success"
                    loading={busyId === o.id}
                    icon={<CheckCircle2 size={14} />}
                    onClick={() => act(o, "delivered")}
                  >
                    Delivered
                  </Button>
                )}
                <a
                  href={`tel:${o.customerPhone.replace(/\s/g, "")}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
                >
                  <Phone size={14} /> Call customer
                </a>
              </div>
            </Card>
          ))
        )}
      </div>

      <p className="mt-5 rounded-2xl bg-ink-100 p-4 text-xs text-ink-500">
        Route visualisation is simulated for the prototype. A production build plugs a real
        navigation SDK and live GPS tracking into the same screen.
      </p>
    </StaffShell>
  );
}
