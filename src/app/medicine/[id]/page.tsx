"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import {
  ArrowLeft,
  Bell,
  Clock3,
  Minus,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Store,
  Upload,
} from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { ComplianceNote } from "@/components/brand";
import { useApp } from "@/components/providers";
import { EmptyState, KeyValue, Skeleton } from "@/components/ui";
import { api, post } from "@/lib/client";
import type { MedicineSearchResult } from "@/lib/types";
import { inr } from "@/lib/utils";

export default function MedicinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { addToCart, setQty, cart, toast, user, geoQuery } = useApp();
  const [data, setData] = useState<MedicineSearchResult | null>(null);
  const [loading, setLoading] = useState(true);
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
        <Skeleton className="h-80" />
      </CustomerShell>
    );
  }
  if (!data) {
    return (
      <CustomerShell>
        <EmptyState title="Product not found" body="Try searching for it instead." />
      </CustomerShell>
    );
  }

  const { medicine: m, available, pharmacyCount, minPrice, nearestKm, fastestEta } = data;
  const price = minPrice ?? m.mrp;
  const hasDiscount = price < m.mrp;
  const off = hasDiscount ? Math.round(((m.mrp - price) / m.mrp) * 100) : 0;
  const line = cart.find((l) => l.medicineId === m.id);

  return (
    <CustomerShell>
      <button
        onClick={() => router.back()}
        className="mb-2 inline-flex items-center gap-1 text-[13px] font-semibold text-ink-600"
      >
        <ArrowLeft size={15} /> Back
      </button>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        {/* image */}
        <div className="img-well relative flex aspect-square items-center justify-center rounded-xl border border-ink-200">
          {hasDiscount && available && (
            <span className="absolute left-0 top-3 rounded-r-md bg-offer-600 px-2 py-1 text-[12px] font-extrabold text-white">
              {off}% OFF
            </span>
          )}
          <span className="text-7xl">{m.emoji}</span>
        </div>

        {/* buy box */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400">{m.brand}</p>
          <h1 className="mt-0.5 text-[20px] font-extrabold leading-tight text-ink-900">
            {m.name}
          </h1>
          <p className="mt-0.5 text-[13px] text-ink-500">
            {m.packLabel} · {m.form}
          </p>

          {available && (
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-semibold text-ink-600">
              <span className="flex items-center gap-1 text-brand-700">
                <Clock3 size={13} strokeWidth={3} /> {fastestEta} mins
              </span>
              <span className="flex items-center gap-1">
                <Store size={13} /> {pharmacyCount} pharmacies
              </span>
              {nearestKm !== null && <span>nearest {nearestKm} km</span>}
            </p>
          )}

          <div className="mt-3 flex items-end gap-2">
            <span className="text-[24px] font-extrabold leading-none text-ink-900">
              {inr(price)}
            </span>
            {hasDiscount && (
              <>
                <span className="text-[14px] text-ink-400 line-through">{inr(m.mrp)}</span>
                <span className="pb-0.5 text-[13px] font-bold text-brand-700">{off}% off</span>
              </>
            )}
          </div>
          <p className="text-[11px] text-ink-400">Inclusive of all taxes</p>

          {/* action */}
          <div className="mt-4">
            {m.restricted ? (
              <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-[13px] text-red-800">
                <p className="flex items-center gap-1.5 font-bold">
                  <ShieldAlert size={15} /> Not available for delivery
                </p>
                <p className="mt-1">
                  This is a scheduled / habit-forming drug. It can only be dispensed in person by a
                  pharmacist against a valid original prescription.
                </p>
              </div>
            ) : !available ? (
              <div className="space-y-2">
                <p className="text-[13px] font-bold text-red-600">
                  Out of stock at pharmacies near you
                </p>
                <button
                  disabled={notified}
                  onClick={async () => {
                    if (!user) return toast({ kind: "info", title: "Login to get notified" });
                    await post("/api/stock-alerts", { medicineId: m.id });
                    setNotified(true);
                    toast({ kind: "success", title: "We'll notify you when it's back" });
                  }}
                  className="flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-ink-300 bg-white text-[14px] font-bold text-ink-700 disabled:opacity-60"
                >
                  <Bell size={15} strokeWidth={2.6} />
                  {notified ? "We'll notify you" : "Notify me when available"}
                </button>
              </div>
            ) : m.type === "RX" ? (
              <Link
                href="/prescriptions/upload"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-amber-500 text-[15px] font-bold text-white"
              >
                <Upload size={17} /> Upload prescription to order
              </Link>
            ) : line ? (
              <div className="flex h-12 items-center justify-between rounded-lg bg-brand-600 px-2 text-white">
                <button
                  aria-label="Decrease quantity"
                  onClick={() => setQty(m.id, line.qty - 1)}
                  className="flex h-full w-12 items-center justify-center"
                >
                  <Minus size={18} strokeWidth={3} />
                </button>
                <span className="text-[16px] font-extrabold tabular-nums">{line.qty} in cart</span>
                <button
                  aria-label="Increase quantity"
                  onClick={() => setQty(m.id, line.qty + 1)}
                  className="flex h-full w-12 items-center justify-center"
                >
                  <Plus size={18} strokeWidth={3} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  addToCart({
                    medicineId: m.id,
                    name: m.name,
                    strength: m.strength,
                    form: m.form,
                    type: m.type,
                    emoji: m.emoji,
                    price,
                  });
                  toast({ kind: "success", title: `${m.name} added to cart` });
                }}
                className="h-12 w-full rounded-lg bg-brand-600 text-[15px] font-bold uppercase tracking-wide text-white hover:bg-brand-700"
              >
                Add to cart
              </button>
            )}
          </div>

          {m.type === "RX" && !m.restricted && (
            <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 p-2.5 text-[11px] text-amber-900">
              <ShieldCheck size={13} className="mt-px shrink-0 text-amber-600" />
              Dispensed only after a registered pharmacist verifies your prescription.
            </p>
          )}
        </div>
      </div>

      {/* details */}
      <div className="mt-5 rounded-xl border border-ink-200 bg-white p-4">
        <h2 className="text-[15px] font-extrabold text-ink-900">Product details</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">{m.description}</p>
        <div className="mt-3 divide-y divide-ink-100">
          <KeyValue label="Salt / generic" value={m.genericName} />
          <KeyValue label="Strength" value={m.strength} />
          <KeyValue label="Dosage form" value={m.form} />
          <KeyValue label="Pack size" value={m.packLabel} />
          <KeyValue label="Manufacturer" value={m.manufacturer} />
          <KeyValue label="How to use" value={m.usage} />
          <KeyValue
            label="Classification"
            value={m.type === "OTC" ? "Over the counter" : "Prescription only"}
          />
        </div>
        <p className="mt-3 rounded-lg bg-ink-100 p-3 text-[11px] text-ink-500">
          Information shown is indicative. Always follow your doctor&apos;s advice and the pack
          insert. DawaQuick does not provide medical advice.
        </p>
      </div>

      {m.type === "RX" && <ComplianceNote className="mt-3" />}
    </CustomerShell>
  );
}
