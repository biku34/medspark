"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Clock3, CornerDownLeft, Search, TrendingUp, X } from "lucide-react";
import { CategoryArt, ProductArt, ServiceArt, paletteFor } from "./art";
import { useApp } from "./providers";
import { api } from "@/lib/client";
import { SHELF_CATEGORIES } from "@/lib/shelf";
import { matchServices, type ServiceHit } from "@/lib/service-search";
import type { MedicineSearchResult } from "@/lib/types";
import { inr } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* recent searches                                                            */
/* -------------------------------------------------------------------------- */

const RECENT_KEY = "dawaquick.recentSearches";
const MAX_RECENT = 6;

function readRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function pushRecent(term: string): string[] {
  const t = term.trim();
  if (!t) return readRecent();
  const next = [t, ...readRecent().filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(
    0,
    MAX_RECENT,
  );
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* private mode — recents just do not persist */
  }
  return next;
}

/** What people in a pharmacy actually reach for, not a keyword-stuffed list. */
const POPULAR = [
  "Paracetamol",
  "Cough syrup",
  "Sanitary pads",
  "BP monitor",
  "ORS",
  "Vitamin D",
  "Physiotherapy",
];

/* -------------------------------------------------------------------------- */
/* the suggestion panel                                                       */
/* -------------------------------------------------------------------------- */

interface Row {
  key: string;
  href: string;
  kind: "service" | "category" | "medicine" | "term";
  label: string;
}

/**
 * Instant search.
 *
 * A pharmacy search box is not a catalogue filter — it is somebody standing at
 * a counter saying a word. So results appear while they type, and they are
 * grouped by the kind of thing the word turned out to mean: a home visit, an
 * aisle, or a product. ℞ items are marked in the list itself, because finding
 * out at checkout that a medicine needs a prescription is a wasted trip.
 */
