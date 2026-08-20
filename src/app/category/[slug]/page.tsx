"use client";

import { Suspense, use, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Leaf, LayoutGrid, Pill, Search, Stethoscope } from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { ProductCard, ProductGrid } from "@/components/product-card";
import { ComplianceNote } from "@/components/brand";
import { useApp } from "@/components/providers";
import { Badge, EmptyState, Input, SectionTitle, Skeleton } from "@/components/ui";
import { api } from "@/lib/client";
import { SHELF_CATEGORIES, shelfCategory } from "@/lib/shelf";
import { CategoryArt, paletteFor } from "@/components/art";
import type { MedicineSearchResult } from "@/lib/types";

const META: Record<
  string,
  { title: string; subtitle: string; icon: typeof Pill; tone: string; rx?: boolean; shelf?: boolean }
> = {
  otc: {
    title: "OTC Medicines",
    subtitle: "Over-the-counter medicines you can order without a prescription.",
    icon: Pill,
    tone: "bg-ok-50 text-ok-700",
  },
  prescription: {
    title: "Prescription Medicines",
    subtitle:
      "These require a valid prescription verified by a registered pharmacist before any pharmacy can dispense them.",
    icon: Stethoscope,
    tone: "bg-amber-50 text-amber-700",
    rx: true,
  },
  wellness: {
    title: "Health & Wellness",
    subtitle: "Everything your local pharmacy can deliver — pick a category to start.",
    icon: Leaf,
    tone: "bg-sky-50 text-sky-700",
    shelf: true,
  },
};

