"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Store } from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { PharmacyOfferCard } from "@/components/pharmacy-card";
import { useApp } from "@/components/providers";
import { Badge, EmptyState, SectionTitle, Skeleton } from "@/components/ui";
import { api } from "@/lib/client";
import type { PharmacyOffer } from "@/lib/types";
import type { SortKey } from "@/lib/services";

const SORTS: Array<{ id: SortKey; label: string }> = [
  { id: "fastest", label: "Fastest delivery" },
  { id: "nearest", label: "Nearest pharmacy" },
  { id: "cheapest", label: "Lowest total price" },
  { id: "rating", label: "Highest rated" },
];

/**
 * Pharmacy choice screen — the heart of the platform.
 * DawaQuick ranks, the customer decides.
 */
export default function SelectPharmacyPage() {
  const { cart, location, origin, activePrescriptionId, geoQuery } = useApp();
  const router = useRouter();
  const [sort, setSort] = useState<SortKey>("fastest");
  const [offers, setOffers] = useState<PharmacyOffer[]>([]);
  const [loading, setLoading] = useState(true);

  const itemsParam = useMemo(
    () => cart.map((l) => `${l.medicineId}:${l.qty}`).join(","),
    [cart],
  );

  useEffect(() => {
    if (!itemsParam) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api<{ offers: PharmacyOffer[] }>(`/api/pharmacies?items=${itemsParam}&sort=${sort}&${geoQuery}`)
      .then((d) => setOffers(d.offers))
      .finally(() => setLoading(false));
  }, [itemsParam, sort, geoQuery]);

  if (!cart.length) {
    return (
      <CustomerShell>
        <EmptyState
          title="Nothing to fulfil yet"
          body="Add a medicine to your cart first."
          action={<button onClick={() => router.push("/search")}>Search medicines</button>}
        />
      </CustomerShell>
    );
  }

  const fullMatches = offers.filter((o) => o.allAvailable);
  const partial = offers.filter((o) => !o.allAvailable);

  return (
    <CustomerShell wide>
      <button
        onClick={() => router.back()}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900"
      >
        <ArrowLeft size={16} /> Back to cart
      </button>

      <SectionTitle
        title="Choose your pharmacy"
        subtitle={`${fullMatches.length} verified ${
          fullMatches.length === 1 ? "pharmacy has" : "pharmacies have"
        } everything in your cart${location ? ` near ${location.locality}` : ""}.`}
      />

      {activePrescriptionId && (
        <div className="mb-3">
          <Badge tone="green">Prescription verified ✓ — fulfilment unlocked</Badge>
        </div>
      )}

      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">
        <span className="shrink-0 self-center pr-1 text-xs font-medium text-ink-400">Sort by</span>
        {SORTS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSort(s.id)}
            className={
              "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors " +
              (sort === s.id
                ? "bg-ink-900 text-white"
                : "border border-ink-200 bg-white text-ink-600 hover:bg-ink-50")
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {fullMatches.map((o) => (
              <PharmacyOfferCard
                key={o.pharmacy.id}
                offer={o}
                onChoose={() => router.push(`/checkout?pharmacy=${o.pharmacy.id}`)}
              />
            ))}
          </div>

          {fullMatches.length === 0 && (
            <EmptyState
              icon={<Store size={38} />}
              title="No nearby pharmacy has your full cart right now"
              body="Try removing an item, or set “Notify me” on the medicine that's out of stock."
            />
          )}

          {partial.length > 0 && (
            <>
              <p className="mb-2 mt-6 text-sm font-semibold text-ink-600">
                Partially available nearby
              </p>
              <div className="grid gap-3 opacity-90 lg:grid-cols-2">
                {partial.map((o) => (
                  <PharmacyOfferCard key={o.pharmacy.id} offer={o} onChoose={() => {}} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      <p className="mt-6 rounded-2xl bg-ink-100 p-4 text-xs text-ink-500">
        DawaQuick never auto-assigns a pharmacy. You compare distance, delivery time, price and
        rating, and pick the local chemist you trust.
      </p>
    </CustomerShell>
  );
}
