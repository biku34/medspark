"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, FileText, Hospital, Phone, Stethoscope } from "lucide-react";
import { QueueTabs, StaffShell } from "@/components/staff-shell";
import { Metric, MetricRow, Pill, Ticket, WaitTimer } from "@/components/ops";
import { AiBriefing } from "@/components/ai-briefing";
import { ComplianceNote } from "@/components/brand";
import { EmptyState, Skeleton } from "@/components/ui";
import { api } from "@/lib/client";
import { totalVisitCount } from "@/lib/care";
import {
  CARE_PLAN_LABELS,
  PRESCRIPTION_LABELS,
  type CarePlan,
  type Prescription,
  type PrescriptionStatus,
} from "@/lib/types";
import { relativeTime } from "@/lib/utils";

type Tab = "queue" | "care" | "clarification" | "approved" | "rejected";

const TONE: Record<PrescriptionStatus, "amber" | "green" | "red" | "blue" | "grey"> = {
  PENDING: "amber",
  IN_REVIEW: "blue",
  CLARIFICATION: "amber",
  APPROVED: "green",
  REJECTED: "red",
};

const ACCENT: Record<PrescriptionStatus, "amber" | "green" | "red" | "blue" | "grey"> = {
  PENDING: "amber",
  IN_REVIEW: "blue",
  CLARIFICATION: "amber",
  APPROVED: "green",
  REJECTED: "red",
};

