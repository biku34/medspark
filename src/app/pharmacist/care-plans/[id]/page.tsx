"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileText,
  Plus,
  Save,
  Send,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import clsx from "clsx";
import { StaffShell } from "@/components/staff-shell";
import { ActionButton, PanelTitle, Pill } from "@/components/ops";
import { useApp } from "@/components/providers";
import { Card, Field, Input, Select, Skeleton, Textarea } from "@/components/ui";
import { api, patch } from "@/lib/client";
import {
  FOLLOW_UP_TEMPLATES,
  VISIT_TEMPLATES,
  isEditableByCareTeam,
  validatePlanForProposal,
} from "@/lib/care";
import {
  CARE_PLAN_LABELS,
  DOCUMENT_META,
  RECONCILIATION_META,
  SERVICE_META,
  type CarePlan,
  type CarePlanFollowUp,
  type CarePlanMedicine,
  type CarePlanVisit,
  type Medicine,
  type Prescription,
  type ReconciliationVerdict,
} from "@/lib/types";
import { dateTime } from "@/lib/utils";

const SLOTS = ["08:00-12:00", "10:00-11:00", "12:00-16:00", "16:00-17:00", "16:00-20:00"];

let seq = 0;
const rid = (p: string) => `${p}_${Date.now().toString(36)}${++seq}`;

