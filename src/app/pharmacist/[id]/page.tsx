"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  RefreshCw,
  Phone,
  PhoneOff,
  Plus,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { StaffShell } from "@/components/staff-shell";
import { ComplianceNote } from "@/components/brand";
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
  Modal,
  SectionTitle,
  Select,
  Skeleton,
  Textarea,
} from "@/components/ui";
import { api, patch } from "@/lib/client";
import {
  PRESCRIPTION_LABELS,
  type MedicineSearchResult,
  type Prescription,
  type PrescriptionMedicine,
} from "@/lib/types";
import { dateTime } from "@/lib/utils";

type Checklist = NonNullable<Prescription["call"]>["checklist"];

const CHECK_LABELS: Array<{ key: keyof Checklist; label: string; hint: string }> = [
  { key: "identity", label: "Customer name confirmed", hint: "Matches the account and prescription" },
  { key: "medicine", label: "Required medicine confirmed", hint: "Read back each prescribed item" },
  { key: "quantity", label: "Quantity confirmed", hint: "Strips / bottles as prescribed" },
  { key: "prescriptionDetails", label: "Prescription details confirmed", hint: "Doctor, date, validity" },
  { key: "address", label: "Delivery address confirmed", hint: "Read back the full address" },
  { key: "orderConfirmed", label: "Customer confirms the order", hint: "Explicit verbal confirmation" },
];

type CallStage = "idle" | "dialing" | "connected" | "ended";