export default function PharmacistDashboard() {
  const [list, setList] = useState<Prescription[]>([]);
  const [plans, setPlans] = useState<CarePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("queue");

  useEffect(() => {
    const load = () =>
      Promise.all([
        api<{ prescriptions: Prescription[] }>("/api/prescriptions"),
        api<{ carePlans: CarePlan[] }>("/api/care-plans"),
      ])
        .then(([rx, cp]) => {
          setList(rx.prescriptions);
          setPlans(cp.carePlans);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    void load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, []);

  // Plans still needing the care team: not yet proposed, or sent back for edits.
  const openPlans = plans.filter((p) =>
    ["SUBMITTED", "IN_REVIEW", "CHANGES_REQUESTED"].includes(p.status),
  );

  const queue = list.filter((p) => p.status === "PENDING" || p.status === "IN_REVIEW");
  const clarification = list.filter((p) => p.status === "CLARIFICATION");
  const approved = list.filter((p) => p.status === "APPROVED");
  const rejected = list.filter((p) => p.status === "REJECTED");

  const shown =
    tab === "queue"
      ? queue
      : tab === "clarification"
        ? clarification
        : tab === "approved"
          ? approved
          : rejected;

  const avgWait = queue.length
    ? Math.round(
        queue.reduce((s, p) => s + (Date.now() - new Date(p.createdAt).getTime()) / 60000, 0) /
          queue.length,
      )
    : 0;

  return (
    <StaffShell role="pharmacist">
      <div className="mb-3">
        <h1 className="text-[18px] font-extrabold tracking-tight text-ink-900">
          Verification desk
        </h1>
        <p className="text-[12px] text-ink-500">
          Every prescription order in the network passes through here
        </p>
      </div>

      <AiBriefing role="pharmacist" />

      <MetricRow>
        <Metric
          label="Pending"
          value={queue.length}
          tone="amber"
          live={queue.length > 0}
          hint={`avg wait ${avgWait} min`}
        />
        <Metric label="Awaiting customer" value={clarification.length} tone="blue" />
        <Metric label="Approved" value={approved.length} tone="green" />
        <Metric
          label="Care plans"
          value={openPlans.length}
          tone={openPlans.length ? "violet" : "neutral"}
          live={openPlans.some((p) => p.status === "SUBMITTED")}
        />
      </MetricRow>

      <div className="mt-3">
        <QueueTabs<Tab>
          tabs={[
            { id: "queue", label: "To verify", count: queue.length, urgent: true },
            { id: "care", label: "Care plans", count: openPlans.length, urgent: true },
            { id: "clarification", label: "Clarification", count: clarification.length },
            { id: "approved", label: "Approved", count: approved.length },
            { id: "rejected", label: "Rejected", count: rejected.length },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      <ComplianceNote className="mb-3" />

      {tab === "care" ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {loading ? (
            Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-36" />)
          ) : openPlans.length === 0 ? (
            <div className="lg:col-span-2">
              <EmptyState
                icon={<Hospital size={36} />}
                title="No care plans waiting"
                body="Requests appear here the moment a customer uploads their documents."
              />
            </div>
          ) : (
            openPlans.map((p) => (
              <Ticket
                key={p.id}
                code={p.ref}
                accent={p.status === "SUBMITTED" ? "amber" : "blue"}
                timer={<WaitTimer since={p.createdAt} warnAfter={60} breachAfter={240} />}
                meta={
                  <span>
                    {p.customerName} · {relativeTime(p.createdAt)}
                  </span>
                }
                state={
                  <Pill tone={p.status === "SUBMITTED" ? "amber" : "blue"}>
                    {CARE_PLAN_LABELS[p.status]}
                  </Pill>
                }
                actions={
                  <Link
                    href={`/pharmacist/care-plans/${p.id}`}
                    className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-brand-600 px-3 text-[13px] font-bold text-white hover:bg-brand-700 sm:flex-none"
                  >
                    <Stethoscope size={14} />
                    {p.status === "SUBMITTED" ? "Start review" : "Continue"}
                  </Link>
                }
              >
                <p className="text-[13px] text-ink-800">
                  <strong className="text-ink-900">{p.patientName}</strong>
                  {p.patientAge ? `, ${p.patientAge}` : ""}
                  {p.condition ? ` · ${p.condition}` : ""}
                </p>
                {p.hospitalName && (
                  <p className="text-[11px] text-ink-500">
                    {p.hospitalName}
                    {p.dischargeDate ? ` · discharged ${p.dischargeDate}` : ""}
                  </p>
                )}
                {p.allergies && (
                  <p className="mt-1 inline-block rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-bold text-red-700">
                    Allergies: {p.allergies}
                  </p>
                )}
                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-600">
                  <span className="inline-flex items-center gap-1">
                    <FileText size={11} className="text-ink-400" />
                    {p.documents.length} document(s)
                  </span>
                  {p.medicines.length > 0 && <span>{p.medicines.length} medicine(s) drafted</span>}
                  {p.visits.length > 0 && <span>{totalVisitCount(p)} visit(s) drafted</span>}
                </p>
                {p.status === "CHANGES_REQUESTED" && p.changeRequest && (
                  <p className="mt-1.5 rounded border-l-2 border-amber-400 bg-amber-50 py-1 pl-2 text-[11px] text-amber-900">
                    “{p.changeRequest}”
                  </p>
                )}
              </Ticket>
            ))
          )}
        </div>
      ) : (
      <div className="grid gap-3 lg:grid-cols-2">
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40" />)
        ) : shown.length === 0 ? (
          <div className="lg:col-span-2">
            <EmptyState
              icon={<FileText size={36} />}
              title="Nothing here right now"
              body="New prescription uploads appear automatically."
            />
          </div>
        ) : (
          shown.map((p) => (
            <Ticket
              key={p.id}
              code={p.ref}
              accent={ACCENT[p.status]}
              timer={
                p.status === "PENDING" || p.status === "IN_REVIEW" ? (
                  <WaitTimer since={p.createdAt} warnAfter={5} breachAfter={15} />
                ) : undefined
              }
              meta={
                <span>
                  {p.customerName} · {relativeTime(p.createdAt)}
                </span>
              }
              state={<Pill tone={TONE[p.status]}>{PRESCRIPTION_LABELS[p.status]}</Pill>}
              actions={
                <>
                  <Link
                    href={`/pharmacist/${p.id}`}
                    className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-brand-600 px-3 text-[13px] font-bold text-white hover:bg-brand-700 sm:flex-none"
                  >
                    <CheckCircle2 size={14} />
                    {p.status === "APPROVED" || p.status === "REJECTED" ? "Open record" : "Verify now"}
                  </Link>
                  <span className="inline-flex items-center gap-1 text-[11px] text-ink-500">
                    <Phone size={11} className="text-ink-400" />
                    {p.call ? `Call logged · ${p.call.outcome}` : "No verification call yet"}
                  </span>
                </>
              }
            >
              <div className="flex gap-2.5">
                <div className="h-16 w-14 shrink-0 overflow-hidden rounded-md border border-ink-200 bg-ink-50">
                  {p.mimeType === "application/pdf" ? (
                    <div className="flex h-full items-center justify-center">
                      <FileText size={18} className="text-ink-400" />
                    </div>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={p.fileData} alt="" className="h-full w-full object-cover" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-ink-700">
                    Patient <strong className="text-ink-900">{p.patientName}</strong>
                  </p>

                  {p.extractedMedicines.length > 0 && (
                    <ul className="mt-1.5 flex flex-wrap gap-1">
                      {p.extractedMedicines.map((m) => (
                        <li
                          key={m.name}
                          className="rounded border border-ink-200 bg-ink-50 px-1.5 py-0.5 text-[11px] font-semibold text-ink-700"
                        >
                          {m.name}
                        </li>
                      ))}
                    </ul>
                  )}

                  {p.note && (
                    <p className="clamp-2 mt-1.5 text-[11px] italic text-ink-500">“{p.note}”</p>
                  )}
                </div>
              </div>
            </Ticket>
          ))
        )}
        </div>
      )}
    </StaffShell>
  );
}
