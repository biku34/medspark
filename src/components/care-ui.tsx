"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import {
  CalendarClock,
  Check,
  FileText,
  FlaskConical,
  Hospital,
  Pill,
} from "lucide-react";
import {
  CARE_PLAN_FLOW,
  CARE_PLAN_LABELS,
  DOCUMENT_META,
  RECONCILIATION_META,
  type CarePlanMedicine,
  type CarePlanStatus,
  type HealthDocument,
  type HealthDocumentKind,
} from "@/lib/types";
import { planProgressIndex } from "@/lib/care";

/* -------------------------------------------------------------------------- */
/* status                                                                     */
/* -------------------------------------------------------------------------- */

const STATUS_TONE: Record<CarePlanStatus, string> = {
  SUBMITTED: "bg-ink-200 text-ink-700",
  IN_REVIEW: "bg-care-600 text-white",
  PLAN_READY: "bg-rx-500 text-white",
  CHANGES_REQUESTED: "bg-rx-500 text-white",
  ACTIVE: "bg-brand-600 text-white",
  COMPLETED: "bg-ink-700 text-white",
  CANCELLED: "bg-red-600 text-white",
};

/**
 * Badge copy is deliberately shorter than the full status label. A chip that
 * wraps to three lines stops being a chip.
 */
const BADGE_LABEL: Record<CarePlanStatus, string> = {
  SUBMITTED: "Received",
  IN_REVIEW: "Reviewing",
  PLAN_READY: "Needs you",
  CHANGES_REQUESTED: "Revising",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export function CarePlanBadge({
  status,
  full,
}: {
  status: CarePlanStatus;
  /** Spell the whole status out — for detail headers, not list chips. */
  full?: boolean;
}) {
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide",
        STATUS_TONE[status],
      )}
    >
      {full ? CARE_PLAN_LABELS[status] : BADGE_LABEL[status]}
    </span>
  );
}

/** The five-step track a customer follows from upload to a running plan. */
export function CarePlanProgress({ status }: { status: CarePlanStatus }) {
  const current = planProgressIndex(status);
  const dead = status === "CANCELLED";

  return (
    <ol className="flex items-center gap-1">
      {CARE_PLAN_FLOW.map((step, i) => {
        const done = !dead && i < current;
        const now = !dead && i === current;
        return (
          <li key={step} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex w-full items-center">
              <span
                className={clsx(
                  "h-0.5 flex-1",
                  i === 0 ? "opacity-0" : done || now ? "bg-brand-500" : "bg-ink-200",
                )}
              />
              <span
                className={clsx(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold",
                  done
                    ? "bg-brand-600 text-white"
                    : now
                      ? "bg-brand-600 text-white ring-4 ring-brand-100"
                      : "bg-ink-200 text-ink-500",
                )}
              >
                {done ? <Check size={11} strokeWidth={3.5} /> : i + 1}
              </span>
              <span
                className={clsx(
                  "h-0.5 flex-1",
                  i === CARE_PLAN_FLOW.length - 1 ? "opacity-0" : done ? "bg-brand-500" : "bg-ink-200",
                )}
              />
            </div>
            <span
              className={clsx(
                "text-center text-[9px] font-bold leading-tight",
                now ? "text-brand-700" : "text-ink-400",
              )}
            >
              {SHORT_STEP[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const SHORT_STEP: Record<CarePlanStatus, string> = {
  SUBMITTED: "Uploaded",
  IN_REVIEW: "Reviewing",
  PLAN_READY: "Your approval",
  CHANGES_REQUESTED: "Changes",
  ACTIVE: "Running",
  COMPLETED: "Done",
  CANCELLED: "Cancelled",
};

/* -------------------------------------------------------------------------- */
/* documents                                                                  */
/* -------------------------------------------------------------------------- */

export const DOC_ICON: Record<HealthDocumentKind, ReactNode> = {
  DISCHARGE_SUMMARY: <Hospital size={14} />,
  LAB_REPORT: <FlaskConical size={14} />,
  PRESCRIPTION: <Pill size={14} />,
  OTHER: <FileText size={14} />,
};

/** A document thumbnail that opens full size in a new tab. */
export function DocumentTile({ doc }: { doc: HealthDocument }) {
  const meta = DOCUMENT_META[doc.kind];
  return (
    <a
      href={doc.fileData}
      target="_blank"
      rel="noreferrer"
      className="group flex min-w-0 items-center gap-2.5 rounded-lg border border-ink-200 bg-white p-2 transition-colors hover:border-brand-400"
    >
      <span className="flex h-14 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-ink-200 bg-ink-50">
        {doc.mimeType === "application/pdf" ? (
          <FileText size={18} className="text-ink-400" />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={doc.fileData} alt="" className="h-full w-full object-cover" />
        )}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wide text-brand-700">
          {DOC_ICON[doc.kind]}
          {meta.short}
        </span>
        <span className="mt-0.5 block truncate text-[12px] font-semibold text-ink-800 group-hover:underline">
          {doc.fileName}
        </span>
        {doc.note && <span className="block truncate text-[11px] text-ink-500">{doc.note}</span>}
      </span>
    </a>
  );
}

/* -------------------------------------------------------------------------- */
/* medication reconciliation                                                  */
/* -------------------------------------------------------------------------- */

const VERDICT_CLASS = {
  green: "border-brand-200 bg-brand-50 text-brand-800",
  blue: "border-care-200 bg-care-50 text-care-800",
  amber: "border-rx-200 bg-rx-50 text-rx-800",
  red: "border-red-200 bg-red-50 text-red-800",
} as const;

/**
 * One reconciled medicine line.
 *
 * The verdict — continue, new, dose changed, stop — is the loudest thing on the
 * row, because after a hospital stay that is the question the family is
 * actually asking: which of these do I still give him?
 */
export function MedicineLine({ med }: { med: CarePlanMedicine }) {
  const meta = RECONCILIATION_META[med.reconciliation];
  const stop = med.reconciliation === "STOP";

  return (
    <li
      className={clsx(
        "rounded-lg border p-2.5",
        stop ? "border-red-200 bg-red-50/50" : "border-ink-200 bg-white",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={clsx(
              "text-[14px] font-bold",
              stop ? "text-ink-500 line-through" : "text-ink-900",
            )}
          >
            {med.name}
          </p>
          <p className="text-[12px] text-ink-600">{med.dosage}</p>
        </div>
        <span
          className={clsx(
            "shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide",
            VERDICT_CLASS[meta.tone],
          )}
        >
          {meta.label}
        </span>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-500">
        {med.type === "RX" && (
          <span className="font-bold text-rx-700">℞ prescription medicine</span>
        )}
        {!stop && med.durationDays > 0 && <span>{med.durationDays} days</span>}
        {med.repeat && (
          <span className="inline-flex items-center gap-1 font-bold text-brand-700">
            <CalendarClock size={11} /> on repeat delivery
          </span>
        )}
      </div>

      {med.note && (
        <p
          className={clsx(
            "mt-1.5 rounded border-l-2 py-0.5 pl-2 text-[12px]",
            stop ? "border-red-400 text-red-800" : "border-ink-300 text-ink-600",
          )}
        >
          {med.note}
        </p>
      )}
    </li>
  );
}
