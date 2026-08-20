"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  HeartPulse,
  Home,
  LayoutGrid,
  LogIn,
  MapPin,
  Search,
  ShoppingCart,
  Stethoscope,
  Truck,
  X,
  User as UserIcon,
} from "lucide-react";
import { LogoMark } from "./brand";
import { LocationPermissionGate, LocationSheet } from "./location-sheet";
import { useApp } from "./providers";
import { ProductArt } from "./art";
import { MiniTracker } from "./order-tracker";
import { api } from "@/lib/client";
import { ORDER_LABELS, type Order } from "@/lib/types";
import { CITIES, areasFor } from "@/lib/zones";
import { inr } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Header                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Rotating placeholder.
 *
 * A static "search for medicines" box teaches nobody what the catalogue holds.
 * Cycling real products is how a shopper finds out there are pads and BP
 * monitors in here too, without a line of marketing copy.
 */
const HINTS = [
  "paracetamol",
  "sanitary pads",
  "BP monitor",
  "cough syrup",
  "baby wipes",
  "glucometer strips",
  "hand sanitiser",
  "vitamin D",
];

function SearchBar({ autoFocusHint = true }: { autoFocusHint?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hint, setHint] = useState(0);

  useEffect(() => {
    if (!autoFocusHint) return;
    const t = setInterval(() => setHint((h) => (h + 1) % HINTS.length), 2600);
    return () => clearInterval(t);
  }, [autoFocusHint]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
      className="relative"
      role="search"
    >
      <Search
        size={18}
        strokeWidth={2.6}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500"
      />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search medicines and health products"
        className="h-12 w-full rounded-xl border border-ink-200 bg-white pl-11 pr-3 text-[15px] font-medium text-ink-900 shadow-sm outline-none placeholder:text-transparent focus:border-brand-400"
      />
      {/* The animated hint sits behind the real input so typing hides it. */}
      {q === "" && (
        <span className="pointer-events-none absolute left-11 top-1/2 flex -translate-y-1/2 items-baseline gap-1 text-[15px] text-ink-500">
          Search
          <span key={hint} className="rise font-semibold text-ink-700">
            &ldquo;{HINTS[hint]}&rdquo;
          </span>
        </span>
      )}
    </form>
  );
}

/**
 * The header is the promise.
 *
 * Every quick-commerce app that works puts one number above everything else,
 * because it is the only reason the customer chose an app over the chemist
 * downstairs. Ours is the delivery time, set in 28px, with the address as a
 * quiet second line under it.
 */
