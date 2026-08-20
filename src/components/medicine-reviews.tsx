"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Star } from "lucide-react";
import { api } from "@/lib/client";
import type { RatingSummary, Review } from "@/lib/types";
import { initials, relativeTime } from "@/lib/utils";

/**
 * Reviews on a product page.
 *
 * Every row here was written by somebody whose order was marked delivered —
 * the API will not accept one otherwise — so the "Verified purchase" tick is a
 * statement about the data rather than decoration. The section stays hidden
 * until there is something real to show; an empty five-star widget is worse
 * than no widget.
 */
export function MedicineReviews({ medicineId }: { medicineId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<RatingSummary | null>(null);

  useEffect(() => {
    let alive = true;
    api<{ reviews: Review[]; summary: RatingSummary }>(`/api/reviews?medicineId=${medicineId}`)
      .then((d) => {
        if (!alive) return;
        setReviews(d.reviews);
        setSummary(d.summary);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [medicineId]);

  if (!summary || summary.count === 0) return null;

  const withText = reviews.filter((r) => r.text?.trim());

  return (
    <section className="mt-3 rounded-2xl border border-ink-200 bg-white p-4">
      <h2 className="text-[15px] font-extrabold text-ink-900">What customers say</h2>

      <div className="mt-3 flex items-center gap-5">
        <div className="shrink-0 text-center">
          <p className="nums text-[30px] font-extrabold leading-none text-ink-900">
            {summary.average.toFixed(1)}
          </p>
          <div className="mt-1 flex justify-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                size={12}
                className={
                  n <= Math.round(summary.average)
                    ? "fill-rx-400 text-rx-400"
                    : "fill-ink-100 text-ink-300"
                }
              />
            ))}
          </div>
          <p className="nums mt-1 text-[11px] text-ink-500">{summary.count} rating(s)</p>
        </div>

        {/* Distribution, so one angry review does not read like the whole story. */}
        <div className="min-w-0 flex-1 space-y-1">
          {[5, 4, 3, 2, 1].map((star) => {
            const n = summary.histogram[star - 1];
            const pct = summary.count ? Math.round((n / summary.count) * 100) : 0;
            return (
              <div key={star} className="flex items-center gap-2">
                <span className="nums w-2 text-[11px] font-bold text-ink-500">{star}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                  <span
                    className="block h-full rounded-full bg-rx-400"
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="nums w-6 text-right text-[10.5px] text-ink-400">{n}</span>
              </div>
            );
          })}
        </div>
      </div>

      {withText.length > 0 && (
        <ul className="mt-3 divide-y divide-ink-100 border-t border-ink-100">
          {withText.slice(0, 4).map((r) => (
            <li key={r.id} className="flex gap-2.5 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[11px] font-extrabold text-ink-600">
                {initials(r.customerName)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-[13px] font-bold text-ink-900">{r.customerName}</span>
                  <span className="inline-flex items-center gap-0.5 rounded bg-ok-100 px-1.5 py-px text-[10px] font-extrabold text-ok-800">
                    <BadgeCheck size={10} /> Verified purchase
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="nums inline-flex items-center gap-0.5 rounded bg-rx-100 px-1.5 py-px text-[11px] font-extrabold text-rx-800">
                    {r.rating} <Star size={9} className="fill-rx-700 text-rx-700" />
                  </span>
                  <span className="text-[11px] text-ink-400">{relativeTime(r.createdAt)}</span>
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-700">{r.text}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
