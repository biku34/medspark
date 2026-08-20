"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Info,
  MapPin,
  ShieldCheck,
  Users,
} from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { ServiceArt } from "@/components/art";
import { ProviderCard } from "@/components/provider-card";
import { useApp } from "@/components/providers";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  Input,
  KeyValue,
  QtyStepper,
  SectionTitle,
  Select,
  Skeleton,
  Textarea,
} from "@/components/ui";
import { api, post } from "@/lib/client";
import type { ProviderOffer } from "@/lib/home-care";
import {
  bookableDates,
  bookingDateLabel,
  earliestBookableDate,
  priceBooking,
  rateConfigFor,
} from "@/lib/booking-utils";
import {
  NURSING_ASSISTANCE_TYPES,
  PHYSIO_REASONS,
  SERVICE_META,
  type ServiceBooking,
  type ServiceSettings,
  type ServiceType,
} from "@/lib/types";
import { inr } from "@/lib/utils";

const SLUG_TO_TYPE: Record<string, ServiceType> = {
  physiotherapy: "PHYSIO",
  nursing: "NURSING",
};

export default function ServiceBookingPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type: slug } = use(params);
  const serviceType = SLUG_TO_TYPE[slug];
  const router = useRouter();
  const { user, origin, geoQuery, toast } = useApp();

  const [settings, setSettings] = useState<ServiceSettings | null>(null);
  const [offers, setOffers] = useState<ProviderOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [hours, setHours] = useState(2);
  const [providerId, setProviderId] = useState<string>("");
  const [address, setAddress] = useState("");
  const [patientName, setPatientName] = useState("");
  const [reason, setReason] = useState("");
  const [assistance, setAssistance] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const meta = serviceType ? SERVICE_META[serviceType] : null;
  const cfg = settings && serviceType ? rateConfigFor(settings, serviceType) : null;

  /* ------------------------------- data load ----------------------------- */
  useEffect(() => {
    if (!serviceType) return;
    api<{ settings: ServiceSettings }>("/api/settings").then((d) => {
      setSettings(d.settings);
      const first = bookableDates(d.settings.minAdvanceDays, 14)[0];
      setDate((prev) => prev || first);
      const c = rateConfigFor(d.settings, serviceType);
      setHours((h) => Math.min(Math.max(h, c.minHours), c.maxHours));
    });
  }, [serviceType]);

  useEffect(() => {
    if (user?.address) setAddress((a) => a || user.address!);
    if (user?.name) setPatientName((p) => p || user.name);
  }, [user]);

  const loadProviders = useCallback(async () => {
    if (!serviceType || !date) return;
    setLoading(true);
    try {
      const d = await api<{ offers: ProviderOffer[] }>(
        `/api/providers?type=${serviceType}&date=${date}&${geoQuery}`,
      );
      setOffers(d.offers);
    } finally {
      setLoading(false);
    }
  }, [serviceType, date, geoQuery]);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  /* --------------------------- derived values ---------------------------- */
  const dates = useMemo(
    () => (settings ? bookableDates(settings.minAdvanceDays, 14) : []),
    [settings],
  );

  const chosen = offers.find((o) => o.provider.id === providerId);

  /** Slots offered = the chosen provider's free slots, or the union of all. */
  const slots = useMemo(() => {
    const source = chosen ? [chosen] : offers;
    return [...new Set(source.flatMap((o) => o.freeSlots))].sort();
  }, [offers, chosen]);

  useEffect(() => {
    if (slot && !slots.includes(slot)) setSlot("");
  }, [slots, slot]);

  const rate = chosen?.provider.hourlyRate ?? cfg?.rate ?? 0;
  const price = cfg ? priceBooking(rate, hours, cfg.platformFee) : null;

  const canSubmit =
    !!serviceType &&
    !!date &&
    !!slot &&
    !!address.trim() &&
    offers.length > 0 &&
    (serviceType === "PHYSIO" ? !!reason : assistance.length > 0);

  /* -------------------------------- submit ------------------------------- */
  const submit = async () => {
    if (!user) {
      toast({ kind: "info", title: "Sign in to book a home visit" });
      router.push(`/login?next=/services/${slug}`);
      return;
    }
    setSubmitting(true);
    try {
      const { booking } = await post<{ booking: ServiceBooking }>("/api/bookings", {
        serviceType,
        date,
        slot,
        hours,
        address,
        locality: origin.locality,
        city: origin.city,
        lat: origin.lat,
        lng: origin.lng,
        patientName,
        reason: serviceType === "PHYSIO" ? reason : undefined,
        assistanceTypes: serviceType === "NURSING" ? assistance : [],
        patientNotes: notes,
        preferredProviderId: providerId || undefined,
        paymentMode: "COD",
      });
      toast({
        kind: "success",
        title: "Booking requested",
        body: `Booking ID ${booking.code}`,
      });
      router.push(`/bookings/${booking.id}`);
    } catch (e) {
      toast({ kind: "error", title: "Could not book", body: (e as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  if (!serviceType || !meta) {
    return (
      <CustomerShell>
        <EmptyState
          title="Unknown service"
          body="Pick a service from the home page."
          action={<Button onClick={() => router.push("/")}>Back to home</Button>}
        />
      </CustomerShell>
    );
  }

  if (!settings || !cfg) {
    return (
      <CustomerShell>
        <Skeleton className="h-96" />
      </CustomerShell>
    );
  }

  const earliest = earliestBookableDate(settings.minAdvanceDays);

  return (
    <CustomerShell wide>
      {/* ------------------------------ header ----------------------------- */}
      <section className="overflow-hidden rounded-xl bg-brand-600 p-4 text-white sm:p-6">
        <ServiceArt kind={serviceType === "PHYSIO" ? "physio" : "nursing"} size={56} />
        <h1 className="mt-2 text-xl font-bold leading-tight sm:text-3xl">{meta.label}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-brand-50">
          {serviceType === "PHYSIO"
            ? "A qualified physiotherapist visits you at home with the equipment needed for your session — no travel, no waiting room."
            : "Qualified nursing personnel provide home-based assistance for recovery, elderly care and day-to-day patient support."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="brand" className="border-white/25 bg-white/15 text-white">
            {inr(cfg.rate)}/hour onwards
          </Badge>
          <Badge tone="brand" className="border-white/25 bg-white/15 text-white">
            <Clock3 size={12} /> {cfg.minHours}–{cfg.maxHours} hours per visit
          </Badge>
          <Badge tone="brand" className="border-white/25 bg-white/15 text-white">
            <Users size={12} /> {offers.length} verified nearby
          </Badge>
        </div>
      </section>

      {/* --------------------- advance booking notice ---------------------- */}
      <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3">
        <CalendarDays size={18} className="mt-0.5 shrink-0 text-amber-600" />
        <p className="text-sm text-amber-900">
          <strong>Advance booking required: minimum {settings.minAdvanceDays} day.</strong>{" "}
          Same-day visits aren&apos;t available. The earliest date you can book is{" "}
          <strong>{bookingDateLabel(earliest)}</strong>.
        </p>
      </div>

      {serviceType === "NURSING" && (
        <div className="mt-2.5 flex items-start gap-2.5 rounded-lg border border-red-300 bg-red-50 p-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-600" />
          <p className="text-xs leading-relaxed text-red-900">
            <strong>Not emergency care.</strong> Home nursing assistance supports recovery and
            daily care. It is not a substitute for emergency medical care, a doctor&apos;s
            consultation or hospital treatment. In an emergency, call your local emergency number
            or go to the nearest hospital immediately. Medication and wound care are provided only
            as professionally and legally appropriate, following the treating doctor&apos;s
            instructions.
          </p>
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        {/* --------------------------- left column ------------------------- */}
        <div className="min-w-0 space-y-4">
          {/* Date */}
          <Card>
            <SectionTitle title="1. Choose a date" subtitle="Next 14 available days" />
            <div className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
              {dates.map((d) => (
                <button
                  key={d}
                  onClick={() => setDate(d)}
                  className={
                    "shrink-0 snap-start rounded-xl border px-3 py-2.5 text-center text-sm whitespace-nowrap transition-colors sm:px-3.5 " +
                    (date === d
                      ? "border-brand-500 bg-brand-50 font-semibold text-brand-800"
                      : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50")
                  }
                >
                  {bookingDateLabel(d)}
                </button>
              ))}
            </div>
          </Card>

          {/* Slot + duration */}
          <Card>
            <SectionTitle
              title="2. Time slot & duration"
              subtitle="Slots reflect real provider availability on the chosen date"
            />
            {loading ? (
              <Skeleton className="h-10" />
            ) : slots.length ? (
              <div className="flex flex-wrap gap-2">
                {slots.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSlot(s)}
                    className={
                      "min-h-11 min-w-24 flex-1 rounded-xl border px-3 py-2 text-sm transition-colors sm:flex-none sm:px-3.5 " +
                      (slot === s
                        ? "border-brand-500 bg-brand-50 font-semibold text-brand-800"
                        : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50")
                    }
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                No slots free on this date. Please pick another date.
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-3">
              <div>
                <p className="text-sm font-medium text-ink-800">Session duration</p>
                <p className="text-xs text-ink-500">
                  {cfg.minHours}–{cfg.maxHours} hours · billed hourly
                </p>
              </div>
              <QtyStepper
                value={hours}
                onChange={setHours}
                min={cfg.minHours}
                max={cfg.maxHours}
              />
            </div>
          </Card>

          {/* Providers — deliberately not wrapped in a Card: nesting cards
              doubles the horizontal padding and squeezes phone screens. */}
          <section>
            <SectionTitle
              title={`3. Choose a ${meta.providerNoun.toLowerCase()}`}
              subtitle="Optional — leave unselected and we'll assign the first available verified provider"
            />
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-52" />
                <Skeleton className="h-52" />
              </div>
            ) : offers.length === 0 ? (
              <EmptyState
                icon={<Users size={36} />}
                title={`No verified ${meta.providerNoun.toLowerCase()} covers your area yet`}
                body="We're onboarding providers across Gandhinagar and Ahmedabad. Try changing your delivery location."
              />
            ) : (
              <div className="space-y-3">
                <button
                  onClick={() => setProviderId("")}
                  className={
                    "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors " +
                    (providerId === ""
                      ? "border-brand-500 bg-brand-50"
                      : "border-ink-200 bg-white hover:bg-ink-50")
                  }
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl">
                    ✨
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink-900">
                      Any available {meta.providerNoun.toLowerCase()}
                    </span>
                    <span className="block text-xs text-ink-500">
                      Fastest assignment · {inr(cfg.rate)}/hour standard rate
                    </span>
                  </span>
                  {providerId === "" && (
                    <CheckCircle2 size={18} className="ml-auto shrink-0 text-brand-600" />
                  )}
                </button>

                {offers.map((o) => (
                  <ProviderCard
                    key={o.provider.id}
                    offer={o}
                    selected={providerId === o.provider.id}
                    onSelect={() =>
                      setProviderId(providerId === o.provider.id ? "" : o.provider.id)
                    }
                  />
                ))}
              </div>
            )}
          </section>

          {/* Visit details */}
          <Card>
            <SectionTitle title="4. Visit details" />
            <div className="space-y-3">
              <Field label="Patient name" required>
                <Input
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Who is the visit for?"
                />
              </Field>

              <Field label="Visit address" required hint="Include flat/house number and a landmark">
                <Textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Flat, building, street, landmark"
                  className="min-h-20"
                />
              </Field>

              {serviceType === "PHYSIO" ? (
                <Field label="Reason for visit" required>
                  <Select value={reason} onChange={(e) => setReason(e.target.value)}>
                    <option value="">— select —</option>
                    {PHYSIO_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <div>
                  <p className="mb-1.5 text-sm font-medium text-ink-700">
                    Type of assistance required <span className="text-red-500">*</span>
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {NURSING_ASSISTANCE_TYPES.map((t) => (
                      <Checkbox
                        key={t}
                        checked={assistance.includes(t)}
                        onChange={(v) =>
                          setAssistance((prev) =>
                            v ? [...prev, t] : prev.filter((x) => x !== t),
                          )
                        }
                        label={t}
                      />
                    ))}
                  </div>
                </div>
              )}

              <Field
                label="Basic patient requirements (optional)"
                hint="Mobility, existing conditions, equipment at home, preferred language…"
              >
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Patient is 72, uses a walker, recovering from knee replacement."
                />
              </Field>
            </div>
          </Card>
        </div>

        {/* --------------------------- right column ------------------------ */}
        <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <SectionTitle title="Price breakdown" />
            <KeyValue label="Service" value={meta.short} />
            <KeyValue
              label={chosen ? meta.providerNoun : "Assignment"}
              value={chosen ? chosen.provider.name : "First available verified provider"}
            />
            <KeyValue
              label="Date & time"
              value={date ? `${bookingDateLabel(date)}${slot ? ` · ${slot}` : ""}` : "—"}
            />
            <KeyValue label="Duration" value={`${hours} hour${hours > 1 ? "s" : ""}`} />

            <div className="my-2 border-t border-ink-100" />
            <KeyValue
              label={`Service rate × hours`}
              value={`${inr(rate)} × ${hours} = ${inr(price?.serviceCharge ?? 0)}`}
            />
            <KeyValue label="Platform & convenience fee" value={inr(price?.platformFee ?? 0)} />
            <div className="mt-2 flex items-baseline justify-between border-t border-ink-100 pt-3">
              <span className="font-semibold text-ink-900">Total estimated cost</span>
              <span className="text-2xl font-bold text-ink-900">{inr(price?.total ?? 0)}</span>
            </div>
            <p className="mt-1 text-xs text-ink-400">
              Payable after the visit. Extra hours are billed at the same hourly rate.
            </p>

            <Button
              full
              size="lg"
              className="mt-4 hidden lg:inline-flex"
              loading={submitting}
              disabled={!canSubmit}
              onClick={submit}
            >
              Confirm {serviceType === "PHYSIO" ? "Physiotherapy" : "Nursing"} Booking
            </Button>

            {!canSubmit && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-500">
                <Info size={13} className="mt-0.5 shrink-0" />
                Choose a date, time slot, address and{" "}
                {serviceType === "PHYSIO" ? "reason for the visit" : "at least one assistance type"}{" "}
                to continue.
              </p>
            )}

            <div className="mt-4 space-y-2 border-t border-ink-100 pt-3 text-xs text-ink-500">
              <p className="flex items-start gap-1.5">
                <ShieldCheck size={13} className="mt-0.5 shrink-0 text-brand-600" />
                Every provider is credential-verified by DawaQuick before going live.
              </p>
              <p className="flex items-start gap-1.5">
                <MapPin size={13} className="mt-0.5 shrink-0 text-brand-600" />
                Serving {origin.locality}, {origin.city}.
              </p>
              <p className="flex items-start gap-1.5">
                <ClipboardList size={13} className="mt-0.5 shrink-0 text-brand-600" />
                You&apos;ll get a booking ID and status updates at each stage.
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Spacer so the last card clears the sticky bar + bottom nav on phones */}
      <div className="h-24 lg:hidden" aria-hidden />

      {/* ------------------------------------------------------------------ */}
      {/* Sticky mobile action bar — the running total and the primary action */}
      {/* stay reachable while the customer scrolls a long form.              */}
      {/*                                                                    */}
      {/* Same offset as the tab bar's own height plus the safe area, because */}
      {/* a flat bottom-14 sat under the nav on a notched phone. The floating */}
      {/* cart and order bars step aside on this route (see ownsBottom in     */}
      {/* customer-shell) so nothing can land on top of Confirm.              */}
      {/* ------------------------------------------------------------------ */}
      <div className="fixed inset-x-0 bottom-[calc(3.25rem_+_env(safe-area-inset-bottom))] z-30 border-t border-ink-200 bg-white/95 backdrop-blur lg:hidden no-print">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <div className="min-w-0">
            <p className="text-[11px] leading-none text-ink-500">Total estimated</p>
            <p className="text-lg font-bold leading-tight text-ink-900">
              {inr(price?.total ?? 0)}
            </p>
            <p className="truncate text-[11px] leading-none text-ink-400">
              {hours}h · {slot || "pick a slot"}
            </p>
          </div>
          <Button
            size="lg"
            className="ml-auto min-w-0 flex-1"
            loading={submitting}
            disabled={!canSubmit}
            onClick={submit}
          >
            <span className="truncate">Confirm Booking</span>
          </Button>
        </div>
      </div>
    </CustomerShell>
  );
}
