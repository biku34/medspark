"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bike,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileText,
  HeartPulse,
  Leaf,
  MapPin,
  Package,
  Pill,
  RotateCcw,
  Search,
  ShieldCheck,
  Stethoscope,
  Store,
  Upload,
} from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { BRAND, ComplianceNote } from "@/components/brand";
import { useApp } from "@/components/providers";
import { Badge, Button, Card, LinkButton, SectionTitle } from "@/components/ui";
import { MiniTracker } from "@/components/order-tracker";
import { api } from "@/lib/client";
import { ORDER_LABELS, type MedicineSearchResult, type Order } from "@/lib/types";
import { dayLabel, inr } from "@/lib/utils";

const QUICK_ACTIONS = [
  {
    href: "/search",
    label: "Search medicines",
    hint: "By name or salt",
    icon: Search,
    tone: "bg-brand-50 text-brand-700",
  },
  {
    href: "/prescriptions/upload",
    label: "Upload Prescription",
    hint: "Pharmacist verified",
    icon: Upload,
    tone: "bg-amber-50 text-amber-700",
  },
  {
    href: "/category/otc",
    label: "OTC Medicines",
    hint: "No prescription",
    icon: Pill,
    tone: "bg-emerald-50 text-emerald-700",
  },
  {
    href: "/category/prescription",
    label: "Prescription Medicines",
    hint: "℞ verification required",
    icon: Stethoscope,
    tone: "bg-violet-50 text-violet-700",
  },
  {
    href: "/category/wellness",
    label: "Health & Wellness",
    hint: "Devices, vitamins",
    icon: Leaf,
    tone: "bg-sky-50 text-sky-700",
  },
  {
    href: "/orders",
    label: "My Orders",
    hint: "Track & reorder",
    icon: Package,
    tone: "bg-ink-100 text-ink-700",
  },
];

const AUDIENCE = [
  "Hostel & PG residents",
  "Senior citizens",
  "Working professionals",
  "Women ordering at night",
  "Family in another city",
  "Travellers & tourists",
  "Limited mobility",
  "Anyone who can't step out",
];

