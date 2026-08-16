"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Bike,
  CheckCircle2,
  Clock3,
  FastForward,
  Headphones,
  MapPin,
  Phone,
  Printer,
  Store,
  XCircle,
} from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { MapView } from "@/components/map-view";
import { OrderTracker } from "@/components/order-tracker";
import { useApp } from "@/components/providers";
import { Badge, Button, Card, EmptyState, KeyValue, Modal, Skeleton } from "@/components/ui";
import { api, patch } from "@/lib/client";
import { ORDER_FLOW, ORDER_LABELS, type Order } from "@/lib/types";
import { dateTime, inr, windowLabel } from "@/lib/utils";

export default function OrderTrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useApp();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [support, setSupport] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api<{ order: Order }>(`/api/orders/${id}`);
      setOrder(d.order);
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live-ish tracking: poll while the order is in flight.
  useEffect(() => {
    if (!order || ["DELIVERED", "CANCELLED", "REJECTED"].includes(order.status)) return;
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [order, load]);

  if (loading) {
    return (
      <CustomerShell>
        <Skeleton className="h-96" />
      </CustomerShell>
    );
  }
  if (!order) {
    return (
      <CustomerShell>
        <EmptyState title="Order not found" action={<Link href="/orders">Back to orders</Link>} />
      </CustomerShell>
    );
  }

  const stage = ORDER_FLOW.indexOf(order.status);
  const progress =
    order.status === "DELIVERED" ? 1 : order.status === "OUT_FOR_DELIVERY" ? 0.55 : 0;
  const closed = ["DELIVERED", "CANCELLED", "REJECTED"].includes(order.status);

  const act = async (action: string, note?: string) => {
    setBusy(true);
    try {
      const d = await patch<{ order: Order }>(`/api/orders/${order.id}`, { action, note });
      setOrder(d.order);
      toast({ kind: "success", title: `Order ${ORDER_LABELS[d.order.status]}` });
    } catch (e) {
      toast({ kind: "error", title: "Could not update", body: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <CustomerShell>
      <button
        onClick={() => router.push("/orders")}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900 no-print"
      >
        <ArrowLeft size={16} /> All orders
      </button>

      {/* ------------------------------ header ---------------------------- */}
      <Card
        className={
          order.status === "DELIVERED"
            ? "border-emerald-200 bg-emerald-50/60"
            : closed
              ? "border-red-200 bg-red-50/60"
              : "border-brand-200 bg-brand-50/60"
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-lg font-bold text-ink-900">
              {order.status === "DELIVERED" ? (
                <CheckCircle2 size={20} className="text-emerald-600" />
              ) : closed ? (
                <XCircle size={20} className="text-red-600" />
              ) : (
                <Bike size={20} className="text-brand-600" />
              )}
              {ORDER_LABELS[order.status]}
            </p>
            {!closed && (
              <p className="mt-1 text-sm text-ink-700">
                Your medicine will be delivered between{" "}
                <strong className="text-ink-900">
                  {windowLabel(order.promisedFrom, order.promisedTo)}
                </strong>
              </p>
            )}
            {order.status === "DELIVERED" && (
              <p className="mt-1 text-sm text-emerald-800">
                Delivered {dateTime(order.history.find((h) => h.status === "DELIVERED")!.at)}
              </p>
            )}
          </div>
          <Badge tone={order.type === "RX" ? "amber" : "green"}>{order.type}</Badge>
        </div>
        <p className="mt-2 text-xs text-ink-500">
          Order ID <strong className="font-mono text-ink-700">{order.code}</strong>
        </p>
      </Card>

      {/* ------------------------------- map ------------------------------ */}
      {!closed && (
        <div className="mt-3">
          <MapView
            pharmacyName={order.pharmacyName}
            customerLocality={order.locality}
            distanceKm={order.distanceKm}
            progress={progress}
            riderName={order.deliveryPartnerName}
          />
        </div>
      )}

      {/* ----------------------------- tracker ---------------------------- */}
      <Card className="mt-3">
        <OrderTracker order={order} />
      </Card>

      {/* --------------------------- demo control -------------------------- */}
      {!closed && (
        <div className="mt-3 rounded-2xl border border-dashed border-ink-300 bg-white p-3 no-print">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-ink-500">
              <strong className="text-ink-700">Demo control.</strong> In production this advances
              from the pharmacy and rider apps.
            </p>
            <Button
              size="sm"
              variant="outline"
              icon={<FastForward size={14} />}
              loading={busy}
              onClick={() => act("advance")}
            >
              Simulate next step
            </Button>
          </div>
        </div>
      )}

      {/* ----------------------------- details ---------------------------- */}
      <Card className="mt-3">
        <h2 className="mb-2 font-semibold text-ink-900">Order details</h2>
        <ul className="mb-3 divide-y divide-ink-100">
          {order.items.map((i) => (
            <li key={i.medicineId} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink-800">{i.name}</span>
                <span className="text-xs text-ink-500">
                  {i.form} · {i.strength} · Qty {i.qty}
                </span>
              </span>
              <span className="text-sm font-semibold text-ink-800">{inr(i.price * i.qty)}</span>
            </li>
          ))}
        </ul>
        <KeyValue
          label="Pharmacy"
          value={
            <span className="inline-flex items-center gap-1.5">
              <Store size={13} className="text-ink-400" />
              {order.pharmacyName} · {order.distanceKm} km
            </span>
          }
        />
        <KeyValue
          label="Delivery partner"
          value={
            order.deliveryPartnerName ? (
              <span className="inline-flex items-center gap-1.5">
                <Bike size={13} className="text-ink-400" />
                {order.deliveryPartnerName}
              </span>
            ) : (
              "Assigning…"
            )
          }
        />
        <KeyValue
          label="Estimated delivery"
          value={
            <span className="inline-flex items-center gap-1.5">
              <Clock3 size={13} className="text-ink-400" />
              {order.etaMinFrom}–{order.etaMinTo} min
            </span>
          }
        />
        <KeyValue
          label="Delivery address"
          value={
            <span className="inline-flex items-start gap-1.5 text-right">
              <MapPin size={13} className="mt-0.5 shrink-0 text-ink-400" />
              {order.address}
            </span>
          }
        />
        <KeyValue label="Payment" value={`${order.paymentMode} · ${order.paymentStatus}`} />
        <div className="my-2 border-t border-ink-100" />
        <KeyValue label="Medicine total" value={inr(order.subtotal)} />
        <KeyValue label="Delivery fee" value={inr(order.deliveryFee)} />
        <div className="mt-2 flex items-baseline justify-between border-t border-ink-100 pt-3">
          <span className="font-semibold text-ink-900">Total</span>
          <span className="text-xl font-bold text-ink-900">{inr(order.total)}</span>
        </div>
        {order.prescriptionId && (
          <Link
            href={`/prescriptions/${order.prescriptionId}`}
            className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800"
          >
            <CheckCircle2 size={16} /> Prescription verified — view record
          </Link>
        )}
      </Card>

      {/* ----------------------------- actions ---------------------------- */}
      <div className="mt-4 flex flex-wrap gap-2 no-print">
        <Button variant="outline" icon={<Headphones size={16} />} onClick={() => setSupport(true)}>
          Contact support
        </Button>
        <Button variant="outline" icon={<Printer size={16} />} onClick={() => window.print()}>
          Print summary
        </Button>
        {!closed && order.status !== "OUT_FOR_DELIVERY" && (
          <Button variant="danger" loading={busy} onClick={() => act("cancel")}>
            Cancel order
          </Button>
        )}
      </div>

      <Modal open={support} onClose={() => setSupport(false)} title="Contact & support">
        <div className="space-y-3">
          <a
            href={`tel:${order.customerPhone.replace(/\s/g, "")}`}
            className="flex items-center gap-3 rounded-xl border border-ink-200 p-3 hover:bg-ink-50"
          >
            <Phone size={18} className="text-brand-600" />
            <span>
              <span className="block text-sm font-semibold text-ink-900">Call the pharmacy</span>
              <span className="block text-xs text-ink-500">{order.pharmacyName}</span>
            </span>
          </a>
          {order.deliveryPartnerName && (
            <div className="flex items-center gap-3 rounded-xl border border-ink-200 p-3">
              <Bike size={18} className="text-brand-600" />
              <span>
                <span className="block text-sm font-semibold text-ink-900">
                  Call {order.deliveryPartnerName}
                </span>
                <span className="block text-xs text-ink-500">Masked number (simulated)</span>
              </span>
            </div>
          )}
          <div className="flex items-center gap-3 rounded-xl border border-ink-200 p-3">
            <Headphones size={18} className="text-brand-600" />
            <span>
              <span className="block text-sm font-semibold text-ink-900">MedSpark care</span>
              <span className="block text-xs text-ink-500">1800-000-0000 · 24×7 (simulated)</span>
            </span>
          </div>
          <p className="rounded-xl bg-ink-50 p-3 text-xs text-ink-500">
            For medical emergencies contact your local emergency number immediately. MedSpark
            support cannot give medical advice.
          </p>
        </div>
      </Modal>

      <p className="mt-4 text-center text-xs text-ink-400">
        Stage {Math.max(1, stage + 1)} of {ORDER_FLOW.length} · updates every few seconds
      </p>
    </CustomerShell>
  );
}