function CategoryInner({ slug }: { slug: string }) {
  const meta = META[slug];
  const router = useRouter();
  const params = useSearchParams();
  const sub = params.get("sub") ?? "";
  const { geoQuery, origin } = useApp();

  const [results, setResults] = useState<MedicineSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  /**
   * The whole shelf is fetched once and grouped in the browser, so switching
   * category is instant and the tiles can show real counts and availability.
   */
  useEffect(() => {
    if (!meta) return;
    setLoading(true);
    const query = meta.shelf
      ? `/api/medicines?q=&shelf=1&limit=400&${geoQuery}`
      : `/api/medicines?q=&category=${slug}&limit=200&${geoQuery}`;
    api<{ results: MedicineSearchResult[] }>(query)
      .then((d) => setResults(d.results))
      .finally(() => setLoading(false));
  }, [slug, meta, geoQuery]);

  /** Counts per shelf category, used on the tiles. */
  const grouped = useMemo(() => {
    const map = new Map<string, MedicineSearchResult[]>();
    for (const r of results) {
      const key = r.medicine.subcategory;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return map;
  }, [results]);

  if (!meta) {
    return (
      <CustomerShell>
        <EmptyState
          title="Unknown category"
          body="Pick a category from the home page."
        />
      </CustomerShell>
    );
  }

  const Icon = meta.icon;
  const active = sub ? shelfCategory(sub) : undefined;

  const goto = (id: string) =>
    router.push(id ? `/category/${slug}?sub=${id}` : `/category/${slug}`);

  /* ---------------------------------------------------------------------- */
  /* Shelf browsing: categories first, then the items inside one            */
  /* ---------------------------------------------------------------------- */
  if (meta.shelf) {
    const items = active ? (grouped.get(active.id) ?? []) : [];
    const shown = filter
      ? items.filter((r) =>
          `${r.medicine.name} ${r.medicine.brand} ${r.medicine.description}`
            .toLowerCase()
            .includes(filter.toLowerCase()),
        )
      : items;

    /* ----------------------------- tile grid ---------------------------- */
    if (!active) {
      return (
        <CustomerShell wide>
          <div className="flex items-start gap-3.5">
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${meta.tone}`}
            >
              <Icon size={24} />
            </span>
            <SectionTitle title={meta.title} subtitle={meta.subtitle} />
          </div>

          <p className="mb-4 text-sm text-ink-500">
            Delivered from verified pharmacies near{" "}
            <strong className="text-ink-700">{origin.locality}</strong>.
          </p>

          {loading ? (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-36" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5">
              {SHELF_CATEGORIES.map((c) => {
                const list = grouped.get(c.id) ?? [];
                const inStock = list.filter((r) => r.available).length;
                return (
                  <button
                    key={c.id}
                    onClick={() => goto(c.id)}
                    className="group flex flex-col text-left"
                  >
                    <span
                      className="flex aspect-[4/3] items-center justify-center rounded-xl transition-transform group-hover:-translate-y-0.5 group-active:scale-95"
                      style={{ background: paletteFor(c.id).well }}
                    >
                      <CategoryArt id={c.id} className="h-auto w-[44%]" />
                    </span>
                    <span className="mt-1.5 text-[13px] font-extrabold leading-tight text-ink-900">
                      {c.name}
                    </span>
                    <span className="nums mt-0.5 text-[11px] font-semibold text-ink-500">
                      {list.length} item{list.length === 1 ? "" : "s"}
                      {list.length > 0 && (
                        <span className={inStock ? "text-brand-700" : "text-ink-400"}>
                          {" "}
                          · {inStock} in stock
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <p className="mt-6 rounded-xl border border-ink-200 bg-white p-3.5 text-[12px] leading-relaxed text-ink-500">
            <strong className="font-extrabold text-ink-700">
              Prescription medicines are not on these shelves.
            </strong>{" "}
            They take a different route — upload your prescription and a registered pharmacist
            verifies it before any pharmacy can dispense.
          </p>
        </CustomerShell>
      );
    }

    /* --------------------------- items in a tile ------------------------- */
    return (
      <CustomerShell wide>
        <button
          onClick={() => goto("")}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft size={16} /> All categories
        </button>

        <div className="flex items-start gap-3.5">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: paletteFor(active.id).well }}
          >
            <CategoryArt id={active.id} size={40} />
          </span>
          <SectionTitle
            title={active.name}
            subtitle={`${items.length} product${items.length === 1 ? "" : "s"} · ${active.blurb}`}
          />
        </div>

        {/* category rail — chips on phones, sidebar on desktop */}
        <div className="mt-2 grid gap-4 lg:grid-cols-[210px_minmax(0,1fr)]">
          <div className="min-w-0">
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:sticky lg:top-24 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
              <button
                onClick={() => goto("")}
                className="flex shrink-0 items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50 lg:w-full"
              >
                <LayoutGrid size={15} /> All categories
              </button>
              {SHELF_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => goto(c.id)}
                  className={
                    "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-medium transition-colors lg:w-full lg:whitespace-normal lg:text-left " +
                    (c.id === active.id
                      ? "border-brand-500 bg-brand-50 text-brand-800"
                      : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50")
                  }
                >
                  <CategoryArt id={c.id} size={20} className="shrink-0" />
                  <span className="min-w-0 lg:truncate">{c.name}</span>
                  <span className="ml-auto hidden text-xs text-ink-400 lg:inline">
                    {(grouped.get(c.id) ?? []).length}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="min-w-0">
            <div className="relative mb-3">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
              />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={`Search in ${active.name}…`}
                className="pl-9"
              />
            </div>

            {loading ? (
              <ProductGrid>
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-64" />
                ))}
              </ProductGrid>
            ) : shown.length === 0 ? (
              <EmptyState
                title={filter ? "Nothing matches that search" : "No products here yet"}
                body="Try another category, or search the full catalogue."
              />
            ) : (
              <ProductGrid>
                {shown.map((r) => (
                  <ProductCard key={r.medicine.id} result={r} />
                ))}
              </ProductGrid>
            )}
          </div>
        </div>
      </CustomerShell>
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Plain list (OTC / prescription) — unchanged behaviour                  */
  /* ---------------------------------------------------------------------- */
  return (
    <CustomerShell wide>
      <div className="flex items-start gap-3.5">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${meta.tone}`}
        >
          <Icon size={24} />
        </span>
        <SectionTitle title={meta.title} subtitle={meta.subtitle} />
      </div>

      {meta.rx && <ComplianceNote className="mb-4" />}

      {!loading && results.length > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <Badge tone="slate">{results.length} products</Badge>
          <Badge tone="green">{results.filter((r) => r.available).length} available nearby</Badge>
        </div>
      )}

      <ProductGrid>
        {loading
          ? Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-64" />)
          : results.map((r) => <ProductCard key={r.medicine.id} result={r} />)}
      </ProductGrid>

      {!loading && results.length === 0 && (
        <EmptyState title="Nothing in this category yet" body="Check back shortly." />
      )}
    </CustomerShell>
  );
}

export default function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return (
    <Suspense
      fallback={
        <CustomerShell wide>
          <Skeleton className="h-64" />
        </CustomerShell>
      }
    >
      <CategoryInner slug={slug} />
    </Suspense>
  );
}
