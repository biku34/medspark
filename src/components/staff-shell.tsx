"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { LogOut, RefreshCcw } from "lucide-react";
import { Logo } from "./brand";
import { useApp } from "./providers";
import { Button } from "./ui";
import type { Role } from "@/lib/types";

const ROLE_LABEL: Record<Role, string> = {
  customer: "Customer",
  provider: "Home Care Provider",
  pharmacist: "Pharmacist Console",
  pharmacy: "Pharmacy Dashboard",
  delivery: "Delivery Partner",
  admin: "Admin Console",
};

/**
 * Chrome for every non-customer role. Access is checked on the client for the
 * prototype's convenience *and* on every API route for real (see lib/api.ts).
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
      <div className="flex min-h-dvh items-center justify-center text-sm text-ink-500">
        Checking access…
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#f7f7f7]">
      <header className="sticky top-0 z-30 border-b border-ink-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <Logo size="sm" href="/" />
          <span className="rounded-md bg-brand-600 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white">
            {ROLE_LABEL[role]}
          </span>

          {nav && (
            <nav className="no-scrollbar order-last flex w-full gap-1 overflow-x-auto md:order-none md:w-auto">
              {nav.map((n) => {
                const active = pathname === n.href;
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={clsx(
                      "shrink-0 rounded-md px-3 py-1.5 text-[13px] font-bold",
                      active ? "bg-brand-50 text-brand-700" : "text-ink-600 hover:bg-ink-100",
                    )}
                  >
                    {n.label}
                  </Link>
                );
              })}
            </nav>
          )}

          <div className="ml-auto flex items-center gap-2">
            {actions}
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCcw size={14} />}
              onClick={() => router.refresh()}
            >
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight text-ink-800">{user.name}</p>
              <p className="text-[11px] text-ink-400">{user.email}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={<LogOut size={14} />}
              onClick={async () => {
                await signOut();
                toast({ kind: "info", title: "Signed out" });
                router.push("/login");
              }}
            >
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">{children}</main>
    </div>
  );
}
