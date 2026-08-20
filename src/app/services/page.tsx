"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BadgeCheck,
  CalendarClock,
  ChevronRight,
  ClipboardCheck,
  MapPin,
  Phone,
  ShieldCheck,
  Star,
} from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { SERVICE_PALETTE, ServiceArt } from "@/components/art";
import { useApp } from "@/components/providers";
import { Skeleton } from "@/components/ui";
import { api } from "@/lib/client";
import type { ProviderOffer } from "@/lib/home-care";
import { bookingDateLabel, earliestBookableDate } from "@/lib/booking-utils";
import {
  NURSING_ASSISTANCE_TYPES,
  PHYSIO_REASONS,
  type ServiceSettings,
  type ServiceType,
} from "@/lib/types";
import { initials, inr } from "@/lib/utils";

const SERVICES = [
  {
    type: "PHYSIO" as ServiceType,
    art: "physio" as const,
    slug: "physiotherapy",
    title: "Physiotherapy at home",
    line: "A qualified physiotherapist brings the equipment and runs the session in your living room.",
    covers: PHYSIO_REASONS,
  },
  {
    type: "NURSING" as ServiceType,
    art: "nursing" as const,
    slug: "nursing",
    title: "Nursing care at home",
    line: "Trained nursing staff for recovery, elderly care, wound dressing and day-to-day support.",
    covers: NURSING_ASSISTANCE_TYPES,
  },
];

const STEPS = [
  {
    icon: CalendarClock,
    title: "Pick a date and slot",
    body: "At least a day ahead, so somebody can plan their round properly.",
  },
  {
    icon: BadgeCheck,
    title: "A professional accepts",
    body: "Only verified providers who already cover your address can see the request.",
  },
  {
    icon: Phone,
    title: "They confirm with you",
    body: "You get their name, registration number and rating before the visit.",
  },
  {
    icon: ClipboardCheck,
    title: "The visit happens",
    body: "Pay by the hour after it is done. Rate them so the next family knows.",
  },
];

