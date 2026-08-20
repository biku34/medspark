"use client";

import { Bike, Check, Clock3, MapPin, Star, X } from "lucide-react";
import type { PharmacyOffer } from "@/lib/types";
import { inr } from "@/lib/utils";

/**
 * A pharmacy's offer for the customer's basket.
 * The customer always picks — DawaQuick never auto-assigns a pharmacy.
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
  const {
    pharmacy,
    distanceKm,
    etaMinFrom,
    etaMinTo,
    deliveryFee,
    itemsTotal,
    total,
    allAvailable,
    lines,
  } = offer;

  return (
    <article
      className={
        "rounded-xl border bg-white p-3.5 " +
        (selected ? "border-brand-600 ring-1 ring-brand-600" : "border-ink-200")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-extrabold text-ink-900">{pharmacy.name}</h3>
          <p className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-500">
            <span className="flex items-center gap-0.5">
              <MapPin size={11} /> {distanceKm} km
            </span>
            <span>·</span>
            <span>{pharmacy.locality}</span>
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-0.5 rounded-md bg-brand-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
          <Star size={10} className="fill-white" />
          {pharmacy.rating > 0 ? pharmacy.rating.toFixed(1) : "New"}
        </span>
      </div>

      {/* the three numbers that actually drive the choice */}
      <div className="mt-2.5 flex items-stretch divide-x divide-ink-200 rounded-lg bg-ink-50 text-center">
        <div className="flex-1 px-2 py-1.5">
          <p className="flex items-center justify-center gap-1 text-[13px] font-extrabold text-ink-900">
            <Clock3 size={12} strokeWidth={3} className="text-brand-700" />
            {etaMinFrom}–{etaMinTo}m
          </p>
          <p className="text-[10px] text-ink-500">delivery</p>
        </div>
        <div className="flex-1 px-2 py-1.5">
          <p className="flex items-center justify-center gap-1 text-[13px] font-extrabold text-ink-900">
            <Bike size={12} strokeWidth={3} className="text-ink-500" />
            {inr(deliveryFee)}
          </p>
          <p className="text-[10px] text-ink-500">fee</p>
        </div>
        <div className="flex-1 px-2 py-1.5">
          <p className="text-[13px] font-extrabold text-brand-700">{inr(total)}</p>
          <p className="text-[10px] text-ink-500">total</p>
        </div>
      </div>

      {/* per-item availability — honest about partial matches */}
      <ul className="mt-2.5 space-y-1">
        {lines.map((l) => (
          <li key={l.medicineId} className="flex items-center justify-between gap-2 text-[12px]">
            <span className="flex min-w-0 items-center gap-1.5">
              {l.available ? (
                <Check size={12} strokeWidth={3} className="shrink-0 text-brand-600" />
              ) : (
                <X size={12} strokeWidth={3} className="shrink-0 text-red-500" />
              )}
              <span className="truncate text-ink-600">
                {l.name} × {l.qty}
              </span>
            </span>
            <span className="shrink-0 font-semibold text-ink-700">
              {l.available ? (
                inr(l.price * l.qty)
              ) : (
                <span className="text-red-500">
                  {l.stock > 0 ? `only ${l.stock}` : "out of stock"}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[11px] text-ink-500">
          Items {inr(itemsTotal)} + fee {inr(deliveryFee)}
        </p>
        <button
          onClick={onChoose}
          disabled={!allAvailable || busy}
          className={
            "h-9 rounded-lg px-4 text-[13px] font-bold uppercase tracking-wide transition-colors " +
            (allAvailable
              ? selected
                ? "bg-brand-700 text-white"
                : "border border-brand-600 bg-brand-50 text-brand-700 hover:bg-brand-100"
              : "cursor-not-allowed border border-ink-200 bg-ink-100 text-ink-400")
          }
        >
          {selected ? "Selected" : allAvailable ? "Select" : "Unavailable"}
        </button>
      </div>
    </article>
  );
}