export default function HomePage() {
  const { user, location, cart, addToCart, toast, geoQuery } = useApp();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [popular, setPopular] = useState<MedicineSearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [meds, ord] = await Promise.all([
          api<{ results: MedicineSearchResult[] }>(`/api/medicines?q=&limit=8&category=otc&${geoQuery}`),
          user
            ? api<{ orders: Order[] }>("/api/orders").catch(() => ({ orders: [] }))
            : Promise.resolve({ orders: [] as Order[] }),
        ]);
        if (!alive) return;
        setPopular(meds.results.slice(0, 6));
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
  const reorderable = past.slice(0, 4);

  return (
    <CustomerShell wide>
      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 p-6 text-white sm:p-9">
        <Badge tone="brand" className="border-white/25 bg-white/15 text-white">
          <ShieldCheck size={12} /> Verified local pharmacy network
        </Badge>

        <h1 className="mt-3 text-2xl font-bold leading-tight sm:text-4xl">
          {BRAND.differentiator}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-brand-50 sm:text-base">
          {BRAND.promise}
        </p>

        <div className="mt-5 flex flex-wrap gap-2.5">
          <Button
            size="lg"
            variant="secondary"
            className="border-transparent bg-white text-brand-700 hover:bg-brand-50"
            icon={<Search size={18} />}
            onClick={() => router.push("/search?q=Paracetamol%20650")}
          >
            Search medicines
          </Button>
          <LinkButton
            href="/prescriptions/upload"
            size="lg"
            variant="secondary"
            className="border-white/30 bg-white/15 text-white hover:bg-white/25"
            icon={<Upload size={18} />}
          >
            Upload Prescription
          </LinkButton>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { icon: Store, title: "Nearby pharmacies", body: "You choose the pharmacy — never us." },
            { icon: Clock3, title: "20–40 min delivery", body: "Real windows, honestly shown." },
            { icon: ShieldCheck, title: "Pharmacist verified", body: "Every ℞ reviewed by a person." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl bg-white/10 p-3.5 backdrop-blur-sm">
              <Icon size={20} className="text-brand-100" />
              <p className="mt-1.5 text-sm font-semibold">{title}</p>
              <p className="text-xs text-brand-100">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Location strip */}
      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-ink-200 bg-white px-4 py-3">
        <MapPin size={18} className="shrink-0 text-brand-600" />
        <p className="min-w-0 flex-1 text-sm">
          {location ? (
            <>
              <span className="text-ink-500">Delivering to </span>
              <strong className="text-ink-900">{location.locality}</strong>
              {location.source === "gps" && (
                <span className="ml-1.5 text-xs text-emerald-600">· detected</span>
              )}
            </>
          ) : (
            <span className="text-ink-600">Set your location to see pharmacies near you</span>
          )}
        </p>
        <button
          onClick={() =>
            document.getElementById("medspark-location-trigger")?.click()
          }
          className="shrink-0 text-sm font-semibold text-brand-700 underline"
        >
          Change
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Quick actions                                                       */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-6">
        <SectionTitle title="What do you need today?" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {QUICK_ACTIONS.map(({ href, label, hint, icon: Icon, tone }) => (
            <Link
              key={href}
              href={href}
              className="card flex flex-col gap-2 p-4 transition-transform hover:-translate-y-0.5"
            >
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
                <Icon size={22} />
              </span>
              <span className="text-sm font-semibold text-ink-900">{label}</span>
              <span className="text-xs text-ink-500">{hint}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Active order                                                        */}
      {/* ------------------------------------------------------------------ */}
      {active.length > 0 && (
        <section className="mt-7">
          <SectionTitle title="Active order" />
          {active.map((o) => (
            <Link key={o.id} href={`/orders/${o.id}`} className="card mb-3 block p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink-900">{ORDER_LABELS[o.status]}</p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {o.code} · {o.pharmacyName} · {o.items.length} item
                    {o.items.length > 1 ? "s" : ""}
                  </p>
                </div>
                <Badge tone="brand">
                  <Bike size={12} /> {o.etaMinFrom}–{o.etaMinTo} min
                </Badge>
              </div>
              <div className="mt-3">
                <MiniTracker status={o.status} />
              </div>
              <p className="mt-2 flex items-center gap-1 text-xs font-medium text-brand-700">
                Track order <ChevronRight size={14} />
              </p>
            </Link>
          ))}
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Popular OTC                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-7">
        <SectionTitle
          title="Frequently ordered nearby"
          subtitle="Availability reflects live stock at pharmacies around you"
          action={
            <Link href="/category/otc" className="text-sm font-semibold text-brand-700">
              See all
            </Link>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card h-36 animate-pulse bg-ink-50" />
              ))
            : popular.map((r) => (
                <div key={r.medicine.id} className="card flex flex-col p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink-50 text-2xl">
                      {r.medicine.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/medicine/${r.medicine.id}`}
                        className="line-clamp-2 text-sm font-semibold text-ink-900 hover:text-brand-700"
                      >
                        {r.medicine.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-ink-500">{r.medicine.packLabel}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-ink-900">{inr(r.minPrice ?? r.medicine.mrp)}</p>
                      <p className="text-[11px] text-ink-400">
                        {r.available ? `${r.pharmacyCount} pharmacies` : "Unavailable nearby"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      disabled={!r.available}
                      onClick={() => {
                        addToCart({
                          medicineId: r.medicine.id,
                          name: r.medicine.name,
                          strength: r.medicine.strength,
                          form: r.medicine.form,
                          type: r.medicine.type,
                          emoji: r.medicine.emoji,
                          price: r.minPrice ?? r.medicine.mrp,
                        });
                        toast({ kind: "success", title: `${r.medicine.name} added to cart` });
                      }}
                    >
                      {cart.some((l) => l.medicineId === r.medicine.id) ? "Added" : "Add"}
                    </Button>
                  </div>
                </div>
              ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Recent orders + reorder                                             */}
      {/* ------------------------------------------------------------------ */}
      {user && past.length > 0 && (
        <section className="mt-7 grid gap-5 lg:grid-cols-2">
          <div>
            <SectionTitle
              title="Recent Orders"
              action={
                <Link href="/orders" className="text-sm font-semibold text-brand-700">
                  All orders
                </Link>
              }
            />
            <ul className="space-y-2.5">
              {past.slice(0, 3).map((o) => (
                <li key={o.id}>
                  <Link href={`/orders/${o.id}`} className="card flex items-center gap-3 p-3.5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-50">
                      <ClipboardList size={18} className="text-ink-500" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink-900">
                        {o.items.map((i) => i.name).join(", ")}
                      </span>
                      <span className="block text-xs text-ink-500">
                        {dayLabel(o.createdAt)} · {o.pharmacyName} · {inr(o.total)}
                      </span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-ink-400" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <SectionTitle title="Reorder Medicines" subtitle="One tap to fill your cart again" />
            <div className="grid gap-2.5 sm:grid-cols-2">
              {reorderable.map((o) => (
                <div key={o.id} className="card flex flex-col justify-between gap-3 p-3.5">
                  <div>
                    <p className="line-clamp-2 text-sm font-medium text-ink-900">
                      {o.items.map((i) => `${i.name} × ${i.qty}`).join(", ")}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {dayLabel(o.createdAt)} · {inr(o.total)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<RotateCcw size={14} />}
                    onClick={() => {
                      const rx = o.items.filter((i) => i.type === "RX");
                      if (rx.length) {
                        toast({
                          kind: "info",
                          title: "Prescription needed",
                          body: "This order contains ℞ medicines — upload a prescription to reorder.",
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
                      router.push("/cart");
                    }}
                  >
                    Reorder
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {!user && (
        <Card className="mt-7 flex flex-col items-start gap-3 border-brand-200 bg-brand-50/50 sm:flex-row sm:items-center">
          <HeartPulse size={28} className="text-brand-600" />
          <div className="flex-1">
            <p className="font-semibold text-ink-900">Sign in to order and track deliveries</p>
            <p className="text-sm text-ink-600">
              Demo account: <code className="rounded bg-white px-1.5 py-0.5 text-xs">customer@medspark.app</code>{" "}
              / <code className="rounded bg-white px-1.5 py-0.5 text-xs">demo1234</code>
            </p>
          </div>
          <LinkButton href="/login" icon={<ArrowRight size={16} />}>
            Sign in
          </LinkButton>
        </Card>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* How it works                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-8">
        <SectionTitle title="How MedSpark works" subtitle="Two clearly separated journeys" />
        <div className="grid gap-3 md:grid-cols-2">
          <Card className="border-emerald-200 bg-emerald-50/40">
            <div className="mb-2 flex items-center gap-2">
              <Pill size={18} className="text-emerald-700" />
              <h3 className="font-semibold text-emerald-900">OTC medicines</h3>
            </div>
            <ol className="space-y-1.5 text-sm text-emerald-900/85">
              {["Search", "Select quantity", "Choose a nearby pharmacy", "Place order", "Delivery"].map(
                (s, i) => (
                  <li key={s} className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ),
              )}
            </ol>
          </Card>
          <Card className="border-amber-200 bg-amber-50/40">
            <div className="mb-2 flex items-center gap-2">
              <FileText size={18} className="text-amber-700" />
              <h3 className="font-semibold text-amber-900">Prescription medicines</h3>
            </div>
            <ol className="space-y-1.5 text-sm text-amber-900/85">
              {[
                "Upload prescription",
                "Pharmacist review",
                "Customer verification call",
                "Approval",
                "Choose pharmacy → delivery",
              ].map((s, i) => (
                <li key={s} className="flex gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-600 text-[11px] font-bold text-white">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <ComplianceNote className="mt-3" />
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Audience                                                            */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-8 rounded-3xl border border-ink-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-ink-900">Built for people who can&apos;t just step out</h2>
        <p className="mt-1 text-sm text-ink-500">
          Large buttons, minimal steps, and no jargon — because the person ordering is often
          unwell, elderly, or ordering for someone in another city.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {AUDIENCE.map((a) => (
            <span
              key={a}
              className="rounded-full border border-ink-200 bg-ink-50 px-3 py-1.5 text-sm text-ink-700"
            >
              {a}
            </span>
          ))}
        </div>
        <p className="mt-5 rounded-2xl bg-ink-900 p-4 text-sm text-ink-100">
          <strong className="text-white">We are not replacing pharmacies.</strong> MedSpark builds a
          digital network of local pharmacies — the same trusted chemist near you, now reachable
          in minutes.
        </p>
      </section>
    </CustomerShell>
  );
}
