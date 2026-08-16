"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ShoppingCart, Trash2 } from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { useApp } from "@/components/providers";
import { Badge, Button, Card, EmptyState, KeyValue, QtyStepper, SectionTitle } from "@/components/ui";
import { inr } from "@/lib/utils";

export default function CartPage() {
  const { cart, setQty, removeFromCart, cartTotal, clearCart, activePrescriptionId } = useApp();
  const router = useRouter();

  const hasRx = cart.some((l) => l.type === "RX");

  if (cart.length === 0) {
    return (
      <CustomerShell>
        <SectionTitle title="Your cart" />
        <EmptyState
          icon={<ShoppingCart size={40} />}
          title="Your cart is empty"
          body="Search for a medicine and add it — we'll then show you which nearby pharmacies have it in stock."
          action={<Button onClick={() => router.push("/search")}>Search medicines</Button>}
        />
      </CustomerShell>
    );
  }

  return (
    <CustomerShell>
      <SectionTitle
        title="Your cart"
        subtitle="Prices are indicative — the pharmacy you choose sets the final price."
        action={
          <button onClick={clearCart} className="text-sm font-medium text-ink-500 underline">
            Clear
          </button>
        }
      />

      <ul className="space-y-3">
        {cart.map((l) => (
          <li key={l.medicineId}>
            <Card className="flex items-center gap-3.5">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-ink-50 text-2xl">
                {l.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/medicine/${l.medicineId}`}
                  className="block truncate text-sm font-semibold text-ink-900"
                >
                  {l.name}
                </Link>
                <p className="text-xs text-ink-500">
                  {l.form} · {l.strength}
                </p>
                <p className="mt-1 text-sm font-semibold text-ink-800">{inr(l.price)}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <QtyStepper value={l.qty} onChange={(v) => setQty(l.medicineId, v)} min={0} size="sm" />
                <button
                  onClick={() => removeFromCart(l.medicineId)}
                  className="flex items-center gap-1 text-xs text-ink-400 hover:text-red-600"
                >
                  <Trash2 size={12} /> Remove
                </button>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <Card className="mt-4">
        <KeyValue label={`Items (${cart.reduce((s, l) => s + l.qty, 0)})`} value={inr(cartTotal)} />
        <KeyValue label="Delivery fee" value="Shown per pharmacy" />
        <div className="mt-2 flex items-baseline justify-between border-t border-ink-100 pt-3">
          <span className="font-semibold text-ink-900">Estimated total</span>
          <span className="text-xl font-bold text-ink-900">{inr(cartTotal)}</span>
        </div>
        <p className="mt-1 text-xs text-ink-400">+ delivery fee of the pharmacy you choose</p>
      </Card>

      {hasRx && (
        <Card className="mt-3 border-amber-200 bg-amber-50/60">
          <div className="flex items-start gap-2">
            <Badge tone="amber">℞</Badge>
            <p className="text-sm text-amber-900">
              Your cart contains prescription medicines. They can only be ordered against a
              prescription that a MedSpark pharmacist has verified.{" "}
              {activePrescriptionId ? (
                <Link href={`/prescriptions/${activePrescriptionId}`} className="font-semibold underline">
                  View your verified prescription
                </Link>
              ) : (
                <Link href="/prescriptions/upload" className="font-semibold underline">
                  Upload a prescription
                </Link>
              )}
            </p>
          </div>
        </Card>
      )}

      <div className="sticky bottom-20 mt-4 sm:bottom-4">
        <Button
          full
          size="lg"
          icon={<ArrowRight size={18} />}
          onClick={() => router.push("/select-pharmacy")}
        >
          Continue — choose a nearby pharmacy
        </Button>
      </div>
    </CustomerShell>
  );
}
