"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import clsx from "clsx";
import { Button, Textarea } from "./ui";
import { useApp } from "./providers";
import { api, post } from "@/lib/client";
import type { Order, Review } from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* stars                                                                      */
/* -------------------------------------------------------------------------- */

export function StarPicker({
  value,
  onChange,
  size = 30,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <div className="flex items-center gap-1" role={onChange ? "radiogroup" : undefined}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          onMouseEnter={() => onChange && setHover(n)}
          onMouseLeave={() => onChange && setHover(0)}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          aria-checked={value === n}
          role={onChange ? "radio" : undefined}
          className={clsx("transition-transform", onChange && "hover:scale-110 active:scale-95")}
        >
          <Star
            size={size}
            className={clsx(
              "transition-colors",
              n <= shown ? "fill-rx-400 text-rx-400" : "fill-ink-100 text-ink-300",
            )}
          />
        </button>
      ))}
    </div>
  );
}

const WORDS = ["", "Poor", "Not great", "Fine", "Good", "Excellent"];

/* -------------------------------------------------------------------------- */
/* the prompt                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Rating a delivered order.
 *
 * Shown only on an order that actually arrived, because that is the whole
 * basis of the review being worth anything. The service rating goes to the
 * pharmacy that dispensed; the optional per-item stars are what give a product
 * page its rating, so both are collected in the one moment the customer is
 * willing to spend on this.
 */
export function RateOrder({ order }: { order: Order }) {
  const { toast } = useApp();
  const [existing, setExisting] = useState<Review[] | null>(null);
  const [rating, setRating] = useState(0);
  const [items, setItems] = useState<Record<string, number>>({});
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ reviews: Review[] }>(`/api/reviews?orderId=${order.id}`)
      .then((d) => setExisting(d.reviews))
      .catch(() => setExisting([]));
  }, [order.id]);

  if (order.status !== "DELIVERED" || existing === null) return null;

  /* ------------------------------ already done ------------------------- */
  if (existing.length > 0) {
    const service = existing.find((r) => !r.medicineId) ?? existing[0];
    return (
      <div className="mt-3 rounded-2xl border border-ink-200 bg-white p-4">
        <p className="text-[13px] font-extrabold text-ink-900">You rated this order</p>
        <div className="mt-1.5 flex items-center gap-2">
          <StarPicker value={service.rating} size={18} />
          <span className="text-[13px] font-semibold text-ink-600">
            {WORDS[service.rating]}
          </span>
        </div>
        {service.text && (
          <p className="mt-2 text-[12.5px] italic leading-relaxed text-ink-600">
            &ldquo;{service.text}&rdquo;
          </p>
        )}
      </div>
    );
  }

  const submit = async () => {
    if (!rating) return;
    setBusy(true);
    try {
      await post("/api/reviews", { orderId: order.id, rating, text, items });
      toast({ kind: "success", title: "Thanks — that helps the next customer" });
      const d = await api<{ reviews: Review[] }>(`/api/reviews?orderId=${order.id}`);
      setExisting(d.reviews);
    } catch (e) {
      toast({ kind: "error", title: "Could not save your rating", body: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-2xl border border-ink-200 bg-white p-4">
      <p className="text-[15px] font-extrabold text-ink-900">How was this order?</p>
      <p className="mt-0.5 text-[12px] text-ink-500">
        Your rating goes to {order.pharmacyName}, and helps the next person on your street.
      </p>

      <div className="mt-3 flex items-center gap-3">
        <StarPicker value={rating} onChange={setRating} />
        {rating > 0 && (
          <span className="text-[14px] font-extrabold text-ink-700">{WORDS[rating]}</span>
        )}
      </div>

      {rating > 0 && (
        <>
          <div className="mt-4">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-ink-400">
              Rate what you got (optional)
            </p>
            <ul className="mt-1.5 divide-y divide-ink-100">
              {order.items.map((i) => (
                <li key={i.medicineId} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink-800">
                    {i.name}
                  </span>
                  <StarPicker
                    value={items[i.medicineId] ?? 0}
                    onChange={(v) => setItems((prev) => ({ ...prev, [i.medicineId]: v }))}
                    size={18}
                  />
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-3">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Anything worth telling the next customer? (optional)"
            />
          </div>

          <Button className="mt-3" loading={busy} onClick={submit}>
            Submit rating
          </Button>
        </>
      )}
    </div>
  );
}
