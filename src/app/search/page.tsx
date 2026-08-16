"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PackageSearch, Search, SlidersHorizontal } from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { MedicineCard } from "@/components/medicine-card";
import { useApp } from "@/components/providers";
import { Button, EmptyState, Input, Skeleton } from "@/components/ui";
import { api } from "@/lib/client";
import type { MedicineSearchResult } from "@/lib/types";

const SUGGESTED = [
  "Paracetamol 650",
  "Cetirizine",
  "ORS",
  "Cough syrup",
  "Vitamin C",
  "Thermometer",
  "Pantoprazole",
];

type Filter = "all" | "otc" | "prescription" | "wellness" | "available";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "available", label: "Available now" },
  { id: "otc", label: "OTC" },
  { id: "prescription", label: "Prescription" },
  { id: "wellness", label: "Wellness" },
];

function SearchInner() {
  const params = useSearchParams();
  const router = useRouter();
  const initial = params.get("q") ?? "";
  const { origin, geoQuery } = useApp();

  const [term, setTerm] = useState(initial);
  const [results, setResults] = useState<MedicineSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  const run = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        const data = await api<{ results: MedicineSearchResult[] }>(
          `/api/medicines?q=${encodeURIComponent(q)}&track=1&${geoQuery}`,
        );
        setResults(data.results);
      } finally {
        setLoading(false);
      }
    },
    [geoQuery],
  );

  useEffect(() => {
    setTerm(initial);
    void run(initial);
  }, [initial, run]);

  const filtered = results.filter((r) => {
    if (filter === "all") return true;
    if (filter === "available") return r.available;
    return r.medicine.category === filter;
  });

  return (
    <CustomerShell wide>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`/search?q=${encodeURIComponent(term.trim())}`);
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search
            size={18}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search medicines, health products..."
            className="pl-10"
            autoFocus={!initial}
            aria-label="Search medicines"
          />
        </div>
        <Button type="submit" size="md">
          Search
        </Button>
      </form>

      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
        <span className="flex shrink-0 items-center gap-1 pr-1 text-xs font-medium text-ink-400">
          <SlidersHorizontal size={13} />
        </span>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={
              "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors " +
              (filter === f.id
                ? "bg-ink-900 text-white"
                : "border border-ink-200 bg-white text-ink-600 hover:bg-ink-50")
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {!initial && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
            Try searching for
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED.map((s) => (
              <button
                key={s}
                onClick={() => router.push(`/search?q=${encodeURIComponent(s)}`)}
                className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-700 hover:border-brand-300 hover:bg-brand-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-sm text-ink-500">
        {loading
          ? `Checking stock at pharmacies near ${origin.locality}…`
          : `${filtered.length} ${filtered.length === 1 ? "result" : "results"}${initial ? ` for “${initial}”` : ""} near ${origin.locality}, ${origin.city}`}
      </p>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44" />)
          : filtered.map((r) => <MedicineCard key={r.medicine.id} result={r} />)}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="mt-4">
          <EmptyState
            icon={<PackageSearch size={40} />}
            title="No medicines matched that search"
            body="Try the salt name (e.g. “paracetamol”) or a shorter term. Availability is limited to verified pharmacies near your location."
            action={
              <Button variant="outline" onClick={() => router.push("/search")}>
                Search another medicine
              </Button>
            }
          />
        </div>
      )}
    </CustomerShell>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <CustomerShell wide>
          <Skeleton className="h-12" />
        </CustomerShell>
      }
    >
      <SearchInner />
    </Suspense>
  );
}