const todayPlus = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export default function CarePlanBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useApp();

  const [plan, setPlan] = useState<CarePlan | null>(null);
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [catalogue, setCatalogue] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [summary, setSummary] = useState("");
  const [safetyNotes, setSafetyNotes] = useState("");
  const [medicines, setMedicines] = useState<CarePlanMedicine[]>([]);
  const [visits, setVisits] = useState<CarePlanVisit[]>([]);
  const [followUps, setFollowUps] = useState<CarePlanFollowUp[]>([]);

  const load = useCallback(async () => {
    try {
      const [d, meds] = await Promise.all([
        api<{ carePlan: CarePlan; prescription: Prescription | null }>(`/api/care-plans/${id}`),
        api<{ results: Array<{ medicine: Medicine }> }>("/api/medicines?limit=400"),
      ]);
      setPlan(d.carePlan);
      setPrescription(d.prescription);
      setCatalogue((meds.results ?? []).map((r) => r.medicine));
      setSummary(d.carePlan.summary ?? "");
      setSafetyNotes(d.carePlan.safetyNotes ?? "");
      setMedicines(d.carePlan.medicines);
      setVisits(d.carePlan.visits);
      setFollowUps(d.carePlan.followUps);
    } catch (e) {
      toast({ kind: "error", title: "Could not load", body: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const problems = useMemo(
    () => validatePlanForProposal({ summary, medicines, visits, followUps }),
    [summary, medicines, visits, followUps],
  );

  const send = async (action: "claim" | "save" | "propose") => {
    setBusy(true);
    try {
      const res = await patch<{ carePlan: CarePlan }>(`/api/care-plans/${id}`, {
        action,
        summary,
        safetyNotes,
        medicines,
        visits,
        followUps,
      });
      setPlan(res.carePlan);
      toast({
        kind: "success",
        title:
          action === "propose"
            ? "Plan sent to the customer"
            : action === "claim"
              ? "Review started"
              : "Draft saved",
      });
      if (action === "propose") router.push("/pharmacist");
    } catch (e) {
      toast({ kind: "error", title: "Could not save", body: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  /* ------------------------------ prefill ------------------------------- */

  /**
   * Seeds the medicine table from the verified prescription. Everything on a
   * discharge script is either newly started or a dose change, so lines land as
   * "new" and the pharmacist corrects the ones the patient was already taking.
   */
  const pullFromPrescription = () => {
    if (!prescription) return;
    const existing = new Set(medicines.map((m) => m.medicineId));
    const added = prescription.extractedMedicines
      .filter((m) => m.medicineId && !existing.has(m.medicineId))
      .map<CarePlanMedicine>((m) => {
        const cat = catalogue.find((c) => c.id === m.medicineId);
        return {
          id: rid("cpm"),
          medicineId: m.medicineId,
          name: m.name,
          strength: m.strength,
          dosage: m.dosage,
          durationDays: 30,
          qtyPerCycle: Math.max(1, m.qty),
          type: cat?.type ?? "RX",
          reconciliation: "NEW",
          repeat: false,
        };
      });
    if (!added.length) {
      toast({ kind: "info", title: "Nothing new on the prescription" });
      return;
    }
    setMedicines((prev) => [...prev, ...added]);
  };

  const addVisitTemplate = (templateId: string) => {
    const t = VISIT_TEMPLATES.find((v) => v.id === templateId);
    if (!t) return;
    setVisits((prev) => [
      ...prev,
      {
        id: rid("cpv"),
        serviceType: t.serviceType,
        reason: t.reason,
        assistanceTypes: t.assistanceTypes,
        hours: t.hours,
        visits: t.visits,
        everyDays: t.everyDays,
        firstDate: todayPlus(Math.max(1, t.afterDischargeDays)),
        slot: t.serviceType === "PHYSIO" ? "16:00-17:00" : "08:00-12:00",
      },
    ]);
  };

  if (loading) {
    return (
      <StaffShell role="pharmacist">
        <Skeleton className="h-64" />
      </StaffShell>
    );
  }

  if (!plan) {
    return (
      <StaffShell role="pharmacist">
        <Card>
          <p className="text-[14px] font-bold text-ink-900">Care plan not found</p>
        </Card>
      </StaffShell>
    );
  }

  const editable = isEditableByCareTeam(plan.status);
  const rxLines = medicines.filter((m) => m.type === "RX" && m.reconciliation !== "STOP");
  const rxBlocked = rxLines.length > 0 && prescription?.status !== "APPROVED";

  return (
    <StaffShell role="pharmacist">
      <button
        onClick={() => router.push("/pharmacist")}
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-600 hover:text-ink-900"
      >
        <ArrowLeft size={15} /> Verification desk
      </button>

      {/* ------------------------------ header ------------------------------ */}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[12px] font-bold text-ink-500">{plan.ref}</p>
          <h1 className="text-[19px] font-extrabold tracking-tight text-ink-900">
            {plan.patientName}
            {plan.patientAge ? `, ${plan.patientAge}` : ""}
          </h1>
          <p className="text-[12px] text-ink-500">
            {[plan.condition, plan.hospitalName].filter(Boolean).join(" · ") || "Care plan request"}
            {plan.dischargeDate ? ` · discharged ${plan.dischargeDate}` : ""}
          </p>
        </div>
        <Pill tone={plan.status === "ACTIVE" ? "green" : plan.status === "PLAN_READY" ? "amber" : "blue"}>
          {CARE_PLAN_LABELS[plan.status]}
        </Pill>
      </div>

      {plan.allergies && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-2.5">
          <TriangleAlert size={16} className="mt-px shrink-0 text-red-600" />
          <p className="text-[13px] font-bold text-red-800">
            Allergies: {plan.allergies}
          </p>
        </div>
      )}

      {plan.status === "CHANGES_REQUESTED" && plan.changeRequest && (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-2.5">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-amber-700">
            Customer asked for changes
          </p>
          <p className="mt-0.5 text-[13px] text-amber-900">“{plan.changeRequest}”</p>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* --------------------------- documents --------------------------- */}
        <div className="min-w-0 space-y-3">
          <Card>
            <PanelTitle title="Documents" count={plan.documents.length} />
            <div className="space-y-2">
              {plan.documents.map((d) => (
                <div key={d.id} className="overflow-hidden rounded-lg border border-ink-200">
                  <div className="flex items-center justify-between gap-2 bg-ink-50 px-2.5 py-1.5">
                    <span className="text-[11px] font-extrabold uppercase tracking-wide text-ink-600">
                      {DOCUMENT_META[d.kind].emoji} {DOCUMENT_META[d.kind].label}
                    </span>
                    <a
                      href={d.fileData}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-700 hover:underline"
                    >
                      <ExternalLink size={11} /> Full size
                    </a>
                  </div>
                  {d.mimeType === "application/pdf" ? (
                    <object data={d.fileData} type="application/pdf" className="h-[360px] w-full">
                      <p className="p-3 text-[12px]">PDF preview unavailable.</p>
                    </object>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={d.fileData} alt={d.fileName} className="w-full bg-white" />
                  )}
                </div>
              ))}
            </div>
          </Card>

          {plan.customerNote && (
            <Card>
              <PanelTitle title="What the customer said" />
              <p className="text-[13px] italic leading-relaxed text-ink-700">
                “{plan.customerNote}”
              </p>
            </Card>
          )}

          <Card>
            <PanelTitle title="Prescription" />
            {prescription ? (
              <div className="space-y-1.5 text-[13px]">
                <p className="flex items-center justify-between">
                  <span className="text-ink-500">Reference</span>
                  <a
                    href={`/pharmacist/${prescription.id}`}
                    className="font-mono font-bold text-brand-700 hover:underline"
                  >
                    {prescription.ref}
                  </a>
                </p>
                <p className="flex items-center justify-between">
                  <span className="text-ink-500">Status</span>
                  <Pill tone={prescription.status === "APPROVED" ? "green" : "amber"}>
                    {prescription.status}
                  </Pill>
                </p>
                {prescription.refillsAuthorised ? (
                  <p className="flex items-center justify-between">
                    <span className="text-ink-500">Repeats left</span>
                    <span className="font-bold">
                      {prescription.refillsAuthorised - (prescription.refillsUsed ?? 0)} of{" "}
                      {prescription.refillsAuthorised}
                    </span>
                  </p>
                ) : null}
                {editable && prescription.status === "APPROVED" && (
                  <button
                    onClick={pullFromPrescription}
                    className="mt-1 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-ink-300 text-[12px] font-bold text-ink-700 hover:bg-ink-100"
                  >
                    <Plus size={13} /> Pull lines into the plan
                  </button>
                )}
              </div>
            ) : (
              <p className="flex items-start gap-1.5 text-[12px] text-ink-500">
                <FileText size={13} className="mt-px shrink-0" />
                No prescription attached. An ℞ line cannot be proposed without one.
              </p>
            )}
          </Card>

          <Card>
            <PanelTitle title="History" />
            <ol className="space-y-2">
              {[...plan.history].reverse().map((h, i) => (
                <li key={i} className="text-[12px]">
                  <p className="font-bold text-ink-800">{h.status.replace(/_/g, " ")}</p>
                  <p className="text-[11px] text-ink-500">
                    {dateTime(h.at)}
                    {h.by ? ` · ${h.by}` : ""}
                  </p>
                  {h.note && <p className="text-[11px] text-ink-600">{h.note}</p>}
                </li>
              ))}
            </ol>
          </Card>
        </div>

        {/* ---------------------------- the plan ---------------------------- */}
        <div className="min-w-0 space-y-3">
          {plan.status === "SUBMITTED" && (
            <Card className="border-amber-300 bg-amber-50">
              <p className="text-[13px] font-extrabold text-amber-900">
                This request has not been picked up yet
              </p>
              <ActionButton loading={busy} onClick={() => send("claim")}>
                Start the review
              </ActionButton>
            </Card>
          )}

          <Card>
            <PanelTitle title="Summary for the customer" />
            <Field label="What you found and what you're proposing">
              <Textarea
                value={summary}
                disabled={!editable}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="The antibiotic finishes this course and stops. Telmisartan and Atorvastatin continue long term…"
              />
            </Field>
            <div className="mt-2.5">
              <Field label="Safety notes" hint="Allergies, interactions, when to call us">
                <Textarea
                  value={safetyNotes}
                  disabled={!editable}
                  onChange={(e) => setSafetyNotes(e.target.value)}
                  placeholder="Sulfa allergy noted — nothing in this plan contains a sulfonamide…"
                />
              </Field>
            </div>
          </Card>

          {/* ------------------------ reconciliation ----------------------- */}
          <Card>
            <PanelTitle
              title="Medication reconciliation"
              count={medicines.length}
              action={
                editable ? (
                  <button
                    onClick={() =>
                      setMedicines((prev) => [
                        ...prev,
                        {
                          id: rid("cpm"),
                          name: "",
                          dosage: "",
                          durationDays: 30,
                          qtyPerCycle: 1,
                          type: "OTC",
                          reconciliation: "NEW",
                          repeat: false,
                        },
                      ])
                    }
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-ink-300 px-2.5 text-[12px] font-bold text-ink-700 hover:bg-ink-100"
                  >
                    <Plus size={13} /> Add line
                  </button>
                ) : undefined
              }
            />

            {medicines.length === 0 ? (
              <p className="text-[13px] text-ink-500">
                Nothing yet. Pull the lines off the prescription, or add them by hand.
              </p>
            ) : (
              <ul className="space-y-2">
                {medicines.map((m, i) => {
                  const set = (patchObj: Partial<CarePlanMedicine>) =>
                    setMedicines((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, ...patchObj } : x)),
                    );
                  const stop = m.reconciliation === "STOP";
                  return (
                    <li
                      key={m.id}
                      className={clsx(
                        "rounded-lg border p-2.5",
                        stop ? "border-red-200 bg-red-50/50" : "border-ink-200",
                      )}
                    >
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px]">
                        <Select
                          value={m.medicineId ?? ""}
                          disabled={!editable}
                          onChange={(e) => {
                            const cat = catalogue.find((c) => c.id === e.target.value);
                            set({
                              medicineId: e.target.value || undefined,
                              name: cat?.name ?? m.name,
                              strength: cat?.strength ?? m.strength,
                              type: cat?.type ?? m.type,
                            });
                          }}
                        >
                          <option value="">— not matched to the catalogue —</option>
                          {catalogue.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.type})
                            </option>
                          ))}
                        </Select>

                        <Select
                          value={m.reconciliation}
                          disabled={!editable}
                          onChange={(e) =>
                            set({ reconciliation: e.target.value as ReconciliationVerdict })
                          }
                        >
                          {(Object.keys(RECONCILIATION_META) as ReconciliationVerdict[]).map((v) => (
                            <option key={v} value={v}>
                              {RECONCILIATION_META[v].label}
                            </option>
                          ))}
                        </Select>
                      </div>

                      <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_90px_90px]">
                        <Input
                          value={m.dosage}
                          disabled={!editable}
                          onChange={(e) => set({ dosage: e.target.value })}
                          placeholder="1-0-1 after food"
                        />
                        <Input
                          type="number"
                          value={m.durationDays}
                          disabled={!editable}
                          onChange={(e) => set({ durationDays: Number(e.target.value) })}
                          placeholder="Days"
                        />
                        <Input
                          type="number"
                          value={m.qtyPerCycle}
                          disabled={!editable}
                          onChange={(e) => set({ qtyPerCycle: Number(e.target.value) })}
                          placeholder="Qty"
                        />
                      </div>

                      <div className="mt-2">
                        <Input
                          value={m.note ?? ""}
                          disabled={!editable}
                          onChange={(e) => set({ note: e.target.value })}
                          placeholder="Note the customer will read — why, or what to watch for"
                        />
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <label
                          className={clsx(
                            "flex items-center gap-1.5 text-[12px] font-bold",
                            stop ? "text-ink-400" : "text-ink-700",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={m.repeat}
                            disabled={!editable || stop}
                            onChange={(e) => set({ repeat: e.target.checked })}
                            className="h-3.5 w-3.5 accent-brand-600"
                          />
                          Put on repeat delivery
                        </label>
                        {m.repeat && (
                          <label className="flex items-center gap-1.5 text-[12px] text-ink-600">
                            every
                            <input
                              type="number"
                              value={m.intervalDays ?? 30}
                              disabled={!editable}
                              onChange={(e) => set({ intervalDays: Number(e.target.value) })}
                              className="h-7 w-16 rounded border border-ink-200 px-2 text-[12px]"
                            />
                            days
                          </label>
                        )}
                        {m.type === "RX" && <Pill tone="amber">℞</Pill>}
                        {editable && (
                          <button
                            onClick={() => setMedicines((prev) => prev.filter((_, j) => j !== i))}
                            className="ml-auto rounded p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"
                            aria-label="Remove line"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* --------------------------- visits ---------------------------- */}
          <Card>
            <PanelTitle title="Home visits" count={visits.length} />
            {editable && (
              <div className="mb-2.5 flex flex-wrap gap-1.5">
                {VISIT_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => addVisitTemplate(t.id)}
                    className="inline-flex items-center gap-1 rounded border border-ink-200 px-2 py-1 text-[11px] font-bold text-ink-600 hover:bg-ink-100"
                  >
                    <Plus size={11} /> {t.label}
                  </button>
                ))}
              </div>
            )}

            {visits.length === 0 ? (
              <p className="text-[13px] text-ink-500">No visits proposed.</p>
            ) : (
              <ul className="space-y-2">
                {visits.map((v, i) => {
                  const set = (patchObj: Partial<CarePlanVisit>) =>
                    setVisits((prev) => prev.map((x, j) => (j === i ? { ...x, ...patchObj } : x)));
                  return (
                    <li key={v.id} className="rounded-lg border border-ink-200 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[13px] font-extrabold text-ink-900">
                          {SERVICE_META[v.serviceType].emoji} {SERVICE_META[v.serviceType].short}
                        </p>
                        {editable && (
                          <button
                            onClick={() => setVisits((prev) => prev.filter((_, j) => j !== i))}
                            className="rounded p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"
                            aria-label="Remove visit"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <Field label="First visit">
                          <Input
                            type="date"
                            value={v.firstDate}
                            min={todayPlus(1)}
                            disabled={!editable}
                            onChange={(e) => set({ firstDate: e.target.value })}
                          />
                        </Field>
                        <Field label="Slot">
                          <Select
                            value={v.slot}
                            disabled={!editable}
                            onChange={(e) => set({ slot: e.target.value })}
                          >
                            {SLOTS.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <Field label="Sessions">
                          <Input
                            type="number"
                            min={1}
                            value={v.visits}
                            disabled={!editable}
                            onChange={(e) => set({ visits: Number(e.target.value) })}
                          />
                        </Field>
                        <Field label="Every N days">
                          <Input
                            type="number"
                            min={1}
                            value={v.everyDays}
                            disabled={!editable}
                            onChange={(e) => set({ everyDays: Number(e.target.value) })}
                          />
                        </Field>
                      </div>

                      <div className="mt-2">
                        <Input
                          value={v.note ?? ""}
                          disabled={!editable}
                          onChange={(e) => set({ note: e.target.value })}
                          placeholder="What the visiting professional should do"
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* ------------------------- follow-ups -------------------------- */}
          <Card>
            <PanelTitle title="Follow-ups" count={followUps.length} />
            {editable && (
              <div className="mb-2.5 flex flex-wrap gap-1.5">
                {FOLLOW_UP_TEMPLATES.map((f) => (
                  <button
                    key={f.label}
                    onClick={() =>
                      setFollowUps((prev) => [
                        ...prev,
                        { id: rid("cpf"), label: f.label, dueDate: todayPlus(f.afterDays) },
                      ])
                    }
                    className="inline-flex items-center gap-1 rounded border border-ink-200 px-2 py-1 text-[11px] font-bold text-ink-600 hover:bg-ink-100"
                  >
                    <Plus size={11} /> {f.label}
                  </button>
                ))}
              </div>
            )}
            {followUps.length === 0 ? (
              <p className="text-[13px] text-ink-500">Nothing to re-check.</p>
            ) : (
              <ul className="space-y-1.5">
                {followUps.map((f, i) => (
                  <li key={f.id} className="flex items-center gap-2">
                    <Input
                      value={f.label}
                      disabled={!editable}
                      onChange={(e) =>
                        setFollowUps((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                        )
                      }
                    />
                    <Input
                      type="date"
                      value={f.dueDate}
                      disabled={!editable}
                      onChange={(e) =>
                        setFollowUps((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, dueDate: e.target.value } : x)),
                        )
                      }
                      className="w-44"
                    />
                    {editable && (
                      <button
                        onClick={() => setFollowUps((prev) => prev.filter((_, j) => j !== i))}
                        className="shrink-0 rounded p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="Remove follow-up"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* --------------------------- send ------------------------------ */}
          {editable && (
            <Card className="sticky bottom-3">
              {(problems.length > 0 || rxBlocked) && (
                <ul className="mb-2.5 space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[12px] text-amber-900">
                  {rxBlocked && (
                    <li className="font-bold">
                      This plan has ℞ lines but prescription{" "}
                      {prescription ? prescription.ref : "(none attached)"} is not verified yet.
                    </li>
                  )}
                  {problems.map((p, i) => (
                    <li key={i}>{p.message}</li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                <ActionButton
                  tone="neutral"
                  loading={busy}
                  icon={<Save size={14} />}
                  onClick={() => send("save")}
                >
                  Save draft
                </ActionButton>
                <ActionButton
                  loading={busy}
                  disabled={problems.length > 0 || rxBlocked}
                  icon={<Send size={14} />}
                  onClick={() => send("propose")}
                >
                  Send to customer
                </ActionButton>
              </div>
            </Card>
          )}

          {plan.status === "ACTIVE" && (
            <Card className="border-brand-300 bg-brand-50">
              <p className="flex items-center gap-1.5 text-[13px] font-extrabold text-brand-800">
                <CheckCircle2 size={15} /> Approved by the customer
              </p>
              <p className="mt-1 text-[12px] text-brand-900">
                {plan.scheduled.orderIds.length} order(s),{" "}
                {plan.scheduled.subscriptionIds.length} repeat delivery,{" "}
                {plan.scheduled.bookingIds.length} home visit(s) scheduled.
              </p>
            </Card>
          )}
        </div>
      </div>
    </StaffShell>
  );
}
