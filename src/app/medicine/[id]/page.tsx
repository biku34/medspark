"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { ArrowLeft, BellRing, Clock3, Info, MapPin, ShieldAlert, Store, Upload } from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { ComplianceNote } from "@/components/brand";
import { useApp } from "@/components/providers";
import { Badge, Button, Card, EmptyState, KeyValue, QtyStepper, RxBadge, Skeleton } from "@/components/ui";
import { api, post } from "@/lib/client";
import type { MedicineSearchResult } from "@/lib/types";
import { inr } from "@/lib/utils";

export default function MedicinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { addToCart, toast, user, geoQuery } = useApp();
  const [data, setData] = useState<MedicineSearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [notified, setNotified] = useState(false);

  useEffect(() => {
    api<MedicineSearchResult>(`/api/medicines/${id}?${geoQuery}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id, geoQuery]);

  if (loading) {
    return (
      <CustomerShell>
        <Skeleton className="h-64" />
      </CustomerShell>
    );
  }
  if (!data) {
    return (
      <CustomerShell>
        <EmptyState title="Medicine not found" action={<Link href="/search">Back to search</Link>} />
      </CustomerShell>
    );
  }

  const { medicine: m, available, pharmacyCount, minPrice, maxPrice, nearestKm, fastestEta } = data;
  const price = minPrice ?? m.mrp;

  return (
    <CustomerShell>
      <button
        onClick={() => router.back()}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <Card>
        <div className="flex gap-4">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-ink-50 text-4xl">
            {m.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold leading-tight text-ink-900">{m.name}</h1>
            <p className="mt-1 text-sm text-ink-500">
              {m.brand} · {m.form} · {m.strength}
            </p>
            <p className="text-sm text-ink-400">by {m.manufacturer}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <RxBadge type={m.type} />
              {m.requiresColdChain && <Badge tone="blue">❄ Cold chain</Badge>}
              {m.restricted && (
                <Badge tone="red" icon={<ShieldAlert size={12} />}>
                  Restricted drug
                </Badge>
              )}
              {available ? <Badge tone="green">Available nearby</Badge> : <Badge tone="slate">Unavailable</Badge>}
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-ink-100 pt-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-bold text-ink-900">{inr(price)}</p>
              <p className="text-xs text-ink-400">
                per {m.packLabel}
                {maxPrice && maxPrice !== minPrice && ` · up to ${inr(maxPrice)} at other pharmacies`}
              </p>
            </div>
            {available && (
              <div className="text-right text-xs text-ink-500">
                <p className="flex items-center justify-end gap-1">
                  <Store size={12} /> {pharmacyCount} pharmacies
                </p>
                {nearestKm !== null && (
                  <p className="flex items-center justify-end gap-1">
                    <MapPin size={12} /> nearest {nearestKm} km
                  </p>
                )}
                {fastestEta !== null && (
                  <p className="flex items-center justify-end gap-1">
                    <Clock3 size={12} /> from {fastestEta} min
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* --------------------------- actions ---------------------------- */}
        <div className="mt-4">
          {m.restricted ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <strong>Not available through DawaQuick.</strong> This medicine is a scheduled /
              habit-forming drug. It can only be dispensed in person by a pharmacist against a
              valid original prescription, with the record-keeping the law requires.
            </div>
          ) : !available ? (
            <div className="space-y-2.5">
              <p className="font-medium text-ink-800">Currently unavailable in nearby pharmacies.</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  icon={<BellRing size={16} />}
                  disabled={notified}
                  onClick={async () => {
                    if (!user) return toast({ kind: "info", title: "Sign in to get notified" });
                    await post("/api/stock-alerts", { medicineId: m.id });
                    setNotified(true);
                    toast({ kind: "success", title: "We'll notify you when it's back" });
                  }}
                >
                  {notified ? "You'll be notified" : "Notify me when available"}
                </Button>
                <Button variant="outline" onClick={() => router.push("/search")}>
                  Search another medicine
                </Button>
              </div>
            </div>
          ) : m.type === "RX" ? (
            <div className="space-y-3">
              <ComplianceNote variant="short" />
              <Button
                size="lg"
                full
                icon={<Upload size={18} />}
                onClick={() => router.push("/prescriptions/upload")}
              >
                Upload prescription to order
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <QtyStepper value={qty} onChange={setQty} />
              <Button
                size="lg"
                className="flex-1"
                onClick={() => {
                  addToCart(
                    {
                      medicineId: m.id,
                      name: m.name,
                      strength: m.strength,
                      form: m.form,
                      type: m.type,
                      emoji: m.emoji,
                      price,
                    },
                    qty,
                  );
                  toast({ kind: "success", title: `${qty} × ${m.name} added` });
                  router.push("/cart");
                }}
              >
                Add to Cart · {inr(price * qty)}
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Card className="mt-4">
        <h2 className="mb-2 flex items-center gap-2 font-semibold text-ink-900">
          <Info size={16} className="text-ink-400" /> About this medicine
        </h2>
        <p className="text-sm leading-relaxed text-ink-600">{m.description}</p>
        <div className="mt-3 divide-y divide-ink-100">
          <KeyValue label="Generic / salt" value={m.genericName} />
          <KeyValue label="Strength" value={m.strength} />
          <KeyValue label="Dosage form" value={m.form} />
          <KeyValue label="Pack" value={m.packLabel} />
          <KeyValue label="Typical usage" value={m.usage} />
          <KeyValue
            label="Classification"
            value={m.type === "OTC" ? "Over the counter" : "Prescription only (℞)"}
          />
        </div>
        <p className="mt-3 rounded-xl bg-ink-50 p-3 text-xs text-ink-500">
          Information shown is indicative and for demonstration only. Always follow your
          doctor&apos;s advice and the pack insert. DawaQuick does not provide medical advice.
        </p>
      </Card>
    </CustomerShell>
  );
}
