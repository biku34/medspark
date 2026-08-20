"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileUp,
  MapPin,
  Phone,
  ShieldAlert,
  Star,
  Upload,
  User as UserIcon,
  XCircle,
} from "lucide-react";
import { QueueTabs, StaffShell } from "@/components/staff-shell";
import { ActionButton, Metric, MetricRow, Pill, Ticket } from "@/components/ops";
import { useApp } from "@/components/providers";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  Input,
  Modal,
  SectionTitle,
  Skeleton,
  Stars,
  Textarea,
} from "@/components/ui";
import { RankedBars } from "@/components/charts";
import { api, patch } from "@/lib/client";
import { bookingDateLabel } from "@/lib/booking-utils";
import {
  SERVICE_META,
  bookingLabel,
  type ServiceBooking,
  type ServiceProvider,
} from "@/lib/types";
import { dateTime, inr } from "@/lib/utils";

type Tab = "requests" | "upcoming" | "completed" | "profile" | "earnings";

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ALL_SLOTS = [
  "08:00-10:00",
  "10:00-12:00",
  "12:00-16:00",
  "16:00-18:00",
  "18:00-20:00",
  "08:00-12:00",
  "20:00-08:00",
];

export default function ProviderDashboard() {
  const { user, toast } = useApp();
  const [tab, setTab] = useState<Tab>("requests");
  const [provider, setProvider] = useState<ServiceProvider | null>(null);
  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [credOpen, setCredOpen] = useState(false);
  const [credName, setCredName] = useState("");
  const [credFile, setCredFile] = useState("");

  const [form, setForm] = useState({
    headline: "",
    bio: "",
    qualifications: "",
    specialities: "",
    serviceAreas: "",
    experienceYears: 0,
    hourlyRate: 0,
    serviceRadiusKm: 10,
  });

  const load = useCallback(async () => {
    try {
      const d = await api<{ bookings: ServiceBooking[]; provider: ServiceProvider | null }>(
        "/api/bookings",
      );
      setBookings(d.bookings);
      if (d.provider) {
        setProvider(d.provider);
        setForm({
          headline: d.provider.headline,
          bio: d.provider.bio,
          qualifications: d.provider.qualifications.join(", "),
          specialities: d.provider.specialities.join(", "),
          serviceAreas: d.provider.serviceAreas.join(", "),
          experienceYears: d.provider.experienceYears,
          hourlyRate: d.provider.hourlyRate,
          serviceRadiusKm: d.provider.serviceRadiusKm,
        });
      }
    } catch {
      /* guarded by the shell */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void load();
    const t = setInterval(load, 12_000);
    return () => clearInterval(t);
  }, [user, load]);

  const act = async (booking: ServiceBooking, action: string) => {
    setBusyId(booking.id);
    try {
      await patch(`/api/bookings/${booking.id}`, { action });
      toast({ kind: "success", title: `${booking.code} · ${action}` });
      await load();
    } catch (e) {
      toast({ kind: "error", title: "Could not update", body: (e as Error).message });
    } finally {
      setBusyId(null);
    }
  };

  const updateProvider = async (action: string, body: Record<string, unknown>) => {
    try {
      await patch("/api/providers/me", { action, ...body });
      toast({ kind: "success", title: "Profile updated" });
      await load();
    } catch (e) {
      toast({ kind: "error", title: "Could not save", body: (e as Error).message });
    }
  };

  const requests = bookings.filter((b) => b.status === "REQUESTED");
  const upcoming = bookings.filter((b) =>
    ["ASSIGNED", "CONFIRMED", "IN_VISIT"].includes(b.status),
  );
  const completed = bookings.filter((b) => b.status === "COMPLETED");

  const earnings = useMemo(() => {
    const total = completed.reduce((s, b) => s + b.serviceCharge, 0);
    const week = completed
      .filter((b) => Date.now() - new Date(b.createdAt).getTime() < 7 * 864e5)
      .reduce((s, b) => s + b.serviceCharge, 0);
    const byPatient = new Map<string, number>();
    for (const b of completed) {
      byPatient.set(b.patientName, (byPatient.get(b.patientName) ?? 0) + b.serviceCharge);
    }
    return {
      total,
      week,
      visits: completed.length,
      avg: completed.length ? Math.round(total / completed.length) : 0,
      hours: completed.reduce((s, b) => s + b.hours, 0),
      top: [...byPatient.entries()]
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5),
    };
  }, [completed]);

  if (loading) {
    return (
      <StaffShell role="provider">
        <Skeleton className="h-96" />
      </StaffShell>
    );
  }

  if (!provider) {
    return (
      <StaffShell role="provider">
        <EmptyState
          icon={<UserIcon size={38} />}
          title="No provider profile linked to this account"
          body="Ask DawaQuick admin to attach a provider profile to your login."
        />
      </StaffShell>
    );
  }

  const meta = SERVICE_META[provider.type];
  const list = tab === "requests" ? requests : tab === "upcoming" ? upcoming : completed;

  return (
    <StaffShell role="provider">
      {/* ------------------------------ header ----------------------------- */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-4xl">
            {provider.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold text-ink-900">
              {provider.name}
              {provider.verified ? (
                <Badge tone="green" icon={<BadgeCheck size={12} />}>
                  Verification Status: Verified ✓
                </Badge>
              ) : (
                <Badge tone="amber" icon={<ShieldAlert size={12} />}>
                  Pending verification
                </Badge>
              )}
            </h1>
            <p className="text-sm text-ink-500">
              {meta.short} · {provider.headline}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-600">
              <Stars value={provider.rating} count={provider.ratingCount} />
              <span>{provider.completedVisits} visits completed</span>
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} /> {provider.serviceAreas.join(", ")} · {provider.city}
              </span>
              <span>{inr(provider.hourlyRate)}/hour</span>
            </div>
          </div>
        </div>
        {!provider.verified && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
            Your profile is awaiting credential verification by DawaQuick. You can complete your
            profile and upload certificates now — bookings unlock once an admin approves you.
          </p>
        )}
      </Card>

      <MetricRow>
        <Metric
          label="Open requests"
          value={requests.length}
          tone="amber"
          live={requests.length > 0}
        />
        <Metric label="Upcoming visits" value={upcoming.length} tone="blue" />
        <Metric label="Completed" value={completed.length} tone="green" />
        <Metric label="Earned (7 days)" value={inr(earnings.week)} tone="green" />
      </MetricRow>

      <div className="mt-3">
        <QueueTabs<Tab>
          tabs={[
            { id: "requests", label: "Requests", count: requests.length, urgent: true },
            { id: "upcoming", label: "Upcoming", count: upcoming.length },
            { id: "completed", label: "Completed", count: completed.length },
            { id: "profile", label: "Profile" },
            { id: "earnings", label: "Earnings" },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      <div>
        {/* ---------------------------- bookings --------------------------- */}
        {(tab === "requests" || tab === "upcoming" || tab === "completed") && (
          <div className="grid gap-3 lg:grid-cols-2">
            {list.length === 0 ? (
              <div className="lg:col-span-2">
                <EmptyState
                  icon={<CalendarDays size={38} />}
                  title={
                    tab === "requests"
                      ? "No open requests right now"
                      : tab === "upcoming"
                        ? "No upcoming visits"
                        : "No completed visits yet"
                  }
                  body="New home-visit requests in your service area appear here automatically."
                />
              </div>
            ) : (
              list.map((b) => (
                <Ticket
                  key={b.id}
                  code={b.code}
                  accent={
                    b.status === "COMPLETED"
                      ? "green"
                      : b.status === "REQUESTED"
                        ? "amber"
                        : "blue"
                  }
                  meta={<span>Requested {dateTime(b.createdAt)}</span>}
                  state={
                    <span className="flex flex-col items-end gap-1">
                      <Pill
                        tone={
                          b.status === "COMPLETED"
                            ? "green"
                            : b.status === "REQUESTED"
                              ? "amber"
                              : "blue"
                        }
                      >
                        {bookingLabel(b.serviceType, b.status)}
                      </Pill>
                      <span className="text-[13px] font-extrabold text-brand-700">
                        {inr(b.serviceCharge)}
                      </span>
                    </span>
                  }
                  actions={
                    <>
                      {b.status === "REQUESTED" && (
                        <>
                          <ActionButton
                            loading={busyId === b.id}
                            icon={<CheckCircle2 size={14} />}
                            onClick={() => act(b, "accept")}
                            disabled={!provider.verified}
                          >
                            Accept
                          </ActionButton>
                          <ActionButton
                            tone="danger"
                            loading={busyId === b.id}
                            icon={<XCircle size={14} />}
                            onClick={() => act(b, "reject")}
                          >
                            Decline
                          </ActionButton>
                        </>
                      )}
                      {b.status === "ASSIGNED" && (
                        <ActionButton loading={busyId === b.id} onClick={() => act(b, "confirm")}>
                          Confirm booking
                        </ActionButton>
                      )}
                      {b.status === "CONFIRMED" && b.serviceType === "NURSING" && (
                        <ActionButton
                          loading={busyId === b.id}
                          onClick={() => act(b, "start_visit")}
                        >
                          Start home visit
                        </ActionButton>
                      )}
                      {((b.status === "CONFIRMED" && b.serviceType === "PHYSIO") ||
                        b.status === "IN_VISIT") && (
                        <ActionButton
                          loading={busyId === b.id}
                          icon={<CheckCircle2 size={14} />}
                          onClick={() => act(b, "complete")}
                        >
                          Mark completed
                        </ActionButton>
                      )}
                      <a
                        href={`tel:${b.customerPhone.replace(/\s/g, "")}`}
                        className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-ink-300 bg-white px-3 text-[13px] font-bold text-ink-700 hover:bg-ink-100 sm:flex-none"
                      >
                        <Phone size={14} /> Call patient
                      </a>
                      {b.rating && (
                        <Pill tone="amber">
                          <Star size={9} className="fill-white" /> {b.rating}/5
                        </Pill>
                      )}
                    </>
                  }
                >
                  {/* when and where — the two things a visiting professional plans around */}
                  <div className="rounded-md border border-ink-200 bg-ink-50 px-2.5 py-2">
                    <p className="flex items-center gap-1.5 text-[14px] font-bold text-ink-900">
                      <CalendarDays size={13} className="text-ink-400" />
                      {bookingDateLabel(b.date)} · {b.slot}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-600">
                      <Clock3 size={11} className="text-ink-400" />
                      {b.hours} hour{b.hours > 1 ? "s" : ""} · {inr(b.rate)}/hr
                    </p>
                  </div>

                  <p className="mt-2 flex items-start gap-1.5 text-[13px] text-ink-800">
                    <MapPin size={13} className="mt-0.5 shrink-0 text-ink-400" />
                    <span>
                      <strong className="text-ink-900">{b.patientName}</strong>
                      <span className="block text-[12px] text-ink-600">{b.address}</span>
                    </span>
                  </p>

                  {(b.reason || b.assistanceTypes.length > 0 || b.patientNotes) && (
                    <div className="mt-2 space-y-0.5 text-[11px] text-ink-600">
                      {b.reason && (
                        <p>
                          <span className="font-bold text-ink-500">Reason: </span>
                          {b.reason}
                        </p>
                      )}
                      {b.assistanceTypes.length > 0 && (
                        <p>
                          <span className="font-bold text-ink-500">Assistance: </span>
                          {b.assistanceTypes.join(", ")}
                        </p>
                      )}
                      {b.patientNotes && (
                        <p>
                          <span className="font-bold text-ink-500">Notes: </span>
                          {b.patientNotes}
                        </p>
                      )}
                    </div>
                  )}
                </Ticket>
              ))
            )}
          </div>
        )}

        {/* ----------------------------- profile --------------------------- */}
        {tab === "profile" && (
          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <SectionTitle title="Profile" subtitle="Shown to customers before they book" />
              <div className="space-y-3">
                <Field label="Headline">
                  <Input
                    value={form.headline}
                    onChange={(e) => setForm({ ...form, headline: e.target.value })}
                  />
                </Field>
                <Field label="About you">
                  <Textarea
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  />
                </Field>
                <Field label="Qualifications" hint="Comma separated">
                  <Input
                    value={form.qualifications}
                    onChange={(e) => setForm({ ...form, qualifications: e.target.value })}
                  />
                </Field>
                <Field label="Specialities" hint="Comma separated">
                  <Input
                    value={form.specialities}
                    onChange={(e) => setForm({ ...form, specialities: e.target.value })}
                  />
                </Field>
                <Field label="Service areas" hint="Comma separated localities">
                  <Input
                    value={form.serviceAreas}
                    onChange={(e) => setForm({ ...form, serviceAreas: e.target.value })}
                  />
                </Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Experience (yrs)">
                    <Input
                      type="number"
                      value={form.experienceYears}
                      onChange={(e) =>
                        setForm({ ...form, experienceYears: Number(e.target.value) })
                      }
                    />
                  </Field>
                  <Field label="Rate ₹/hr">
                    <Input
                      type="number"
                      value={form.hourlyRate}
                      onChange={(e) => setForm({ ...form, hourlyRate: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="Radius (km)">
                    <Input
                      type="number"
                      value={form.serviceRadiusKm}
                      onChange={(e) =>
                        setForm({ ...form, serviceRadiusKm: Number(e.target.value) })
                      }
                    />
                  </Field>
                </div>
                <Button
                  full
                  onClick={() =>
                    updateProvider("profile", {
                      profile: {
                        headline: form.headline,
                        bio: form.bio,
                        qualifications: form.qualifications.split(",").map((s) => s.trim()).filter(Boolean),
                        specialities: form.specialities.split(",").map((s) => s.trim()).filter(Boolean),
                        serviceAreas: form.serviceAreas.split(",").map((s) => s.trim()).filter(Boolean),
                        experienceYears: form.experienceYears,
                        hourlyRate: form.hourlyRate,
                        serviceRadiusKm: form.serviceRadiusKm,
                      },
                    })
                  }
                >
                  Save profile
                </Button>
              </div>
            </Card>

            <div className="space-y-3">
              <Card>
                <SectionTitle title="Availability" subtitle="Days and slots you accept visits" />
                <p className="mb-2 text-xs font-medium text-ink-500">Working days</p>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_NAMES.map((d, i) => {
                    const on = provider.availability.weekdays.includes(i);
                    return (
                      <button
                        key={d}
                        onClick={() =>
                          updateProvider("availability", {
                            profile: {
                              availability: {
                                ...provider.availability,
                                weekdays: on
                                  ? provider.availability.weekdays.filter((w) => w !== i)
                                  : [...provider.availability.weekdays, i].sort(),
                              },
                            },
                          })
                        }
                        className={
                          "rounded-lg border px-3 py-1.5 text-sm font-medium " +
                          (on
                            ? "border-brand-500 bg-brand-50 text-brand-800"
                            : "border-ink-200 bg-white text-ink-500")
                        }
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>

                <p className="mb-2 mt-4 text-xs font-medium text-ink-500">Time slots</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {ALL_SLOTS.map((s) => (
                    <Checkbox
                      key={s}
                      checked={provider.availability.slots.includes(s)}
                      onChange={(v) =>
                        updateProvider("availability", {
                          profile: {
                            availability: {
                              ...provider.availability,
                              slots: v
                                ? [...provider.availability.slots, s]
                                : provider.availability.slots.filter((x) => x !== s),
                            },
                          },
                        })
                      }
                      label={s}
                    />
                  ))}
                </div>
              </Card>

              <Card>
                <SectionTitle
                  title="Professional credentials"
                  action={
                    <Button size="sm" icon={<Upload size={14} />} onClick={() => setCredOpen(true)}>
                      Upload
                    </Button>
                  }
                />
                {provider.credentials.length === 0 ? (
                  <p className="text-sm text-ink-500">
                    No credentials uploaded yet. Upload your degree and council registration to get
                    verified.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {provider.credentials.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center gap-3 rounded-xl border border-ink-200 p-3"
                      >
                        <FileUp size={16} className="shrink-0 text-ink-400" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink-900">
                            {c.name}
                          </span>
                          <span className="block truncate text-xs text-ink-500">
                            {c.fileName} · {dateTime(c.uploadedAt)}
                          </span>
                        </span>
                        <Badge tone={c.status === "VERIFIED" ? "green" : "amber"}>{c.status}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 rounded-xl bg-ink-50 p-3 text-xs text-ink-500">
                  Prototype note: uploads record the filename only. Production stores the document
                  in encrypted object storage and routes it to a manual verification queue.
                </p>
              </Card>
            </div>
          </div>
        )}

        {/* ---------------------------- earnings --------------------------- */}
        {tab === "earnings" && (
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric label="Last 7 days" value={inr(earnings.week)} tone="green" />
              <Metric label="All time" value={inr(earnings.total)} tone="green" />
              <Metric label="Visits completed" value={earnings.visits} />
              <Metric label="Avg. per visit" value={inr(earnings.avg)} tone="blue" hint={`${earnings.hours} hours worked`} />
            </div>
            <Card>
              <SectionTitle title="Earnings by patient" />
              {earnings.top.length ? (
                <RankedBars items={earnings.top} unit="₹" />
              ) : (
                <p className="text-sm text-ink-500">No completed visits yet.</p>
              )}
            </Card>
            <Card className="lg:col-span-2">
              <p className="text-xs text-ink-500">
                Earnings shown are the service charge for completed visits. DawaQuick&apos;s platform
                fee is collected separately from the customer. Settlement, TDS and invoicing are out
                of scope for this prototype.
              </p>
            </Card>
          </div>
        )}
      </div>

      {/* ------------------------- upload credential ----------------------- */}
      <Modal
        open={credOpen}
        onClose={() => setCredOpen(false)}
        title="Upload a professional credential"
        footer={
          <Button
            full
            disabled={!credName.trim()}
            onClick={async () => {
              await updateProvider("add_credential", {
                credential: { name: credName, fileName: credFile || "credential.pdf" },
              });
              setCredOpen(false);
              setCredName("");
              setCredFile("");
            }}
          >
            Submit for verification
          </Button>
        }
      >
        <Field label="Document name" required>
          <Input
            value={credName}
            onChange={(e) => setCredName(e.target.value)}
            placeholder="e.g. BPT degree certificate"
          />
        </Field>
        <div className="mt-3">
          <Field label="Document file" hint="Placeholder — the file itself is not stored in the prototype">
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setCredFile(e.target.files?.[0]?.name ?? "")}
              className="w-full rounded-xl border border-ink-300 bg-white px-3 py-2.5 text-sm text-ink-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700"
            />
          </Field>
        </div>
        {credFile && (
          <p className="mt-2 text-xs text-emerald-700">Selected: {credFile}</p>
        )}
      </Modal>
    </StaffShell>
  );
}
