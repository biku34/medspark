"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, PackageSearch, Search, SlidersHorizontal } from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import Link from "next/link";
import { SERVICE_PALETTE, ServiceArt } from "@/components/art";
import { ProductCard, ProductGrid } from "@/components/product-card";
import { useApp } from "@/components/providers";
import { Button, EmptyState, Input, Skeleton } from "@/components/ui";
import { api } from "@/lib/client";
import { matchServices } from "@/lib/service-search";
import type { MedicineSearchResult } from "@/lib/types";

const SUGGESTED = [
  "Paracetamol 650",
  "Cetirizine",
  "Physiotherapy",
  "Nurse at home",
  "Cough syrup",
  "Thermometer",
  "Sanitary pads",
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

  // A pharmacy search box is where people ask for a nurse too.
  const serviceHits = matchServices(initial);

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

      {serviceHits.length > 0 && (
        <section className="mt-4">
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-ink-400">
            Home visits
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {serviceHits.map((s) => {
              const art = s.type === "PHYSIO" ? "physio" : "nursing";
              const pal = SERVICE_PALETTE[art];
              return (
                <Link
                  key={s.type}
                  href={`/services/${s.slug}`}
                  className="flex items-center gap-3 rounded-2xl p-3.5 ring-1 transition-transform active:scale-[0.99]"
                  style={{ background: pal.well, boxShadow: `inset 0 0 0 1px ${pal.pop}` }}
                >
                  <ServiceArt kind={art} size={44} className="shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span
                      className="block text-[15px] font-extrabold leading-tight"
                      style={{ color: pal.deep }}
                    >
                      {s.label}
                    </span>
                    <span className="block text-[12px] text-ink-600">
                      Book a verified professional to visit you at home
                    </span>
                  </span>
                  <ChevronRight size={18} strokeWidth={2.6} style={{ color: pal.base }} />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <p className="mt-4 text-sm text-ink-500">
        {loading
          ? `Checking stock at pharmacies near ${origin.locality}…`
          : `${filtered.length} ${filtered.length === 1 ? "result" : "results"}${initial ? ` for “${initial}”` : ""} near ${origin.locality}, ${origin.city}`}
      </p>

      <div className="mt-3">
        {loading ? (
          <ProductGrid>
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </ProductGrid>
        ) : (
          <ProductGrid>
            {filtered.map((r) => (
              <ProductCard key={r.medicine.id} result={r} />
            ))}
          </ProductGrid>
        )}
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
