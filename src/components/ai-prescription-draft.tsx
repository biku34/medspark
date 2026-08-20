"use client";

import { useState } from "react";
import {
  BadgeCheck,
  ChevronDown,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import clsx from "clsx";
import { Button } from "./ui";
import { Pill } from "./ops";
import { useApp } from "./providers";
import { post } from "@/lib/client";
import { prepareDocument } from "@/lib/image-prep";
import type { AiPrescriptionDraft, Prescription, PrescriptionMedicine } from "@/lib/types";

/**
 * The AI draft, on the pharmacist's desk.
 *
 * Presented as somebody else's reading of the page, not as an answer. Every
 * line shows the words it came from and whether both vendors independently
 * agreed on the product, and nothing enters the form until the pharmacist puts
 * it there. A line only one model proposed is deliberately harder to accept
 * than one they both found.
 */
export function AiPrescriptionDraft({
  prescription,
  disabled,
  onApply,
}: {
  prescription: Prescription;
  disabled?: boolean;
  /** Hands accepted lines to the form the pharmacist is already editing. */
  onApply: (lines: PrescriptionMedicine[]) => void;
}) {
  const { toast } = useApp();
  const [draft, setDraft] = useState<AiPrescriptionDraft | null>(
    prescription.aiDraft ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [openTranscript, setOpenTranscript] = useState(false);
  const [picked, setPicked] = useState<Record<number, boolean>>({});

  const run = async () => {
    setBusy(true);
    try {
      // The page is rasterised and flattened here, in the browser: vision
      // models will not take SVG, and greyscale with a contrast stretch reads
      // considerably better than a raw phone photo.
      const prepared = await prepareDocument(prescription.fileData, {
        enhance: prescription.mimeType !== "image/svg+xml",
      });

      const res = await post<{ draft: AiPrescriptionDraft }>("/api/ai/prescription", {
        prescriptionId: prescription.id,
        imageBase64: prepared.base64,
        mimeType: prepared.mimeType,
      });

      setDraft(res.draft);
      setPicked(Object.fromEntries(res.draft.lines.map((l, i) => [i, l.agreed])));

      /**
       * Lines both vendors independently agreed on go straight into the form.
       *
       * The pharmacist still reads, calls and approves — that gate is what
       * makes this safe, not the extra click. A line only one model found is
       * deliberately left out here and has to be added by hand, so the
       * automatic path only ever carries the corroborated reading.
       */
      const agreed = res.draft.lines.filter((l) => l.agreed);
      if (agreed.length > 0) {
        onApply(
          agreed.map((l) => ({
            name: l.name,
            strength: l.strength,
            dosage: l.dosage,
            qty: l.qty,
            medicineId: l.medicineId,
          })),
        );
        toast({
          kind: "success",
          title: `${agreed.length} line(s) filled in — check them against the page`,
        });
      }

      if (res.draft.lines.some((l) => !l.agreed)) {
        toast({
          kind: "info",
          title: "Some lines need your eye",
          body: "Only one model read them, so they were left for you to add.",
        });
      }

      if (!res.draft.ok) {
        toast({
          kind: "info",
          title: "Nothing could be read confidently",
          body: res.draft.notes[0] ?? "Enter the lines by hand.",
        });
      }
    } catch (e) {
      toast({ kind: "error", title: "AI could not read this", body: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!draft) return;
    const chosen = draft.lines.filter((_, i) => picked[i]);
    if (chosen.length === 0) {
      toast({ kind: "info", title: "Tick the lines you want to keep" });
      return;
    }
    onApply(
      chosen.map((l) => ({
        name: l.name,
        strength: l.strength,
        dosage: l.dosage,
        qty: l.qty,
        medicineId: l.medicineId,
      })),
    );
    toast({ kind: "success", title: `${chosen.length} line(s) added — check them` });
  };

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-care-200 bg-care-50">
      <div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5">
        <Sparkles size={16} className="shrink-0 text-care-700" />
        <p className="text-[13px] font-extrabold text-care-800">AI reading</p>
        <p className="min-w-0 flex-1 text-[11.5px] text-care-700/80">
          A draft for you to check — it cannot approve or dispense anything.
        </p>
        {!disabled && (
          <Button size="sm" loading={busy} onClick={run}>
            {draft ? "Read again" : "Read this prescription"}
          </Button>
        )}
      </div>

      {draft && (
        <div className="border-t border-care-200 bg-white px-3.5 py-3">
          {/* ---------------------------- lines --------------------------- */}
          {draft.lines.length === 0 ? (
            <p className="text-[13px] text-ink-600">
              {draft.unreadable
                ? "The model could not read this document confidently."
                : "Nothing on this page matched the catalogue."}
            </p>
          ) : (
            <>
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-ink-400">
                Read from the page
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {draft.lines.map((l, i) => (
                  <li
                    key={`${l.medicineId}-${i}`}
                    className={clsx(
                      "rounded-lg border p-2.5",
                      l.agreed ? "border-ok-200 bg-ok-50/40" : "border-rx-300 bg-rx-50/50",
                    )}
                  >
                    <label className="flex cursor-pointer items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={!!picked[i]}
                        disabled={disabled}
                        onChange={(e) =>
                          setPicked((p) => ({ ...p, [i]: e.target.checked }))
                        }
                        className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[13.5px] font-bold text-ink-900">{l.name}</span>
                          {l.agreed ? (
                            <Pill tone="green">
                              <BadgeCheck size={9} strokeWidth={3} /> Both models agree
                            </Pill>
                          ) : (
                            <Pill tone="amber">
                              <TriangleAlert size={9} strokeWidth={3} /> One model only
                            </Pill>
                          )}
                        </span>
                        <span className="block text-[12px] text-ink-600">
                          {l.dosage || "no dosage written"} · qty {l.qty}
                        </span>
                        {/* The words it actually read, so you can check the page. */}
                        <span className="mt-1 block rounded border-l-2 border-ink-300 bg-ink-50 py-0.5 pl-2 font-mono text-[11px] text-ink-600">
                          {l.sourceText}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-ink-400">
                          {l.proposedBy.join(" · ")}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>

              {!disabled && (
                <Button size="sm" className="mt-2.5" onClick={apply}>
                  Add ticked lines to the form
                </Button>
              )}
            </>
          )}

          {/* -------------------------- what was dropped ------------------- */}
          {draft.unmatched.length > 0 && (
            <div className="mt-3 rounded-lg border border-ink-200 bg-ink-50 p-2.5">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-ink-500">
                Read but not matched — enter by hand if needed
              </p>
              <ul className="mt-1 space-y-0.5">
                {draft.unmatched.map((u, i) => (
                  <li key={i} className="font-mono text-[11px] text-ink-600">
                    {u}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {draft.notes.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {draft.notes.map((n, i) => (
                <li key={i} className="text-[11px] text-rx-700">
                  {n}
                </li>
              ))}
            </ul>
          )}

          {/* ---------------------------- audit --------------------------- */}
          <button
            onClick={() => setOpenTranscript((o) => !o)}
            className="mt-2.5 inline-flex items-center gap-1 text-[11.5px] font-bold text-ink-500 hover:text-ink-800"
          >
            <ChevronDown
              size={13}
              className={clsx("transition-transform", openTranscript && "rotate-180")}
            />
            What the model transcribed
          </button>
          {openTranscript && (
            <pre className="mt-1.5 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-ink-900 p-2.5 font-mono text-[11px] leading-relaxed text-white/80">
              {draft.transcription || "(nothing)"}
            </pre>
          )}
          <p className="mt-1.5 text-[10px] text-ink-400">
            {draft.models.join(" · ")}
          </p>
        </div>
      )}
    </div>
  );
}
