"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  HeartPulse,
  Home,
  LayoutGrid,
  LogIn,
  MapPin,
  RefreshCw,
  Search,
  ShoppingCart,
  User as UserIcon,
} from "lucide-react";
import { LogoMark } from "./brand";
import { LocationPermissionGate, LocationSheet } from "./location-sheet";
import { useApp } from "./providers";
import { ProductArt } from "./art";
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
                  href="/bookings"
                  className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-bold text-white/85 hover:bg-white/10 sm:flex"
                >
                  <HeartPulse size={15} />
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

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/category/wellness", label: "Shop", icon: LayoutGrid },
  { href: "/care", label: "Care", icon: HeartPulse },
  { href: "/subscriptions", label: "Repeat", icon: RefreshCw },
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
/* Sticky cart bar                                                            */
/* -------------------------------------------------------------------------- */

function CartBar() {
  const { cart, cartCount, cartTotal } = useApp();
  const pathname = usePathname();
  const hideOn = ["/cart", "/checkout", "/select-pharmacy"];

  if (cart.length === 0 || hideOn.some((p) => pathname.startsWith(p))) return null;

  return (
    <div className="fixed inset-x-0 bottom-[4.25rem] z-40 px-3 sm:bottom-4 no-print">
      <Link
        href="/cart"
        className="slide-up mx-auto flex max-w-2xl items-center gap-3 rounded-2xl bg-brand-600 px-3 py-2.5 text-white shadow-xl shadow-brand-900/30"
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
          "mx-auto w-full flex-1 px-3 pb-28 pt-3 sm:px-4 sm:pb-8",
          wide ? "max-w-7xl" : "max-w-6xl",
        )}
      >
        {children}
      </main>
      <BottomNav />
      <CartBar />
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
