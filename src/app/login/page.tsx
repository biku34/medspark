"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Bike,
  Building2,
  HandHeart,
  HeartPulse,
  LogIn,
  Shield,
  Stethoscope,
  User,
} from "lucide-react";
import { BRAND, Logo } from "@/components/brand";
import { useApp } from "@/components/providers";
import { Button, Card, Field, Input, Skeleton } from "@/components/ui";
import { post } from "@/lib/client";
import type { Role, User as AppUser } from "@/lib/types";

const DEMO_ACCOUNTS: Array<{
  role: Role;
  email: string;
  label: string;
  who: string;
  icon: typeof User;
  tone: string;
}> = [
  {
    role: "customer",
    email: "customer@dawaquick.app",
    label: "Customer",
    who: "Aarav Mehta",
    icon: User,
    tone: "bg-brand-50 text-brand-700 border-brand-200",
  },
  {
    role: "pharmacist",
    email: "pharmacist@dawaquick.app",
    label: "Pharmacist",
    who: "Dr. Neha Shah",
    icon: Stethoscope,
    tone: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    role: "pharmacy",
    email: "pharmacy@dawaquick.app",
    label: "Pharmacy",
    who: "HealthFirst Pharmacy",
    icon: Building2,
    tone: "bg-ok-50 text-ok-700 border-ok-200",
  },
  {
    role: "delivery",
    email: "rider@dawaquick.app",
    label: "Delivery",
    who: "Imran Qureshi",
    icon: Bike,
    tone: "bg-sky-50 text-sky-700 border-sky-200",
  },
  {
    role: "provider",
    email: "physio@dawaquick.app",
    label: "Physiotherapist",
    who: "Dr. Ankit Rawal (PT)",
    icon: HeartPulse,
    tone: "bg-teal-50 text-teal-700 border-teal-200",
  },
  {
    role: "provider",
    email: "nurse@dawaquick.app",
    label: "Nurse",
    who: "Sr. Kavita Patel (RN)",
    icon: HandHeart,
    tone: "bg-rose-50 text-rose-700 border-rose-200",
  },
  {
    role: "admin",
    email: "admin@dawaquick.app",
    label: "Admin",
    who: "DawaQuick Ops",
    icon: Shield,
    tone: "bg-violet-50 text-violet-700 border-violet-200",
  },
];

const PASSWORD = "demo1234";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const { refreshUser, toast } = useApp();

  const [email, setEmail] = useState("customer@dawaquick.app");
  const [password, setPassword] = useState(PASSWORD);
  const [busy, setBusy] = useState<string | null>(null);

  const signIn = async (asEmail: string, asPassword: string) => {
    setBusy(asEmail);
    try {
      const res = await post<{ home: string; user: AppUser }>("/api/auth/login", {
        email: asEmail,
        password: asPassword,
      });
      await refreshUser();
      toast({ kind: "success", title: `Signed in as ${res.user.name}` });
      router.push(next && res.user.role === "customer" ? next : res.home);
    } catch (e) {
      toast({ kind: "error", title: "Sign in failed", body: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-ink-50">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-4 py-8">
        <Logo size="lg" />
        <p className="mt-2 text-center text-sm text-ink-500">{BRAND.tagline}</p>

        <div className="mt-7 grid w-full gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* ------------------------- one-tap demo ------------------------- */}
          <Card>
            <h2 className="text-lg font-semibold text-ink-900">Demo sign-in</h2>
            <p className="mt-1 text-sm text-ink-500">
              One tap to enter any role. Password for every account is{" "}
              <code className="rounded bg-ink-100 px-1.5 py-0.5 text-xs">{PASSWORD}</code>.
            </p>

            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {DEMO_ACCOUNTS.map((a) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.email}
                    onClick={() => signIn(a.email, PASSWORD)}
                    disabled={busy !== null}
                    className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-transform hover:-translate-y-0.5 disabled:opacity-60 ${a.tone}`}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70">
                      <Icon size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">{a.label}</span>
                      <span className="block truncate text-xs opacity-80">{a.who}</span>
                      <span className="block truncate text-[11px] opacity-60">{a.email}</span>
                    </span>
                    {busy === a.email ? (
                      <span className="text-xs font-medium">…</span>
                    ) : (
                      <ArrowRight size={16} className="shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            <p className="mt-4 rounded-xl bg-ink-50 p-3 text-xs text-ink-500">
              Each role opens a different interface: customers order and book home visits, pharmacists
              verify prescriptions, pharmacies pack orders, riders deliver, physiotherapists and
              nurses manage home visits, and admin runs the network.
            </p>
          </Card>

          {/* --------------------------- manual form ------------------------ */}
          <Card>
            <h2 className="text-lg font-semibold text-ink-900">Sign in</h2>
            <form
              className="mt-3 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void signIn(email.trim().toLowerCase(), password);
              }}
            >
              <Field label="Email" required>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                />
              </Field>
              <Field label="Password" required>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </Field>
              <Button full size="lg" type="submit" loading={busy !== null} icon={<LogIn size={17} />}>
                Sign in
              </Button>
            </form>

            <div className="mt-4 rounded-xl border border-dashed border-ink-300 p-3">
              <p className="text-xs font-semibold text-ink-700">Phone + OTP (simulated)</p>
              <p className="mt-1 text-xs text-ink-500">
                A production build sends an OTP over SMS. In this prototype the API also accepts
                the fixed code <code className="rounded bg-ink-100 px-1 py-0.5">123456</code> for
                any known email.
              </p>
            </div>

            <p className="mt-4 text-center text-xs text-ink-400">
              <Link href="/" className="underline">
                Continue browsing without signing in
              </Link>
            </p>
          </Card>
        </div>

        <p className="mt-8 max-w-2xl text-center text-xs text-ink-400">
          Prototype only. Accounts, medicines, pharmacies, payments, OTP and calls are simulated.
          No real dispensing occurs and no real personal data should be entered.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Skeleton className="m-6 h-96" />}>
      <LoginInner />
    </Suspense>
  );
}