export default function PharmacistReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useApp();

  const [rx, setRx] = useState<Prescription | null>(null);
  const [catalogue, setCatalogue] = useState<MedicineSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  /* review state */
  const [meds, setMeds] = useState<PrescriptionMedicine[]>([]);
  const [note, setNote] = useState("Prescription verified. Customer details confirmed.");
  const [refills, setRefills] = useState(0);
  const [validUntil, setValidUntil] = useState("");

  /* modals */
  const [callOpen, setCallOpen] = useState(false);
  const [clarifyOpen, setClarifyOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [clarifyMsg, setClarifyMsg] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  /* simulated call */
  const [stage, setStage] = useState<CallStage>("idle");
  const [seconds, setSeconds] = useState(0);
  const [checks, setChecks] = useState({
    identity: false,
    medicine: false,
    quantity: false,
    prescriptionDetails: false,
    address: false,
    orderConfirmed: false,
  });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const [d, cat] = await Promise.all([
        api<{ prescription: Prescription }>(`/api/prescriptions/${id}`),
        api<{ results: MedicineSearchResult[] }>("/api/medicines?q=&limit=100"),
      ]);
      setRx(d.prescription);
      setMeds(d.prescription.extractedMedicines);
      setCatalogue(cat.results);
      if (d.prescription.call) setChecks(d.prescription.call.checklist);
    } catch {
      setRx(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Mark as under review the moment the pharmacist opens the file.
  useEffect(() => {
    if (rx?.status === "PENDING") {
      void patch(`/api/prescriptions/${rx.id}`, { action: "start_review" }).then(load);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rx?.status]);

  useEffect(() => () => void (timer.current && clearInterval(timer.current)), []);

  if (loading) {
    return (
      <StaffShell role="pharmacist">
        <Skeleton className="h-96" />
      </StaffShell>
    );
  }
  if (!rx) {
    return (
      <StaffShell role="pharmacist">
        <EmptyState title="Prescription not found" action={<Link href="/pharmacist">Back to queue</Link>} />
      </StaffShell>
    );
  }

  const decided = rx.status === "APPROVED" || rx.status === "REJECTED";
  const callVerified = rx.call?.outcome === "VERIFIED";
  const allChecked = Object.values(checks).every(Boolean);

  /* ------------------------------- actions ------------------------------- */

  const saveMedicines = async () => {
    setBusy(true);
    try {
      await patch(`/api/prescriptions/${rx.id}`, { action: "update_medicines", medicines: meds });
      toast({ kind: "success", title: "Medicine list saved" });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const startCall = () => {
    setCallOpen(true);
    setStage("dialing");
    setSeconds(0);
    setTimeout(() => {
      setStage("connected");
      timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    }, 1800);
  };

  const endCall = async (outcome: "VERIFIED" | "UNREACHABLE" | "MISMATCH") => {
    if (timer.current) clearInterval(timer.current);
    setStage("ended");
    setBusy(true);
    try {
      await patch(`/api/prescriptions/${rx.id}`, {
        action: "log_call",
        call: { durationSec: seconds, checklist: checks, outcome },
      });
      toast({
        kind: outcome === "VERIFIED" ? "success" : "info",
        title: `Call logged — ${outcome}`,
      });
      await load();
    } finally {
      setBusy(false);
      setCallOpen(false);
      setStage("idle");
    }
  };

  const approve = async () => {
    setBusy(true);
    try {
      await patch(`/api/prescriptions/${rx.id}`, {
        action: "approve",
        note,
        refillsAuthorised: refills,
        validUntil: refills > 0 ? validUntil : undefined,
      });
      toast({ kind: "success", title: "Prescription approved & released" });
      await load();
    } catch (e) {
      toast({ kind: "error", title: "Cannot approve", body: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    setBusy(true);
    try {
      await patch(`/api/prescriptions/${rx.id}`, { action: "reject", reason: rejectReason });
      toast({ kind: "info", title: "Prescription rejected" });
      setRejectOpen(false);
      await load();
    } catch (e) {
      toast({ kind: "error", title: "Could not reject", body: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const clarify = async () => {
    setBusy(true);
    try {
      await patch(`/api/prescriptions/${rx.id}`, { action: "clarify", message: clarifyMsg });
      toast({ kind: "info", title: "Clarification requested" });
      setClarifyOpen(false);
      setClarifyMsg("");
      await load();
    } finally {
      setBusy(false);
    }
  };

  /* --------------------------------- view -------------------------------- */

  return (
    <StaffShell role="pharmacist">
      <button
        onClick={() => router.push("/pharmacist")}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900"
      >
        <ArrowLeft size={16} /> Verification queue
      </button>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        {/* ------------------------- prescription ------------------------- */}
        <div>
          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h1 className="font-mono text-lg font-bold text-ink-900">{rx.ref}</h1>
                <p className="text-xs text-ink-500">Submitted {dateTime(rx.createdAt)}</p>
              </div>
              <Badge tone={rx.status === "APPROVED" ? "green" : rx.status === "REJECTED" ? "red" : "amber"}>
                {PRESCRIPTION_LABELS[rx.status]}
              </Badge>
            </div>

            <div className="overflow-hidden rounded-xl border border-ink-200 bg-ink-50">
              {rx.mimeType === "application/pdf" ? (
                <object data={rx.fileData} type="application/pdf" className="h-[520px] w-full">
                  <p className="p-4 text-sm">PDF preview unavailable.</p>
                </object>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={rx.fileData} alt="Prescription" className="w-full object-contain" />
              )}
            </div>
            <a
              href={rx.fileData}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 underline"
            >
              <ExternalLink size={13} /> Open full size
            </a>
          </Card>

          <Card className="mt-3">
            <SectionTitle title="Patient & customer" />
            <KeyValue label="Patient name" value={rx.patientName} />
            <KeyValue label="Account holder" value={rx.customerName} />
            <KeyValue label="Phone" value={rx.customerPhone} />
            {rx.doctorName && <KeyValue label="Prescribing doctor" value={rx.doctorName} />}
            {rx.note && <KeyValue label="Customer note" value={rx.note} />}
          </Card>
        </div>

        {/* ---------------------------- review ---------------------------- */}
        <div>
          <Card>
            <SectionTitle
              title="Medicines to dispense"
              subtitle="Confirm every line against the prescription."
            />
            <ul className="space-y-2">
              {meds.map((m, i) => (
                <li key={i} className="rounded-xl border border-ink-200 p-2.5">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Input
                        value={m.name}
                        disabled={decided}
                        onChange={(e) =>
                          setMeds(meds.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                        }
                        placeholder="Medicine name"
                        className="text-sm"
                      />
                      <Input
                        value={m.dosage}
                        disabled={decided}
                        onChange={(e) =>
                          setMeds(meds.map((x, j) => (j === i ? { ...x, dosage: e.target.value } : x)))
                        }
                        placeholder="Dosage, e.g. 1 tablet twice daily × 5 days"
                        className="text-sm"
                      />
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min={1}
                          value={m.qty}
                          disabled={decided}
                          onChange={(e) =>
                            setMeds(
                              meds.map((x, j) =>
                                j === i ? { ...x, qty: Math.max(1, Number(e.target.value)) } : x,
                              ),
                            )
                          }
                          className="w-20 text-sm"
                        />
                        <Select
                          value={m.medicineId ?? ""}
                          disabled={decided}
                          onChange={(e) =>
                            setMeds(
                              meds.map((x, j) =>
                                j === i ? { ...x, medicineId: e.target.value || undefined } : x,
                              ),
                            )
                          }
                          className="flex-1 text-sm"
                        >
                          <option value="">— link to catalogue —</option>
                          {catalogue
                            .filter((c) => c.medicine.type === "RX")
                            .map((c) => (
                              <option key={c.medicine.id} value={c.medicine.id}>
                                {c.medicine.name}
                                {c.available ? "" : " (unavailable nearby)"}
                              </option>
                            ))}
                        </Select>
                      </div>
                    </div>
                    {!decided && (
                      <button
                        onClick={() => setMeds(meds.filter((_, j) => j !== i))}
                        className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="Remove line"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {!decided && (
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Plus size={14} />}
                  onClick={() =>
                    setMeds([...meds, { name: "", strength: "", dosage: "", qty: 1 }])
                  }
                >
                  Add line
                </Button>
                <Button size="sm" variant="secondary" loading={busy} onClick={saveMedicines}>
                  Save list
                </Button>
              </div>
            )}
          </Card>

          {/* --------------------------- call --------------------------- */}
          <Card className="mt-3">
            <SectionTitle
              title="Customer verification"
              subtitle="Mandatory before approval."
            />
            {rx.call ? (
              <div className="rounded-xl bg-ink-50 p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                  {callVerified ? (
                    <CheckCircle2 size={16} className="text-ok-600" />
                  ) : (
                    <XCircle size={16} className="text-amber-600" />
                  )}
                  Call {rx.call.outcome.toLowerCase()} · {rx.call.durationSec}s
                </p>
                <p className="mt-0.5 text-xs text-ink-500">{dateTime(rx.call.calledAt)}</p>
                <ul className="mt-2 grid gap-1">
                  {CHECK_LABELS.map((c) => (
                    <li key={c.key} className="flex items-center gap-1.5 text-xs text-ink-600">
                      {rx.call!.checklist[c.key] ? (
                        <CheckCircle2 size={12} className="text-ok-600" />
                      ) : (
                        <XCircle size={12} className="text-ink-300" />
                      )}
                      {c.label}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                No verification call logged yet. The prescription cannot be approved until the
                customer is contacted and every detail is confirmed.
              </p>
            )}

            {!decided && (
              <Button full className="mt-3" icon={<Phone size={16} />} onClick={startCall}>
                Call Customer for Verification
              </Button>
            )}
          </Card>

          {/* -------------------------- decision -------------------------- */}
          {!decided ? (
            <Card className="mt-3">
              <SectionTitle title="Decision" />
              <Field label="Verification note" required hint="Recorded against the prescription.">
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>

              {/* ------------------------------------------------------- */}
              {/* Repeat authorisation.                                    */}
              {/*                                                          */}
              {/* Verifying a prescription releases one order. Authorising */}
              {/* repeats lets the customer put it on an unattended        */}
              {/* schedule, so it is a separate, deliberate decision with  */}
              {/* an expiry attached — never an automatic consequence of   */}
              {/* approval.                                                */}
              {/* ------------------------------------------------------- */}
              <div className="mt-3 rounded-xl border border-ink-200 bg-ink-50 p-3">
                <p className="flex items-center gap-1.5 text-sm font-bold text-ink-900">
                  <RefreshCw size={14} className="text-ink-500" />
                  Repeat dispensings
                </p>
                <p className="mt-0.5 text-xs text-ink-600">
                  How many times may this be dispensed again without a fresh prescription?
                </p>

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {[0, 1, 3, 6, 12].map((n) => (
                    <button
                      key={n}
                      onClick={() => setRefills(n)}
                      className={
                        "h-9 min-w-11 rounded-lg border px-2.5 text-sm font-bold transition-colors " +
                        (refills === n
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-ink-300 bg-white text-ink-700 hover:bg-ink-100")
                      }
                    >
                      {n === 0 ? "None" : n}
                    </button>
                  ))}
                </div>

                {refills > 0 && (
                  <div className="mt-2.5">
                    <Field label="Valid until" required hint="No repeat is dispensed after this date.">
                      <Input
                        type="date"
                        value={validUntil}
                        min={new Date(Date.now() + 864e5).toISOString().slice(0, 10)}
                        onChange={(e) => setValidUntil(e.target.value)}
                      />
                    </Field>
                    {!validUntil && (
                      <p className="mt-1 text-xs text-amber-700">
                        Set an expiry date to authorise repeats.
                      </p>
                    )}
                  </div>
                )}

                {refills === 0 && (
                  <p className="mt-2 text-xs text-ink-500">
                    No repeats: the customer must upload a fresh prescription for each order.
                  </p>
                )}
              </div>

              <div className="mt-3 space-y-2">
                <Button
                  full
                  size="lg"
                  variant="success"
                  loading={busy}
                  disabled={!callVerified || (refills > 0 && !validUntil)}
                  icon={<ShieldCheck size={18} />}
                  onClick={approve}
                >
                  APPROVE &amp; RELEASE ORDER
                </Button>
                {!callVerified && (
                  <p className="text-center text-xs text-amber-700">
                    Complete a successful verification call to enable approval.
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    full
                    variant="outline"
                    icon={<MessageSquare size={15} />}
                    onClick={() => setClarifyOpen(true)}
                  >
                    Request clarification
                  </Button>
                  <Button full variant="danger" onClick={() => setRejectOpen(true)}>
                    Reject
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card
              className={
                "mt-3 " +
                (rx.status === "APPROVED"
                  ? "border-ok-200 bg-ok-50/60"
                  : "border-red-200 bg-red-50/60")
              }
            >
              <p className="font-semibold text-ink-900">
                {rx.status === "APPROVED" ? "Approved & released" : "Rejected"}
              </p>
              {rx.status === "APPROVED" && (
                <p className="mt-1 text-xs font-bold text-ok-800">
                  {rx.refillsAuthorised
                    ? `${(rx.refillsAuthorised ?? 0) - (rx.refillsUsed ?? 0)} of ${rx.refillsAuthorised} repeat dispensings left · valid until ${rx.validUntil}`
                    : "No repeat dispensings authorised"}
                </p>
              )}
              <p className="mt-1 text-sm text-ink-700">
                {rx.verificationNote ?? rx.rejectionReason}
              </p>
              <p className="mt-1 text-xs text-ink-500">
                {rx.verifiedByName} · {rx.reviewedAt && dateTime(rx.reviewedAt)}
              </p>
            </Card>
          )}

          <ComplianceNote className="mt-3" />
        </div>
      </div>

      {/* ------------------------- simulated call ------------------------- */}
      <Modal
        open={callOpen}
        onClose={() => stage !== "connected" && setCallOpen(false)}
        title="Verification call (simulated)"
        wide
      >
        <div className="mb-4 flex items-center gap-4 rounded-2xl bg-ink-900 p-4 text-white">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-lg font-bold">
            {rx.customerName.slice(0, 1)}
          </span>
          <div className="flex-1">
            <p className="font-semibold">{rx.customerName}</p>
            <p className="text-xs text-ink-300">{rx.customerPhone}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">
              {stage === "dialing"
                ? "Ringing…"
                : stage === "connected"
                  ? `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
                  : "Ended"}
            </p>
            <p className="text-[11px] text-ink-400">masked number</p>
          </div>
        </div>

        <p className="mb-2 text-sm font-semibold text-ink-800">Confirm with the customer:</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {CHECK_LABELS.map((c) => (
            <Checkbox
              key={c.key}
              checked={checks[c.key]}
              onChange={(v) => setChecks({ ...checks, [c.key]: v })}
              label={c.label}
              description={c.hint}
            />
          ))}
        </div>

        <div className="mt-3 rounded-xl bg-ink-50 p-3 text-xs text-ink-500">
          Suggested script: “Hello {rx.customerName}, this is {""}
          DawaQuick pharmacy verification. I&apos;m calling about prescription {rx.ref} for{" "}
          {rx.patientName}. Could you confirm the medicines and quantity prescribed, and your
          delivery address?”
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="success"
            icon={<CheckCircle2 size={16} />}
            loading={busy}
            disabled={stage !== "connected" || !allChecked}
            onClick={() => endCall("VERIFIED")}
          >
            End call — verified
          </Button>
          <Button
            variant="outline"
            icon={<PhoneOff size={16} />}
            disabled={stage !== "connected"}
            onClick={() => endCall("MISMATCH")}
          >
            Details don&apos;t match
          </Button>
          <Button
            variant="ghost"
            disabled={stage === "connected" && allChecked}
            onClick={() => endCall("UNREACHABLE")}
          >
            Customer unreachable
          </Button>
        </div>
        {stage === "connected" && !allChecked && (
          <p className="mt-2 text-xs text-amber-700">
            Tick every item above before you can mark the call verified.
          </p>
        )}
      </Modal>

      {/* --------------------------- clarification -------------------------- */}
      <Modal
        open={clarifyOpen}
        onClose={() => setClarifyOpen(false)}
        title="Request clarification"
        footer={
          <Button full loading={busy} disabled={!clarifyMsg.trim()} onClick={clarify}>
            Send to customer
          </Button>
        }
      >
        <Field label="What do you need from the customer?" required>
          <Textarea
            value={clarifyMsg}
            onChange={(e) => setClarifyMsg(e.target.value)}
            placeholder="e.g. The prescription date is not readable. Please re-upload a clearer photo showing the date and doctor's signature."
          />
        </Field>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            "Image is blurred — please re-upload a clearer photo.",
            "Prescription date is not visible.",
            "Doctor's signature / registration number is missing.",
            "Prescription appears older than 6 months.",
          ].map((s) => (
            <button
              key={s}
              onClick={() => setClarifyMsg(s)}
              className="rounded-full border border-ink-200 px-3 py-1 text-xs text-ink-600 hover:bg-ink-50"
            >
              {s}
            </button>
          ))}
        </div>
      </Modal>

      {/* ------------------------------ reject ------------------------------ */}
      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject prescription"
        footer={
          <Button full variant="danger" loading={busy} disabled={!rejectReason.trim()} onClick={reject}>
            Reject prescription
          </Button>
        }
      >
        <Field label="Reason (shared with the customer)" required>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. The uploaded document is not a valid prescription."
          />
        </Field>
        <p className="mt-2 rounded-xl bg-ink-50 p-3 text-xs text-ink-500">
          Rejecting blocks fulfilment of every prescription medicine on this request. The customer
          is notified immediately and can upload a corrected prescription.
        </p>
      </Modal>
    </StaffShell>
  );
}
