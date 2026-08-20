"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight, RotateCcw, ShieldCheck, Store, Truck } from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { useApp } from "@/components/providers";
import { ProductCard } from "@/components/product-card";
import { CategoryArt, ProductArt, ServiceArt, paletteFor } from "@/components/art";
import { HomeCareBand } from "@/components/home-care-band";
import { api } from "@/lib/client";
import type { MedicineSearchResult, Order } from "@/lib/types";
import { SHELF_CATEGORIES } from "@/lib/shelf";
import { inr } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Section header — one shape, used by every rail on the page                 */
/* -------------------------------------------------------------------------- */

function Rail({
  title,
  href,
  linkLabel = "See all",
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[19px] font-extrabold text-ink-900 sm:text-[21px]">{title}</h2>
        {href && (
          <Link
            href={href}
            className="shrink-0 text-[13px] font-extrabold text-brand-700 hover:underline"
          >
            {linkLabel}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export default function HomePage() {
  const { user, origin, geoQuery, addToCart, toast } = useApp();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [shelf, setShelf] = useState<MedicineSearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [meds, ord] = await Promise.all([
          api<{ results: MedicineSearchResult[] }>(
            `/api/medicines?q=&shelf=1&limit=400&${geoQuery}`,
          ),
          user
            ? api<{ orders: Order[] }>("/api/orders").catch(() => ({ orders: [] }))
            : Promise.resolve({ orders: [] as Order[] }),
        ]);
        if (!alive) return;
        setShelf(meds.results);
        setOrders(ord.orders);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user, geoQuery]);

  const past = orders.filter((o) => o.status === "DELIVERED");

  const bySub = (id: string) => shelf.filter((r) => r.medicine.subcategory === id).slice(0, 10);
  const bestsellers = shelf.filter((r) => r.available).slice(0, 10);

  return (
    <CustomerShell wide>
      {/* ================================================================== */}
      {/* Shop by category — image-forward, no borders, tight                 */}
      {/* ================================================================== */}
      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-[19px] font-extrabold text-ink-900 sm:text-[21px]">
            What do you need?
          </h2>
          <Link
            href="/category/wellness"
            className="shrink-0 text-[13px] font-extrabold text-brand-700 hover:underline"
          >
            All categories
          </Link>
        </div>

        <div className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-6 lg:grid-cols-8">
          {SHELF_CATEGORIES.slice(0, 8).map((c) => (
            <Link key={c.id} href={`/category/wellness?sub=${c.id}`} className="group">
              <span
                className="flex aspect-square items-center justify-center rounded-xl transition-transform group-active:scale-95"
                style={{ background: paletteFor(c.id).well }}
              >
                <CategoryArt id={c.id} size={46} />
              </span>
              <span className="mt-1.5 block text-center text-[11px] font-semibold leading-tight text-ink-700">
                {c.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ================================================================== */}
      {/* The two things a chemist downstairs cannot do                       */}
      {/* ================================================================== */}
      <section className="mt-6 grid gap-2.5 sm:grid-cols-2">
        {/* prescription upload */}
        <Link
          href="/prescriptions/upload"
          className="relative flex items-center gap-3 overflow-hidden rounded-2xl bg-rx-50 p-4 ring-1 ring-rx-200 transition-colors hover:bg-rx-100"
        >
          <ServiceArt kind="rx" size={54} className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-extrabold leading-tight text-rx-800">
              Upload a prescription
            </span>
            <span className="mt-0.5 block text-[12.5px] leading-snug text-rx-700/80">
              A licensed pharmacist checks it, calls you, then releases the order
            </span>
          </span>
          <ChevronRight size={20} strokeWidth={2.6} className="shrink-0 text-rx-500" />
        </Link>

        {/* care plan */}
        <Link
          href="/care"
          className="relative flex items-center gap-3 overflow-hidden rounded-2xl bg-care-50 p-4 ring-1 ring-care-200 transition-colors hover:bg-care-100"
        >
          <ServiceArt kind="care" size={54} className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="text-[16px] font-extrabold leading-tight text-care-800">
                Send us your reports
              </span>
              <span className="rounded bg-care-600 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white">
                New
              </span>
            </span>
            <span className="mt-0.5 block text-[12.5px] leading-snug text-care-700/80">
              Discharge summary or lab report — we plan the medicines and visits
            </span>
          </span>
          <ChevronRight size={20} strokeWidth={2.6} className="shrink-0 text-care-500" />
        </Link>
      </section>

      <HomeCareBand />

      {/* ================================================================== */}
      {/* Bestsellers                                                         */}
      {/* ================================================================== */}
      <Rail title={`Popular in ${origin.locality}`} href="/category/wellness">
        {loading ? (
          <div className="rail">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 w-[150px] shrink-0 animate-pulse rounded-xl bg-ink-100" />
            ))}
          </div>
        ) : (
          <div className="rail">
            {bestsellers.map((r) => (
              <div key={r.medicine.id} className="w-[150px] shrink-0 sm:w-[168px]">
                <ProductCard result={r} />
              </div>
            ))}
          </div>
        )}
      </Rail>

      {/* ================================================================== */}
      {/* Repeat delivery — a full-width band, not another card               */}
      {/* ================================================================== */}
      <section className="bleed mt-7 bg-brand-800 py-5 text-white sm:rounded-2xl sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-brand-200">
              Repeat delivery
            </p>
            <h2 className="mt-2 text-[22px] font-extrabold leading-tight sm:text-[26px]">
              Stop re-ordering the same
              <br className="hidden sm:block" /> tablets every month
            </h2>
            <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-white/70">
              Pick a day, pick your pharmacy, and it arrives on its own — 5% off every time. Skip a
              month or cancel whenever you like.
            </p>
            <Link
              href="/subscriptions"
              className="mt-3.5 inline-flex h-11 items-center gap-1.5 rounded-xl bg-white px-4 text-[14px] font-extrabold text-brand-800 hover:bg-brand-50"
            >
              Set up repeat delivery
              <ChevronRight size={17} strokeWidth={3} />
            </Link>
          </div>
          <div className="flex shrink-0 items-center justify-center">
            <span className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white/10 sm:h-28 sm:w-28">
              <ServiceArt kind="repeat" size={72} />
            </span>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* More aisles                                                         */}
      {/* ================================================================== */}
      {[
        { id: "pain-relief", title: "Pain relief" },
        { id: "cold-cough-fever", title: "Cold, cough & fever" },
        { id: "devices", title: "Health devices" },
      ].map((rail) => {
        const items = bySub(rail.id);
        if (!loading && items.length === 0) return null;
        return (
          <Rail key={rail.id} title={rail.title} href={`/category/wellness?sub=${rail.id}`}>
            {loading ? (
              <div className="rail">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-64 w-[150px] shrink-0 animate-pulse rounded-xl bg-ink-100"
                  />
                ))}
              </div>
            ) : (
              <div className="rail">
                {items.map((r) => (
                  <div key={r.medicine.id} className="w-[150px] shrink-0 sm:w-[168px]">
                    <ProductCard result={r} />
                  </div>
                ))}
              </div>
            )}
          </Rail>
        );
      })}

      {/* ================================================================== */}
      {/* Reorder                                                             */}
      {/* ================================================================== */}
      {user && past.length > 0 && (
        <Rail title="Buy it again" href="/orders" linkLabel="All orders">
          <div className="rail">
            {past.slice(0, 6).map((o) => (
              <div key={o.id} className="tile flex w-[210px] shrink-0 flex-col p-3">
                <div className="flex -space-x-2">
                  {o.items.slice(0, 3).map((i) => (
                    <span
                      key={i.medicineId}
                      className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border-2 border-white bg-ink-50"
                    >
                      <ProductArt subcategory="" form={i.form} size={32} />
                    </span>
                  ))}
                </div>
                <p className="clamp-2 mt-2 text-[13px] font-semibold leading-snug text-ink-800">
                  {o.items.map((i) => i.name).join(", ")}
                </p>
                <p className="nums mt-0.5 text-[11px] text-ink-500">
                  {o.pharmacyName} · {inr(o.total)}
                </p>
                <button
                  onClick={() => {
                    if (o.items.some((i) => i.type === "RX")) {
                      toast({
                        kind: "info",
                        title: "Prescription needed",
                        body: "Upload a prescription to reorder these medicines.",
                      });
                      router.push("/prescriptions/upload");
                      return;
                    }
                    o.items.forEach((i) =>
                      addToCart(
                        {
                          medicineId: i.medicineId,
                          name: i.name,
                          strength: i.strength,
                          form: i.form,
                          type: i.type,
                          emoji: "💊",
                          price: i.price,
                        },
                        i.qty,
                      ),
                    );
                    toast({ kind: "success", title: "Added to cart" });
                  }}
                  className="mt-auto flex h-9 items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-brand-600 bg-white pt-0 text-[12px] font-extrabold uppercase text-brand-700 hover:bg-brand-50"
                >
                  <RotateCcw size={12} strokeWidth={3} /> Reorder
                </button>
              </div>
            ))}
          </div>
        </Rail>
      )}

      {/* ================================================================== */}
      {/* Why this is not just another store                                  */}
      {/* ================================================================== */}
      <section className="mt-7 rounded-2xl border border-ink-200 bg-white p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Store,
              title: "You choose the shop",
              sub: "We show you every pharmacy near you with prices and stock. We never pick one for you.",
            },
            {
              icon: ShieldCheck,
              title: "A pharmacist actually calls",
              sub: "Every prescription is read and verified over a phone call before anything is dispensed.",
            },
            {
              icon: Truck,
              title: "From a shop, not a warehouse",
              sub: "Your order comes from a licensed chemist a few streets away — that is why it is fast.",
            },
          ].map(({ icon: Icon, title, sub }) => (
            <div key={title} className="flex gap-2.5">
              <Icon size={18} strokeWidth={2.4} className="mt-0.5 shrink-0 text-brand-600" />
              <div className="min-w-0">
                <p className="text-[13px] font-extrabold leading-tight text-ink-900">{title}</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-ink-500">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {!user && (
        <Link
          href="/login"
          className="mt-3 flex items-center gap-3 rounded-2xl bg-ink-900 p-4 text-white"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-extrabold">Sign in to order</span>
            <span className="block text-[12px] text-white/60">
              Saved addresses, order tracking, prescriptions and repeat deliveries
            </span>
          </span>
          <ChevronRight size={20} className="shrink-0 text-white/50" />
        </Link>
      )}
    </CustomerShell>
  );
}
