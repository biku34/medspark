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
import { CITIES, areasFor } from "@/lib/zones";
import { inr } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Header                                                                     */
/* -------------------------------------------------------------------------- */

function SearchBar({ className }: { className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
      className={clsx("relative", className)}
      role="search"
    >
      <Search
        size={18}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
      />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search for paracetamol, sanitary pads, BP monitor..."
        aria-label="Search medicines and health products"
        className="h-11 w-full rounded-lg border border-ink-200 bg-white pl-10 pr-3 text-[14px] text-ink-800 placeholder:text-ink-400 focus:border-brand-500"
      />
    </form>
  );
}

/**
 * Quick-commerce header: a brand bar carrying the delivery promise and the
 * delivery address, with search sitting on the white surface below it.
 */
export function CustomerHeader() {
  const { cartCount, cartTotal, user, location, origin } = useApp();
  const [locOpen, setLocOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 no-print">
        <div className="bg-brand-600 text-white">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-2.5 sm:px-4">
            <Link href="/" className="flex shrink-0 items-center gap-1.5">
              <LogoMark size={26} mono />
              <span className="text-[17px] font-extrabold tracking-tight">
                Dawa<span className="text-brand-200">Quick</span>
              </span>
            </Link>

            <button
              id="dawaquick-location-trigger"
              onClick={() => setLocOpen(true)}
              className="ml-1 flex min-w-0 items-center rounded-md px-1.5 py-1 text-left hover:bg-white/10"
            >
              <span className="min-w-0">
                <span className="block text-[13px] font-extrabold leading-tight">
                  Delivery in 20 mins
                </span>
                <span className="flex items-center gap-0.5 text-[11px] leading-tight text-brand-100">
                  <MapPin size={10} strokeWidth={3} className="shrink-0" />
                  <span className="max-w-24 truncate sm:max-w-56">
                    {location?.locality ?? origin.locality}
                  </span>
                  <ChevronDown size={12} className="shrink-0" />
                </span>
              </span>
            </button>

            <nav className="ml-auto flex items-center gap-1">
              <Link
                href="/bookings"
                className="hidden items-center gap-1.5 rounded-md px-2.5 py-2 text-[13px] font-semibold hover:bg-white/10 sm:flex"
              >
                <HeartPulse size={16} />
                Home Visits
              </Link>
              <Link
                href="/orders"
                className="hidden items-center rounded-md px-2.5 py-2 text-[13px] font-semibold hover:bg-white/10 sm:flex"
              >
                Orders
              </Link>
              {user ? (
                <Link
                  href="/profile"
                  aria-label="Profile"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[13px] font-bold"
                >
                  {user.name.slice(0, 1).toUpperCase()}
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-2 text-[13px] font-bold hover:bg-white/10"
                >
                  <LogIn size={16} />
                  Login
                </Link>
              )}
              <Link
                href="/cart"
                aria-label={`Cart, ${cartCount} items`}
                className="ml-1 hidden items-center gap-1.5 rounded-lg bg-brand-800 px-3 py-2 text-[13px] font-bold sm:flex"
              >
                <ShoppingCart size={16} />
                {cartCount > 0 ? `${cartCount} · ${inr(cartTotal)}` : "Cart"}
              </Link>
            </nav>
          </div>
        </div>

        <div className="border-b border-ink-200 bg-white">
          <div className="mx-auto max-w-6xl px-3 py-2 sm:px-4">
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
  { href: "/category/wellness", label: "Categories", icon: LayoutGrid },
  { href: "/care", label: "Care", icon: HeartPulse },
  { href: "/subscriptions", label: "Repeat", icon: RefreshCw },
  { href: "/profile", label: "Account", icon: UserIcon },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-white sm:hidden no-print">
      <div className="mx-auto flex max-w-lg">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-bold transition-colors",
                active ? "text-brand-700" : "text-ink-500",
              )}
            >
              <Icon size={19} strokeWidth={active ? 2.6 : 2} />
              {label}
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

/** The green "view cart" bar that follows you around a grocery app. */
function CartBar() {
  const { cart, cartCount, cartTotal } = useApp();
  const pathname = usePathname();
  const hideOn = ["/cart", "/checkout", "/select-pharmacy"];

  if (cart.length === 0 || hideOn.some((p) => pathname.startsWith(p))) return null;

  return (
    <div className="fixed inset-x-0 bottom-12 z-40 px-3 sm:bottom-4 no-print">
      <Link
        href="/cart"
        className="slide-up mx-auto flex max-w-2xl items-center gap-3 rounded-xl bg-brand-600 px-4 py-2.5 text-white shadow-lg shadow-brand-900/25"
      >
        <span className="flex -space-x-2">
          {cart.slice(0, 3).map((l) => (
            <span
              key={l.medicineId}
              className="flex h-8 w-8 items-center justify-center rounded-md border-2 border-brand-600 bg-white text-base"
            >
              {l.emoji}
            </span>
          ))}
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] font-extrabold leading-tight">
            {cartCount} item{cartCount > 1 ? "s" : ""}
          </span>
          <span className="block text-[11px] leading-tight text-brand-100">{inr(cartTotal)}</span>
        </span>
        <span className="ml-auto flex items-center gap-0.5 text-[14px] font-extrabold">
          View cart <ChevronRight size={16} strokeWidth={3} />
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
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
        <MapPin size={18} className="shrink-0 text-amber-600" />
        <p className="min-w-0 flex-1 text-[13px] text-amber-900">
          <strong>We are not live in your area yet.</strong> DawaQuick currently delivers in
          Gandhinagar and Ahmedabad.
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
                className="rounded-md bg-amber-600 px-3 py-1.5 text-[13px] font-bold text-white hover:bg-amber-700"
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
  const { user, userLoading } = useApp();
  const pathname = usePathname();
  const router = useRouter();

  // Staff who land on a customer page get sent to their own dashboard.
  useEffect(() => {
    if (userLoading || !user) return;
    if (user.role === "customer") return;
    const home = {
      provider: "/provider",
      pharmacist: "/pharmacist",
      pharmacy: "/pharmacy",
      delivery: "/delivery",
      admin: "/admin",
      customer: "/",
    }[user.role];
    if (home && !pathname.startsWith(home)) router.replace(home);
  }, [user, userLoading, pathname, router]);

  return (
    <div className="flex min-h-dvh flex-col">
      <CustomerHeader />
      <ServiceAreaBanner />
      <main
        className={clsx(
          "mx-auto w-full flex-1 px-3 pb-28 pt-3 sm:px-4 sm:pb-10",
          wide ? "max-w-6xl" : "max-w-3xl",
        )}
      >
        {children}
      </main>
      <BottomNav />
      <CartBar />
      <LocationPermissionGate />
      <footer className="border-t border-ink-200 bg-white px-4 py-6 text-center text-[11px] text-ink-400 no-print">
        <p className="mx-auto max-w-2xl">
          DawaQuick is a technology platform connecting customers with licensed local pharmacies.
          It does not dispense medicines itself. Prescription medicines are dispensed only after
          applicable prescription and pharmacist verification requirements are satisfied.
        </p>
        <p className="mt-2">
          <Link href="/login" className="font-semibold text-ink-500 underline">
            Partner &amp; staff login
          </Link>
        </p>
      </footer>
    </div>
  );
}
