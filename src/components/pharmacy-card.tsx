"use client";

import { Bike, CheckCircle2, Clock3, MapPin, XCircle } from "lucide-react";
import type { PharmacyOffer } from "@/lib/types";
import { inr } from "@/lib/utils";
import { Badge, Button, Stars } from "./ui";

/**
 * A pharmacy's offer for the customer's basket.
 *
 * The customer always picks the pharmacy — DawaQuick never auto-assigns one.
 */
export function PharmacyOfferCard({
  offer,
  onChoose,
  selected,
  busy,
}: {
  offer: PharmacyOffer;
  onChoose: () => void;
  selected?: boolean;
  busy?: boolean;
}) {
  const { pharmacy, distanceKm, etaMinFrom, etaMinTo, deliveryFee, itemsTotal, total, allAvailable, lines } =
    offer;

  return (
    <article
      className={
        "card p-4 transition-shadow " +
        (selected ? "ring-2 ring-brand-500" : allAvailable ? "" : "opacity-75")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-ink-900">{pharmacy.name}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-500">
            <MapPin size={12} />
            {distanceKm} km away · {pharmacy.locality}
          </p>
        </div>
        <Stars value={pharmacy.rating} count={pharmacy.ratingCount} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl bg-ink-50 p-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">Medicine</p>
          <p
            className={
              "mt-0.5 flex items-center gap-1 text-sm font-semibold " +
              (allAvailable ? "text-emerald-700" : "text-red-600")
            }
          >
            {allAvailable ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            {allAvailable ? "Available" : "Partial"}
          </p>
        </div>
        <div className="rounded-xl bg-ink-50 p-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">Delivery</p>
          <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-ink-800">
            <Clock3 size={14} />
            {etaMinFrom}–{etaMinTo} min
          </p>
        </div>
        <div className="rounded-xl bg-ink-50 p-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">Delivery fee</p>
          <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-ink-800">
            <Bike size={14} />
            {inr(deliveryFee)}
          </p>
        </div>
        <div className="rounded-xl bg-brand-50 p-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-brand-700">Total</p>
          <p className="mt-0.5 text-sm font-bold text-brand-800">{inr(total)}</p>
        </div>
      </div>

      {/* Per-item availability, so partial matches are honest about what's missing */}
      <ul className="mt-3 space-y-1">
        {lines.map((l) => (
          <li key={l.medicineId} className="flex items-center justify-between gap-2 text-xs">
            <span className="min-w-0 truncate text-ink-600">
              {l.name} × {l.qty}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="text-ink-500">{inr(l.price * l.qty)}</span>
              {l.available ? (
                <Badge tone="green">In stock</Badge>
              ) : (
                <Badge tone="red">{l.stock > 0 ? `Only ${l.stock} left` : "Out of stock"}</Badge>
              )}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-ink-100 pt-3">
        <p className="text-xs text-ink-500">
          Items {inr(itemsTotal)} + delivery {inr(deliveryFee)}
        </p>
        <Button onClick={onChoose} disabled={!allAvailable} loading={busy}>
          {selected ? "Selected" : "Choose Pharmacy"}
        </Button>
      </div>
    </article>
  );
}