export default function HomeVisitsHub() {
  const { user, origin, geoQuery } = useApp();
  const [settings, setSettings] = useState<ServiceSettings | null>(null);
  const [offers, setOffers] = useState<Record<ServiceType, ProviderOffer[]>>({
    PHYSIO: [],
    NURSING: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, physio, nursing] = await Promise.all([
          api<{ settings: ServiceSettings }>("/api/settings"),
          api<{ offers: ProviderOffer[] }>(`/api/providers?type=PHYSIO&${geoQuery}`),
          api<{ offers: ProviderOffer[] }>(`/api/providers?type=NURSING&${geoQuery}`),
        ]);
        if (!alive) return;
        setSettings(s.settings);
        setOffers({ PHYSIO: physio.offers, NURSING: nursing.offers });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [geoQuery]);

  const everyone = [...offers.PHYSIO, ...offers.NURSING].sort(
    (a, b) => b.provider.rating - a.provider.rating,
  );
  const earliest = settings ? earliestBookableDate(settings.minAdvanceDays) : null;

  return (
    <CustomerShell wide>
      {/* ================================================================== */}
      {/* Hero                                                                */}
      {/* ================================================================== */}
      <section className="bleed -mt-3 bg-ink-900 pb-6 pt-5 text-white sm:mt-0 sm:rounded-2xl sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white/70">
              Home visits
            </p>
            <h1 className="mt-2 text-[26px] font-extrabold leading-[1.12] sm:text-[34px]">
              Care that comes
              <br />
              to your door
            </h1>
            <p className="mt-2 max-w-lg text-[13.5px] leading-relaxed text-white/70">
              Physiotherapy and nursing at home, by professionals we have checked the registration
              of. Booked by the hour, paid after the visit.
            </p>
          </div>
          <ServiceArt kind="nursing" size={76} className="hidden shrink-0 sm:block" />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px]">
          <span className="inline-flex items-center gap-1.5 text-white/75">
            <BadgeCheck size={14} className="text-brand-300" />
            <strong className="font-extrabold text-white">{everyone.length}</strong>
            verified near {origin.locality}
          </span>
          {settings && (
            <span className="inline-flex items-center gap-1.5 text-white/75">
              <CalendarClock size={14} className="text-brand-300" />
              from <strong className="font-extrabold text-white">
                {inr(Math.min(settings.physio.rate, settings.nursing.rate))}
              </strong>{" "}
              an hour
            </span>
          )}
          {user && (
            <Link
              href="/bookings"
              className="ml-auto inline-flex items-center gap-0.5 text-[13px] font-extrabold text-brand-300 hover:underline"
            >
              My bookings <ChevronRight size={15} strokeWidth={3} />
            </Link>
          )}
        </div>
      </section>

      {/* ================================================================== */}
      {/* The two services                                                    */}
      {/* ================================================================== */}
      <section className="mt-5 grid gap-3 lg:grid-cols-2">
        {SERVICES.map((s) => {
          const cfg = s.type === "PHYSIO" ? settings?.physio : settings?.nursing;
          const p = SERVICE_PALETTE[s.art];
          const count = offers[s.type].length;

          return (
            <article
              key={s.type}
              className="flex flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white"
            >
              <div className="flex items-start gap-3.5 p-4" style={{ background: p.well }}>
                <ServiceArt kind={s.art} size={54} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <h2
                    className="text-[19px] font-extrabold leading-tight"
                    style={{ color: p.deep }}
                  >
                    {s.title}
                  </h2>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-ink-700">{s.line}</p>
                </div>
              </div>

              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="nums text-[24px] font-extrabold leading-none text-ink-900">
                      {cfg ? inr(cfg.rate) : "—"}
                      <span className="ml-1 text-[12px] font-bold text-ink-500">/ hour</span>
                    </p>
                    {cfg && (
                      <p className="nums mt-1 text-[11.5px] text-ink-500">
                        {cfg.minHours}–{cfg.maxHours} hours per visit · +{inr(cfg.platformFee)}{" "}
                        platform fee
                      </p>
                    )}
                  </div>
                  {count > 0 && (
                    <span className="shrink-0 rounded-lg bg-brand-50 px-2.5 py-1.5 text-center">
                      <span className="nums block text-[15px] font-extrabold leading-none text-brand-700">
                        {count}
                      </span>
                      <span className="block text-[9px] font-bold uppercase tracking-wide text-brand-700">
                        near you
                      </span>
                    </span>
                  )}
                </div>

                <p className="mt-3.5 text-[11px] font-extrabold uppercase tracking-wide text-ink-400">
                  What it covers
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-1">
                  {s.covers.map((c) => (
                    <li
                      key={c}
                      className="rounded-md border border-ink-200 bg-ink-50 px-2 py-1 text-[11.5px] font-semibold text-ink-700"
                    >
                      {c}
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/services/${s.slug}`}
                  className="mt-4 flex h-12 items-center justify-center gap-1.5 rounded-xl text-[15px] font-extrabold text-white"
                  style={{ background: p.deep }}
                >
                  Book {s.type === "PHYSIO" ? "physiotherapy" : "nursing"}
                  <ChevronRight size={17} strokeWidth={3} />
                </Link>
              </div>
            </article>
          );
        })}
      </section>

      {/* ================================================================== */}
      {/* The people                                                          */}
      {/* ================================================================== */}
      <section className="mt-7">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-[19px] font-extrabold text-ink-900 sm:text-[21px]">
            Who would come
          </h2>
          <span className="nums shrink-0 text-[12px] font-semibold text-ink-500">
            covering {origin.locality}
          </span>
        </div>

        {loading ? (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : everyone.length === 0 ? (
          <div className="rounded-2xl border border-ink-200 bg-white p-5 text-center">
            <p className="text-[14px] font-extrabold text-ink-900">
              No professionals cover this address yet
            </p>
            <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-ink-500">
              We are live across Gandhinagar and Ahmedabad. Try a different address from the
              location picker.
            </p>
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {everyone.map(({ provider: p, distanceKm, freeSlots }) => {
              const art = p.type === "PHYSIO" ? "physio" : "nursing";
              const pal = SERVICE_PALETTE[art];
              return (
                <Link
                  key={p.id}
                  href={`/services/${p.type === "PHYSIO" ? "physiotherapy" : "nursing"}`}
                  className="tile flex flex-col p-3.5 hover:tile-hover"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[15px] font-extrabold"
                      style={{ background: pal.well, color: pal.deep }}
                    >
                      {initials(p.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 truncate text-[15px] font-extrabold text-ink-900">
                        {p.name}
                        {p.verified && (
                          <BadgeCheck size={14} className="shrink-0 text-brand-600" />
                        )}
                      </p>
                      <p className="clamp-2 text-[11.5px] leading-snug text-ink-500">
                        {p.headline}
                      </p>
                    </div>
                    <span className="nums shrink-0 text-right">
                      <span className="block text-[15px] font-extrabold text-ink-900">
                        {inr(p.hourlyRate)}
                      </span>
                      <span className="block text-[10px] text-ink-400">per hour</span>
                    </span>
                  </div>

                  <div className="nums mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-600">
                    <span className="inline-flex items-center gap-1">
                      <Star size={11} className="fill-rx-400 text-rx-400" />
                      {p.rating.toFixed(1)}
                      <span className="text-ink-400">({p.ratingCount})</span>
                    </span>
                    <span>{p.experienceYears}y experience</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={11} className="text-ink-400" />
                      {distanceKm} km
                    </span>
                  </div>

                  <p className="mt-2 border-t border-ink-100 pt-2 text-[11.5px] text-ink-500">
                    {p.completedVisits} visits completed
                    {freeSlots.length > 0 && (
                      <span className="font-bold text-brand-700">
                        {" "}
                        · {freeSlots.length} slot{freeSlots.length === 1 ? "" : "s"} free
                      </span>
                    )}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ================================================================== */}
      {/* How a booking runs                                                  */}
      {/* ================================================================== */}
      <section className="mt-7">
        <h2 className="mb-3 text-[19px] font-extrabold text-ink-900 sm:text-[21px]">
          How a visit works
        </h2>
        <ol className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-2xl border border-ink-200 bg-white p-3.5">
              <div className="flex items-center gap-2">
                <span className="nums flex h-6 w-6 items-center justify-center rounded-full bg-ink-900 text-[11px] font-extrabold text-white">
                  {i + 1}
                </span>
                <s.icon size={15} className="text-ink-400" />
              </div>
              <p className="mt-2 text-[14px] font-extrabold leading-tight text-ink-900">
                {s.title}
              </p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-ink-500">{s.body}</p>
            </li>
          ))}
        </ol>

        {settings && (
          <p className="mt-3 flex items-start gap-2 rounded-2xl border border-rx-200 bg-rx-50 p-3.5 text-[12.5px] leading-relaxed text-rx-800">
            <CalendarClock size={16} className="mt-px shrink-0 text-rx-600" />
            <span>
              <strong className="font-extrabold">Same-day visits are not offered.</strong> Every
              booking needs {settings.minAdvanceDays} day
              {settings.minAdvanceDays === 1 ? "" : "s"} of notice — the earliest slot right now is{" "}
              {earliest ? bookingDateLabel(earliest) : "tomorrow"}.
            </span>
          </p>
        )}
      </section>

      {/* ================================================================== */}
      {/* Trust                                                               */}
      {/* ================================================================== */}
      <section className="mt-4 rounded-2xl bg-ink-900 p-4 text-white">
        <p className="flex items-center gap-1.5 text-[13px] font-extrabold">
          <ShieldCheck size={15} className="text-brand-300" />
          Before anyone reaches your door
        </p>
        <ul className="mt-2.5 grid gap-2 text-[12.5px] leading-relaxed text-white/70 sm:grid-cols-3">
          <li>
            Council registration number checked and recorded against their profile by our admin
            team.
          </li>
          <li>
            Certificates uploaded and verified — an unverified provider cannot accept a single
            booking.
          </li>
          <li>
            You see their name, rating and experience before the visit, and rate them after it.
          </li>
        </ul>
      </section>
    </CustomerShell>
  );
}
