"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  FileText,
  Sparkles,
  Trash2,
  Upload,
  ShieldCheck,
} from "lucide-react";
import clsx from "clsx";
import { CustomerShell } from "@/components/customer-shell";
import { useApp } from "@/components/providers";
import { Button, Card, Field, Input, SectionTitle, Textarea } from "@/components/ui";
import { post } from "@/lib/client";
import { DOCUMENT_KINDS } from "@/lib/care";
import { mockDischargeSummary, mockLabReport } from "@/lib/sample-documents";
import { DOCUMENT_META, type CarePlan, type HealthDocumentKind } from "@/lib/types";

const MAX_BYTES = 5 * 1024 * 1024;

interface Draft {
  key: string;
  kind: HealthDocumentKind;
  fileName: string;
  mimeType: string;
  fileData: string;
}

let seq = 0;

/** Ready-made documents so the flow can be walked through without a scanner. */
const SAMPLES: Array<{ label: string; kind: HealthDocumentKind; build: () => Draft }> = [
  {
    label: "Sample discharge summary",
    kind: "DISCHARGE_SUMMARY",
    build: () => ({
      key: `s${++seq}`,
      kind: "DISCHARGE_SUMMARY",
      fileName: "sample-discharge-summary.svg",
      mimeType: "image/svg+xml",
      fileData: mockDischargeSummary({
        hospital: "Civil Hospital, Gandhinagar",
        patient: "Sample Patient",
        age: "64 Y / M",
        admitted: new Date(Date.now() - 7 * 864e5).toLocaleDateString("en-IN"),
        discharged: new Date(Date.now() - 2 * 864e5).toLocaleDateString("en-IN"),
        diagnosis: "Community-acquired pneumonia with hypertension",
        procedure: "Conservative management · IV antibiotics",
        medicines: [
          "Cap. Amoxicillin 500 mg — 1 TDS × 5 days",
          "Tab. Telmisartan 40 mg — 1 OD (continue)",
          "Tab. Pantoprazole 40 mg — 1 OD × 14 days",
        ],
        advice: [
          "Chest physiotherapy at home for two weeks",
          "Monitor blood pressure twice daily",
          "Repeat CBC after 14 days",
        ],
      }),
    }),
  },
  {
    label: "Sample lab report",
    kind: "LAB_REPORT",
    build: () => ({
      key: `s${++seq}`,
      kind: "LAB_REPORT",
      fileName: "sample-lab-report.svg",
      mimeType: "image/svg+xml",
      fileData: mockLabReport({
        lab: "Sterling Diagnostics",
        patient: "Sample Patient",
        age: "64 Y / M",
        collected: new Date(Date.now() - 864e5).toLocaleDateString("en-IN"),
        panel: "Complete blood count & lipid profile",
        rows: [
          { test: "Haemoglobin", result: "11.4", unit: "g/dL", range: "13.0 – 17.0", flag: "L" },
          { test: "Total leucocyte count", result: "12,900", unit: "/µL", range: "4,000 – 11,000", flag: "H" },
          { test: "LDL cholesterol", result: "162", unit: "mg/dL", range: "< 100", flag: "H" },
          { test: "Fasting glucose", result: "108", unit: "mg/dL", range: "70 – 100", flag: "H" },
        ],
      }),
    }),
  },
];

