"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BadgeCheck, CalendarClock, ChevronRight, MapPin, Star } from "lucide-react";
import { ServiceArt, SERVICE_PALETTE } from "./art";
import { useApp } from "./providers";
import type { ProviderOffer } from "@/lib/home-care";
import { api } from "@/lib/client";
import { bookingDateLabel, earliestBookableDate } from "@/lib/booking-utils";
import {
  NURSING_ASSISTANCE_TYPES,
  PHYSIO_REASONS,
  type ServiceSettings,
} from "@/lib/types";
import { initials, inr } from "@/lib/utils";

const SERVICES = [
  {
    type: "PHYSIO" as const,
    art: "physio" as const,
    slug: "physiotherapy",
    title: "Physiotherapy",
    line: "Recover movement at home",
    covers: PHYSIO_REASONS.slice(0, 4),
  },
  {
    type: "NURSING" as const,
    art: "nursing" as const,
    slug: "nursing",
    title: "Nursing care",
    line: "Someone qualified in the house",
    covers: NURSING_ASSISTANCE_TYPES.slice(0, 4),
  },
];

/**
 * Home visits, given the room the service deserves.
 *
 * This is the half of the platform that is not a delivery, and a two-line tile
 * could never carry it: letting a stranger into your home to treat your father
 * is a bigger decision than buying a strip of paracetamol. So the band leads
 * with the people — real names, real registrations, real ratings, and how many
 * of them actually cover this address — and only then quotes a price.
 */