export function CustomerHeader() {
  const { cartCount, cartTotal, user, location, origin } = useApp();
  const [locOpen, setLocOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 no-print">
        <div className="bg-brand-700 text-white">
          <div className="mx-auto max-w-6xl px-3 pb-2.5 pt-2 sm:px-4 sm:pb-3">
            {/* row 1 — identity and account */}
            <div className="flex items-center gap-2">
              <Link href="/" className="flex shrink-0 items-center gap-1.5">
                <LogoMark size={22} mono />
                <span className="text-[15px] font-extrabold tracking-tight">
                  Dawa<span className="text-brand-200">Quick</span>
                </span>
              </Link>

              <nav className="ml-auto flex items-center gap-0.5">
                <Link
                  href="/services"
                  className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-bold text-white/85 hover:bg-white/10 sm:flex"
                >
                  <Stethoscope size={15} />
                  Home visits
                </Link>
                <Link
                  href="/orders"
                  className="hidden items-center rounded-lg px-2.5 py-1.5 text-[13px] font-bold text-white/85 hover:bg-white/10 sm:flex"
                >
                  Orders
                </Link>
                {user ? (
                  <Link
                    href="/profile"
                    aria-label="Profile"
                    className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-[13px] font-extrabold ring-1 ring-white/25"
                  >
                    {user.name.slice(0, 1).toUpperCase()}
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    className="ml-1 flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-[13px] font-extrabold ring-1 ring-white/25 hover:bg-white/25"
                  >
                    <LogIn size={15} />
                    Login
                  </Link>
                )}
                <Link
                  href="/cart"
                  aria-label={`Cart, ${cartCount} items`}
                  className="ml-1 hidden items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[13px] font-extrabold text-brand-800 hover:bg-brand-50 sm:flex"
                >
                  <ShoppingCart size={15} strokeWidth={2.6} />
                  {cartCount > 0 ? `${cartCount} · ${inr(cartTotal)}` : "Cart"}
                </Link>
              </nav>
            </div>

            {/* row 2 — the promise */}
            <button
              id="dawaquick-location-trigger"
              onClick={() => setLocOpen(true)}
              className="mt-1.5 flex w-full items-end gap-2 rounded-lg text-left"
            >
              <span className="min-w-0">
                <span className="flex items-baseline gap-1.5">
                  <span className="text-[28px] font-extrabold leading-none tracking-tight sm:text-[32px]">
                    20 minutes
                  </span>
                  <span className="text-[13px] font-bold text-brand-200">delivery</span>
                </span>
                <span className="mt-1 flex items-center gap-1 text-[12px] font-semibold text-white/80">
                  <MapPin size={12} strokeWidth={3} className="shrink-0" />
                  <span className="max-w-[15rem] truncate">
                    {location?.address ?? `${origin.locality}, ${origin.city}`}
                  </span>
                  <ChevronDown size={14} strokeWidth={3} className="shrink-0" />
                </span>
              </span>
            </button>
          </div>
        </div>

        {/* search rides the fold between the brand band and the page */}
        <div className="bg-brand-700 pb-2.5">
          <div className="mx-auto max-w-6xl px-3 sm:px-4">
            <SearchBar />
          </div>
        </div>
      </header>
      <LocationSheet open={locOpen} onClose={() => setLocOpen(false)} />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Bottom navigation (mobile)                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Five tabs, and home visits earn one of them.
 *
 * Repeat delivery lost its slot deliberately: it is a setting you put on an
 * order (at checkout, from a care plan, from the home band), not somewhere you
 * go. Physiotherapy and nursing are a service you buy — half of what this
 * platform sells — and leaving them out of the tab bar was the single loudest
 * signal that they were an afterthought.
 */
const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/category/wellness", label: "Shop", icon: LayoutGrid },
  { href: "/services", label: "Visits", icon: Stethoscope },
  { href: "/care", label: "Care", icon: HeartPulse },
  { href: "/profile", label: "Account", icon: UserIcon },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden no-print">
      <div className="mx-auto flex max-w-lg">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2"
            >
              {/* the active marker is a bar at the top edge, like a real tab bar */}
              <span
                className={clsx(
                  "absolute inset-x-5 top-0 h-[3px] rounded-b-full transition-opacity",
                  active ? "bg-brand-600 opacity-100" : "opacity-0",
                )}
              />
              <Icon
                size={20}
                strokeWidth={active ? 2.7 : 2}
                className={active ? "text-brand-700" : "text-ink-500"}
              />
              <span
                className={clsx(
                  "text-[10px] font-bold leading-none",
                  active ? "text-brand-800" : "text-ink-500",
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/* Bottom dock — live order, then cart                                        */
/* -------------------------------------------------------------------------- */

/**
 * The order in flight, docked to the bottom of the screen.
 *
 * A delivery in progress is a live thing, not a page section: the customer
 * keeps shopping while it runs and wants the ETA within thumb reach on
 * whatever screen they wander to. So it follows them, sitting above the tab
 * bar rather than pushing the catalogue down from the top.
 */
/**
 * Screens that own the bottom edge of the display.
 *
 * Each ends in a primary action pinned down there — "Confirm Booking", "Place
 * order" — so a floating bar does not merely clutter them, it covers the
 * button the customer came to press. Both docked bars read this one list
 * rather than keeping their own, which is how they drifted apart in the first
 * place.
 *
 * The home-visit hub at /services is not included: it is a browse screen, and
 * only the booking pages beneath it pin an action.
 */
const OWNS_BOTTOM = [/^\/checkout/, /^\/services\/[^/]+$/];

const ownsBottom = (pathname: string) => OWNS_BOTTOM.some((r) => r.test(pathname));

/** Dismissals live here so a card stays gone as you move between pages. */
const DISMISSED_KEY = "dawaquick.dismissedOrders";

type Dismissed = Record<string, string>;

function readDismissed(): Dismissed {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    return raw ? (JSON.parse(raw) as Dismissed) : {};
  } catch {
    return {};
  }
}

function writeDismissed(value: Dismissed) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(value));
  } catch {
    /* private mode — dismissals just do not survive the session */
  }
}