export function SearchSuggest({ className }: { className?: string }) {
  const router = useRouter();
  const { geoQuery } = useApp();

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<MedicineSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  const [hint, setHint] = useState(0);

  const boxRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setRecent(readRecent()), []);

  // The placeholder cycles only while the box is idle and empty.
  useEffect(() => {
    if (open || q) return;
    const t = setInterval(() => setHint((h) => (h + 1) % POPULAR.length), 2600);
    return () => clearInterval(t);
  }, [open, q]);

  /* ---------------------------- fetch on type --------------------------- */
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = setTimeout(() => {
      api<{ results: MedicineSearchResult[] }>(
        `/api/medicines?q=${encodeURIComponent(term)}&limit=6&${geoQuery}`,
      )
        .then((d) => setResults(d.results.slice(0, 6)))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 180);
    return () => clearTimeout(id);
  }, [q, geoQuery]);

  /* --------------------------- close on outside -------------------------- */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const term = q.trim();
  const services: ServiceHit[] = term.length >= 3 ? matchServices(term) : [];
  const categories =
    term.length >= 2
      ? SHELF_CATEGORIES.filter(
          (c) =>
            c.name.toLowerCase().includes(term.toLowerCase()) ||
            c.blurb.toLowerCase().includes(term.toLowerCase()),
        ).slice(0, 3)
      : [];

  /* Flattened for keyboard navigation, in the order they are painted. */
  const rows: Row[] = [
    ...services.map((s) => ({
      key: `s-${s.type}`,
      href: `/services/${s.slug}`,
      kind: "service" as const,
      label: s.label,
    })),
    ...categories.map((c) => ({
      key: `c-${c.id}`,
      href: `/category/wellness?sub=${c.id}`,
      kind: "category" as const,
      label: c.name,
    })),
    ...results.map((r) => ({
      key: `m-${r.medicine.id}`,
      href: `/medicine/${r.medicine.id}`,
      kind: "medicine" as const,
      label: r.medicine.name,
    })),
  ];

  const go = useCallback(
    (href: string, label: string) => {
      setRecent(pushRecent(label));
      setOpen(false);
      setActive(-1);
      inputRef.current?.blur();
      router.push(href);
    },
    [router],
  );

  const submit = (value: string) => {
    const v = value.trim();
    if (!v) return;
    setRecent(pushRecent(v));
    setOpen(false);
    setActive(-1);
    inputRef.current?.blur();
    router.push(`/search?q=${encodeURIComponent(v)}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, rows.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[active];
      if (row) go(row.href, row.label);
      else submit(q);
    }
  };

  const showPanel = open;
  const showSuggestions = term.length >= 2;

  return (
    <div ref={boxRef} className={clsx("relative", className)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(q);
        }}
        role="search"
      >
        <Search
          size={18}
          strokeWidth={2.6}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500"
        />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          aria-label="Search medicines, categories and home visits"
          aria-expanded={showPanel}
          aria-autocomplete="list"
          role="combobox"
          className="h-12 w-full rounded-xl border border-ink-200 bg-white pl-11 pr-10 text-[15px] font-medium text-ink-900 shadow-sm outline-none placeholder:text-transparent focus:border-brand-400"
        />

        {q === "" && !open && (
          <span className="pointer-events-none absolute left-11 top-1/2 flex -translate-y-1/2 items-baseline gap-1 text-[15px] text-ink-500">
            Search
            <span key={hint} className="rise font-semibold text-ink-700">
              &ldquo;{POPULAR[hint]}&rdquo;
            </span>
          </span>
        )}

        {q !== "" && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setResults([]);
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          >
            <X size={16} strokeWidth={2.6} />
          </button>
        )}
      </form>

      {showPanel && (
        <div className="absolute inset-x-0 top-full z-50 mt-1.5 max-h-[70vh] overflow-y-auto overscroll-contain rounded-xl border border-ink-200 bg-white py-1.5 shadow-2xl shadow-ink-900/15">
          {/* ---------------------- idle: recents + popular ---------------- */}
          {!showSuggestions && (
            <>
              {recent.length > 0 && (
                <Group title="Recent">
                  {recent.map((r) => (
                    <button
                      key={r}
                      onClick={() => {
                        setQ(r);
                        submit(r);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-ink-50"
                    >
                      <Clock3 size={15} className="shrink-0 text-ink-400" />
                      <span className="min-w-0 flex-1 truncate text-[14px] text-ink-800">{r}</span>
                    </button>
                  ))}
                </Group>
              )}

              <Group title="Popular right now">
                <div className="flex flex-wrap gap-1.5 px-3 pb-1 pt-0.5">
                  {POPULAR.map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        setQ(p);
                        submit(p);
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-ink-200 px-2.5 py-1.5 text-[12.5px] font-semibold text-ink-700 hover:border-brand-300 hover:bg-brand-50"
                    >
                      <TrendingUp size={11} className="text-brand-600" />
                      {p}
                    </button>
                  ))}
                </div>
              </Group>
            </>
          )}

          {/* ------------------------- live results ------------------------ */}
          {showSuggestions && (
            <>
              {services.length > 0 && (
                <Group title="Home visits">
                  {services.map((s, i) => {
                    const art = s.type === "PHYSIO" ? "physio" : "nursing";
                    return (
                      <Row
                        key={s.type}
                        activeRow={rows[active]?.key === `s-${s.type}`}
                        href={`/services/${s.slug}`}
                        onPick={() => go(`/services/${s.slug}`, s.label)}
                        art={<ServiceArt kind={art} size={30} />}
                        title={s.label}
                        sub="Book a verified professional at home"
                        index={i}
                      />
                    );
                  })}
                </Group>
              )}

              {categories.length > 0 && (
                <Group title="Categories">
                  {categories.map((c) => (
                    <Row
                      key={c.id}
                      activeRow={rows[active]?.key === `c-${c.id}`}
                      href={`/category/wellness?sub=${c.id}`}
                      onPick={() => go(`/category/wellness?sub=${c.id}`, c.name)}
                      art={<CategoryArt id={c.id} size={28} />}
                      wellColor={paletteFor(c.id).well}
                      title={c.name}
                      sub={c.blurb}
                    />
                  ))}
                </Group>
              )}

              <Group title="Products">
                {loading && results.length === 0 ? (
                  <div className="space-y-1.5 px-3 py-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-10 animate-pulse rounded-lg bg-ink-100" />
                    ))}
                  </div>
                ) : results.length === 0 ? (
                  <p className="px-3 py-2 text-[13px] text-ink-500">
                    Nothing matching &ldquo;{term}&rdquo; nearby.
                  </p>
                ) : (
                  results.map((r) => {
                    const m = r.medicine;
                    return (
                      <Row
                        key={m.id}
                        activeRow={rows[active]?.key === `m-${m.id}`}
                        href={`/medicine/${m.id}`}
                        onPick={() => go(`/medicine/${m.id}`, m.name)}
                        art={<ProductArt subcategory={m.subcategory} form={m.form} size={30} />}
                        wellColor={paletteFor(m.subcategory).well}
                        title={m.name}
                        sub={m.packLabel}
                        rx={m.type === "RX"}
                        right={
                          r.available ? (
                            <span className="nums text-right">
                              <span className="block text-[13.5px] font-extrabold text-ink-900">
                                {inr(r.minPrice ?? m.mrp)}
                              </span>
                              {r.fastestEta !== null && (
                                <span className="block text-[10px] font-bold text-brand-700">
                                  {r.fastestEta} min
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-ink-400">
                              Out of stock
                            </span>
                          )
                        }
                      />
                    );
                  })
                )}
              </Group>

              <button
                onClick={() => submit(q)}
                className="mt-1 flex w-full items-center gap-2 border-t border-ink-100 px-3 py-2.5 text-left hover:bg-ink-50"
              >
                <Search size={15} className="shrink-0 text-brand-600" />
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink-800">
                  See all results for &ldquo;{term}&rdquo;
                </span>
                <CornerDownLeft size={14} className="shrink-0 text-ink-400" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* pieces                                                                     */
/* -------------------------------------------------------------------------- */

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-0.5">
      <p className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-ink-400">
        {title}
      </p>
      {children}
    </div>
  );
}

function Row({
  href,
  onPick,
  art,
  wellColor,
  title,
  sub,
  right,
  rx,
  activeRow,
}: {
  href: string;
  onPick: () => void;
  art: React.ReactNode;
  wellColor?: string;
  title: string;
  sub?: string;
  right?: React.ReactNode;
  rx?: boolean;
  activeRow?: boolean;
  index?: number;
}) {
  return (
    <Link
      href={href}
      onClick={(e) => {
        e.preventDefault();
        onPick();
      }}
      className={clsx(
        "flex items-center gap-2.5 px-3 py-2 transition-colors",
        activeRow ? "bg-brand-50" : "hover:bg-ink-50",
      )}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ background: wellColor ?? "var(--color-ink-100)" }}
      >
        {art}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-semibold text-ink-900">{title}</span>
          {rx && (
            <span className="shrink-0 rounded bg-rx-100 px-1 py-px text-[9px] font-extrabold text-rx-700">
              ℞
            </span>
          )}
        </span>
        {sub && <span className="block truncate text-[11.5px] text-ink-500">{sub}</span>}
      </span>
      {right}
    </Link>
  );
}
