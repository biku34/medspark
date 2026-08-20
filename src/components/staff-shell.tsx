"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LogOut, RefreshCcw } from "lucide-react";
import { LogoMark } from "./brand";
import { useApp } from "./providers";
import type { Role } from "@/lib/types";

const ROLE_LABEL: Record<Role, string> = {
  customer: "Customer",
  provider: "Home Care",
  pharmacist: "Pharmacist",
  pharmacy: "Pharmacy",
  delivery: "Delivery",
  admin: "Admin",
};

/** A quiet live clock — ops staff work to the minute. */
function Clock() {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const set = () =>
      setNow(
        new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
      );
    set();
    const t = setInterval(set, 30_000);
    return () => clearInterval(t);
  }, []);
  return <span className="hidden font-mono text-[12px] text-white/60 lg:inline">{now}</span>;
}

/**
 * Chrome for every non-customer role.
 *
 * Deliberately dark, unlike the customer app's green — staff should never be
 * unsure which side of the platform they are looking at. Access is checked
 * here for convenience and again on every API route for real (see lib/api.ts).
 */
export function StaffShell({
  role,
  children,
  nav,
  actions,
}: {
  role: Role;
  children: ReactNode;
  nav?: Array<{ href: string; label: string }>;
  actions?: ReactNode;
}) {
  const { user, userLoading, signOut, toast } = useApp();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (userLoading) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (user.role !== role) router.replace("/login");
  }, [user, userLoading, role, router, pathname]);

  if (userLoading || !user || user.role !== role) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-[13px] text-ink-500">
        Checking access…
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#f2f3f5]">
      <header className="sticky top-0 z-30 bg-ink-900 text-white">
        <div className="mx-auto flex max-w-7xl items-center gap-2.5 px-3 py-2 sm:px-4">
          <Link href="/" className="flex shrink-0 items-center gap-1.5">
            <LogoMark size={22} mono />
            <span className="hidden text-[15px] font-extrabold tracking-tight sm:inline">
              Dawa<span className="text-brand-400">Quick</span>
            </span>
          </Link>

          <span className="rounded bg-brand-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider">
            {ROLE_LABEL[role]}
          </span>

          <Clock />

          <div className="ml-auto flex items-center gap-2">
            {actions}
            <button
              onClick={() => router.refresh()}
              className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[12px] font-semibold text-white/80 hover:bg-white/10"
            >
              <RefreshCcw size={13} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-[12px] font-bold">{user.name}</p>
              <p className="text-[10px] text-white/50">{user.email}</p>
            </div>
            <button
              onClick={async () => {
                await signOut();
                toast({ kind: "info", title: "Signed out" });
                router.push("/login");
              }}
              className="flex h-8 items-center gap-1.5 rounded-md bg-white/10 px-2.5 text-[12px] font-semibold hover:bg-white/20"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>

        {nav && (
          <div className="border-t border-white/10">
            <nav className="no-scrollbar mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 sm:px-4">
              {nav.map((n) => {
                const active = pathname === n.href;
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={clsx(
                      "shrink-0 border-b-2 px-3 py-2 text-[13px] font-bold transition-colors",
                      active
                        ? "border-brand-400 text-white"
                        : "border-transparent text-white/60 hover:text-white",
                    )}
                  >
                    {n.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-3 sm:px-4 sm:py-4">{children}</main>
    </div>
  );
}

/**
 * Horizontal queue switcher used inside the staff panels.
 * The selected tab is solid so the current queue is unmistakable, and a
 * non-zero urgent count turns red.
 */
export function QueueTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: T; label: string; count?: number; urgent?: boolean }>;
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={clsx(
              "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-bold transition-colors",
              on
                ? "bg-ink-900 text-white"
                : "border border-ink-200 bg-white text-ink-600 hover:bg-ink-100",
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={clsx(
                  "rounded px-1.5 py-px text-[11px] font-extrabold tabular-nums",
                  on
                    ? "bg-white/20"
                    : t.urgent && t.count > 0
                      ? "bg-red-600 text-white"
                      : "bg-ink-200 text-ink-600",
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
