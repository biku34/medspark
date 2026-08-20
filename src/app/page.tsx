"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronRight,
  Clock3,
  FileText,
  RotateCcw,
  ShieldCheck,
  Store,
  Upload,
} from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { useApp } from "@/components/providers";
import { ProductCard, ProductGrid } from "@/components/product-card";
import { MiniTracker } from "@/components/order-tracker";
import { api } from "@/lib/client";
import { ORDER_LABELS, type MedicineSearchResult, type Order } from "@/lib/types";
import { SHELF_CATEGORIES } from "@/lib/shelf";
import { inr } from "@/lib/utils";

/** Big, colourful entry points — the row of round category tiles. */
const QUICK_TILES = [
  { href: "/prescriptions/upload", label: "Upload Rx", emoji: "📄", tone: "bg-amber-100" },
  { href: "/category/otc", label: "Medicines", emoji: "💊", tone: "bg-rose-100" },
  { href: "/services/physiotherapy", label: "Physio", emoji: "🧑‍⚕️", tone: "bg-brand-100" },
  { href: "/services/nursing", label: "Nursing", emoji: "👩‍⚕️", tone: "bg-violet-100" },
  { href: "/care", label: "Care Plan", emoji: "🏥", tone: "bg-sky-100" },
  { href: "/subscriptions", label: "Repeat", emoji: "🔁", tone: "bg-teal-100" },
  { href: "/category/wellness?sub=first-aid", label: "First Aid", emoji: "🩹", tone: "bg-red-100" },
  { href: "/category/wellness?sub=devices", label: "Devices", emoji: "🩺", tone: "bg-indigo-100" },
];

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

  const active = orders.filter(
    (o) => !["DELIVERED", "CANCELLED", "REJECTED"].includes(o.status),
  );
  const past = orders.filter((o) => o.status === "DELIVERED");

  const bySub = (id: string) => shelf.filter((r) => r.medicine.subcategory === id).slice(0, 10);
  const bestsellers = shelf.filter((r) => r.available).slice(0, 10);
  const painRelief = bySub("pain-relief");
  const coldCough = bySub("cold-cough-fever");

  return (
    <CustomerShell wide>
      {/* ------------------------------------------------------------------ */}
      {/* Delivery promise strip                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-[13px] text-brand-900">
        <Clock3 size={15} strokeWidth={2.6} className="shrink-0 text-brand-700" />
        <p className="min-w-0">
          <strong className="font-extrabold">Medicines in 20 minutes</strong> from verified
          pharmacies near {origin.locality}
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Quick tiles                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-6 sm:overflow-visible">
        {QUICK_TILES.map((t) => (
          <Link key={t.href} href={t.href} className="flex w-16 shrink-0 flex-col items-center gap-1 sm:w-auto">
            <span
              className={`flex h-16 w-16 items-center justify-center rounded-full text-3xl sm:h-[72px] sm:w-[72px] ${t.tone}`}
            >
              {t.emoji}
            </span>
            <span className="text-center text-[11px] font-semibold leading-tight text-ink-700">
              {t.label}
            </span>
          </Link>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Prescription banner                                                 */}
      {/* ------------------------------------------------------------------ */}
      <Link
        href="/prescriptions/upload"
        className="mt-3 flex items-center gap-3 overflow-hidden rounded-xl bg-gradient-to-r from-amber-400 to-amber-300 p-3.5"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/70 text-2xl">
          📄
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-extrabold leading-tight text-amber-950">
            Have a doctor&apos;s prescription?
          </span>
          <span className="block text-[12px] leading-tight text-amber-900">
            Upload it — a licensed pharmacist verifies before delivery
          </span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-amber-900" />
      </Link>

      {/* ------------------------------------------------------------------ */}
      {/* Active order strip                                                  */}
      {/* ------------------------------------------------------------------ */}
      {active.length > 0 && (
        <div className="mt-3 space-y-2">
          {active.map((o) => (
            <Link
              key={o.id}
              href={`/orders/${o.id}`}
              className="block rounded-lg border border-brand-200 bg-white p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-extrabold text-ink-900">
                    {ORDER_LABELS[o.status]}
                  </p>
                  <p className="truncate text-[11px] text-ink-500">
                    {o.code} · {o.pharmacyName}
                  </p>
                </div>
                <span className="shrink-0 rounded-md bg-brand-600 px-2 py-1 text-[11px] font-bold text-white">
                  {o.etaMinFrom}–{o.etaMinTo} min
                </span>
              </div>
              <div className="mt-2">
                <MiniTracker status={o.status} />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Shop by category                                                    */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-5">
        <div className="mb-2.5 flex items-end justify-between">
          <h2 className="text-[17px] font-extrabold tracking-tight text-ink-900">
            Shop by category
          </h2>
          <Link href="/category/wellness" className="text-[13px] font-bold text-brand-700">
            See all
          </Link>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
          {SHELF_CATEGORIES.slice(0, 8).map((c) => (
            <Link
              key={c.id}
              href={`/category/wellness?sub=${c.id}`}
              className={`flex flex-col items-center gap-1 rounded-lg border p-2 ${c.tone}`}
            >
              <span className="text-2xl sm:text-3xl">{c.emoji}</span>
              <span className="text-center text-[10px] font-semibold leading-tight text-ink-700">
                {c.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Product rails                                                       */}
      {/* ------------------------------------------------------------------ */}
      {[
        { title: "Bestsellers near you", items: bestsellers, href: "/category/wellness" },
        { title: "Pain relief", items: painRelief, href: "/category/wellness?sub=pain-relief" },
        {
          title: "Cold, cough & fever",
          items: coldCough,
          href: "/category/wellness?sub=cold-cough-fever",
        },
      ].map((rail) => (
        <section key={rail.title} className="mt-5">
          <div className="mb-2.5 flex items-end justify-between">
            <h2 className="text-[17px] font-extrabold tracking-tight text-ink-900">
              {rail.title}
            </h2>
            <Link href={rail.href} className="text-[13px] font-bold text-brand-700">
              See all
            </Link>
          </div>

          {loading ? (
            <div className="no-scrollbar flex gap-2.5 overflow-x-auto">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-64 w-40 shrink-0 animate-pulse rounded-lg bg-ink-100"
                />
              ))}
            </div>
          ) : (
            <div className="no-scrollbar -mx-3 flex gap-2.5 overflow-x-auto px-3 sm:mx-0 sm:px-0">
              {rail.items.map((r) => (
                <div key={r.medicine.id} className="w-[150px] shrink-0 sm:w-[168px]">
                  <ProductCard result={r} />
                </div>
              ))}
            </div>
          )}
        </section>
      ))}

      {/* ------------------------------------------------------------------ */}
      {/* Home healthcare                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-6">
        <h2 className="mb-1 text-[17px] font-extrabold tracking-tight text-ink-900">
          Healthcare at your doorstep
        </h2>
        <p className="mb-2.5 text-[13px] text-ink-500">
          Verified professionals who come to you · book 1 day ahead
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {[
            {
              href: "/services/physiotherapy",
              emoji: "🧑‍⚕️",
              title: "Physiotherapy",
              sub: "Post-op, back, knee & stroke rehab",
              rate: 500,
              bg: "from-brand-600 to-brand-500",
            },
            {
              href: "/services/nursing",
              emoji: "👩‍⚕️",
              title: "Nursing at home",
              sub: "Elderly care, wound care, vitals",
              rate: 300,
              bg: "from-violet-600 to-violet-500",
            },
          ].map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className={`flex items-center gap-3 rounded-xl bg-gradient-to-r p-4 text-white ${s.bg}`}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/20 text-2xl">
                {s.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-extrabold leading-tight">{s.title}</span>
                <span className="block text-[12px] leading-snug text-white/85">{s.sub}</span>
                <span className="mt-1 block text-[12px] font-bold">
                  From {inr(s.rate)}/hour
                </span>
              </span>
              <ChevronRight size={20} className="shrink-0" />
            </Link>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Add-on services                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-6">
        <h2 className="mb-1 text-[17px] font-extrabold tracking-tight text-ink-900">
          More than delivery
        </h2>
        <p className="mb-2.5 text-[13px] text-ink-500">
          Two things a chemist down the road cannot do for you
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Link
            href="/care"
            className="group flex items-start gap-3 rounded-xl border border-ink-200 bg-white p-3.5 transition-colors hover:border-brand-400"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-2xl">
              🏥
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-extrabold leading-tight text-ink-900">
                Send us your reports
              </span>
              <span className="mt-0.5 block text-[12px] leading-snug text-ink-600">
                Discharge summary, lab report or prescription. A pharmacist reads it and plans the
                medicines, nurse and physio visits for you to approve.
              </span>
              <span className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-extrabold text-brand-700">
                Start a care plan <ChevronRight size={13} />
              </span>
            </span>
          </Link>

          <Link
            href="/subscriptions"
            className="group flex items-start gap-3 rounded-xl border border-ink-200 bg-white p-3.5 transition-colors hover:border-brand-400"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-2xl">
              🔁
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-[15px] font-extrabold leading-tight text-ink-900">
                  Repeat delivery
                </span>
                <span className="rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
                  Save 5%
                </span>
              </span>
              <span className="mt-0.5 block text-[12px] leading-snug text-ink-600">
                Monthly tablets, supplements or pads — delivered on a schedule you set. Skip, pause
                or cancel any time.
              </span>
              <span className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-extrabold text-brand-700">
                Set one up <ChevronRight size={13} />
              </span>
            </span>
          </Link>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Reorder                                                             */}
      {/* ------------------------------------------------------------------ */}
      {user && past.length > 0 && (
        <section className="mt-6">
          <div className="mb-2.5 flex items-end justify-between">
            <h2 className="text-[17px] font-extrabold tracking-tight text-ink-900">
              Order again
            </h2>
            <Link href="/orders" className="text-[13px] font-bold text-brand-700">
              All orders
            </Link>
          </div>
          <div className="no-scrollbar -mx-3 flex gap-2.5 overflow-x-auto px-3 sm:mx-0 sm:px-0">
            {past.slice(0, 6).map((o) => (
              <div
                key={o.id}
                className="tile flex w-[190px] shrink-0 flex-col justify-between p-3"
              >
                <div>
                  <p className="clamp-2 text-[13px] font-semibold text-ink-800">
                    {o.items.map((i) => i.name).join(", ")}
                  </p>
                  <p className="mt-1 text-[11px] text-ink-500">
                    {o.pharmacyName} · {inr(o.total)}
                  </p>
                </div>
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
                  className="mt-2 flex h-8 items-center justify-center gap-1 rounded-lg border border-brand-600 bg-brand-50 text-[12px] font-bold uppercase text-brand-700"
                >
                  <RotateCcw size={12} strokeWidth={3} /> Reorder
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Trust strip                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-6 grid grid-cols-3 gap-2">
        {[
          { icon: Store, title: "You pick the pharmacy", sub: "Never auto-assigned" },
          { icon: ShieldCheck, title: "Pharmacist verified", sub: "Every prescription" },
          { icon: FileText, title: "Licensed partners", sub: "Verified drug licence" },
        ].map(({ icon: Icon, title, sub }) => (
          <div key={title} className="rounded-lg border border-ink-200 bg-white p-3 text-center">
            <Icon size={18} className="mx-auto text-brand-600" />
            <p className="mt-1 text-[11px] font-bold leading-tight text-ink-800">{title}</p>
            <p className="text-[10px] leading-tight text-ink-500">{sub}</p>
          </div>
        ))}
      </section>

      {!user && (
        <Link
          href="/login"
          className="mt-4 flex items-center gap-3 rounded-lg border border-ink-200 bg-white p-3.5"
        >
          <Upload size={18} className="shrink-0 text-brand-600" />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold text-ink-900">
              Login to order and track deliveries
            </span>
            <span className="block text-[11px] text-ink-500">
              customer@dawaquick.app · demo1234
            </span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-ink-400" />
        </Link>
      )}
    </CustomerShell>
  );
}
