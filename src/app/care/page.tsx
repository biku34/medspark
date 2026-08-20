"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  FileUp,
  Hospital,
  Pill,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { CarePlanBadge, CarePlanProgress } from "@/components/care-ui";
import { useApp } from "@/components/providers";
import { Card, EmptyState, SectionTitle, Skeleton } from "@/components/ui";
import { api } from "@/lib/client";
import { totalVisitCount } from "@/lib/care";
import type { CarePlan } from "@/lib/types";
import { relativeTime } from "@/lib/utils";

const STEPS = [
  {
    icon: FileUp,
    title: "Send us the paperwork",
    body: "Discharge summary, lab reports, prescriptions — whatever you already have.",
  },
  {
    icon: Stethoscope,
    title: "A pharmacist reads it",
    body: "They reconcile every medicine: what continues, what is new, what should stop.",
  },
  {
    icon: CalendarClock,
    title: "You get a plan to approve",
    body: "Medicines, nurse and physiotherapy visits, and what to re-check and when.",
  },
  {
    icon: ShieldCheck,
    title: "We schedule it",
    body: "Only after you say yes. You still choose the pharmacy that dispenses.",
  },
];

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

  return (
    <CustomerShell>
      {/* ------------------------------- hero ------------------------------ */}
      <section className="rounded-xl bg-gradient-to-br from-brand-700 to-brand-600 p-4 text-white sm:p-5">
        <p className="inline-flex items-center gap-1.5 rounded bg-white/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide">
          <Hospital size={11} /> Add-on service
        </p>
        <h1 className="mt-2 text-[21px] font-extrabold leading-tight tracking-tight sm:text-[26px]">
          Home care, planned from your reports
        </h1>
        <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-white/85">
          Upload a discharge summary, a lab report or a prescription. Our pharmacist reads it and
          builds one plan — medicines, nurse visits, physiotherapy and follow-up dates — for you to
          approve.
        </p>
        <Link
          href="/care/new"
          className="mt-3.5 inline-flex h-11 items-center gap-2 rounded-lg bg-white px-4 text-[14px] font-extrabold text-brand-700 hover:bg-brand-50"
        >
          <FileUp size={16} /> Start a care plan
        </Link>
        <p className="mt-2 text-[11px] text-white/70">Free to submit · No obligation to accept</p>
      </section>

      {/* --------------------------- your plans ---------------------------- */}
      {user && (
        <section className="mt-5">
          <SectionTitle
            title="Your care plans"
            subtitle={
              awaitingYou.length
                ? `${awaitingYou.length} plan waiting for your approval`
                : undefined
            }
          />

          {loading ? (
            <Skeleton className="h-32" />
          ) : plans.length === 0 ? (
            <EmptyState
              icon={<Hospital size={36} />}
              title="No care plans yet"
              body="Send us a discharge summary or lab report and we'll build one."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {plans.map((p) => (
                <Link key={p.id} href={`/care/${p.id}`} className="block">
                  <Card className="h-full transition-colors hover:border-brand-400">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-[12px] font-bold text-ink-500">{p.ref}</p>
                        <p className="truncate text-[15px] font-extrabold text-ink-900">
                          {p.patientName}
                        </p>
                        {p.condition && (
                          <p className="truncate text-[12px] text-ink-500">{p.condition}</p>
                        )}
                      </div>
                      <CarePlanBadge status={p.status} />
                    </div>

                    <div className="mt-3">
                      <CarePlanProgress status={p.status} />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-ink-100 pt-2.5 text-[11px] text-ink-600">
                      <span className="inline-flex items-center gap-1">
                        <Pill size={11} className="text-ink-400" />
                        {p.medicines.length} medicine(s)
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Stethoscope size={11} className="text-ink-400" />
                        {totalVisitCount(p)} visit(s)
                      </span>
                      <span className="ml-auto inline-flex items-center gap-1 font-bold text-brand-700">
                        Open <ArrowRight size={11} />
                      </span>
                    </div>

                    <p className="mt-1 text-[10px] text-ink-400">
                      Updated {relativeTime(p.updatedAt)}
                    </p>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ------------------------------ how ------------------------------- */}
      <section className="mt-6">
        <SectionTitle title="How it works" />
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.title} className="rounded-lg border border-ink-200 bg-white p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <s.icon size={15} />
                </span>
                <span className="text-[10px] font-extrabold uppercase tracking-wide text-ink-400">
                  Step {i + 1}
                </span>
              </div>
              <p className="mt-2 text-[14px] font-extrabold text-ink-900">{s.title}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-ink-600">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------- the rules ---------------------------- */}
      <section className="mt-4 rounded-lg border border-ink-200 bg-white p-3.5">
        <p className="flex items-center gap-1.5 text-[13px] font-extrabold text-ink-900">
          <ShieldCheck size={15} className="text-brand-600" />
          What a care plan will never do
        </p>
        <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-ink-600">
          <li>
            <strong className="text-ink-800">Order anything without you.</strong> Nothing is
            scheduled until you approve the plan, and you choose the pharmacy that dispenses.
          </li>
          <li>
            <strong className="text-ink-800">Replace your doctor.</strong> We reconcile and
            schedule what your doctor has already prescribed. We do not diagnose or prescribe.
          </li>
          <li>
            <strong className="text-ink-800">Skip prescription checks.</strong> Every ℞ medicine in
            a plan still goes through pharmacist verification first.
          </li>
        </ul>
      </section>
    </CustomerShell>
  );
}
