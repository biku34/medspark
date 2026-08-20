"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ChevronRight,
  Pause,
  Play,
  RefreshCw,
  SkipForward,
  Store,
  TriangleAlert,
} from "lucide-react";
import clsx from "clsx";
import { CustomerShell } from "@/components/customer-shell";
import { ServiceArt, ProductArt } from "@/components/art";
import { useApp } from "@/components/providers";
import { Button, Skeleton } from "@/components/ui";
import { api, patch } from "@/lib/client";
import { frequencyLabel, nextDeliveryLabel } from "@/lib/repeat-utils";
import {
  REPEAT_DISCOUNT_PCT,
  type Subscription,
  type SubscriptionStatus,
} from "@/lib/types";
import { bookingDateLabel } from "@/lib/booking-utils";

/** Chip copy. The full label already appears under the date, so this stays short. */
const BADGE_LABEL: Record<SubscriptionStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  AWAITING_RX: "On hold",
  CANCELLED: "Cancelled",
  COMPLETED: "Finished",
};

const BADGE: Record<SubscriptionStatus, string> = {
  ACTIVE: "bg-brand-100 text-brand-800",
  PAUSED: "bg-ink-200 text-ink-700",
  AWAITING_RX: "bg-rx-200 text-rx-800",
  CANCELLED: "bg-red-100 text-red-700",
  COMPLETED: "bg-ink-200 text-ink-700",
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
      /* signed-out visitors just see the pitch */
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
  const held = live.filter((s) => s.status === "AWAITING_RX").length;

  return (
    <CustomerShell>
      {/* ================================================================== */}
      {/* Header band                                                         */}
      {/* ================================================================== */}
      <section className="bleed -mt-3 bg-brand-800 pb-5 pt-5 text-white sm:mt-0 sm:rounded-2xl sm:px-6">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-brand-200">
              Repeat delivery
            </p>
            <h1 className="mt-2 text-[24px] font-extrabold leading-[1.15] sm:text-[30px]">
              The same medicines,
              <br />
              without asking twice
            </h1>
            <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-white/75">
              Set the day once. It arrives from your pharmacy, {REPEAT_DISCOUNT_PCT}% cheaper every
              cycle, and stops on its own the moment your prescription runs out.
            </p>
          </div>
          <ServiceArt kind="repeat" size={72} className="hidden shrink-0 sm:block" />
        </div>
      </section>

      {/* ================================================================== */}
      {/* Schedules                                                           */}
      {/* ================================================================== */}
      <section className="mt-6">
        {held > 0 && (
          <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-rx-300 bg-rx-50 p-3">
            <TriangleAlert size={17} className="mt-px shrink-0 text-rx-600" />
            <p className="text-[12.5px] leading-relaxed text-rx-800">
              <strong className="font-extrabold">
                {held} repeat{held > 1 ? "s are" : " is"} on hold.
              </strong>{" "}
              The prescription behind {held > 1 ? "them" : "it"} has no dispensings left — upload a
              current one to start it again.
            </p>
          </div>
        )}

        {loading ? (
          <Skeleton className="h-40" />
        ) : !user ? (
          <div className="rounded-2xl border border-ink-200 bg-white p-5 text-center">
            <p className="text-[15px] font-extrabold text-ink-900">
              Sign in to see your repeat deliveries
            </p>
            <p className="mx-auto mt-1 max-w-xs text-[12.5px] text-ink-500">
              Start one at checkout by ticking &ldquo;deliver this again&rdquo;.
            </p>
            <Link href="/login?next=/subscriptions">
              <Button className="mt-3">Sign in</Button>
            </Link>
          </div>
        ) : subs.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-ink-300 bg-white p-5 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50">
              <ServiceArt kind="repeat" size={40} />
            </span>
            <p className="mt-2.5 text-[15px] font-extrabold text-ink-900">
              No repeat deliveries yet
            </p>
            <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-ink-500">
              At checkout, tick <strong className="text-ink-700">Deliver this again</strong> and
              pick how often. Best for blood pressure, thyroid, diabetes and supplements.
            </p>
            <Link href="/category/wellness">
              <Button className="mt-3">Browse medicines</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {live.map((s) => {
              const onHold = s.status === "AWAITING_RX";
              return (
                <article
                  key={s.id}
                  className={clsx(
                    "overflow-hidden rounded-2xl border bg-white",
                    onHold ? "border-rx-300" : "border-ink-200",
                  )}
                >
                  {/* ---- what and where -------------------------------- */}
                  <div className="flex items-start gap-3 p-3.5">
                    <span className="flex -space-x-2.5">
                      {s.items.slice(0, 2).map((i) => (
                        <span
                          key={i.medicineId}
                          className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border-2 border-white bg-ink-50"
                        >
                          <ProductArt subcategory="" form={i.form} size={34} />
                        </span>
                      ))}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-extrabold leading-tight text-ink-900">
                        {s.items.map((i) => i.name).join(" + ")}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-ink-500">
                        <Store size={11} className="shrink-0" />
                        <span className="truncate">{s.pharmacyName}</span>
                        <span>·</span>
                        <span>{frequencyLabel(s)}</span>
                      </p>
                    </div>

                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className={clsx(
                          "rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide",
                          BADGE[s.status],
                        )}
                      >
                        {BADGE_LABEL[s.status]}
                      </span>
                      {s.type === "RX" && (
                        <span className="rounded bg-rx-100 px-1.5 py-0.5 text-[10px] font-extrabold text-rx-700">
                          ℞
                        </span>
                      )}
                    </span>
                  </div>

                  {/* ---- the date, which is the whole point ------------- */}
                  <div
                    className={clsx(
                      "flex items-end justify-between gap-3 px-3.5 py-3",
                      onHold ? "bg-rx-50" : "bg-brand-50",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] font-extrabold uppercase tracking-wide text-ink-500">
                        {onHold
                          ? "Paused for a prescription"
                          : s.skipNext
                            ? "Skipping this one"
                            : "Next delivery"}
                      </p>
                      <p
                        className={clsx(
                          "text-[18px] font-extrabold leading-tight",
                          onHold ? "text-rx-800" : "text-brand-800",
                        )}
                      >
                        {nextDeliveryLabel(s)}
                      </p>
                      {!onHold && s.status === "ACTIVE" && (
                        <p className="text-[12px] font-semibold text-ink-500">
                          {bookingDateLabel(s.nextDate)}
                        </p>
                      )}
                    </div>
                    <p className="nums shrink-0 text-right text-[11px] leading-tight text-ink-500">
                      {s.deliveriesMade} delivered
                      <span className="block font-extrabold text-brand-700">
                        saving {s.discountPct}%
                      </span>
                    </p>
                  </div>

                  {/* ---- actions --------------------------------------- */}
                  <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 p-2.5">
                    {s.status === "ACTIVE" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          loading={busyId === s.id}
                          icon={<SkipForward size={14} />}
                          onClick={() =>
                            act(
                              s,
                              s.skipNext ? "unskip" : "skip_next",
                              s.skipNext ? "skip cancelled" : "next one skipped",
                            )
                          }
                        >
                          {s.skipNext ? "Don't skip" : "Skip"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          loading={busyId === s.id}
                          icon={<Pause size={14} />}
                          onClick={() => act(s, "pause", "paused")}
                        >
                          Pause
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          loading={busyId === s.id}
                          icon={<RefreshCw size={14} />}
                          onClick={() => act(s, "deliver_now", "delivery placed")}
                        >
                          Send now
                        </Button>
                      </>
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
                    {onHold && (
                      <Link href="/prescriptions/upload">
                        <Button size="sm">Upload prescription</Button>
                      </Link>
                    )}
                    <Link
                      href={`/subscriptions/${s.id}`}
                      className="ml-auto flex items-center gap-0.5 px-2 py-1.5 text-[13px] font-extrabold text-ink-600 hover:text-ink-900"
                    >
                      Manage <ChevronRight size={15} strokeWidth={3} />
                    </Link>
                  </div>
                </article>
              );
            })}

            {finished.length > 0 && (
              <>
                <p className="pt-3 text-[12px] font-extrabold uppercase tracking-wide text-ink-400">
                  Ended
                </p>
                {finished.map((s) => (
                  <Link key={s.id} href={`/subscriptions/${s.id}`} className="block">
                    <div className="flex items-center gap-3 rounded-xl border border-ink-200 bg-ink-50 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-bold text-ink-700">
                          {s.items.map((i) => i.name).join(" + ")}
                        </p>
                        <p className="nums text-[11.5px] text-ink-500">
                          {s.ref} · {s.deliveriesMade} delivered
                        </p>
                      </div>
                      <span
                        className={clsx(
                          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide",
                          BADGE[s.status],
                        )}
                      >
                        {BADGE_LABEL[s.status]}
                      </span>
                    </div>
                  </Link>
                ))}
              </>
            )}
          </div>
        )}
      </section>

      {/* ================================================================== */}
      {/* Why it stops itself — the part worth reading                        */}
      {/* ================================================================== */}
      <section className="mt-7 rounded-2xl border border-ink-200 bg-white p-4">
        <h2 className="text-[15px] font-extrabold text-ink-900">
          A repeat that knows when to stop
        </h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-600">
          Most subscriptions keep charging until you notice. A prescription medicine cannot work
          that way — so when a pharmacist verifies your prescription, they also set how many
          repeats it covers and until when.
        </p>

        <div className="mt-3 rounded-xl bg-ink-50 p-3">
          <div className="flex items-baseline justify-between">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-ink-500">
              Repeats left
            </p>
            <p className="nums text-[12px] font-extrabold text-ink-800">4 of 6</p>
          </div>
          <div className="mt-1.5 flex gap-1">
            {[1, 1, 0, 0, 0, 0].map((used, i) => (
              <span
                key={i}
                className={clsx(
                  "h-2 flex-1 rounded-full",
                  used ? "bg-ink-300" : "bg-brand-500",
                )}
              />
            ))}
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-ink-500">
            When the last one is used, the schedule pauses itself and asks for a fresh
            prescription. It never quietly dispenses one more.
          </p>
        </div>
      </section>
    </CustomerShell>
  );
}
