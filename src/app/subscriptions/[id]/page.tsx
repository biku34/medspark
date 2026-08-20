"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  Package,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  SkipForward,
  Store,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import clsx from "clsx";
import { CustomerShell } from "@/components/customer-shell";
import { useApp } from "@/components/providers";
import {
  Badge,
  Button,
  Card,
  Field,
  KeyValue,
  Modal,
  SectionTitle,
  Select,
  Skeleton,
} from "@/components/ui";
import { api, patch } from "@/lib/client";
import { frequencyLabel, nextDeliveryLabel, type RefillCover } from "@/lib/repeat-utils";
import {
  ORDER_LABELS,
  REPEAT_META,
  SUBSCRIPTION_LABELS,
  type Order,
  type PharmacyOffer,
  type Prescription,
  type RepeatFrequency,
  type Subscription,
} from "@/lib/types";
import { bookingDateLabel } from "@/lib/booking-utils";
import { dateTime, inr } from "@/lib/utils";

export default function SubscriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { location, toast } = useApp();

  const [sub, setSub] = useState<Subscription | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [cover, setCover] = useState<RefillCover | null>(null);
  const [offers, setOffers] = useState<PharmacyOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [freqOpen, setFreqOpen] = useState(false);
  const [frequency, setFrequency] = useState<RepeatFrequency>("MONTHLY");
  const [customDays, setCustomDays] = useState(21);
  const [shopOpen, setShopOpen] = useState(false);
  const [pharmacyId, setPharmacyId] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api<{
        subscription: Subscription;
        orders: Order[];
        prescription: Prescription | null;
        cover: RefillCover;
      }>(`/api/subscriptions/${id}`);
      setSub(d.subscription);
      setOrders(d.orders);
      setPrescription(d.prescription);
      setCover(d.cover);
      setFrequency(d.subscription.frequency);
      setCustomDays(d.subscription.intervalDays);
      setPharmacyId(d.subscription.pharmacyId);
    } catch (e) {
      toast({ kind: "error", title: "Could not load", body: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (payload: Record<string, unknown>, label: string) => {
    setBusy(true);
    try {
      await patch(`/api/subscriptions/${id}`, payload);
      toast({ kind: "success", title: label });
      setFreqOpen(false);
      setShopOpen(false);
      setCancelOpen(false);
      await load();
    } catch (e) {
      toast({ kind: "error", title: "Could not update", body: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const openShopPicker = async () => {
    setShopOpen(true);
    if (!sub) return;
    try {
      const basket = sub.items.map((i) => `${i.medicineId}:${i.qty}`).join(",");
      const d = await api<{ offers: PharmacyOffer[] }>(
        `/api/pharmacies?items=${encodeURIComponent(basket)}` +
          (location ? `&lat=${location.lat}&lng=${location.lng}` : `&lat=${sub.lat}&lng=${sub.lng}`),
      );
      setOffers(d.offers);
    } catch {
      /* picker shows a fallback message */
    }
  };

  if (loading) {
    return (
      <CustomerShell>
        <Skeleton className="h-64" />
      </CustomerShell>
    );
  }

  if (!sub) {
    return (
      <CustomerShell>
        <Card>
          <p className="text-[14px] font-bold text-ink-900">Repeat delivery not found</p>
          <Link href="/subscriptions">
            <Button className="mt-3">Back to repeat deliveries</Button>
          </Link>
        </Card>
      </CustomerShell>
    );
  }

  const held = sub.status === "AWAITING_RX";
  const ended = sub.status === "CANCELLED" || sub.status === "COMPLETED";
  const remaining =
    prescription && prescription.refillsAuthorised
      ? prescription.refillsAuthorised - (prescription.refillsUsed ?? 0)
      : null;

  return (
    <CustomerShell>
      <Link
        href="/subscriptions"
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-600 hover:text-ink-900"
      >
        <ArrowLeft size={15} /> Repeat deliveries
      </Link>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-[12px] font-bold text-ink-500">{sub.ref}</p>
            <h1 className="text-[19px] font-extrabold tracking-tight text-ink-900">
              {sub.items.map((i) => i.name).join(" + ")}
            </h1>
            <p className="text-[12px] text-ink-500">
              {frequencyLabel(sub)} · {sub.deliveriesMade} delivered
            </p>
          </div>
          <Badge
            tone={
              sub.status === "ACTIVE"
                ? "green"
                : held
                  ? "amber"
                  : sub.status === "CANCELLED"
                    ? "red"
                    : "slate"
            }
          >
            {SUBSCRIPTION_LABELS[sub.status]}
          </Badge>
        </div>

        {!ended && (
          <div
            className={clsx(
              "mt-3 rounded-lg px-3 py-2.5",
              held ? "bg-amber-100" : "bg-brand-50",
            )}
          >
            <p className="text-[10px] font-extrabold uppercase tracking-wide text-ink-500">
              {held ? "On hold" : sub.skipNext ? "Skipping this cycle" : "Next delivery"}
            </p>
            <p className={clsx("text-[17px] font-extrabold", held ? "text-amber-800" : "text-brand-800")}>
              {nextDeliveryLabel(sub)}
              {!held && (
                <span className="ml-1.5 text-[13px] font-semibold text-ink-500">
                  {bookingDateLabel(sub.nextDate)}
                </span>
              )}
            </p>
          </div>
        )}

        {held && cover?.reason && (
          <p className="mt-2 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[12px] leading-relaxed text-amber-900">
            <TriangleAlert size={15} className="mt-px shrink-0" />
            <span>
              {cover.reason} Upload a current prescription and we'll resume from the next cycle.
            </span>
          </p>
        )}

        {!ended && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-100 pt-3">
            {sub.status === "ACTIVE" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  loading={busy}
                  icon={<SkipForward size={14} />}
                  onClick={() =>
                    act(
                      { action: sub.skipNext ? "unskip" : "skip_next" },
                      sub.skipNext ? "Skip cancelled" : "Next cycle skipped",
                    )
                  }
                >
                  {sub.skipNext ? "Don't skip" : "Skip next"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  loading={busy}
                  icon={<Pause size={14} />}
                  onClick={() => act({ action: "pause" }, "Paused")}
                >
                  Pause
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  loading={busy}
                  icon={<RefreshCw size={14} />}
                  onClick={() => act({ action: "deliver_now" }, "Delivery placed")}
                >
                  Deliver now
                </Button>
              </>
            )}
            {sub.status === "PAUSED" && (
              <Button
                size="sm"
                loading={busy}
                icon={<Play size={14} />}
                onClick={() => act({ action: "resume" }, "Resumed")}
              >
                Resume
              </Button>
            )}
            {held && (
              <Link href="/prescriptions/upload">
                <Button size="sm">Upload prescription</Button>
              </Link>
            )}
            <Button
              size="sm"
              variant="danger"
              icon={<Trash2 size={14} />}
              onClick={() => setCancelOpen(true)}
              className="ml-auto"
            >
              Cancel
            </Button>
          </div>
        )}
      </Card>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        <div className="min-w-0 space-y-3">
          {/* --------------------------- what ships -------------------------- */}
          <Card>
            <SectionTitle title="Every delivery contains" />
            <ul className="divide-y divide-ink-100">
              {sub.items.map((i) => (
                <li key={i.medicineId} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-ink-900">{i.name}</p>
                    <p className="text-[11px] text-ink-500">
                      {[i.strength, i.form].filter((x) => x && x !== "—").join(" · ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {i.type === "RX" && <Badge tone="amber">℞</Badge>}
                    <span className="rounded bg-ink-900 px-1.5 py-0.5 text-[11px] font-extrabold text-white">
                      × {i.qty}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-2 rounded-lg bg-brand-50 px-2.5 py-2 text-[12px] font-semibold text-brand-800">
              {sub.discountPct}% subscriber discount applied to every cycle.
            </p>
          </Card>

          {/* ---------------------------- history ---------------------------- */}
          <Card>
            <SectionTitle title="Deliveries" />
            {orders.length === 0 ? (
              <p className="text-[13px] text-ink-500">No deliveries yet.</p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {orders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <Link
                        href={`/orders/${o.id}`}
                        className="font-mono text-[13px] font-bold text-brand-700 hover:underline"
                      >
                        {o.code}
                      </Link>
                      <p className="text-[11px] text-ink-500">
                        {dateTime(o.createdAt)} · {ORDER_LABELS[o.status]}
                      </p>
                    </div>
                    <span className="shrink-0 text-[13px] font-bold text-ink-900">
                      {inr(o.total)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <SectionTitle title="Activity" />
            <ol className="space-y-2">
              {[...sub.history].reverse().map((h, i) => (
                <li key={i} className="flex gap-2.5">
                  <span
                    className={clsx(
                      "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                      i === 0 ? "bg-brand-600" : "bg-ink-300",
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-ink-800">
                      {h.event.replace(/_/g, " ").toLowerCase()}
                    </p>
                    <p className="text-[11px] text-ink-500">{dateTime(h.at)}</p>
                    {h.note && <p className="text-[11px] text-ink-600">{h.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        {/* ------------------------------ aside ----------------------------- */}
        <div className="min-w-0 space-y-3">
          <Card>
            <SectionTitle title="Schedule" />
            <KeyValue label="Frequency" value={frequencyLabel(sub)} />
            <KeyValue label="Started" value={bookingDateLabel(sub.startDate)} />
            <KeyValue label="Payment" value={sub.paymentMode} />
            {!ended && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2 w-full"
                icon={<CalendarClock size={14} />}
                onClick={() => setFreqOpen(true)}
              >
                Change frequency
              </Button>
            )}
          </Card>

          <Card>
            <SectionTitle title="Dispensed by" />
            <p className="flex items-center gap-2 text-[14px] font-bold text-ink-900">
              <Store size={15} className="text-ink-400" />
              {sub.pharmacyName}
            </p>
            <p className="mt-1 text-[12px] text-ink-500">{sub.address}</p>
            {!ended && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2 w-full"
                onClick={openShopPicker}
              >
                Change pharmacy
              </Button>
            )}
          </Card>

          {sub.type === "RX" && (
            <Card>
              <SectionTitle title="Prescription cover" />
              {prescription ? (
                <>
                  <KeyValue label="Reference" value={prescription.ref} />
                  {remaining !== null && (
                    <>
                      <KeyValue
                        label="Repeats left"
                        value={
                          <span
                            className={clsx(
                              "font-extrabold",
                              remaining > 0 ? "text-brand-700" : "text-red-600",
                            )}
                          >
                            {remaining} of {prescription.refillsAuthorised}
                          </span>
                        }
                      />
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-100">
                        <div
                          className={clsx(
                            "h-full rounded-full",
                            remaining > 0 ? "bg-brand-500" : "bg-red-500",
                          )}
                          style={{
                            width: `${Math.max(0, (remaining / (prescription.refillsAuthorised || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    </>
                  )}
                  {prescription.validUntil && (
                    <div className="mt-1.5">
                      <KeyValue
                        label="Valid until"
                        value={bookingDateLabel(prescription.validUntil)}
                      />
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[12px] text-ink-500">No prescription is linked.</p>
              )}
              <p className="mt-2 flex gap-1.5 border-t border-ink-100 pt-2 text-[11px] leading-relaxed text-ink-500">
                <ShieldCheck size={13} className="mt-px shrink-0 text-brand-600" />
                We never dispense a prescription medicine beyond what the pharmacist authorised.
                When the repeats run out, this schedule stops on its own.
              </p>
            </Card>
          )}

          {sub.carePlanId && (
            <Card>
              <p className="text-[12px] text-ink-600">
                Started from{" "}
                <Link href={`/care/${sub.carePlanId}`} className="font-bold text-brand-700 underline">
                  a care plan
                </Link>
                .
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* --------------------------- frequency ----------------------------- */}
      <Modal
        open={freqOpen}
        onClose={() => setFreqOpen(false)}
        title="Change how often it arrives"
        footer={
          <>
            <Button variant="outline" onClick={() => setFreqOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={busy}
              onClick={() => act({ action: "set_frequency", frequency, customDays }, "Frequency updated")}
            >
              Save
            </Button>
          </>
        }
      >
        <Field label="Deliver">
          <Select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as RepeatFrequency)}
          >
            {(Object.keys(REPEAT_META) as RepeatFrequency[]).map((f) => (
              <option key={f} value={f}>
                {REPEAT_META[f].label}
              </option>
            ))}
          </Select>
        </Field>
        {frequency === "CUSTOM" && (
          <div className="mt-3">
            <Field label="Every how many days?" hint="Between 3 and 90">
              <input
                type="number"
                min={3}
                max={90}
                value={customDays}
                onChange={(e) => setCustomDays(Number(e.target.value))}
                className="h-11 w-full rounded-lg border border-ink-200 px-3 text-[14px]"
              />
            </Field>
          </div>
        )}
        <p className="mt-3 rounded-lg bg-ink-50 p-2.5 text-[11px] text-ink-600">
          The next delivery moves to within a week of today so you are never left short.
        </p>
      </Modal>

      {/* ---------------------------- pharmacy ----------------------------- */}
      <Modal
        open={shopOpen}
        onClose={() => setShopOpen(false)}
        title="Change pharmacy"
        footer={
          <>
            <Button variant="outline" onClick={() => setShopOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={busy}
              disabled={!pharmacyId || pharmacyId === sub.pharmacyId}
              onClick={() => act({ action: "set_pharmacy", pharmacyId }, "Pharmacy changed")}
            >
              Save
            </Button>
          </>
        }
      >
        {offers.length ? (
          <Field label="Pharmacies that stock everything on this repeat">
            <Select value={pharmacyId} onChange={(e) => setPharmacyId(e.target.value)}>
              {offers.map((o) => (
                <option key={o.pharmacy.id} value={o.pharmacy.id}>
                  {o.pharmacy.name} · {o.distanceKm} km · {inr(o.total)}
                  {o.allAvailable ? "" : " · some items missing"}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <p className="text-[13px] text-ink-500">Looking for pharmacies near your address…</p>
        )}
      </Modal>

      {/* ----------------------------- cancel ------------------------------ */}
      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this repeat delivery?"
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() => act({ action: "cancel" }, "Repeat delivery cancelled")}
            >
              Cancel it
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-ink-700">
          {sub.items.map((i) => i.name).join(", ")} will stop arriving. Orders already placed are
          not affected, and you can always set up a new repeat later.
        </p>
        <p className="mt-2 flex items-center gap-2 rounded-lg bg-ink-50 p-2.5 text-[12px] text-ink-600">
          <Package size={14} className="text-ink-400" />
          Only pausing? Pause keeps the schedule and stops the deliveries.
        </p>
      </Modal>
    </CustomerShell>
  );
}
