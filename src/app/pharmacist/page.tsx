"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, FileText, MessageSquare, XCircle } from "lucide-react";
import { StaffShell } from "@/components/staff-shell";
import { ComplianceNote } from "@/components/brand";
import { Badge, Card, EmptyState, SectionTitle, Skeleton, Stat, Tabs } from "@/components/ui";
import { api } from "@/lib/client";
import { PRESCRIPTION_LABELS, type Prescription, type PrescriptionStatus } from "@/lib/types";
import { dateTime, relativeTime } from "@/lib/utils";

type Tab = "queue" | "clarification" | "approved" | "rejected";

const TONE: Record<PrescriptionStatus, "amber" | "green" | "red" | "blue" | "slate"> = {
  PENDING: "amber",
  IN_REVIEW: "blue",
  CLARIFICATION: "amber",
  APPROVED: "green",
  REJECTED: "red",
};

export default function PharmacistDashboard() {
  const [list, setList] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("queue");

  useEffect(() => {
    const load = () =>
      api<{ prescriptions: Prescription[] }>("/api/prescriptions")
        .then((d) => setList(d.prescriptions))
        .catch(() => {})
        .finally(() => setLoading(false));
    void load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, []);

  const queue = list.filter((p) => p.status === "PENDING" || p.status === "IN_REVIEW");
  const clarification = list.filter((p) => p.status === "CLARIFICATION");
  const approved = list.filter((p) => p.status === "APPROVED");
  const rejected = list.filter((p) => p.status === "REJECTED");

  const shown =
    tab === "queue" ? queue : tab === "clarification" ? clarification : tab === "approved" ? approved : rejected;

  const avgWait = queue.length
    ? Math.round(
        queue.reduce((s, p) => s + (Date.now() - new Date(p.createdAt).getTime()) / 60000, 0) /
          queue.length,
      )
    : 0;

  return (
    <StaffShell role="pharmacist">
      <SectionTitle
        title="Prescription verification queue"
        subtitle="Every prescription medicine order in the network passes through this desk."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pending" value={queue.length} tone="amber" icon={<Clock3 size={15} />} hint={`avg wait ${avgWait} min`} />
        <Stat label="Awaiting customer" value={clarification.length} tone="blue" icon={<MessageSquare size={15} />} />
        <Stat label="Approved" value={approved.length} tone="green" icon={<CheckCircle2 size={15} />} />
        <Stat label="Rejected" value={rejected.length} tone="red" icon={<XCircle size={15} />} />
      </div>

      <ComplianceNote className="mb-4" />

      <Tabs<Tab>
        tabs={[
          { id: "queue", label: "Pending Prescriptions", count: queue.length },
          { id: "clarification", label: "Clarification", count: clarification.length },
          { id: "approved", label: "Approved", count: approved.length },
          { id: "rejected", label: "Rejected", count: rejected.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40" />)
        ) : shown.length === 0 ? (
          <div className="lg:col-span-2">
            <EmptyState
              icon={<FileText size={38} />}
              title="Nothing here right now"
              body="New prescription uploads appear automatically."
            />
          </div>
        ) : (
          shown.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink-900">
                    <span className="font-mono">{p.ref}</span>
                    <Badge tone={TONE[p.status]}>{PRESCRIPTION_LABELS[p.status]}</Badge>
                  </p>
                  <p className="mt-1 text-sm text-ink-700">
                    Patient: <strong>{p.patientName}</strong>
                  </p>
                  <p className="text-xs text-ink-500">
                    Submitted by {p.customerName} · {dateTime(p.createdAt)} ({relativeTime(p.createdAt)})
                  </p>
                </div>
                <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg border border-ink-200 bg-ink-50">
                  {p.mimeType === "application/pdf" ? (
                    <div className="flex h-full items-center justify-center">
                      <FileText size={18} className="text-ink-400" />
                    </div>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={p.fileData} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
              </div>

              {p.extractedMedicines.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {p.extractedMedicines.map((m) => (
                    <li
                      key={m.name}
                      className="rounded-full bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-700"
                    >
                      {m.name}
                    </li>
                  ))}
                </ul>
              )}

              {p.note && (
                <p className="mt-2 rounded-lg bg-ink-50 p-2.5 text-xs text-ink-600">
                  “{p.note}”
                </p>
              )}

              <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-3">
                <span className="text-xs text-ink-400">
                  {p.call ? `Call logged · ${p.call.outcome}` : "No verification call yet"}
                </span>
                <Link
                  href={`/pharmacist/${p.id}`}
                  className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Review Prescription
                </Link>
              </div>
            </Card>
          ))
        )}
      </div>
    </StaffShell>
  );
}
