"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, FileUp, Pill, Plus, Stethoscope } from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { CarePlanBadge, CarePlanProgress, DOC_ICON } from "@/components/care-ui";
import { ServiceArt } from "@/components/art";
import { useApp } from "@/components/providers";
import { Skeleton } from "@/components/ui";
import { api } from "@/lib/client";
import { totalVisitCount } from "@/lib/care";
import { DOCUMENT_META, type CarePlan } from "@/lib/types";
import { relativeTime } from "@/lib/utils";

/** The three documents that actually tell us something, in the order they help. */
const ACCEPTS = ["DISCHARGE_SUMMARY", "LAB_REPORT", "PRESCRIPTION"] as const;

export default function CarePlansPage() {
  const { user } = useApp();
  const [plans, setPlans] = useState<CarePlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    api<{ carePlans: CarePlan[] }>("/api/care-plans")
      .then((d) => setPlans(d.carePlans))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const awaitingYou = plans.filter((p) => p.status === "PLAN_READY");
  const live = plans.filter((p) => !["COMPLETED", "CANCELLED"].includes(p.status));
  const closed = plans.filter((p) => ["COMPLETED", "CANCELLED"].includes(p.status));

  return (
    <CustomerShell>
      {/* ================================================================== */}
      {/* The offer, stated once                                              */}
      {/* ================================================================== */}
      <section className="bleed -mt-3 bg-care-700 pb-5 pt-5 text-white sm:mt-0 sm:rounded-2xl sm:px-6">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-care-100">
              Care plan
            </p>
            <h1 className="mt-2 text-[24px] font-extrabold leading-[1.15] sm:text-[30px]">
              Send us the file
              <br />
              the hospital gave you
            </h1>
            <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-white/75">
              A pharmacist reads it and tells you exactly which tablets to continue, which to stop,
              and which nurse or physio visits to book. You approve — then we schedule it.
            </p>
          </div>
          <ServiceArt kind="care" size={72} className="hidden shrink-0 sm:block" />
        </div>

        <Link
          href="/care/new"
          className="mt-4 flex h-12 items-center justify-center gap-2 rounded-xl bg-white text-[15px] font-extrabold text-care-800 hover:bg-care-50 sm:w-fit sm:px-6"
        >
          <FileUp size={17} strokeWidth={2.6} />
          Start a care plan
        </Link>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {ACCEPTS.map((k) => (
            <span
              key={k}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-white/85"
            >
              {DOC_ICON[k]}
              {DOCUMENT_META[k].label}
            </span>
          ))}
        </div>
      </section>

      {/* ================================================================== */}
      {/* Your plans                                                          */}
      {/* ================================================================== */}
      {user && (
        <section className="mt-6">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-[19px] font-extrabold text-ink-900">Your plans</h2>
            {awaitingYou.length > 0 && (
              <span className="shrink-0 rounded-full bg-rx-100 px-2.5 py-1 text-[11px] font-extrabold text-rx-800">
                {awaitingYou.length} needs your approval
              </span>
            )}
          </div>

          {loading ? (
            <Skeleton className="h-32" />
          ) : plans.length === 0 ? (
            <Link
              href="/care/new"
              className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-ink-300 bg-white p-4 hover:border-care-400"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-care-50 text-care-600">
                <Plus size={22} strokeWidth={2.6} />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-extrabold text-ink-900">
                  No plans yet
                </span>
                <span className="block text-[12px] text-ink-500">
                  Upload a discharge summary or lab report to start one
                </span>
              </span>
            </Link>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {live.map((p) => {
                const needsYou = p.status === "PLAN_READY";
                return (
                  <Link key={p.id} href={`/care/${p.id}`} className="block">
                    <article
                      className={
                        "h-full rounded-2xl border bg-white p-3.5 transition-colors " +
                        (needsYou
                          ? "border-rx-300 bg-rx-50/50 hover:border-rx-400"
                          : "border-ink-200 hover:border-care-300")
                      }
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[16px] font-extrabold leading-tight text-ink-900">
                            {p.patientName}
                          </p>
                          <p className="truncate text-[12px] text-ink-500">
                            {p.condition ?? p.ref}
                          </p>
                        </div>
                        <CarePlanBadge status={p.status} />
                      </div>

                      <div className="mt-3.5">
                        <CarePlanProgress status={p.status} />
                      </div>

                      <div className="mt-3 flex items-center gap-3 border-t border-ink-100 pt-2.5 text-[11.5px] text-ink-600">
                        <span className="nums inline-flex items-center gap-1">
                          <Pill size={12} className="text-ink-400" />
                          {p.medicines.length}
                        </span>
                        <span className="nums inline-flex items-center gap-1">
                          <Stethoscope size={12} className="text-ink-400" />
                          {totalVisitCount(p)}
                        </span>
                        <span className="text-ink-400">·</span>
                        <span className="truncate text-ink-400">
                          {relativeTime(p.updatedAt)}
                        </span>
                        <span className="ml-auto shrink-0 font-extrabold text-care-700">
                          {needsYou ? "Review" : "Open"}
                        </span>
                      </div>
                    </article>
                  </Link>
                );
              })}

              {closed.map((p) => (
                <Link key={p.id} href={`/care/${p.id}`} className="block">
                  <article className="flex h-full items-center gap-3 rounded-2xl border border-ink-200 bg-ink-50 p-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-bold text-ink-700">
                        {p.patientName}
                      </p>
                      <p className="text-[11.5px] text-ink-500">{p.ref}</p>
                    </div>
                    <CarePlanBadge status={p.status} />
                  </article>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ================================================================== */}
      {/* What the pharmacist actually does with it                           */}
      {/* ================================================================== */}
      <section className="mt-7">
        <h2 className="mb-3 text-[19px] font-extrabold text-ink-900">
          What you get back
        </h2>

        {/* A worked example beats a four-step explainer: this is a real
            reconciliation, shown the way it will appear in the plan. */}
        <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white">
          <div className="border-b border-ink-100 bg-ink-50 px-3.5 py-2">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-ink-500">
              Example · after a chest infection
            </p>
          </div>
          <ul className="divide-y divide-ink-100">
            {[
              {
                name: "Telmisartan 40 mg",
                note: "Blood pressure — keep taking, we'll deliver monthly",
                tag: "Continue",
                tone: "bg-brand-100 text-brand-800",
              },
              {
                name: "Amoxicillin 500 mg",
                note: "New antibiotic — 5 days, then stop",
                tag: "New",
                tone: "bg-care-100 text-care-800",
              },
              {
                name: "Atorvastatin 10 mg",
                note: "Raised from 5 mg because LDL is high",
                tag: "Dose changed",
                tone: "bg-rx-100 text-rx-800",
              },
              {
                name: "Ibuprofen 400 mg",
                note: "Works against the BP tablet — use paracetamol instead",
                tag: "Stop",
                tone: "bg-red-100 text-red-700",
                strike: true,
              },
            ].map((row) => (
              <li key={row.name} className="flex items-center gap-3 px-3.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <p
                    className={
                      "text-[13.5px] font-bold " +
                      (row.strike ? "text-ink-400 line-through" : "text-ink-900")
                    }
                  >
                    {row.name}
                  </p>
                  <p className="text-[11.5px] leading-snug text-ink-500">{row.note}</p>
                </div>
                <span
                  className={
                    "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide " +
                    row.tone
                  }
                >
                  {row.tag}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2 border-t border-ink-100 bg-brand-50 px-3.5 py-2.5">
            <Stethoscope size={15} className="shrink-0 text-brand-700" />
            <p className="text-[12px] font-semibold text-brand-800">
              Plus: 3 nurse visits, 6 physio sessions, and a blood test in 2 weeks
            </p>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* The promises that matter, kept short                                */}
      {/* ================================================================== */}
      <section className="mt-4 rounded-2xl bg-ink-900 p-4 text-white">
        <p className="text-[13px] font-extrabold">Three things we will never do</p>
        <ul className="mt-2.5 space-y-2 text-[12.5px] leading-relaxed text-white/75">
          <li className="flex gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
            Order or book anything before you approve the plan — and you still pick the pharmacy.
          </li>
          <li className="flex gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
            Diagnose or prescribe. We reconcile and schedule what your doctor already decided.
          </li>
          <li className="flex gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
            Skip prescription checks. Every ℞ medicine is verified before it reaches a plan.
          </li>
        </ul>
        <Link
          href="/care/new"
          className="mt-3.5 inline-flex items-center gap-1 text-[13px] font-extrabold text-brand-300 hover:underline"
        >
          Start a care plan <ChevronRight size={15} strokeWidth={3} />
        </Link>
      </section>
    </CustomerShell>
  );
}