export default function NewCarePlanPage() {
  const router = useRouter();
  const { user, toast } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [kind, setKind] = useState<HealthDocumentKind>("DISCHARGE_SUMMARY");
  const [docs, setDocs] = useState<Draft[]>([]);
  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [condition, setCondition] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [dischargeDate, setDischargeDate] = useState("");
  const [allergies, setAllergies] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.size > MAX_BYTES) {
        toast({ kind: "error", title: `${file.name} is too large`, body: "Keep each file under 5 MB." });
        continue;
      }
      const reader = new FileReader();
      reader.onload = () =>
        setDocs((prev) => [
          ...prev,
          {
            key: `f${++seq}`,
            kind,
            fileName: file.name,
            mimeType: file.type || "image/jpeg",
            fileData: String(reader.result),
          },
        ]);
      reader.readAsDataURL(file);
    }
  };

  const submit = async () => {
    if (!user) {
      router.push("/login?next=/care/new");
      return;
    }
    if (docs.length === 0) {
      toast({ kind: "error", title: "Add at least one document" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await post<{ carePlan: CarePlan }>("/api/care-plans", {
        patientName: patientName.trim() || undefined,
        patientAge: patientAge ? Number(patientAge) : undefined,
        condition: condition.trim() || undefined,
        hospitalName: hospitalName.trim() || undefined,
        dischargeDate: dischargeDate || undefined,
        allergies: allergies.trim() || undefined,
        note: note.trim() || undefined,
        documents: docs.map((d) => ({
          kind: d.kind,
          fileName: d.fileName,
          mimeType: d.mimeType,
          fileData: d.fileData,
        })),
      });
      toast({
        kind: "success",
        title: "Documents received",
        body: `${res.carePlan.ref} is with our care team.`,
      });
      router.push(`/care/${res.carePlan.id}`);
    } catch (e) {
      toast({ kind: "error", title: "Could not submit", body: (e as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CustomerShell>
      <Link
        href="/care"
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-600 hover:text-ink-900"
      >
        <ArrowLeft size={15} /> Care plans
      </Link>

      <SectionTitle
        title="Start a care plan"
        subtitle="Share what you already have. A pharmacist reads it and builds the plan."
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        {/* ---------------------------- documents --------------------------- */}
        <div className="min-w-0 space-y-3">
          <Card>
            <p className="text-[14px] font-extrabold text-ink-900">1 · Your documents</p>
            <p className="mt-0.5 text-[12px] text-ink-500">
              A discharge summary tells us the most. Lab reports and prescriptions help too.
            </p>

            <div className="mt-3">
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-500">
                What are you adding?
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DOCUMENT_KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={clsx(
                      "rounded-lg border px-2.5 py-1.5 text-[12px] font-bold transition-colors",
                      kind === k
                        ? "border-brand-600 bg-brand-50 text-brand-700"
                        : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50",
                    )}
                  >
                    {DOCUMENT_META[k].emoji} {DOCUMENT_META[k].label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-ink-500">{DOCUMENT_META[kind].hint}</p>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-11 items-center justify-center gap-2 rounded-lg border-2 border-dashed border-ink-300 text-[13px] font-bold text-ink-700 hover:border-brand-500 hover:text-brand-700"
              >
                <Upload size={16} /> Choose file(s)
              </button>
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="flex h-11 items-center justify-center gap-2 rounded-lg border-2 border-dashed border-ink-300 text-[13px] font-bold text-ink-700 hover:border-brand-500 hover:text-brand-700"
              >
                <Camera size={16} /> Take a photo
              </button>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              hidden
              onChange={(e) => addFiles(e.target.files)}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => addFiles(e.target.files)}
            />

            <div className="mt-2 flex flex-wrap gap-1.5">
              {SAMPLES.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setDocs((prev) => [...prev, s.build()])}
                  className="inline-flex items-center gap-1 rounded border border-ink-200 px-2 py-1 text-[11px] font-bold text-ink-600 hover:bg-ink-50"
                >
                  <Sparkles size={11} /> {s.label}
                </button>
              ))}
            </div>

            {docs.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {docs.map((d) => (
                  <li
                    key={d.key}
                    className="flex items-center gap-2.5 rounded-lg border border-ink-200 bg-ink-50 p-2"
                  >
                    <span className="flex h-11 w-9 shrink-0 items-center justify-center overflow-hidden rounded border border-ink-200 bg-white">
                      {d.mimeType === "application/pdf" ? (
                        <FileText size={15} className="text-ink-400" />
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={d.fileData} alt="" className="h-full w-full object-cover" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-extrabold uppercase tracking-wide text-brand-700">
                        {DOCUMENT_META[d.kind].label}
                      </span>
                      <span className="block truncate text-[12px] font-semibold text-ink-800">
                        {d.fileName}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setDocs((prev) => prev.filter((x) => x.key !== d.key))}
                      className="shrink-0 rounded p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"
                      aria-label={`Remove ${d.fileName}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <p className="text-[14px] font-extrabold text-ink-900">2 · About the patient</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Patient name" hint="Leave blank if it's for you">
                <Input
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder={user?.name ?? "Full name"}
                />
              </Field>
              <Field label="Age">
                <Input
                  type="number"
                  value={patientAge}
                  onChange={(e) => setPatientAge(e.target.value)}
                  placeholder="68"
                />
              </Field>
              <Field label="Condition or reason">
                <Input
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  placeholder="Pneumonia recovery, diabetes review…"
                />
              </Field>
              <Field label="Known allergies" hint="Important — it changes what we plan">
                <Input
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  placeholder="Penicillin, sulfa drugs…"
                />
              </Field>
              <Field label="Hospital" hint="If this follows a hospital stay">
                <Input
                  value={hospitalName}
                  onChange={(e) => setHospitalName(e.target.value)}
                  placeholder="Civil Hospital, Gandhinagar"
                />
              </Field>
              <Field label="Discharge date">
                <Input
                  type="date"
                  value={dischargeDate}
                  onChange={(e) => setDischargeDate(e.target.value)}
                />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Anything you want the care team to know">
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="He is weak and I'm not sure which of his old tablets to continue…"
                />
              </Field>
            </div>
          </Card>
        </div>

        {/* ----------------------------- submit ----------------------------- */}
        <div className="min-w-0">
          <div className="lg:sticky lg:top-24">
            <Card>
              <p className="text-[14px] font-extrabold text-ink-900">Ready to send</p>
              <p className="mt-1 text-[12px] text-ink-600">
                {docs.length === 0
                  ? "Add at least one document to continue."
                  : `${docs.length} document${docs.length === 1 ? "" : "s"} attached.`}
              </p>

              <Button
                className="mt-3 w-full"
                loading={submitting}
                disabled={docs.length === 0}
                onClick={submit}
              >
                {user ? "Send to the care team" : "Sign in and send"}
              </Button>

              <ul className="mt-3 space-y-1.5 border-t border-ink-100 pt-3 text-[11px] leading-relaxed text-ink-500">
                <li className="flex gap-1.5">
                  <ShieldCheck size={13} className="mt-px shrink-0 text-brand-600" />
                  Your documents are visible only to the pharmacist reviewing them.
                </li>
                <li className="flex gap-1.5">
                  <ShieldCheck size={13} className="mt-px shrink-0 text-brand-600" />
                  A prescription in the pile goes to the verification desk automatically.
                </li>
                <li className="flex gap-1.5">
                  <ShieldCheck size={13} className="mt-px shrink-0 text-brand-600" />
                  Nothing is ordered or booked until you approve the plan.
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </CustomerShell>
  );
}
