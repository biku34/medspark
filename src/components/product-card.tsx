"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, Minus, Plus, Zap } from "lucide-react";
import type { MedicineSearchResult } from "@/lib/types";
import { inr } from "@/lib/utils";
import { useApp } from "./providers";
import { ProductArt, paletteFor } from "./art";

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
        <span className="nums text-[14px] font-extrabold">{line.qty}</span>
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
          subcategory: m.subcategory,
          price,
        });
        toast({ kind: "success", title: `${m.name} added` });
      }}
      className="h-9 w-full rounded-lg border-[1.5px] border-brand-600 bg-white text-[13px] font-extrabold uppercase tracking-wide text-brand-700 transition-colors hover:bg-brand-50 active:bg-brand-100"
    >
      Add
    </button>
  );
}

/* ========================================================================== */
/* Product tile                                                               */
/* ========================================================================== */

/**
 * The catalogue tile.
 *
 * Order of loudness, decided once and applied everywhere: pack shot, then
 * price, then ADD, then name. A shopper scanning a rail is matching a picture
 * and a number — the name is what they read only after something catches them.
 *
 * ℞ and restricted items reuse the tile so grids stay even, but their action is
 * swapped out: neither can ever drop straight into a cart.
 */
export function ProductCard({ result }: { result: MedicineSearchResult }) {
  const { medicine: m, available, minPrice, fastestEta } = result;
  const { user, toast } = useApp();
  const [notified, setNotified] = useState(false);

  const price = minPrice ?? m.mrp;
  const hasDiscount = price < m.mrp;
  const off = hasDiscount ? Math.round(((m.mrp - price) / m.mrp) * 100) : 0;
  const well = paletteFor(m.subcategory).well;

  return (
    <div className="tile group relative flex flex-col overflow-hidden p-2 hover:tile-hover">
      {/* pack shot sits in its category's own colour, so a rail reads as a shelf */}
      <Link href={`/medicine/${m.id}`} className="relative block">
        <div
          className="relative flex aspect-square items-center justify-center rounded-lg"
          style={{ background: available ? well : "#f2f3f5" }}
        >
          <ProductArt
            subcategory={m.subcategory}
            form={m.form}
            size={78}
            className={available ? "" : "opacity-40 saturate-0"}
          />

          {hasDiscount && available && (
            <span className="nums absolute left-1 top-1 rounded-md bg-offer-600 px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-white shadow-sm">
              {off}% OFF
            </span>
          )}

          {available && fastestEta !== null && (
            <span className="nums absolute bottom-1 left-1 flex items-center gap-0.5 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-extrabold text-ink-700 backdrop-blur-sm">
              <Zap size={9} strokeWidth={3} className="text-brand-600" />
              {fastestEta} min
            </span>
          )}
        </div>
      </Link>

      <Link href={`/medicine/${m.id}`} className="mt-2 block">
        <h3 className="clamp-2 text-[13px] font-semibold leading-snug text-ink-800">{m.name}</h3>
      </Link>
      <p className="mt-0.5 text-[11px] text-ink-500">{m.packLabel}</p>

      {m.type === "RX" && (
        <span className="mt-1 w-fit rounded bg-rx-100 px-1.5 py-px text-[10px] font-extrabold text-rx-700">
          ℞ Prescription
        </span>
      )}

      {/* price + action pinned to the bottom so tiles line up in a grid */}
      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
        <div className="min-w-0">
          <p className="nums text-[15px] font-extrabold leading-none text-ink-900">{inr(price)}</p>
          {hasDiscount && available && (
            <p className="nums mt-0.5 text-[11px] font-medium text-ink-400 line-through">
              {inr(m.mrp)}
            </p>
          )}
        </div>

        <div className="w-[72px] shrink-0 sm:w-[80px]">
          {m.restricted ? (
            <span className="flex h-9 items-center justify-center rounded-lg border border-ink-300 text-[10px] font-extrabold text-ink-400">
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
              className="flex h-9 w-full items-center justify-center gap-1 rounded-lg border border-ink-300 text-[10px] font-extrabold text-ink-500 disabled:opacity-60"
            >
              <Bell size={11} strokeWidth={3} />
              {notified ? "DONE" : "NOTIFY"}
            </button>
          ) : m.type === "RX" ? (
            <Link
              href="/prescriptions/upload"
              className="flex h-9 w-full items-center justify-center rounded-lg border-[1.5px] border-rx-400 bg-white text-[11px] font-extrabold uppercase text-rx-700"
            >
              Upload
            </Link>
          ) : (
            <AddControl result={result} />
          )}
        </div>
      </div>

      {!available && !m.restricted && (
        <p className="mt-1 text-[10px] font-bold text-ink-500">Out of stock nearby</p>
      )}
    </div>
  );
}

/** Responsive product grid — 2 across on phones, up to 5 on wide screens. */
export function ProductGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {children}
    </div>
  );
}
