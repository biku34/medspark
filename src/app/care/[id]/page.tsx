"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  MessageSquare,
  Package,
  ShieldCheck,
  Stethoscope,
  Store,
  TriangleAlert,
} from "lucide-react";
import clsx from "clsx";
import { CustomerShell } from "@/components/customer-shell";
import { ServiceArt } from "@/components/art";
import { CarePlanBadge, CarePlanProgress, DocumentTile, MedicineLine } from "@/components/care-ui";
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
  Textarea,
} from "@/components/ui";
import { api, patch } from "@/lib/client";
import { deliverableMedicines, repeatMedicines, visitDates } from "@/lib/care";
import { SERVICE_META, type CarePlan, type PharmacyOffer, type Prescription } from "@/lib/types";
import { bookingDateLabel } from "@/lib/booking-utils";
import { dateTime, inr } from "@/lib/utils";

export default function CarePlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, location, toast } = useApp();

  const [plan, setPlan] = useState<CarePlan | null>(null);
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [offers, setOffers] = useState<PharmacyOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [approveOpen, setApproveOpen] = useState(false);
  const [pharmacyId, setPharmacyId] = useState("");
  const [startRepeat, setStartRepeat] = useState(true);
  const [changesOpen, setChangesOpen] = useState(false);
  const [changeNote, setChangeNote] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await api<{ carePlan: CarePlan; prescription: Prescription | null }>(
        `/api/care-plans/${id}`,
      );
      setPlan(d.carePlan);
      setPrescription(d.prescription);
    } catch (e) {
      toast({ kind: "error", title: "Could not load this plan", body: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  /* Pharmacies that can actually fill this plan's basket. */
  const openApprove = async () => {
    setApproveOpen(true);
    if (!plan) return;
    const meds = deliverableMedicines(plan);
    if (!meds.length) return;
    try {
      const basket = meds.map((m) => `${m.medicineId}:${m.qtyPerCycle}`).join(",");
      const d = await api<{ offers: PharmacyOffer[] }>(
        `/api/pharmacies?items=${encodeURIComponent(basket)}` +
          (location ? `&lat=${location.lat}&lng=${location.lng}` : ""),
      );
      setOffers(d.offers);
      const first = d.offers.find((o) => o.allAvailable) ?? d.offers[0];
      if (first) setPharmacyId(first.pharmacy.id);
    } catch {
      /* the picker falls back to a plain message */
    }
  };

  const approve = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      const res = await patch<{ carePlan: CarePlan; problems?: string[] }>(
        `/api/care-plans/${plan.id}`,
        {
          action: "approve",
          pharmacyId: pharmacyId || undefined,
          address: location?.address ?? user?.address,
          locality: location?.locality ?? user?.locality,
          city: location?.city,
          lat: location?.lat,
          lng: location?.lng,
          paymentMode: "COD",
          startRepeat,
        },
      );
      setApproveOpen(false);
      setPlan(res.carePlan);
      toast({
        kind: "success",
        title: "Care plan approved",
        body: res.problems?.length ? res.problems.join(" ") : "Everything is scheduled.",
      });
      await load();
    } catch (e) {
      toast({ kind: "error", title: "Could not approve", body: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const requestChanges = async () => {
    if (!plan || !changeNote.trim()) return;
    setBusy(true);
    try {
      await patch(`/api/care-plans/${plan.id}`, {
        action: "request_changes",
        note: changeNote.trim(),
      });
      setChangesOpen(false);
      setChangeNote("");
      toast({ kind: "info", title: "Sent to the care team" });
      await load();
    } catch (e) {
      toast({ kind: "error", title: "Could not send", body: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <CustomerShell>
        <Skeleton className="h-64" />
      </CustomerShell>
    );
  }

  if (!plan) {
    return (
      <CustomerShell>
        <Card>
          <p className="text-[14px] font-bold text-ink-900">Care plan not found</p>
          <Button className="mt-3" onClick={() => router.push("/care")}>
            Back to care plans
          </Button>
        </Card>
      </CustomerShell>
    );
  }

  const meds = deliverableMedicines(plan);
  const repeats = repeatMedicines(plan);
  const stopped = plan.medicines.filter((m) => m.reconciliation === "STOP");
  const awaitingYou = plan.status === "PLAN_READY";
  const proposed = ["PLAN_READY", "ACTIVE", "COMPLETED", "CHANGES_REQUESTED"].includes(plan.status);

  return (
    <CustomerShell>
      <Link
        href="/care"
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-600 hover:text-ink-900"
      >
        <ArrowLeft size={15} /> Care plans
      </Link>

      {/* ------------------------------ header ------------------------------ */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-[12px] font-bold text-ink-500">{plan.ref}</p>
            <h1 className="text-[20px] font-extrabold tracking-tight text-ink-900">
              {plan.patientName}
            </h1>
            <p className="text-[12px] text-ink-500">
              {[plan.condition, plan.hospitalName].filter(Boolean).join(" · ") ||
                "Care plan request"}
            </p>
          </div>
          <CarePlanBadge status={plan.status} full />
        </div>

        <div className="mt-4">
          <CarePlanProgress status={plan.status} />
        </div>
      </Card>

      {/* --------------------- the ask, when it's your turn ---------------- */}
      {awaitingYou && (
        <Card className="mt-3 border-rx-300 bg-rx-50">
          <p className="flex items-center gap-1.5 text-[14px] font-extrabold text-rx-800">
            <CalendarCheck size={16} /> Your care plan is ready
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-rx-800">
            Nothing has been ordered or booked yet. Read the plan below, then approve it — you
            choose the pharmacy at that point.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={openApprove}>Approve &amp; schedule</Button>
            <Button variant="outline" onClick={() => setChangesOpen(true)}>
              <MessageSquare size={14} /> Ask for changes
            </Button>
          </div>
        </Card>
      )}

      {plan.status === "CHANGES_REQUESTED" && plan.changeRequest && (
        <Card className="mt-3 border-rx-300 bg-rx-50">
          <p className="text-[13px] font-extrabold text-rx-800">
            The care team is revising your plan
          </p>
          <p className="mt-1 text-[12px] italic text-rx-800">“{plan.changeRequest}”</p>
        </Card>
      )}

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        <div className="min-w-0 space-y-3">
          {/* ---------------------------- summary --------------------------- */}
          {plan.summary && (
            <Card>
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-ink-400">
                From {plan.coordinatorName ?? "the care team"}
              </p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink-800">{plan.summary}</p>
              {plan.safetyNotes && (
                <p className="mt-2.5 flex gap-2 rounded-lg border border-rx-200 bg-rx-50 p-2.5 text-[12px] leading-relaxed text-rx-800">
                  <TriangleAlert size={15} className="mt-px shrink-0" />
                  <span>{plan.safetyNotes}</span>
                </p>
              )}
            </Card>
          )}

          {/* --------------------------- medicines -------------------------- */}
          {proposed && plan.medicines.length > 0 && (
            <Card>
              <SectionTitle
                title="Your medicines"
                subtitle="Checked against what the patient was already taking"
              />
              <ul className="space-y-2">
                {plan.medicines
                  .filter((m) => m.reconciliation !== "STOP")
                  .map((m) => (
                    <MedicineLine key={m.id} med={m} />
                  ))}
              </ul>

              {stopped.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-red-700">
                    Stop these
                  </p>
                  <ul className="space-y-2">
                    {stopped.map((m) => (
                      <MedicineLine key={m.id} med={m} />
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

          {/* ----------------------------- visits --------------------------- */}
          {proposed && plan.visits.length > 0 && (
            <Card>
              <SectionTitle title="Home visits" subtitle="Scheduled once you approve" />
              <ul className="space-y-2">
                {plan.visits.map((v) => {
                  const meta = SERVICE_META[v.serviceType];
                  const dates = visitDates(v);
                  return (
                    <li key={v.id} className="rounded-lg border border-ink-200 p-2.5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <ServiceArt
                          kind={v.serviceType === "PHYSIO" ? "physio" : "nursing"}
                          size={34}
                          className="shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-[14px] font-bold text-ink-900">
                            {meta.short}
                          </p>
                          <p className="text-[12px] text-ink-600">
                            {v.reason || v.assistanceTypes.join(", ") || "Home visit"}
                          </p>
                        </div>
                        <Badge tone="brand">
                          {v.visits} visit{v.visits === 1 ? "" : "s"}
                        </Badge>
                      </div>
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-500">
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock size={11} /> {v.slot} · {v.hours}h each
                        </span>
                        <span>Every {v.everyDays} day(s)</span>
                      </p>
                      <p className="mt-1.5 flex flex-wrap gap-1">
                        {dates.map((d) => (
                          <span
                            key={d}
                            className="rounded border border-ink-200 bg-ink-50 px-1.5 py-0.5 text-[11px] font-semibold text-ink-700"
                          >
                            {bookingDateLabel(d)}
                          </span>
                        ))}
                      </p>
                      {v.note && <p className="mt-1.5 text-[12px] text-ink-600">{v.note}</p>}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {/* --------------------------- follow-ups ------------------------- */}
          {proposed && plan.followUps.length > 0 && (
            <Card>
              <SectionTitle title="What to re-check" />
              <ul className="divide-y divide-ink-100">
                {plan.followUps.map((f) => (
                  <li key={f.id} className="flex items-start justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-ink-900">{f.label}</p>
                      {f.note && <p className="text-[11px] text-ink-500">{f.note}</p>}
                    </div>
                    <span className="shrink-0 rounded bg-ink-100 px-1.5 py-0.5 text-[11px] font-bold text-ink-700">
                      {bookingDateLabel(f.dueDate)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {!proposed && (
            <Card>
              <p className="text-[14px] font-bold text-ink-900">
                Your documents are with the care team
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-600">
                A pharmacist is reading them now. You'll get a notification the moment there is a
                plan to approve — usually within a few hours.
              </p>
            </Card>
          )}
        </div>

        {/* ------------------------------ aside ----------------------------- */}
        <div className="min-w-0 space-y-3">
          <Card>
            <SectionTitle title="Documents" />
            <div className="space-y-2">
              {plan.documents.map((d) => (
                <DocumentTile key={d.id} doc={d} />
              ))}
            </div>
          </Card>

          {prescription && (
            <Card>
              <SectionTitle title="Prescription" />
              <KeyValue label="Reference" value={prescription.ref} />
              <KeyValue
                label="Status"
                value={
                  prescription.status === "APPROVED" ? (
                    <Badge tone="green" icon={<ShieldCheck size={11} />}>
                      Verified
                    </Badge>
                  ) : (
                    <Badge tone="amber">Awaiting verification</Badge>
                  )
                }
              />
              {prescription.refillsAuthorised ? (
                <KeyValue
                  label="Repeats left"
                  value={`${(prescription.refillsAuthorised ?? 0) - (prescription.refillsUsed ?? 0)} of ${prescription.refillsAuthorised}`}
                />
              ) : null}
              {prescription.validUntil && (
                <KeyValue label="Valid until" value={bookingDateLabel(prescription.validUntil)} />
              )}
            </Card>
          )}

          {plan.status === "ACTIVE" && (
            <Card>
              <SectionTitle title="What we scheduled" />
              <div className="space-y-1.5 text-[13px]">
                <p className="flex items-center gap-2">
                  <Package size={14} className="text-ink-400" />
                  <Link href="/orders" className="font-bold text-brand-700 underline">
                    {plan.scheduled.orderIds.length} order(s)
                  </Link>
                </p>
                <p className="flex items-center gap-2">
                  <CalendarClock size={14} className="text-ink-400" />
                  <Link href="/subscriptions" className="font-bold text-brand-700 underline">
                    {plan.scheduled.subscriptionIds.length} repeat delivery
                  </Link>
                </p>
                <p className="flex items-center gap-2">
                  <Stethoscope size={14} className="text-ink-400" />
                  <Link href="/bookings" className="font-bold text-brand-700 underline">
                    {plan.scheduled.bookingIds.length} home visit(s)
                  </Link>
                </p>
              </div>
            </Card>
          )}

          <Card>
            <SectionTitle title="History" />
            <ol className="space-y-2.5">
              {[...plan.history].reverse().map((h, i) => (
                <li key={i} className="flex gap-2.5">
                  <span
                    className={clsx(
                      "mt-1 h-2 w-2 shrink-0 rounded-full",
                      i === 0 ? "bg-brand-600" : "bg-ink-300",
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-ink-800">{h.status.replace(/_/g, " ")}</p>
                    <p className="text-[11px] text-ink-500">
                      {dateTime(h.at)}
                      {h.by ? ` · ${h.by}` : ""}
                    </p>
                    {h.note && <p className="mt-0.5 text-[11px] text-ink-600">{h.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      {/* ----------------------------- approve ----------------------------- */}
      <Modal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        title="Approve your care plan"
        footer={
          <>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={busy}
              onClick={approve}
              disabled={meds.length > 0 && !pharmacyId}
              icon={<CheckCircle2 size={15} />}
            >
              Approve &amp; schedule
            </Button>
          </>
        }
      >
        {meds.length > 0 && (
          <Field
            label="Which pharmacy should dispense?"
            hint="You choose — we never assign one for you."
          >
            {offers.length ? (
              <Select value={pharmacyId} onChange={(e) => setPharmacyId(e.target.value)}>
                {offers.map((o) => (
                  <option key={o.pharmacy.id} value={o.pharmacy.id}>
                    {o.pharmacy.name} · {o.distanceKm} km · {inr(o.total)}
                    {o.allAvailable ? "" : " · some items missing"}
                  </option>
                ))}
              </Select>
            ) : (
              <p className="rounded-lg bg-ink-50 p-2.5 text-[12px] text-ink-600">
                Finding pharmacies near you…
              </p>
            )}
          </Field>
        )}

        <ul className="mt-3 space-y-1.5 text-[12px] text-ink-700">
          <li className="flex items-center gap-2">
            <Package size={14} className="text-ink-400" />
            {meds.length} medicine(s) delivered now
          </li>
          {repeats.length > 0 && (
            <li className="flex items-center gap-2">
              <CalendarClock size={14} className="text-ink-400" />
              {repeats.length} on a repeat delivery
            </li>
          )}
          <li className="flex items-center gap-2">
            <Stethoscope size={14} className="text-ink-400" />
            {plan.visits.reduce((s, v) => s + v.visits, 0)} home visit(s) requested
          </li>
        </ul>

        {repeats.length > 0 && (
          <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-ink-200 p-2.5">
            <input
              type="checkbox"
              checked={startRepeat}
              onChange={(e) => setStartRepeat(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-brand-600"
            />
            <span>
              <span className="block text-[13px] font-bold text-ink-900">
                Set up the repeat delivery
              </span>
              <span className="block text-[11px] text-ink-500">
                {repeats.map((m) => m.name).join(", ")} — you can pause or cancel any time.
              </span>
            </span>
          </label>
        )}

        <p className="mt-3 flex gap-2 rounded-lg bg-ink-50 p-2.5 text-[11px] leading-relaxed text-ink-600">
          <Store size={14} className="mt-px shrink-0 text-ink-400" />
          Home visits still need one day's notice, and the pharmacy confirms stock before
          dispatching. We'll tell you if anything can't be scheduled.
        </p>
      </Modal>

      {/* -------------------------- ask for changes ------------------------ */}
      <Modal
        open={changesOpen}
        onClose={() => setChangesOpen(false)}
        title="Ask the care team for changes"
        footer={
          <>
            <Button variant="outline" onClick={() => setChangesOpen(false)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={requestChanges} disabled={!changeNote.trim()}>
              Send
            </Button>
          </>
        }
      >
        <Field label="What would you like changed?">
          <Textarea
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            placeholder="The physiotherapy times don't work for us — can we do mornings?"
          />
        </Field>
      </Modal>
    </CustomerShell>
  );
}