export function HomeCareBand() {
  const { origin, geoQuery } = useApp();
  const [settings, setSettings] = useState<ServiceSettings | null>(null);
  const [offers, setOffers] = useState<Record<"PHYSIO" | "NURSING", ProviderOffer[]>>({
    PHYSIO: [],
    NURSING: [],
  });

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
      } catch {
        /* the band still renders without live counts */
      }
    })();
    return () => {
      alive = false;
    };
  }, [geoQuery]);

  const rateFor = (t: "PHYSIO" | "NURSING") =>
    t === "PHYSIO" ? settings?.physio : settings?.nursing;

  const total = offers.PHYSIO.length + offers.NURSING.length;

  // The best-rated few, across both services — the "who would actually come" row.
  const people = [...offers.PHYSIO, ...offers.NURSING]
    .sort((a, b) => b.provider.rating - a.provider.rating)
    .slice(0, 6);

  const earliest = settings ? earliestBookableDate(settings.minAdvanceDays) : null;

  return (
    <section className="bleed mt-7 bg-ink-900 py-6 text-white sm:rounded-2xl sm:px-6">
      {/* ---------------------------- heading --------------------------- */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white/70">
            Care at home
          </p>
          <h2 className="mt-2 text-[23px] font-extrabold leading-[1.15] sm:text-[28px]">
            A physiotherapist or nurse,
            <br className="hidden sm:block" /> at your door
          </h2>
          <p className="mt-1.5 flex max-w-xl flex-wrap items-center gap-x-1.5 text-[13px] text-white/65">
            {total > 0 ? (
              <>
                <span className="font-extrabold text-brand-300">{total} verified</span>
                professionals cover
                <span className="inline-flex items-center gap-1 font-semibold text-white/85">
                  <MapPin size={12} />
                  {origin.locality}
                </span>
              </>
            ) : (
              <>Qualified, background-checked professionals who come to you</>
            )}
          </p>
        </div>
      </div>

      {/* --------------------------- the two ----------------------------- */}
      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 2xl:gap-3">
        {SERVICES.map((s) => {
          const cfg = rateFor(s.type);
          const p = SERVICE_PALETTE[s.art];
          const count = offers[s.type].length;

          return (
            <Link
              key={s.type}
              href={`/services/${s.slug}`}
              className="group relative flex flex-col overflow-hidden rounded-2xl bg-white/[0.06] p-3.5 ring-1 ring-white/10 transition-colors hover:bg-white/[0.1]"
            >
              <div className="flex items-start gap-3">
                <span
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                  style={{ background: p.well }}
                >
                  <ServiceArt kind={s.art} size={40} />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-[17px] font-extrabold leading-tight">{s.title}</p>
                  <p className="text-[12.5px] text-white/60">{s.line}</p>
                  {count > 0 && (
                    <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-brand-300">
                      <BadgeCheck size={12} />
                      {count} available near you
                    </p>
                  )}
                </div>

                {cfg && (
                  <div className="shrink-0 text-right">
                    <p className="nums text-[18px] font-extrabold leading-none">
                      {inr(cfg.rate)}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-white/45">
                      per hour
                    </p>
                  </div>
                )}
              </div>

              {/* what it actually covers — the question people really have */}
              <ul className="mt-3 flex flex-wrap gap-1">
                {s.covers.map((c) => (
                  <li
                    key={c}
                    className="rounded-md bg-white/10 px-2 py-1 text-[11px] font-semibold text-white/75"
                  >
                    {c}
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5">
                <span className="nums text-[11.5px] text-white/50">
                  {cfg ? `${cfg.minHours}–${cfg.maxHours} hours per visit` : "Book by the hour"}
                </span>
                <span className="flex items-center gap-0.5 text-[13px] font-extrabold text-white group-hover:text-brand-300">
                  Book a visit
                  <ChevronRight size={15} strokeWidth={3} />
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* --------------------------- the people -------------------------- */}
      {people.length > 0 && (
        <div className="mt-5">
          <p className="mb-2.5 text-[12px] font-extrabold uppercase tracking-wide text-white/45">
            Who would come
          </p>
          <div className="rail">
            {people.map(({ provider: p, distanceKm }) => (
              <Link
                key={p.id}
                href={`/services/${p.type === "PHYSIO" ? "physiotherapy" : "nursing"}`}
                className="w-[232px] shrink-0 rounded-xl bg-white/[0.06] p-3 ring-1 ring-white/10 transition-colors hover:bg-white/[0.1] sm:w-[248px]"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold"
                    style={{
                      background: SERVICE_PALETTE[p.type === "PHYSIO" ? "physio" : "nursing"].well,
                      color: SERVICE_PALETTE[p.type === "PHYSIO" ? "physio" : "nursing"].deep,
                    }}
                  >
                    {initials(p.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 text-[13.5px] font-extrabold leading-tight">
                      {p.name}
                      {p.verified && (
                        <BadgeCheck size={13} className="shrink-0 text-brand-300" />
                      )}
                    </p>
                    <p className="nums flex items-center gap-1 text-[11px] text-white/55">
                      <Star size={10} className="fill-rx-300 text-rx-300" />
                      {p.rating.toFixed(1)}
                      <span className="text-white/30">·</span>
                      {p.experienceYears}y exp
                    </p>
                  </div>
                </div>
                <p className="clamp-2 mt-2 text-[11.5px] leading-snug text-white/55">
                  {p.headline}
                </p>
                <p className="nums mt-1.5 flex items-center gap-1 text-[11px] text-white/40">
                  <MapPin size={10} />
                  {distanceKm} km away
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------- the one rule -------------------------- */}
      {settings && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-white/[0.06] px-3 py-2.5 text-[12px] leading-relaxed text-white/65">
          <CalendarClock size={15} className="mt-px shrink-0 text-white/40" />
          <span>
            Home visits need{" "}
            <strong className="font-extrabold text-white">
              {settings.minAdvanceDays} day{settings.minAdvanceDays === 1 ? "" : "s"}
            </strong>{" "}
            of notice so a professional can plan their round — the earliest you can book is{" "}
            <strong className="font-extrabold text-white">
              {earliest ? bookingDateLabel(earliest) : "tomorrow"}
            </strong>
            .
          </span>
        </p>
      )}
    </section>
  );
}
