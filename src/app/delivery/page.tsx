"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bike,
  CheckCircle2,
  Clock3,
  MapPin,
  Navigation,
  Package,
  Phone,
  Store,
} from "lucide-react";
import { QueueTabs, StaffShell } from "@/components/staff-shell";
import { ActionButton, Metric, MetricRow, Pill, Ticket, WaitTimer } from "@/components/ops";
import { MapView } from "@/components/map-view";
import { useApp } from "@/components/providers";
import { EmptyState, Skeleton } from "@/components/ui";
import { api, patch } from "@/lib/client";
import { ORDER_LABELS, type Order } from "@/lib/types";
import { inr, relativeTime, windowLabel } from "@/lib/utils";

type Tab = "available" | "mine" | "done";

/**
 * Rider console.
 *
 * Riders read this one-handed, at a signal, in daylight — so it stays a single
 * column of large tickets, the two stops are the loudest thing on each one, and
 * the cash to collect is impossible to miss.
 */
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
      <div className="mb-3">
        <h1 className="text-[18px] font-extrabold tracking-tight text-ink-900">
          Hi, {user?.name?.split(" ")[0] ?? "partner"}
        </h1>
        <p className="text-[12px] text-ink-500">Pick up from the pharmacy, deliver to the door</p>
      </div>

      <MetricRow>
        <Metric
          label="Pickups waiting"
          value={available.length}
          tone="amber"
          live={available.length > 0}
        />
        <Metric label="On hand" value={mine.length} tone="blue" />
        <Metric label="Delivered" value={done.length} tone="green" />
        <Metric label="Earned today" value={inr(todayEarnings)} tone="green" />
      </MetricRow>

      <div className="mt-3">
        <QueueTabs<Tab>
          tabs={[
            { id: "available", label: "New pickups", count: available.length, urgent: true },
            { id: "mine", label: "My runs", count: mine.length },
            { id: "done", label: "Completed", count: done.length },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      <div className="mx-auto grid max-w-2xl gap-3">
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-56" />)
        ) : list.length === 0 ? (
          <EmptyState
            icon={<Bike size={36} />}
            title={
              tab === "available"
                ? "No pickups waiting"
                : tab === "mine"
                  ? "No active runs"
                  : "No completed deliveries yet"
            }
            body="Orders appear here the moment a pharmacy accepts them."
          />
        ) : (
          list.map((o) => {
            const collectCash = o.paymentMode === "COD" && o.paymentStatus === "PENDING";
            return (
              <Ticket
                key={o.id}
                code={o.code}
                accent={
                  o.status === "DELIVERED"
                    ? "green"
                    : o.status === "OUT_FOR_DELIVERY"
                      ? "blue"
                      : "amber"
                }
                timer={
                  o.status !== "DELIVERED" ? (
                    <WaitTimer since={o.createdAt} breachAfter={20} />
                  ) : undefined
                }
                meta={
                  <span>
                    {relativeTime(o.createdAt)} · {ORDER_LABELS[o.status]}
                  </span>
                }
                state={
                  <span className="flex flex-col items-end gap-1">
                    <Pill tone={o.type === "RX" ? "amber" : "grey"}>{o.type}</Pill>
                    <span className="text-[13px] font-extrabold text-brand-700">
                      +{inr(o.deliveryFee)}
                    </span>
                  </span>
                }
                actions={
                  <>
                    {!o.deliveryPartnerId && (
                      <ActionButton
                        loading={busyId === o.id}
                        icon={<Navigation size={14} />}
                        onClick={() => act(o, "assign")}
                      >
                        Accept run
                      </ActionButton>
                    )}
                    {o.deliveryPartnerId === user?.id && o.status === "READY" && (
                      <ActionButton
                        loading={busyId === o.id}
                        icon={<Package size={14} />}
                        onClick={() => act(o, "picked")}
                      >
                        Picked up
                      </ActionButton>
                    )}
                    {o.deliveryPartnerId === user?.id && o.status === "PREPARING" && (
                      <Pill tone="amber">Pharmacy still packing</Pill>
                    )}
                    {o.status === "OUT_FOR_DELIVERY" && (
                      <ActionButton
                        loading={busyId === o.id}
                        icon={<CheckCircle2 size={14} />}
                        onClick={() => act(o, "delivered")}
                      >
                        Mark delivered
                      </ActionButton>
                    )}
                    <a
                      href={`tel:${o.customerPhone.replace(/\s/g, "")}`}
                      className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-ink-300 bg-white px-3 text-[13px] font-bold text-ink-700 hover:bg-ink-100 sm:flex-none"
                    >
                      <Phone size={14} /> Call
                    </a>
                  </>
                }
              >
                {/* the run itself: two stops, in order */}
                <ol className="relative space-y-3 border-l-2 border-dashed border-ink-200 pl-4">
                  <li className="relative">
                    <span className="absolute -left-[22px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-ink-900 text-white">
                      <Store size={9} />
                    </span>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">
                      Pick up
                    </p>
                    <p className="text-[14px] font-bold text-ink-900">{o.pharmacyName}</p>
                  </li>
                  <li className="relative">
                    <span className="absolute -left-[22px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-white">
                      <MapPin size={9} />
                    </span>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">
                      Drop · {o.distanceKm} km
                    </p>
                    <p className="text-[14px] font-bold text-ink-900">{o.address}</p>
                    <p className="text-[12px] text-ink-500">{o.customerName}</p>
                  </li>
                </ol>

                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-600">
                  <span className="inline-flex items-center gap-1">
                    <Clock3 size={11} className="text-ink-400" />
                    {windowLabel(o.promisedFrom, o.promisedTo)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Package size={11} className="text-ink-400" />
                    {o.items.reduce((s, i) => s + i.qty, 0)} unit(s)
                  </span>
                </div>

                {/* cash to collect must never be missed */}
                <div
                  className={
                    collectCash
                      ? "mt-2.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2"
                      : "mt-2.5 rounded-md border border-ink-200 bg-ink-50 px-2.5 py-2"
                  }
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-ink-500">
                    {collectCash ? "Collect from customer" : "Payment"}
                  </p>
                  <p
                    className={
                      collectCash
                        ? "text-[16px] font-extrabold text-amber-700"
                        : "text-[14px] font-bold text-ink-700"
                    }
                  >
                    {collectCash ? `${inr(o.total)} cash` : "Prepaid — collect nothing"}
                  </p>
                </div>

                {tab === "mine" && (
                  <div className="mt-2.5 overflow-hidden rounded-md">
                    <MapView
                      pharmacyName={o.pharmacyName}
                      customerLocality={o.locality}
                      distanceKm={o.distanceKm}
                      progress={o.status === "OUT_FOR_DELIVERY" ? 0.5 : 0}
                      riderName={o.deliveryPartnerName}
                      height={150}
                    />
                  </div>
                )}
              </Ticket>
            );
          })
        )}
      </div>

      <p className="mx-auto mt-4 max-w-2xl rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-[11px] text-ink-500">
        Route visualisation is simulated for the prototype. A production build plugs a real
        navigation SDK and live GPS into the same screen.
      </p>
    </StaffShell>
  );
}
