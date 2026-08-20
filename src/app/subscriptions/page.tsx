"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  CircleSlash,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  SkipForward,
  Store,
} from "lucide-react";
import clsx from "clsx";
import { CustomerShell } from "@/components/customer-shell";
import { useApp } from "@/components/providers";
import { Badge, Button, Card, EmptyState, SectionTitle, Skeleton } from "@/components/ui";
import { api, patch } from "@/lib/client";
import { frequencyLabel, nextDeliveryLabel } from "@/lib/repeat-utils";
import {
  REPEAT_DISCOUNT_PCT,
  SUBSCRIPTION_LABELS,
  type Subscription,
  type SubscriptionStatus,
} from "@/lib/types";
import { bookingDateLabel } from "@/lib/booking-utils";

const TONE: Record<SubscriptionStatus, "green" | "amber" | "red" | "slate"> = {
  ACTIVE: "green",
  PAUSED: "slate",
  AWAITING_RX: "amber",
  CANCELLED: "red",
  COMPLETED: "slate",
};

export default function SubscriptionsPage() {
  const { user, toast } = useApp();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const d = await api<{ subscriptions: Subscription[] }>("/api/subscriptions");
      setSubs(d.subscriptions);
    } catch {
      /* signed-out visitors just see the explainer */
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (sub: Subscription, action: string, label: string) => {
    setBusyId(sub.id);
    try {
      await patch(`/api/subscriptions/${sub.id}`, { action });
      toast({ kind: "success", title: `${sub.ref} · ${label}` });
      await load();
    } catch (e) {
      toast({ kind: "error", title: "Could not update", body: (e as Error).message });
    } finally {
      setBusyId(null);
    }
  };

  const live = subs.filter((s) => s.status !== "CANCELLED" && s.status !== "COMPLETED");
  const finished = subs.filter((s) => s.status === "CANCELLED" || s.status === "COMPLETED");

  return (
    <CustomerShell>
      <SectionTitle
        title="Repeat delivery"
        subtitle="Medicines you take every month, delivered on a schedule you control."
      />

      {/* --------------------------- explainer ---------------------------- */}
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {[
          {
            icon: CalendarClock,
            title: `Save ${REPEAT_DISCOUNT_PCT}% every cycle`,
            body: "A standing discount on every repeat order.",
          },
          {
            icon: SkipForward,
            title: "Skip or pause any time",
            body: "Going away? Skip one cycle without cancelling.",
          },
          {
            icon: ShieldCheck,
            title: "Stops itself when it should",
            body: "A ℞ repeat stops the moment your prescription runs out.",
          },
        ].map((f) => (
          <div key={f.title} className="rounded-lg border border-ink-200 bg-white p-3">
            <f.icon size={16} className="text-brand-600" />
            <p className="mt-1.5 text-[13px] font-extrabold text-ink-900">{f.title}</p>
            <p className="text-[11px] leading-relaxed text-ink-500">{f.body}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <Skeleton className="h-40" />
      ) : !user ? (
        <EmptyState
          icon={<CalendarClock size={36} />}
          title="Sign in to see your repeat deliveries"
          body="Set one up from your cart at checkout, or from an approved care plan."
          action={
            <Link href="/login?next=/subscriptions">
              <Button>Sign in</Button>
            </Link>
          }
        />
      ) : subs.length === 0 ? (
        <EmptyState
          icon={<CalendarClock size={36} />}
          title="No repeat deliveries yet"
          body="Tick “deliver this again” at checkout to start one."
          action={
            <Link href="/category/wellness">
              <Button>Browse medicines</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {live.map((s) => {
            const held = s.status === "AWAITING_RX";
            return (
              <Card
                key={s.id}
                className={clsx(held && "border-amber-300 bg-amber-50/40")}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[12px] font-bold text-ink-500">{s.ref}</p>
                    <p className="text-[15px] font-extrabold text-ink-900">
                      {s.items.map((i) => i.name).join(" + ")}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-ink-500">
                      <span className="inline-flex items-center gap-1">
                        <Store size={11} /> {s.pharmacyName}
                      </span>
                      <span>·</span>
                      <span>{frequencyLabel(s)}</span>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge tone={TONE[s.status]}>{SUBSCRIPTION_LABELS[s.status]}</Badge>
                    {s.type === "RX" && <Badge tone="amber">℞</Badge>}
                  </div>
                </div>

                {/* next delivery */}
                <div
                  className={clsx(
                    "mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2",
                    held ? "bg-amber-100" : "bg-ink-50",
                  )}
                >
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-ink-500">
                      {held ? "On hold" : s.skipNext ? "Skipping this cycle" : "Next delivery"}
                    </p>
                    <p
                      className={clsx(
                        "text-[15px] font-extrabold",
                        held ? "text-amber-800" : "text-ink-900",
                      )}
                    >
                      {nextDeliveryLabel(s)}
                      {!held && s.status === "ACTIVE" && (
                        <span className="ml-1.5 text-[12px] font-semibold text-ink-500">
                          {bookingDateLabel(s.nextDate)}
                        </span>
                      )}
                    </p>
                  </div>
                  <p className="text-[11px] text-ink-500">
                    {s.deliveriesMade} delivered · saving {s.discountPct}%
                  </p>
                </div>

                {held && (
                  <p className="mt-2 text-[12px] leading-relaxed text-amber-900">
                    We stopped this repeat because the prescription behind it has no dispensings
                    left. Upload a current prescription and we'll pick it back up.
                  </p>
                )}

                {/* actions */}
                <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-100 pt-3">
                  {s.status === "ACTIVE" && !s.skipNext && (
                    <Button
                      size="sm"
                      variant="outline"
                      loading={busyId === s.id}
                      icon={<SkipForward size={14} />}
                      onClick={() => act(s, "skip_next", "next cycle skipped")}
                    >
                      Skip next
                    </Button>
                  )}
                  {s.status === "ACTIVE" && s.skipNext && (
                    <Button
                      size="sm"
                      variant="outline"
                      loading={busyId === s.id}
                      onClick={() => act(s, "unskip", "skip cancelled")}
                    >
                      Don&apos;t skip
                    </Button>
                  )}
                  {s.status === "ACTIVE" && (
                    <Button
                      size="sm"
                      variant="outline"
                      loading={busyId === s.id}
                      icon={<Pause size={14} />}
                      onClick={() => act(s, "pause", "paused")}
                    >
                      Pause
                    </Button>
                  )}
                  {s.status === "PAUSED" && (
                    <Button
                      size="sm"
                      loading={busyId === s.id}
                      icon={<Play size={14} />}
                      onClick={() => act(s, "resume", "resumed")}
                    >
                      Resume
                    </Button>
                  )}
                  {s.status === "ACTIVE" && (
                    <Button
                      size="sm"
                      variant="outline"
                      loading={busyId === s.id}
                      icon={<RefreshCw size={14} />}
                      onClick={() => act(s, "deliver_now", "delivery placed")}
                    >
                      Deliver now
                    </Button>
                  )}
                  {held && (
                    <Link href="/prescriptions/upload">
                      <Button size="sm">Upload prescription</Button>
                    </Link>
                  )}
                  <Link href={`/subscriptions/${s.id}`} className="ml-auto">
                    <Button size="sm" variant="ghost">
                      Manage <ArrowRight size={13} />
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}

          {finished.length > 0 && (
            <div>
              <p className="mb-2 mt-5 text-[12px] font-extrabold uppercase tracking-wide text-ink-400">
                Ended
              </p>
              <div className="space-y-2">
                {finished.map((s) => (
                  <Link key={s.id} href={`/subscriptions/${s.id}`} className="block">
                    <div className="flex items-center gap-2.5 rounded-lg border border-ink-200 bg-white p-2.5">
                      <CircleSlash size={15} className="shrink-0 text-ink-400" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-bold text-ink-700">
                          {s.items.map((i) => i.name).join(" + ")}
                        </p>
                        <p className="text-[11px] text-ink-500">
                          {s.ref} · {s.deliveriesMade} delivered
                        </p>
                      </div>
                      <Badge tone={TONE[s.status]}>{SUBSCRIPTION_LABELS[s.status]}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </CustomerShell>
  );
}
