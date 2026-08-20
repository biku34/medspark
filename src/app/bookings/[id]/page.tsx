"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Clock3,
  Headphones,
  MapPin,
  Phone,
  Star,
} from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { ServiceArt } from "@/components/art";
import { BookingTracker } from "@/components/booking-tracker";
import { useApp } from "@/components/providers";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  KeyValue,
  Modal,
  SectionTitle,
  Skeleton,
} from "@/components/ui";
import { api, patch } from "@/lib/client";
import { bookingDateLabel } from "@/lib/booking-utils";
import {
  SERVICE_META,
  bookingLabel,
  type ServiceBooking,
  type ServiceProvider,
} from "@/lib/types";
import { dateTime, inr } from "@/lib/utils";

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useApp();
  const [booking, setBooking] = useState<ServiceBooking | null>(null);
  const [provider, setProvider] = useState<ServiceProvider | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [support, setSupport] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [stars, setStars] = useState(5);

  const load = useCallback(async () => {
    try {
      const d = await api<{ booking: ServiceBooking; provider: ServiceProvider | null }>(
        `/api/bookings/${id}`,
      );
      setBooking(d.booking);
      setProvider(d.provider);
    } catch {
      setBooking(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Poll while the booking is live so provider assignment appears without a refresh.
  useEffect(() => {
    if (!booking || ["COMPLETED", "CANCELLED", "REJECTED"].includes(booking.status)) return;
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [booking, load]);

  if (loading) {
    return (
      <CustomerShell>
        <Skeleton className="h-96" />
      </CustomerShell>
    );
  }
  if (!booking) {
    return (
      <CustomerShell>
        <EmptyState title="Booking not found" action={<Link href="/bookings">All bookings</Link>} />
      </CustomerShell>
    );
  }

  const meta = SERVICE_META[booking.serviceType];
  const closed = ["COMPLETED", "CANCELLED", "REJECTED"].includes(booking.status);

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      await patch(`/api/bookings/${booking.id}`, { action, ...extra });
      await load();
      toast({ kind: "success", title: "Booking updated" });
    } catch (e) {
      toast({ kind: "error", title: "Could not update", body: (e as Error).message });
    } finally {
      setBusy(false);
      setRateOpen(false);
    }
  };

  return (
    <CustomerShell>
      <button
        onClick={() => router.push("/bookings")}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900 no-print"
      >
        <ArrowLeft size={16} /> All home visits
      </button>

      <Card
        className={
          booking.status === "COMPLETED"
            ? "border-emerald-200 bg-emerald-50/60"
            : closed
              ? "border-red-200 bg-red-50/60"
              : "border-brand-200 bg-brand-50/60"
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 gap-3">
            <ServiceArt
              kind={booking.serviceType === "PHYSIO" ? "physio" : "nursing"}
              size={40}
              className="shrink-0"
            />
            <div className="min-w-0">
              <p className="text-base font-bold text-ink-900 sm:text-lg">
                {bookingLabel(booking.serviceType, booking.status)}
              </p>
              <p className="mt-0.5 text-sm text-ink-700">
                {meta.short} · {bookingDateLabel(booking.date)} · {booking.slot}
              </p>
            </div>
          </div>
          <Badge tone={booking.serviceType === "PHYSIO" ? "brand" : "purple"} className="shrink-0">
            {booking.hours}h visit
          </Badge>
        </div>
        <p className="mt-2 text-xs text-ink-500">
          Booking ID <strong className="font-mono text-ink-700">{booking.code}</strong>
        </p>
      </Card>

      <Card className="mt-3">
        <BookingTracker booking={booking} />
      </Card>

      {/* ---------------------------- provider ---------------------------- */}
      {provider ? (
        <Card className="mt-3">
          <SectionTitle title={`Your ${meta.providerNoun.toLowerCase()}`} />
          <div className="flex items-start gap-3.5">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-3xl">
              {provider.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 font-semibold text-ink-900">
                {provider.name}
                {provider.verified && <BadgeCheck size={15} className="text-brand-600" />}
              </p>
              <p className="text-xs text-ink-500">{provider.headline}</p>
              <p className="mt-1 text-xs text-ink-600">
                {provider.qualifications.join(" · ")} · {provider.experienceYears} yrs
              </p>
              <p className="text-xs text-ink-400">Reg. {provider.registrationNo}</p>
            </div>
          </div>
          <a
            href={`tel:${provider.name.replace(/\s/g, "")}`}
            className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-ink-300 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            <Phone size={15} /> Call {meta.providerNoun.toLowerCase()} (masked · simulated)
          </a>
        </Card>
      ) : (
        !closed && (
          <Card className="mt-3 border-amber-200 bg-amber-50/60">
            <p className="text-sm font-semibold text-amber-900">
              Assigning a {meta.providerNoun.toLowerCase()}…
            </p>
            <p className="mt-0.5 text-xs text-amber-800">
              A verified provider near {booking.locality} will pick this up shortly. You&apos;ll be
              notified as soon as they do.
            </p>
          </Card>
        )
      )}

      {/* ----------------------------- details ---------------------------- */}
      <Card className="mt-3">
        <SectionTitle title="Visit details" />
        <KeyValue label="Patient" value={booking.patientName} />
        <KeyValue
          label="Date & time"
          value={
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={13} className="text-ink-400" />
              {bookingDateLabel(booking.date)} · {booking.slot}
            </span>
          }
        />
        <KeyValue
          label="Duration"
          value={
            <span className="inline-flex items-center gap-1.5">
              <Clock3 size={13} className="text-ink-400" />
              {booking.hours} hour{booking.hours > 1 ? "s" : ""}
            </span>
          }
        />
        <KeyValue
          label="Address"
          value={
            <span className="inline-flex items-start gap-1.5 text-right">
              <MapPin size={13} className="mt-0.5 shrink-0 text-ink-400" />
              {booking.address}
            </span>
          }
        />
        {booking.reason && <KeyValue label="Reason for visit" value={booking.reason} />}
        {booking.assistanceTypes.length > 0 && (
          <div className="py-1.5">
            <p className="mb-1.5 text-sm text-ink-500">Assistance requested</p>
            <div className="flex flex-wrap gap-1.5">
              {booking.assistanceTypes.map((a) => (
                <Badge key={a} tone="brand">
                  {a}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {booking.patientNotes && (
          <KeyValue label="Patient requirements" value={booking.patientNotes} />
        )}

        <div className="my-2 border-t border-ink-100" />
        <KeyValue
          label="Service rate × hours"
          value={`${inr(booking.rate)} × ${booking.hours} = ${inr(booking.serviceCharge)}`}
        />
        <KeyValue label="Platform & convenience fee" value={inr(booking.platformFee)} />
        <div className="mt-2 flex items-baseline justify-between border-t border-ink-100 pt-3">
          <span className="font-semibold text-ink-900">Total</span>
          <span className="text-xl font-bold text-ink-900">{inr(booking.total)}</span>
        </div>
        <p className="mt-1 text-xs text-ink-400">
          {booking.paymentMode} · {booking.paymentStatus}
        </p>
      </Card>

      {booking.serviceType === "NURSING" && (
        <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-3.5">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-600" />
          <p className="text-xs leading-relaxed text-red-900">
            Home nursing assistance is not a substitute for emergency medical care. In an
            emergency, contact your local emergency number immediately.
          </p>
        </div>
      )}

      {/* ----------------------------- actions ---------------------------- */}
      <div className="mt-4 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap no-print">
        <Button variant="outline" icon={<Headphones size={16} />} onClick={() => setSupport(true)}>
          Contact support
        </Button>
        {booking.status === "COMPLETED" && !booking.rating && (
          <Button icon={<Star size={16} />} onClick={() => setRateOpen(true)}>
            Rate this visit
          </Button>
        )}
        {booking.rating && (
          <Badge tone="amber">
            <Star size={12} className="fill-amber-500" /> You rated {booking.rating}/5
          </Badge>
        )}
        {!closed && booking.status !== "IN_VISIT" && (
          <Button variant="danger" loading={busy} onClick={() => act("cancel")}>
            Cancel booking
          </Button>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-ink-400">
        Requested {dateTime(booking.createdAt)}
      </p>

      <Modal open={support} onClose={() => setSupport(false)} title="Contact & support">
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-xl border border-ink-200 p-3">
            <Headphones size={18} className="text-brand-600" />
            <span>
              <span className="block text-sm font-semibold text-ink-900">DawaQuick care</span>
              <span className="block text-xs text-ink-500">1800-000-0000 · simulated</span>
            </span>
          </div>
          <p className="rounded-xl bg-red-50 p-3 text-xs text-red-800">
            For medical emergencies contact your local emergency number immediately. DawaQuick
            support cannot give medical advice.
          </p>
        </div>
      </Modal>

      <Modal
        open={rateOpen}
        onClose={() => setRateOpen(false)}
        title="Rate your visit"
        footer={
          <Button full loading={busy} onClick={() => act("rate", { rating: stars })}>
            Submit rating
          </Button>
        }
      >
        <p className="text-sm text-ink-600">
          How was your visit with {booking.providerName}?
        </p>
        <div className="mt-3 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setStars(n)} aria-label={`${n} stars`}>
              <Star
                size={34}
                className={n <= stars ? "fill-amber-400 text-amber-400" : "text-ink-300"}
              />
            </button>
          ))}
        </div>
      </Modal>
    </CustomerShell>
  );
}
