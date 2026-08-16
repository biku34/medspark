"use client";

import Link from "next/link";
import { useState } from "react";
import { BellRing, Clock3, MapPin, ShieldAlert, Upload } from "lucide-react";
import type { MedicineSearchResult } from "@/lib/types";
import { inr } from "@/lib/utils";
import { Badge, Button, QtyStepper, RxBadge } from "./ui";
import { useApp } from "./providers";

/**
 * One search result. Availability is always phrased in terms of NEARBY
 * pharmacies — the platform never implies central stock.
 */
export function MedicineCard({ result }: { result: MedicineSearchResult }) {
  const { medicine: m, available, pharmacyCount, minPrice, nearestKm, fastestEta } = result;
  const { addToCart, cart, setQty, toast, user } = useApp();
  const [notified, setNotified] = useState(false);
  const inCart = cart.find((l) => l.medicineId === m.id);

  const price = minPrice ?? m.mrp;

  const add = () => {
    addToCart({
      medicineId: m.id,
      name: m.name,
      strength: m.strength,
      form: m.form,
      type: m.type,
      emoji: m.emoji,
      price,
    });
    toast({
      kind: "success",
      title: `${m.name} added`,
      body: "Choose a nearby pharmacy at checkout.",
    });
  };

  const notifyMe = async () => {
    if (!user) {
      toast({ kind: "info", title: "Sign in to get notified" });
      return;
    }
    const res = await fetch("/api/stock-alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ medicineId: m.id }),
    });
    if (res.ok) {
      setNotified(true);
      toast({
        kind: "success",
        title: "We'll notify you",
        body: `You'll get an alert when ${m.name} is back in stock nearby.`,
      });
    }
  };

  return (
    <article className="card flex gap-3.5 p-4">
      <Link
        href={`/medicine/${m.id}`}
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-ink-50 text-3xl"
        aria-hidden
      >
        {m.emoji}
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="min-w-0">
            <Link href={`/medicine/${m.id}`} className="block">
              <h3 className="truncate text-[15px] font-semibold text-ink-900 hover:text-brand-700">
                {m.name}
              </h3>
            </Link>
            <p className="mt-0.5 truncate text-xs text-ink-500">
              {m.form} · {m.strength} · {m.brand}
            </p>
            <p className="truncate text-xs text-ink-400">by {m.manufacturer}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-ink-900">{inr(price)}</p>
            <p className="text-[11px] text-ink-400">/ {m.packLabel}</p>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <RxBadge type={m.type} />
          {m.restricted && (
            <Badge tone="red" icon={<ShieldAlert size={12} />}>
              Restricted drug
            </Badge>
          )}
          {available ? (
            <Badge tone="green">Available</Badge>
          ) : (
            <Badge tone="slate">Unavailable nearby</Badge>
          )}
          {available && (
            <span className="text-xs text-ink-500">
              at {pharmacyCount} {pharmacyCount === 1 ? "pharmacy" : "pharmacies"}
            </span>
          )}
        </div>

        {available && (
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
            {nearestKm !== null && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} /> nearest {nearestKm} km
              </span>
            )}
            {fastestEta !== null && (
              <span className="inline-flex items-center gap-1">
                <Clock3 size={12} /> from {fastestEta} min
              </span>
            )}
          </div>
        )}

        {/* ---------------------------- actions ---------------------------- */}
        <div className="mt-3">
          {m.restricted ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
              This medicine is a scheduled / habit-forming drug and cannot be ordered through
              the app. Please visit a pharmacy in person with the original prescription.
            </div>
          ) : !available ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-ink-700">
                Currently unavailable in nearby pharmacies.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<BellRing size={14} />}
                  disabled={notified}
                  onClick={notifyMe}
                >
                  {notified ? "You'll be notified" : "Notify me when available"}
                </Button>
                <Link
                  href="/search"
                  className="inline-flex items-center rounded-lg border border-ink-300 bg-white px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
                >
                  Search another medicine
                </Link>
              </div>
            </div>
          ) : m.type === "RX" ? (
            <Link
              href="/prescriptions/upload"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
            >
              <Upload size={16} />
              Upload prescription to order
            </Link>
          ) : inCart ? (
            <div className="flex items-center gap-3">
              <QtyStepper
                value={inCart.qty}
                onChange={(v) => setQty(m.id, v)}
                min={0}
                size="sm"
              />
              <Link href="/cart" className="text-sm font-semibold text-brand-700 underline">
                Go to cart
              </Link>
            </div>
          ) : (
            <Button size="md" onClick={add}>
              Add to Cart
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
