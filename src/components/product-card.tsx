"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, Clock3, Minus, Plus } from "lucide-react";
import type { MedicineSearchResult } from "@/lib/types";
import { inr } from "@/lib/utils";
import { useApp } from "./providers";

/* ========================================================================== */
/* ADD button — outlined green, flips to a stepper in place                   */
/* ========================================================================== */

function AddControl({ result }: { result: MedicineSearchResult }) {
  const { medicine: m, minPrice } = result;
  const { cart, addToCart, setQty, toast } = useApp();
  const line = cart.find((l) => l.medicineId === m.id);
  const price = minPrice ?? m.mrp;

  if (line) {
    return (
      <div className="flex h-9 w-full items-center justify-between rounded-lg bg-brand-600 text-white">
        <button
          aria-label="Decrease quantity"
          onClick={() => setQty(m.id, line.qty - 1)}
          className="flex h-full w-8 items-center justify-center rounded-l-lg active:bg-brand-700"
        >
          <Minus size={14} strokeWidth={3} />
        </button>
        <span className="text-sm font-bold tabular-nums">{line.qty}</span>
        <button
          aria-label="Increase quantity"
          onClick={() => setQty(m.id, line.qty + 1)}
          className="flex h-full w-8 items-center justify-center rounded-r-lg active:bg-brand-700"
        >
          <Plus size={14} strokeWidth={3} />
        </button>
      </div>
    );
  }

  return (
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
        toast({ kind: "success", title: `${m.name} added` });
      }}
      className="h-9 w-full rounded-lg border border-brand-600 bg-brand-50 text-sm font-bold uppercase tracking-wide text-brand-700 transition-colors hover:bg-brand-100 active:bg-brand-200"
    >
      Add
    </button>
  );
}

/* ========================================================================== */
/* Product tile                                                               */
/* ========================================================================== */

/**
 * The catalogue tile: image well, discount flag, delivery time, two-line name,
 * pack size, price with struck-through MRP, and an ADD control.
 *
 * Prescription and restricted items reuse the same tile so grids stay uniform,
 * but their action is replaced — they can never be dropped straight in a cart.
 */
export function ProductCard({ result }: { result: MedicineSearchResult }) {
  const { medicine: m, available, minPrice, fastestEta } = result;
  const { user, toast } = useApp();
  const [notified, setNotified] = useState(false);

  const price = minPrice ?? m.mrp;
  const hasDiscount = price < m.mrp;
  const off = hasDiscount ? Math.round(((m.mrp - price) / m.mrp) * 100) : 0;

  return (
    <div className="tile group relative flex flex-col p-2 hover:tile-hover">
      {/* discount flag */}
      {hasDiscount && available && (
        <span className="absolute -left-px top-1.5 z-10 rounded-r-md bg-offer-600 px-1.5 py-0.5 text-[10px] font-extrabold leading-tight text-white">
          {off}%<br />OFF
        </span>
      )}

      <Link href={`/medicine/${m.id}`} className="block">
        <div className="img-well relative flex aspect-square items-center justify-center">
          <span className="text-4xl sm:text-5xl">{m.emoji}</span>
        </div>
      </Link>

      {/* delivery time — the promise, stated on every tile */}
      {available && fastestEta !== null && (
        <p className="mt-1.5 flex items-center gap-0.5 text-[10px] font-bold text-ink-500">
          <Clock3 size={10} strokeWidth={3} />
          {fastestEta} MINS
        </p>
      )}

      <Link href={`/medicine/${m.id}`} className="mt-0.5 block">
        <h3 className="clamp-2 text-[13px] font-semibold leading-snug text-ink-800">{m.name}</h3>
      </Link>
      <p className="mt-0.5 text-[11px] text-ink-500">{m.packLabel}</p>

      {m.type === "RX" && (
        <span className="mt-1 w-fit rounded bg-amber-100 px-1 py-px text-[10px] font-bold text-amber-800">
          ℞ Prescription
        </span>
      )}

      {/* price + action pinned to the bottom so tiles line up in a grid */}
      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-ink-900">{inr(price)}</p>
          {hasDiscount && available && (
            <p className="text-[11px] text-ink-400 line-through">{inr(m.mrp)}</p>
          )}
        </div>

        <div className="w-[70px] shrink-0 sm:w-[78px]">
          {m.restricted ? (
            <span className="flex h-9 items-center justify-center rounded-lg border border-ink-300 text-[10px] font-bold text-ink-400">
              In store
            </span>
          ) : !available ? (
            <button
              disabled={notified}
              onClick={async () => {
                if (!user) return toast({ kind: "info", title: "Sign in to get notified" });
                await fetch("/api/stock-alerts", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ medicineId: m.id }),
                });
                setNotified(true);
                toast({ kind: "success", title: "We'll notify you when it's back" });
              }}
              className="flex h-9 w-full items-center justify-center gap-1 rounded-lg border border-ink-300 text-[10px] font-bold text-ink-500 disabled:opacity-60"
            >
              <Bell size={11} strokeWidth={3} />
              {notified ? "DONE" : "NOTIFY"}
            </button>
          ) : m.type === "RX" ? (
            <Link
              href="/prescriptions/upload"
              className="flex h-9 w-full items-center justify-center rounded-lg border border-amber-500 bg-amber-50 text-[11px] font-bold uppercase text-amber-700"
            >
              Upload
            </Link>
          ) : (
            <AddControl result={result} />
          )}
        </div>
      </div>

      {!available && !m.restricted && (
        <p className="mt-1 text-[10px] font-semibold text-red-500">Out of stock nearby</p>
      )}
    </div>
  );
}

/** Responsive product grid — 2 across on phones, up to 6 on wide screens. */
export function ProductGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {children}
    </div>
  );
}
