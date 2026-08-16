"use client";

import { Award, BadgeCheck, Clock3, GraduationCap, Languages, MapPin } from "lucide-react";
import type { ProviderOffer } from "@/lib/home-care";
import { inr } from "@/lib/utils";
import { Badge, Button, Stars } from "./ui";

/**
 * A bookable provider. Shows the qualification and coverage detail a customer
 * needs before letting a stranger into their home.
 */
export function ProviderCard({
  offer,
  selected,
  onSelect,
  showSlots = true,
}: {
  offer: ProviderOffer;
  selected?: boolean;
  onSelect?: () => void;
  showSlots?: boolean;
}) {
  const { provider: p, distanceKm, freeSlots } = offer;

  return (
    <article
      className={
        "card p-4 transition-shadow " + (selected ? "ring-2 ring-brand-500" : "")
      }
    >
      <div className="flex items-start gap-3.5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-3xl">
          {p.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <div className="min-w-0">
              <h3 className="flex items-center gap-1.5 truncate text-base font-semibold text-ink-900">
                {p.name}
                {p.verified && <BadgeCheck size={16} className="shrink-0 text-brand-600" />}
              </h3>
              <p className="truncate text-xs text-ink-500">{p.headline}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-ink-900">{inr(p.hourlyRate)}</p>
              <p className="text-[11px] text-ink-400">per hour</p>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-600">
            <Stars value={p.rating} count={p.ratingCount} />
            <span className="inline-flex items-center gap-1">
              <Award size={12} className="text-ink-400" />
              {p.experienceYears} yrs experience
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} className="text-ink-400" />
              {distanceKm} km · covers {p.serviceRadiusKm} km
            </span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{p.bio}</p>

      <div className="mt-3 space-y-1.5 text-xs text-ink-600">
        <p className="flex items-start gap-1.5">
          <GraduationCap size={13} className="mt-0.5 shrink-0 text-ink-400" />
          <span>
            {p.qualifications.join(" · ")}
            <span className="text-ink-400"> · Reg. {p.registrationNo}</span>
          </span>
        </p>
        <p className="flex items-start gap-1.5">
          <MapPin size={13} className="mt-0.5 shrink-0 text-ink-400" />
          <span>Serves {p.serviceAreas.join(", ")} — {p.city}</span>
        </p>
        <p className="flex items-start gap-1.5">
          <Languages size={13} className="mt-0.5 shrink-0 text-ink-400" />
          <span>{p.languages.join(", ")}</span>
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {p.specialities.map((s) => (
          <Badge key={s} tone="brand">
            {s}
          </Badge>
        ))}
      </div>

      {showSlots && (
        <div className="mt-3 border-t border-ink-100 pt-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink-500">
            <Clock3 size={12} /> Free slots on the selected date
          </p>
          {freeSlots.length ? (
            <div className="flex flex-wrap gap-1.5">
              {freeSlots.map((s) => (
                <span
                  key={s}
                  className="rounded-lg bg-ink-100 px-2 py-1 text-xs font-medium text-ink-700"
                >
                  {s}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-amber-700">
              Not available on this date — pick another date or provider.
            </p>
          )}
        </div>
      )}

      {onSelect && (
        <Button
          full
          className="mt-3"
          variant={selected ? "success" : "primary"}
          disabled={showSlots && freeSlots.length === 0}
          onClick={onSelect}
        >
          {selected ? "Selected ✓" : `Choose ${p.name.split(" ")[0]}`}
        </Button>
      )}

      <p className="mt-2 text-[11px] text-ink-400">
        {p.completedVisits.toLocaleString("en-IN")} home visits completed through MedSpark
      </p>
    </article>
  );
}
