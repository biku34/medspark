"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { ComplianceNote } from "@/components/brand";
import { useApp } from "@/components/providers";
import { Button, Card, Field, Input, SectionTitle, Textarea } from "@/components/ui";
import { post } from "@/lib/client";
import { SAMPLE_PRESCRIPTIONS, mockPrescriptionImage } from "@/lib/sample-prescription";
import type { Prescription, PrescriptionMedicine } from "@/lib/types";

const MAX_BYTES = 5 * 1024 * 1024;

export default function UploadPrescriptionPage() {
  const router = useRouter();
  const { user, toast } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [fileData, setFileData] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [mimeType, setMimeType] = useState("");
  const [patientName, setPatientName] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [note, setNote] = useState("");
  const [medicines, setMedicines] = useState<PrescriptionMedicine[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const readFile = (file: File) => {
    if (file.size > MAX_BYTES) {
      toast({ kind: "error", title: "File too large", body: "Please upload a file under 5 MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFileData(String(reader.result));
      setFileName(file.name);
      setMimeType(file.type || "image/jpeg");
    };
    reader.readAsDataURL(file);
  };

  const useSample = (sample: (typeof SAMPLE_PRESCRIPTIONS)[number]) => {
    setFileData(
      mockPrescriptionImage(
        sample.doctor,
        patientName || user?.name || "Aarav Mehta",
        sample.lines,
        new Date().toLocaleDateString("en-IN"),
      ),
    );
    setFileName(`${sample.id}.svg`);
    setMimeType("image/svg+xml");
    setDoctorName(sample.doctor);
    setMedicines(sample.medicines);
    toast({ kind: "info", title: "Sample prescription loaded (demo)" });
  };

  const submit = async () => {
    if (!user) {
      toast({ kind: "info", title: "Sign in to upload a prescription" });
      router.push("/login?next=/prescriptions/upload");
      return;
    }
    if (!fileData) {
      toast({ kind: "error", title: "Please attach your prescription first" });
      return;
    }
    setSubmitting(true);
    try {
      const { prescription } = await post<{ prescription: Prescription }>("/api/prescriptions", {
        fileData,
        fileName,
        mimeType,
        patientName,
        doctorName,
        note,
        medicines,
      });
      toast({
        kind: "success",
        title: "Prescription submitted for verification",
        body: `Reference ${prescription.ref}`,
      });
      router.push(`/prescriptions/${prescription.id}`);
    } catch (e) {
      toast({ kind: "error", title: "Upload failed", body: (e as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CustomerShell>
      <SectionTitle
        title="Upload Prescription"
        subtitle="Upload a clear image of your prescription. A registered pharmacist will verify it before any pharmacy can dispense."
      />

      <ComplianceNote className="mb-4" />

      {/* -------------------------- upload surface ------------------------- */}
      <Card>
        {fileData ? (
          <div>
            <div className="relative overflow-hidden rounded-xl border border-ink-200 bg-ink-50">
              {mimeType === "application/pdf" ? (
                <div className="flex h-56 flex-col items-center justify-center gap-2 text-ink-500">
                  <FileText size={40} />
                  <p className="text-sm font-medium">{fileName}</p>
                  <p className="text-xs">PDF attached</p>
                </div>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={fileData}
                  alt="Prescription preview"
                  className="max-h-96 w-full object-contain"
                />
              )}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="flex min-w-0 items-center gap-1.5 text-sm text-ok-700">
                <CheckCircle2 size={15} className="shrink-0" />
                <span className="truncate">{fileName}</span>
              </p>
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash2 size={14} />}
                onClick={() => {
                  setFileData(null);
                  setFileName("");
                  setMedicines([]);
                }}
              >
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-ink-300 bg-ink-50/50 p-6 text-center">
            <Upload size={34} className="mx-auto text-ink-400" />
            <p className="mt-2 font-semibold text-ink-800">
              Upload a clear image of your prescription.
            </p>
            <p className="mt-1 text-sm text-ink-500">
              JPG, PNG or PDF · up to 5 MB · make sure the doctor&apos;s name, date, medicines and
              signature are readable.
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <Button variant="outline" icon={<ImageIcon size={16} />} onClick={() => fileRef.current?.click()}>
                Upload image
              </Button>
              <Button variant="outline" icon={<FileText size={16} />} onClick={() => fileRef.current?.click()}>
                Upload PDF
              </Button>
              <Button variant="outline" icon={<Camera size={16} />} onClick={() => cameraRef.current?.click()}>
                Take photo
              </Button>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
            />

            <div className="mt-5 border-t border-ink-200 pt-4">
              <p className="mb-2 flex items-center justify-center gap-1.5 text-xs font-medium text-ink-500">
                <Sparkles size={13} /> No prescription handy? Load a sample to try the flow
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {SAMPLE_PRESCRIPTIONS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => useSample(s)}
                    className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-700 hover:border-brand-300 hover:bg-brand-50"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ---------------------------- patient info ------------------------- */}
      <Card className="mt-3 space-y-3">
        <Field label="Patient name" hint="Ordering for a parent or someone else? Enter their name.">
          <Input
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            placeholder={user?.name ?? "Full name as on the prescription"}
          />
        </Field>
        <Field label="Prescribing doctor (optional)">
          <Input
            value={doctorName}
            onChange={(e) => setDoctorName(e.target.value)}
            placeholder="Dr. …"
          />
        </Field>
        <Field label="Note for the pharmacist (optional)">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Need it today, monthly refill for my mother, etc."
          />
        </Field>
      </Card>

      {medicines.length > 0 && (
        <Card className="mt-3">
          <p className="mb-2 text-sm font-semibold text-ink-900">
            Medicines read from the prescription
          </p>
          <p className="mb-2 text-xs text-ink-500">
            Auto-extraction is a placeholder in this prototype — the pharmacist confirms every line
            during review.
          </p>
          <ul className="space-y-1.5">
            {medicines.map((m) => (
              <li key={m.name} className="rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-700">
                <strong className="text-ink-900">{m.name}</strong> · {m.dosage}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="sticky bottom-20 mt-4 sm:bottom-4">
        <Button full size="lg" loading={submitting} onClick={submit} disabled={!fileData}>
          Submit for pharmacist verification
        </Button>
        <p className="mt-2 text-center text-xs text-ink-400">
          You&apos;ll get a reference number and a status you can track. Nothing is dispensed until
          a pharmacist verifies it.
        </p>
      </div>
    </CustomerShell>
  );
}
