"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { ChevronDown, RefreshCcw, Send, Sparkles } from "lucide-react";
import { ActionButton, Pill } from "./ops";
import { useApp } from "./providers";
import { post } from "@/lib/client";

interface AgentItem {
  priority: 1 | 2 | 3;
  title: string;
  detail: string;
  source: string;
  href?: string;
}

interface Briefing {
  ok: boolean;
  headline: string;
  items: AgentItem[];
  steps: Array<{ tool: string; args: Record<string, unknown> }>;
  notes: string[];
  model: string;
  engine: string;
  cached: boolean;
  createdAt: string;
}

const PRIORITY = {
  1: { label: "Now", tone: "red" as const, edge: "border-l-red-500" },
  2: { label: "Today", tone: "amber" as const, edge: "border-l-amber-500" },
  3: { label: "FYI", tone: "grey" as const, edge: "border-l-ink-300" },
};

/** Questions worth one tap, drawn from what the tools can actually answer. */
const QUICK = [
  "What should I do first?",
  "What can I not fill this week?",
  "What should I order in?",
];

/**
 * The shift briefing.
 *
 * The rest of the AI here reads one document when asked. This panel asks an
 * agent to go and look: it queries the order queue, the shelf, the
 * verification queue and the repeat schedule itself, then comes back with a
 * ranked list of what actually needs a person.
 *
 * Every line names the tool it came from, and the panel shows exactly which
 * look-ups ran — because a briefing you cannot audit is just a rumour with a
 * nice font.
 */
export function AiBriefing({ role }: { role: "pharmacy" | "pharmacist" }) {
  const { toast } = useApp();
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [busy, setBusy] = useState(false);
  const [asked, setAsked] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [showSteps, setShowSteps] = useState(false);

  const run = useCallback(
    async (q?: string, force = false) => {
      setBusy(true);
      setAsked(q ?? null);
      try {
        const res = await post<{ briefing: Briefing }>("/api/ai/agent", {
          question: q,
          force,
        });
        setBriefing(res.briefing);
        if (!res.briefing.ok) {
          toast({
            kind: "info",
            title: "The assistant could not finish",
            body: res.briefing.notes[0],
          });
        }
      } catch (e) {
        toast({ kind: "error", title: "Assistant unavailable", body: (e as Error).message });
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );

  // One briefing when the desk is opened; after that it is on request, because
  // every run costs tokens on a metered account.
  useEffect(() => {
    void run();
  }, [run]);

  const urgent = briefing?.items.filter((i) => i.priority === 1).length ?? 0;

  return (
    <section className="mb-3 overflow-hidden rounded-xl border border-care-200 bg-care-50">
      <div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5">
        <Sparkles size={16} className="shrink-0 text-care-700" />
        <p className="text-[13px] font-extrabold text-care-800">
          {role === "pharmacy" ? "Shift briefing" : "Desk briefing"}
        </p>
        {urgent > 0 && <Pill tone="red">{urgent} need you now</Pill>}
        <p className="min-w-0 flex-1 text-[11.5px] text-care-700/80">
          Looks at your queue, shelf and schedule. It reports — it changes nothing.
          {briefing?.ok && (
            <span className="ml-1 text-care-700/60">
              {briefing.cached ? "Last briefing" : "Fresh"} · {briefing.engine}
            </span>
          )}
        </p>
        <button
          onClick={() => run(asked ?? undefined, true)}
          disabled={busy}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-care-300 bg-white px-2.5 text-[12px] font-bold text-care-800 hover:bg-care-100 disabled:opacity-50"
        >
          <RefreshCcw size={13} className={busy ? "animate-spin" : ""} />
          {busy ? "Looking…" : "Refresh"}
        </button>
      </div>

      <div className="border-t border-care-200 bg-white px-3.5 py-3">
        {busy && !briefing ? (
          <div className="space-y-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-11 animate-pulse rounded-lg bg-ink-100" />
            ))}
          </div>
        ) : !briefing?.ok ? (
          <p className="text-[13px] text-ink-600">
            {briefing?.notes[0] ?? "No briefing yet."}
          </p>
        ) : briefing.items.length === 0 ? (
          <p className="text-[13px] font-semibold text-ok-700">
            {briefing.headline || "Nothing needs you right now."}
          </p>
        ) : (
          <>
            {briefing.headline && (
              <p className="mb-2 text-[13px] font-bold text-ink-900">{briefing.headline}</p>
            )}
            <ul className="space-y-1.5">
              {briefing.items.map((item, i) => {
                const p = PRIORITY[item.priority] ?? PRIORITY[3];
                const body = (
                  <>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Pill tone={p.tone}>{p.label}</Pill>
                      <span className="text-[13.5px] font-bold text-ink-900">{item.title}</span>
                    </div>
                    {item.detail && (
                      <p className="mt-0.5 text-[12px] leading-snug text-ink-600">{item.detail}</p>
                    )}
                    <p className="mt-1 font-mono text-[10px] text-ink-400">{item.source}</p>
                  </>
                );
                return (
                  <li
                    key={i}
                    className={clsx("rounded-lg border border-l-4 border-ink-200 p-2.5", p.edge)}
                  >
                    {item.href ? (
                      <Link href={item.href} className="block hover:opacity-80">
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {/* ------------------------------ ask ---------------------------- */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (question.trim()) void run(question.trim());
          }}
          className="mt-3 flex gap-2"
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about your queue, shelf or schedule…"
            className="h-9 min-w-0 flex-1 rounded-md border border-ink-200 px-2.5 text-[13px] outline-none focus:border-care-400"
          />
          <ActionButton loading={busy} icon={<Send size={13} />}>
            Ask
          </ActionButton>
        </form>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <button
              key={q}
              onClick={() => {
                setQuestion(q);
                void run(q);
              }}
              disabled={busy}
              className="rounded-full border border-ink-200 px-2.5 py-1 text-[11.5px] font-semibold text-ink-600 hover:border-care-300 hover:bg-care-50 disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>

        {/* --------------------------- audit ----------------------------- */}
        {briefing && briefing.steps.length > 0 && (
          <>
            <button
              onClick={() => setShowSteps((s) => !s)}
              className="mt-2.5 inline-flex items-center gap-1 text-[11.5px] font-bold text-ink-500 hover:text-ink-800"
            >
              <ChevronDown
                size={13}
                className={clsx("transition-transform", showSteps && "rotate-180")}
              />
              What it looked at ({briefing.steps.length})
            </button>
            {showSteps && (
              <ul className="mt-1.5 space-y-0.5 rounded-lg bg-ink-900 p-2.5">
                {briefing.steps.map((s, i) => (
                  <li key={i} className="font-mono text-[11px] text-white/75">
                    {s.tool}({JSON.stringify(s.args)})
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {briefing?.notes.length ? (
          <ul className="mt-1.5">
            {briefing.notes.map((n, i) => (
              <li key={i} className="text-[11px] text-ink-400">
                {n}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
