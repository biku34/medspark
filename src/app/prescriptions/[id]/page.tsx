"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileText,
  MessageSquare,
  Phone,
  ShieldCheck,
  Store,
  XCircle,
} from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { ComplianceNote } from "@/components/brand";
import { useApp } from "@/components/providers";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  KeyValue,
  SectionTitle,
  Skeleton,
  Textarea,
} from "@/components/ui";
import { api, patch } from "@/lib/client";
import { PRESCRIPTION_LABELS, type MedicineSearchResult, type Prescription } from "@/lib/types";
import { dateTime } from "@/lib/utils";

export default function PrescriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { addToCart, clearCart, setActivePrescriptionId, toast, geoQuery } = useApp();
  const [rx, setRx] = useState<Prescription | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api<{ prescription: Prescription }>(`/api/prescriptions/${id}`);
      setRx(d.prescription);
    } catch {
      setRx(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Poll while a pharmacist is reviewing so approval appears live in the demo.
  useEffect(() => {
    if (!rx || rx.status === "APPROVED" || rx.status === "REJECTED") return;
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [rx, load]);

  if (loading) {
    return (
      <CustomerShell>
        <Skeleton className="h-96" />
      </CustomerShell>
    );
  }
  if (!rx) {
    return (
      <CustomerShell>
        <EmptyState
          title="Prescription not found"
          action={<Link href="/prescriptions">Back to prescriptions</Link>}
        />
      </CustomerShell>
    );
  }

  /**
   * Load the verified medicines into the basket and unlock pharmacy selection.
   * Prices come from the catalogue here and are re-priced per pharmacy on the
   * next screen — each pharmacy sets its own price.
   */
  const proceedToPharmacies = async () => {
    setBusy(true);
    try {
      clearCart();
      for (const m of rx.extractedMedicines) {
        if (!m.medicineId) continue;
        const detail = await api<MedicineSearchResult>(`/api/medicines/${m.medicineId}?${geoQuery}`).catch(
          () => null,
        );
        addToCart(
          {
            medicineId: m.medicineId,
            name: detail?.medicine.name ?? m.name,
            strength: detail?.medicine.strength ?? m.strength,
            form: detail?.medicine.form ?? "Tablet",
            type: "RX",
            emoji: detail?.medicine.emoji ?? "💊",
            price: detail?.minPrice ?? detail?.medicine.mrp ?? 0,
          },
          m.qty || 1,
        );
      }
      setActivePrescriptionId(rx.id);
      router.push("/select-pharmacy");
    } finally {
      setBusy(false);
    }
  };

  return (
    <CustomerShell>
      <button
        onClick={() => router.push("/prescriptions")}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900"
      >
        <ArrowLeft size={16} /> All prescriptions
      </button>

      {/* ------------------------------ status ---------------------------- */}
      {rx.status === "APPROVED" ? (
        <Card className="border-emerald-200 bg-emerald-50/70">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={26} className="mt-0.5 shrink-0 text-emerald-600" />
            <div>
              <h1 className="text-lg font-bold text-emerald-900">Prescription Verified ✓</h1>
              <p className="mt-1 text-sm leading-relaxed text-emerald-800">
                Your prescription has been verified by our pharmacist. You can now select a nearby
                pharmacy for fulfilment.
              </p>
              {rx.verificationNote && (
                <p className="mt-2 rounded-lg bg-white/70 p-2.5 text-xs text-emerald-900">
                  <strong>Pharmacist note:</strong> “{rx.verificationNote}” —{" "}
                  {rx.verifiedByName}
                </p>
              )}
            </div>
          </div>
          <Button
            full
            size="lg"
            className="mt-4"
            loading={busy}
            icon={<Store size={18} />}
            onClick={proceedToPharmacies}
          >
            Choose a nearby pharmacy
          </Button>
        </Card>
      ) : rx.status === "REJECTED" ? (
        <Card className="border-red-200 bg-red-50/70">
          <div className="flex items-start gap-3">
            <XCircle size={26} className="mt-0.5 shrink-0 text-red-600" />
            <div>
              <h1 className="text-lg font-bold text-red-900">Prescription not verified</h1>
              <p className="mt-1 text-sm text-red-800">{rx.rejectionReason}</p>
              <p className="mt-2 text-xs text-red-700">
                Reviewed by {rx.verifiedByName}. You can upload a clearer or newer prescription.
              </p>
            </div>
          </div>
          <Button
            full
            variant="outline"
            className="mt-4"
            onClick={() => router.push("/prescriptions/upload")}
          >
            Upload another prescription
          </Button>
        </Card>
      ) : rx.status === "CLARIFICATION" ? (
        <Card className="border-amber-200 bg-amber-50/70">
          <div className="flex items-start gap-3">
            <MessageSquare size={24} className="mt-0.5 shrink-0 text-amber-600" />
            <div className="flex-1">
              <h1 className="text-lg font-bold text-amber-900">Pharmacist needs a clarification</h1>
              <p className="mt-1 rounded-lg bg-white/70 p-2.5 text-sm text-amber-900">
                {rx.clarificationMessage}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Type your reply for the pharmacist…"
            />
            <Button
              full
              className="mt-2"
              loading={busy}
              disabled={!reply.trim()}
              onClick={async () => {
                setBusy(true);
                try {
                  await patch(`/api/prescriptions/${rx.id}`, { action: "reply", message: reply });
                  toast({ kind: "success", title: "Reply sent to the pharmacist" });
                  setReply("");
                  await load();
                } finally {
                  setBusy(false);
                }
              }}
            >
              Send reply
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="border-amber-200 bg-amber-50/60">
          <div className="flex items-start gap-3">
            <Clock3 size={24} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <h1 className="text-lg font-bold text-amber-900">
                {PRESCRIPTION_LABELS[rx.status]}
              </h1>
              <p className="mt-1 text-sm text-amber-800">
                A registered pharmacist is reviewing your prescription. You&apos;ll be notified as
                soon as it&apos;s verified — this usually takes a few minutes.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* --------------------------- reference ---------------------------- */}
      <Card className="mt-3">
        <SectionTitle title="Prescription record" />
        <KeyValue label="Reference number" value={<span className="font-mono">{rx.ref}</span>} />
        <KeyValue label="Patient" value={rx.patientName} />
        {rx.doctorName && <KeyValue label="Prescribing doctor" value={rx.doctorName} />}
        <KeyValue label="Submitted" value={dateTime(rx.createdAt)} />
        <KeyValue
          label="Status"
          value={<Badge tone={rx.status === "APPROVED" ? "green" : "amber"}>{PRESCRIPTION_LABELS[rx.status]}</Badge>}
        />
        {rx.verifiedByName && <KeyValue label="Pharmacist" value={rx.verifiedByName} />}
        {rx.reviewedAt && <KeyValue label="Reviewed" value={dateTime(rx.reviewedAt)} />}
        {rx.note && <KeyValue label="Your note" value={rx.note} />}
      </Card>

      {/* ------------------------- verification call ----------------------- */}
      {rx.call && (
        <Card className="mt-3">
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-ink-900">
            <Phone size={16} className="text-brand-600" /> Verification call
          </h2>
          <KeyValue label="Called at" value={dateTime(rx.call.calledAt)} />
          <KeyValue label="Duration" value={`${rx.call.durationSec}s`} />
          <KeyValue label="Outcome" value={rx.call.outcome} />
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {Object.entries(rx.call.checklist).map(([k, v]) => (
              <li key={k} className="flex items-center gap-1.5 text-xs text-ink-600">
                {v ? (
                  <CheckCircle2 size={13} className="text-emerald-600" />
                ) : (
                  <XCircle size={13} className="text-ink-300" />
                )}
                {k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ---------------------------- medicines ---------------------------- */}
      {rx.extractedMedicines.length > 0 && (
        <Card className="mt-3">
          <h2 className="mb-2 font-semibold text-ink-900">Prescribed medicines</h2>
          <ul className="space-y-2">
            {rx.extractedMedicines.map((m) => (
              <li key={m.name} className="rounded-xl bg-ink-50 p-3">
                <p className="text-sm font-semibold text-ink-900">{m.name}</p>
                <p className="text-xs text-ink-500">
                  {m.dosage} · quantity {m.qty}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ------------------------------ image ------------------------------ */}
      <Card className="mt-3">
        <h2 className="mb-2 flex items-center gap-2 font-semibold text-ink-900">
          <FileText size={16} className="text-ink-400" /> Uploaded document
        </h2>
        <div className="overflow-hidden rounded-xl border border-ink-200 bg-ink-50">
          {rx.mimeType === "application/pdf" ? (
            <object data={rx.fileData} type="application/pdf" className="h-96 w-full">
              <p className="p-4 text-sm text-ink-500">
                PDF preview unavailable.{" "}
                <a href={rx.fileData} download={rx.fileName} className="underline">
                  Download {rx.fileName}
                </a>
              </p>
            </object>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={rx.fileData} alt="Uploaded prescription" className="w-full object-contain" />
          )}
        </div>
      </Card>

      <div className="mt-3">
        <ComplianceNote />
      </div>

      <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink-400">
        <ShieldCheck size={13} /> Your prescription is visible only to you and the verifying
        pharmacist.
      </p>
    </CustomerShell>
  );
}
