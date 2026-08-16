"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  ChevronDown,
  FileText,
  HeartPulse,
  Home,
  LogIn,
  MapPin,
  Package,
  Search,
  ShoppingCart,
  User as UserIcon,
} from "lucide-react";
import { Logo, PrototypeRibbon } from "./brand";
import { LocationPermissionGate, LocationSheet } from "./location-sheet";
import { useApp } from "./providers";
import { CITIES, areasFor } from "@/lib/zones";

/* -------------------------------------------------------------------------- */
/* Header                                                                     */
/* -------------------------------------------------------------------------- */

function SearchBar({ compact }: { compact?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
      className={clsx("relative flex-1", compact ? "max-w-none" : "max-w-xl")}
      role="search"
    >
      <Search
        size={18}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400"
      />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search medicines, health products..."
        aria-label="Search medicines"
        className="w-full rounded-xl border border-ink-200 bg-ink-50/70 py-2.5 pl-10 pr-3 text-[15px] text-ink-800 placeholder:text-ink-400 transition-colors hover:bg-white focus:border-brand-400 focus:bg-white"
      />
    </form>
  );
}

export function CustomerHeader() {
  const { cartCount, user, location } = useApp();
  const [locOpen, setLocOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-ink-200 bg-white/95 backdrop-blur no-print">
        <div className="mx-auto max-w-6xl px-4">
          {/* Row 1 */}
          <div className="flex h-14 items-center gap-3 sm:h-16">
            <Logo size="md" />

            <button
              id="dawaquick-location-trigger"
              onClick={() => setLocOpen(true)}
              className="ml-1 flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-left hover:bg-ink-100"
            >
              <MapPin size={16} className="shrink-0 text-brand-600" />
              <span className="min-w-0">
                <span className="block text-[10px] font-medium uppercase leading-none tracking-wide text-ink-400">
                  Deliver to
                </span>
                <span className="block max-w-32 truncate text-sm font-semibold text-ink-800 sm:max-w-48">
                  {location?.locality ?? "Set location"}
                </span>
              </span>
              <ChevronDown size={14} className="shrink-0 text-ink-400" />
            </button>

            <div className="hidden flex-1 md:flex">
              <SearchBar />
            </div>

            <nav className="ml-auto flex items-center gap-1">
              <Link
                href="/orders"
                className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100 sm:flex"
              >
                <Package size={18} />
                Orders
              </Link>
              <Link
                href="/bookings"
                className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100 sm:flex"
              >
                <HeartPulse size={18} />
                Home Visits
              </Link>
              <Link
                href="/prescriptions"
                className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100 lg:flex"
              >
                <FileText size={18} />
                Prescriptions
              </Link>
              <Link
                href="/cart"
                aria-label={`Cart, ${cartCount} items`}
                className="relative rounded-lg p-2.5 text-ink-600 hover:bg-ink-100"
              >
                <ShoppingCart size={20} />
                {cartCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-600 px-1 text-[11px] font-bold text-white">
                    {cartCount}
                  </span>
                )}
              </Link>
              {user ? (
                <Link
                  href="/profile"
                  aria-label="Profile"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white"
                >
                  {user.name.slice(0, 1).toUpperCase()}
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                >
                  <LogIn size={18} />
                  Sign in
                </Link>
              )}
            </nav>
          </div>

          {/* Row 2 — search on small screens */}
          <div className="pb-3 md:hidden">
            <SearchBar compact />
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
  { href: "/search", label: "Search", icon: Search },
  { href: "/prescriptions/upload", label: "Upload ℞", icon: FileText },
  { href: "/bookings", label: "Visits", icon: HeartPulse },
  { href: "/profile", label: "Profile", icon: UserIcon },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-white/95 backdrop-blur sm:hidden no-print">
      <div className="mx-auto flex max-w-lg">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors",
                active ? "text-brand-700" : "text-ink-500",
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 1.9} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/* Shell                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Shown when the browser reports a location DawaQuick doesn't cover yet.
 * Honest about the limit, and one tap away from a servable area.
 */
function ServiceAreaBanner() {
  const { location, setLocation } = useApp();
  if (!location?.outsideServiceArea) return null;

  return (
    <div className="mx-auto mt-3 w-full max-w-6xl px-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
        <MapPin size={18} className="shrink-0 text-amber-600" />
        <p className="min-w-0 flex-1 text-sm text-amber-900">
          <strong>DawaQuick isn&apos;t live in your area yet.</strong> We currently deliver in
          Gandhinagar and Ahmedabad. Pick an area there to explore the demo.
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
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700"
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

export function CustomerShell({
  children,
  wide,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
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
      <PrototypeRibbon />
      <CustomerHeader />
      <ServiceAreaBanner />
      <main
        className={clsx(
          "mx-auto w-full flex-1 px-4 pb-24 pt-4 sm:pb-10",
          wide ? "max-w-6xl" : "max-w-3xl",
        )}
      >
        {children}
      </main>
      <BottomNav />
      <LocationPermissionGate />
      <footer className="border-t border-ink-200 bg-white px-4 py-6 text-center text-xs text-ink-400 no-print">
        <p className="mx-auto max-w-2xl">
          DawaQuick is a technology platform that connects customers with licensed local
          pharmacies. It does not dispense medicines itself. Prescription medicines are
          dispensed only after applicable prescription and pharmacist verification
          requirements are satisfied.
        </p>
        <p className="mt-2">
          <Link href="/login" className="font-medium text-ink-500 underline">
            Partner &amp; staff sign in
          </Link>
        </p>
      </footer>
    </div>
  );
}
