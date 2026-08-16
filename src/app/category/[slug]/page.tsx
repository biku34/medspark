"use client";

import { use, useEffect, useState } from "react";
import { Leaf, Pill, Stethoscope } from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { MedicineCard } from "@/components/medicine-card";
import { ComplianceNote } from "@/components/brand";
import { useApp } from "@/components/providers";
import { EmptyState, SectionTitle, Skeleton } from "@/components/ui";
import { api } from "@/lib/client";
import type { MedicineSearchResult } from "@/lib/types";

const META: Record<
  string,
  { title: string; subtitle: string; icon: typeof Pill; tone: string; rx?: boolean }
> = {
  otc: {
    title: "OTC Medicines",
    subtitle: "Over-the-counter medicines you can order without a prescription.",
    icon: Pill,
    tone: "bg-emerald-50 text-emerald-700",
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
    subtitle: "Vitamins, supplements, devices and daily-care essentials.",
    icon: Leaf,
    tone: "bg-sky-50 text-sky-700",
  },
};

export default function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const meta = META[slug];
  const { geoQuery } = useApp();
  const [results, setResults] = useState<MedicineSearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!meta) return;
    setLoading(true);
    api<{ results: MedicineSearchResult[] }>(
      `/api/medicines?q=&category=${slug}&limit=60&${geoQuery}`,
    )
      .then((d) => setResults(d.results))
      .finally(() => setLoading(false));
  }, [slug, meta, geoQuery]);

  if (!meta) {
    return (
      <CustomerShell>
        <EmptyState title="Unknown category" body="Pick a category from the home page." />
      </CustomerShell>
    );
  }

  const Icon = meta.icon;

  return (
    <CustomerShell wide>
      <div className="flex items-start gap-3.5">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${meta.tone}`}>
          <Icon size={24} />
        </span>
        <div>
          <SectionTitle title={meta.title} subtitle={meta.subtitle} />
        </div>
      </div>

      {meta.rx && <ComplianceNote className="mb-4" />}

      <div className="grid gap-3 lg:grid-cols-2">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44" />)
          : results.map((r) => <MedicineCard key={r.medicine.id} result={r} />)}
      </div>

      {!loading && results.length === 0 && (
        <EmptyState title="Nothing in this category yet" body="Check back shortly." />
      )}
    </CustomerShell>
  );
}