/**
 * The orders in flight, docked to the bottom of the screen.
 *
 * Deliveries in progress are live things, not page sections: the customer keeps
 * shopping while they run and wants the ETA within thumb reach on whatever
 * screen they wander to. So the dock follows them, sitting above the tab bar.
 *
 * With more than one order it becomes a swipeable carousel rather than a stack,
 * because two full cards would eat half a phone screen. Each card can be
 * dismissed — but the dismissal is remembered against the order's *status*, so
 * the card comes back the moment something actually changes ("Out for
 * delivery" is news even if you waved away "Order confirmed"). A dismissal
 * hides a card; it never stops the order.
 */
function LiveOrders() {
  const { user } = useApp();
  const pathname = usePathname();
  const [orders, setOrders] = useState<Order[]>([]);
  const [dismissed, setDismissed] = useState<Dismissed>({});
  const [page, setPage] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);

  // Redundant on the tracking page itself, and in the way of a pinned action.
  const muted = /^\/orders\/[^/]+/.test(pathname) || ownsBottom(pathname);

  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  useEffect(() => {
    if (!user || muted) {
      setOrders([]);
      return;
    }
    let alive = true;
    const load = () =>
      api<{ orders: Order[] }>("/api/orders")
        .then((d) => {
          if (alive) setOrders(d.orders);
        })
        .catch(() => {});
    void load();
    const t = setInterval(load, 20_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [user, muted, pathname]);

  if (muted) return null;

  const live = orders
    .filter((o) => !["DELIVERED", "CANCELLED", "REJECTED"].includes(o.status))
    .filter((o) => dismissed[o.id] !== o.status)
    .sort((a, b) => a.promisedTo.localeCompare(b.promisedTo));

  if (live.length === 0) return null;

  const hide = (o: Order) => {
    const next = { ...dismissed, [o.id]: o.status };
    setDismissed(next);
    writeDismissed(next);
  };

  const goTo = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  const current = Math.min(page, live.length - 1);

  return (
    <div>
      <div
        ref={trackRef}
        data-qa="order-track"
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.clientWidth > 0) setPage(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
      >
        {live.map((o) => (
          <div key={o.id} className="w-full shrink-0 snap-center">
            <article className="overflow-hidden rounded-2xl bg-ink-900 text-white shadow-xl shadow-ink-900/25">
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                <Link
                  href={`/orders/${o.id}`}
                  className="flex min-w-0 flex-1 items-center gap-2.5"
                >
                  <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
                    <Truck size={17} strokeWidth={2.4} className="text-brand-300" />
                    <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                      <span className="pulse-ring absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-400 ring-2 ring-ink-900" />
                    </span>
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-extrabold leading-tight">
                      {ORDER_LABELS[o.status]}
                    </span>
                    <span className="block truncate text-[11px] text-white/55">
                      {o.code} · {o.pharmacyName}
                    </span>
                  </span>

                  <span className="nums shrink-0 rounded-lg bg-brand-500 px-2 py-1 text-center text-[13px] font-extrabold leading-none">
                    {o.etaMinFrom}–{o.etaMinTo}
                    <span className="block text-[9px] font-bold text-brand-100">MIN</span>
                  </span>
                </Link>

                {/* Outside the Link so tapping it never navigates. */}
                <button
                  onClick={() => hide(o)}
                  data-qa="order-close"
                  aria-label={`Hide ${o.code} from the bottom bar`}
                  className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X size={16} strokeWidth={2.6} />
                </button>
              </div>

              <Link href={`/orders/${o.id}`} className="block px-3 pb-2.5">
                <MiniTracker status={o.status} />
              </Link>
            </article>
          </div>
        ))}
      </div>

      {/* Dots, only when there is something to slide between. */}
      {live.length > 1 && (
        <div className="mt-1.5 flex items-center justify-center gap-1.5">
          {live.map((o, i) => (
            <button
              key={o.id}
              onClick={() => goTo(i)}
              data-qa="order-dot"
              aria-label={`Show order ${i + 1} of ${live.length}`}
              aria-current={i === current}
              className={clsx(
                "h-1.5 rounded-full transition-all",
                i === current ? "w-5 bg-ink-900" : "w-1.5 bg-ink-900/30",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CartCard() {
  const { cart, cartCount, cartTotal } = useApp();
  const pathname = usePathname();
  const hideOn = ["/cart", "/select-pharmacy"];

  if (cart.length === 0) return null;
  if (hideOn.some((p) => pathname.startsWith(p)) || ownsBottom(pathname)) return null;

  return (
    <Link
      href="/cart"
      className="slide-up flex items-center gap-3 rounded-2xl bg-brand-600 px-3 py-2.5 text-white shadow-xl shadow-brand-900/30"
    >
      <span className="flex -space-x-2.5">
        {cart.slice(0, 3).map((l) => (
          <span
            key={l.medicineId}
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border-2 border-brand-600 bg-white"
          >
            <ProductArt subcategory={l.subcategory ?? ""} form={l.form} size={30} />
          </span>
        ))}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-extrabold leading-tight">
          {cartCount} item{cartCount > 1 ? "s" : ""}
        </span>
        <span className="nums block text-[12px] font-semibold leading-tight text-brand-100">
          {inr(cartTotal)}
        </span>
      </span>
      <span className="ml-auto flex items-center gap-0.5 text-[15px] font-extrabold">
        View cart <ChevronRight size={17} strokeWidth={3} />
      </span>
    </Link>
  );
}

/**
 * Both floating bars share one stack so they can never overlap each other or
 * the tab bar, however many of them happen to be on screen.
 */
function BottomDock() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(3.25rem_+_env(safe-area-inset-bottom))] z-40 px-3 sm:bottom-4 no-print">
      <div className="pointer-events-auto mx-auto flex max-w-2xl flex-col gap-2">
        <LiveOrders />
        <CartCard />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Shell                                                                      */
/* -------------------------------------------------------------------------- */

/** Shown when the browser reports a location DawaQuick doesn't cover yet. */
function ServiceAreaBanner() {
  const { location, setLocation } = useApp();
  if (!location?.outsideServiceArea) return null;

  return (
    <div className="mx-auto mt-3 w-full max-w-6xl px-3 sm:px-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-rx-300 bg-rx-50 p-3">
        <MapPin size={18} className="shrink-0 text-rx-600" />
        <p className="min-w-0 flex-1 text-[13px] text-rx-800">
          <strong className="font-extrabold">Not live in your area yet.</strong> DawaQuick
          delivers across Gandhinagar and Ahmedabad.
        </p>
        <div className="flex gap-2">
          {CITIES.map((city) => {
            const area = areasFor(city)[0];
            return (
              <button
                key={city}
                onClick={() =>
                  setLocation({
                    locality: area.name,
                    city: area.city,
                    address: `${area.name}, ${area.city}`,
                    lat: area.lat,
                    lng: area.lng,
                    source: "manual",
                  })
                }
                className="rounded-lg bg-rx-600 px-3 py-1.5 text-[13px] font-extrabold text-white hover:bg-rx-700"
              >
                {city}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function CustomerShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <CustomerHeader />
      <ServiceAreaBanner />
      <main
        className={clsx(
          "mx-auto w-full flex-1 px-3 pb-36 pt-3 sm:px-4 sm:pb-8",
          wide ? "max-w-7xl" : "max-w-6xl",
        )}
      >
        {children}
      </main>
      <BottomNav />
      <BottomDock />
      <LocationPermissionGate />
      <footer className="border-t border-ink-200 bg-white px-4 py-7 text-center text-[11px] leading-relaxed text-ink-400 no-print">
        <p className="mx-auto max-w-2xl">
          DawaQuick is a technology platform connecting customers with licensed local pharmacies.
          It does not dispense medicines itself. Prescription medicines are dispensed only after
          applicable prescription and pharmacist verification requirements are satisfied.
        </p>
        <p className="mt-2.5">
          <Link href="/login" className="font-bold text-ink-500 underline">
            Partner &amp; staff login
          </Link>
        </p>
      </footer>
    </div>
  );
}
