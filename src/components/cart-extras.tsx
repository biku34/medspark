"use client";

import { useEffect, useState } from "react";
import { ProductCard } from "./product-card";
import { useApp } from "./providers";
import { api } from "@/lib/client";
import type { MedicineSearchResult } from "@/lib/types";

/**
 * What people come back for an hour later.
 *
 * Quick-commerce calls this an upsell rail; in a pharmacy it is closer to the
 * question a chemist asks over the counter — "do you have a thermometer at
 * home?" The pairings below are the boring, defensible ones: things that go
 * with the thing you are buying, never a second medicine to take alongside the
 * first. Suggesting one drug because of another would be advice, and this is a
 * shop, not a consultation.
 */
const COMPANIONS: Record<string, string[]> = {
  "pain-relief": ["devices", "digestive"],
  "cold-cough-fever": ["devices", "hygiene"],
  digestive: ["hygiene"],
  "first-aid": ["hygiene", "devices"],
  "diabetic-care": ["devices"],
  "elderly-care": ["devices", "hygiene"],
  "baby-care": ["hygiene"],
  "feminine-care": ["hygiene"],
  vitamins: ["digestive"],
};

/** When the cart says nothing useful, fall back to the everyday shelf. */
const DEFAULT_SHELVES = ["hygiene", "first-aid", "vitamins"];

export function CartExtras() {
  const { cart, geoQuery } = useApp();
  const [items, setItems] = useState<MedicineSearchResult[]>([]);

  const inCart = new Set(cart.map((l) => l.medicineId));
  const shelves = Array.from(
    new Set(
      cart
        .flatMap((l) => COMPANIONS[l.subcategory ?? ""] ?? [])
        .concat(DEFAULT_SHELVES),
    ),
  ).slice(0, 3);

  const key = shelves.join(",");

  useEffect(() => {
    if (cart.length === 0 || !key) return;
    let alive = true;
    (async () => {
      try {
        const lists = await Promise.all(
          key
            .split(",")
            .map((sub) =>
              api<{ results: MedicineSearchResult[] }>(
                `/api/medicines?q=&shelf=1&sub=${sub}&limit=8&${geoQuery}`,
              ).catch(() => ({ results: [] as MedicineSearchResult[] })),
            ),
        );
        if (!alive) return;

        // Interleave the shelves so one aisle cannot fill the whole rail.
        const merged: MedicineSearchResult[] = [];
        for (let i = 0; i < 8; i++) {
          for (const l of lists) if (l.results[i]) merged.push(l.results[i]);
        }
        setItems(merged.filter((r) => r.available && r.medicine.type === "OTC").slice(0, 24));
      } catch {
        /* the rail simply does not appear */
      }
    })();
    return () => {
      alive = false;
    };
  }, [key, geoQuery, cart.length]);

  const shown = items.filter((r) => !inCart.has(r.medicine.id)).slice(0, 8);
  if (cart.length === 0 || shown.length === 0) return null;

  return (
    <section className="mt-5">
      <h2 className="mb-1 text-[17px] font-extrabold text-ink-900">Often bought with this</h2>
      <p className="mb-2.5 text-[12px] text-ink-500">
        Everyday items, not medicines to take alongside — ask your doctor about those.
      </p>
      <div className="rail">
        {shown.map((r) => (
          <div key={r.medicine.id} className="w-[150px] shrink-0 sm:w-[168px]">
            <ProductCard result={r} />
          </div>
        ))}
      </div>
    </section>
  );
}
