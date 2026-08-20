"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock3, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { ProductArt, paletteFor } from "@/components/art";
import { useApp } from "@/components/providers";
import { Button, EmptyState } from "@/components/ui";
import { inr } from "@/lib/utils";

export default function CartPage() {
  const { cart, setQty, removeFromCart, cartTotal, clearCart, activePrescriptionId, origin } =
    useApp();
  const router = useRouter();

  const hasRx = cart.some((l) => l.type === "RX");

  if (cart.length === 0) {
    return (
      <CustomerShell>
        <EmptyState
          icon={<ShoppingCart size={40} />}
          title="Your cart is empty"
          body="Add medicines or health products and we'll show which nearby pharmacies have them."
          action={<Button onClick={() => router.push("/category/wellness")}>Start shopping</Button>}
        />
      </CustomerShell>
    );
  }

  return (
    <CustomerShell>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-[19px] font-extrabold tracking-tight text-ink-900">Your cart</h1>
        <button onClick={clearCart} className="text-[12px] font-bold text-ink-500 underline">
          Clear all
        </button>
      </div>

      {/* delivery promise */}
      <div className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-[13px] text-brand-900">
        <Clock3 size={15} strokeWidth={2.6} className="shrink-0 text-brand-700" />
        <p>
          Delivery in <strong className="font-extrabold">20 minutes</strong> to {origin.locality}
        </p>
      </div>

      {/* items */}
      <div className="mt-3 divide-y divide-ink-100 rounded-xl border border-ink-200 bg-white">
        {cart.map((l) => (
          <div key={l.medicineId} className="flex items-center gap-3 p-3">
            <Link
              href={`/medicine/${l.medicineId}`}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
              style={{ background: paletteFor(l.subcategory ?? "").well }}
            >
              <ProductArt subcategory={l.subcategory ?? ""} form={l.form} size={44} />
            </Link>

            <div className="min-w-0 flex-1">
              <Link
                href={`/medicine/${l.medicineId}`}
                className="clamp-2 text-[13px] font-semibold leading-snug text-ink-800"
              >
                {l.name}
              </Link>
              <p className="text-[11px] text-ink-500">
                {l.form} · {l.strength}
              </p>
              <p className="mt-0.5 text-[13px] font-bold text-ink-900">{inr(l.price)}</p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <div className="flex h-8 w-[86px] items-center justify-between rounded-lg bg-brand-600 text-white">
                <button
                  aria-label="Decrease quantity"
                  onClick={() => setQty(l.medicineId, l.qty - 1)}
                  className="flex h-full w-7 items-center justify-center rounded-l-lg"
                >
                  <Minus size={13} strokeWidth={3} />
                </button>
                <span className="text-[13px] font-bold tabular-nums">{l.qty}</span>
                <button
                  aria-label="Increase quantity"
                  onClick={() => setQty(l.medicineId, l.qty + 1)}
                  className="flex h-full w-7 items-center justify-center rounded-r-lg"
                >
                  <Plus size={13} strokeWidth={3} />
                </button>
              </div>
              <button
                onClick={() => removeFromCart(l.medicineId)}
                className="flex items-center gap-1 text-[11px] text-ink-400 hover:text-red-600"
              >
                <Trash2 size={11} /> Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* bill */}
      <div className="mt-3 rounded-xl border border-ink-200 bg-white p-4">
        <h2 className="text-[13px] font-extrabold uppercase tracking-wide text-ink-500">
          Bill details
        </h2>
        <div className="mt-2 space-y-1.5 text-[13px]">
          <div className="flex justify-between">
            <span className="text-ink-600">
              Item total ({cart.reduce((s, l) => s + l.qty, 0)} items)
            </span>
            <span className="font-semibold text-ink-900">{inr(cartTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-600">Delivery fee</span>
            <span className="text-ink-500">Depends on pharmacy</span>
          </div>
        </div>
        <div className="mt-2.5 flex items-center justify-between border-t border-dashed border-ink-200 pt-2.5">
          <span className="text-[14px] font-extrabold text-ink-900">To pay</span>
          <span className="text-[17px] font-extrabold text-ink-900">{inr(cartTotal)}</span>
        </div>
        <p className="mt-1 text-[11px] text-ink-400">+ the delivery fee of the pharmacy you pick</p>
      </div>

      {hasRx && (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[12px] text-amber-900">
          <strong className="font-bold">Prescription required.</strong> Your cart has ℞ medicines.
          They can only be ordered against a prescription verified by a pharmacist.{" "}
          {activePrescriptionId ? (
            <Link href={`/prescriptions/${activePrescriptionId}`} className="font-bold underline">
              View your verified prescription
            </Link>
          ) : (
            <Link href="/prescriptions/upload" className="font-bold underline">
              Upload a prescription
            </Link>
          )}
        </div>
      )}

      {/* sticky checkout */}
      <div className="fixed inset-x-0 bottom-12 z-30 px-3 sm:static sm:mt-4 sm:px-0 no-print">
        <button
          onClick={() => router.push("/select-pharmacy")}
          className="mx-auto flex h-12 w-full max-w-2xl items-center justify-between rounded-xl bg-brand-600 px-4 text-white shadow-lg shadow-brand-900/20 sm:shadow-none"
        >
          <span className="text-left">
            <span className="block text-[15px] font-extrabold leading-tight">
              {inr(cartTotal)}
            </span>
            <span className="block text-[11px] leading-tight text-brand-100">Total</span>
          </span>
          <span className="flex items-center gap-1 text-[15px] font-extrabold">
            Choose pharmacy <ArrowRight size={17} strokeWidth={3} />
          </span>
        </button>
      </div>
      <div className="h-16 sm:hidden" aria-hidden />
    </CustomerShell>
  );
}
