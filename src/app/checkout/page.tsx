"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Banknote, CreditCard, MapPin, Smartphone } from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { ComplianceNote } from "@/components/brand";
import { useApp } from "@/components/providers";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  KeyValue,
  Modal,
  SectionTitle,
  Skeleton,
} from "@/components/ui";
import { api, post } from "@/lib/client";
import type { Order, PharmacyOffer, Prescription } from "@/lib/types";
import { inr } from "@/lib/utils";

type PaymentMode = "COD" | "UPI" | "CARD";

const PAY_OPTIONS: Array<{ id: PaymentMode; label: string; hint: string; icon: typeof Banknote }> = [
  { id: "COD", label: "Cash on delivery", hint: "Pay the rider", icon: Banknote },
  { id: "UPI", label: "UPI", hint: "Simulated", icon: Smartphone },
  { id: "CARD", label: "Card", hint: "Simulated", icon: CreditCard },
];

function CheckoutInner() {
  const params = useSearchParams();
  const router = useRouter();
  const pharmacyId = params.get("pharmacy");
  const {
    cart,
    cartTotal,
    user,
    clearCart,
    toast,
    activePrescriptionId,
    setActivePrescriptionId,
    origin,
    geoQuery,
  } = useApp();

  const [offer, setOffer] = useState<PharmacyOffer | null>(null);
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [address, setAddress] = useState("");
  const [payment, setPayment] = useState<PaymentMode>("COD");
  const [otpOpen, setOtpOpen] = useState(false);
  const [otp, setOtp] = useState("");

  const itemsParam = useMemo(() => cart.map((l) => `${l.medicineId}:${l.qty}`).join(","), [cart]);

  useEffect(() => {
    if (user?.address) setAddress(user.address);
  }, [user]);

  useEffect(() => {
    if (!itemsParam || !pharmacyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      api<{ offers: PharmacyOffer[] }>(`/api/pharmacies?items=${itemsParam}&${geoQuery}`),
      activePrescriptionId
        ? api<{ prescription: Prescription }>(`/api/prescriptions/${activePrescriptionId}`).catch(
            () => null,
          )
        : Promise.resolve(null),
    ])
      .then(([o, rx]) => {
        setOffer(o.offers.find((x) => x.pharmacy.id === pharmacyId) ?? null);
        setPrescription(rx?.prescription ?? null);
      })
      .finally(() => setLoading(false));
  }, [itemsParam, pharmacyId, activePrescriptionId, geoQuery]);

  const placeOrder = async () => {
    if (!user) {
      toast({ kind: "info", title: "Please sign in to place your order" });
      router.push("/login?next=/checkout");
      return;
    }
    setPlacing(true);
    try {
      const { order } = await post<{ order: Order }>("/api/orders", {
        pharmacyId,
        items: cart.map((l) => ({ medicineId: l.medicineId, qty: l.qty })),
        prescriptionId: cart.some((l) => l.type === "RX") ? activePrescriptionId : undefined,
        paymentMode: payment,
        address,
        lat: origin.lat,
        lng: origin.lng,
      });
      clearCart();
      setActivePrescriptionId(null);
      toast({ kind: "success", title: "Order placed", body: `Order ID ${order.code}` });
      router.push(`/orders/${order.id}`);
    } catch (e) {
      toast({ kind: "error", title: "Could not place order", body: (e as Error).message });
    } finally {
      setPlacing(false);
      setOtpOpen(false);
    }
  };

  const startPayment = () => {
    if (payment === "COD") return void placeOrder();
    setOtp("");
    setOtpOpen(true);
  };

  if (loading) {
    return (
      <CustomerShell>
        <Skeleton className="h-72" />
      </CustomerShell>
    );
  }

  if (!cart.length || !offer) {
    return (
      <CustomerShell>
        <EmptyState
          title="Nothing to check out"
          body="Pick a pharmacy that has your items in stock."
          action={<Button onClick={() => router.push("/select-pharmacy")}>Choose a pharmacy</Button>}
        />
      </CustomerShell>
    );
  }

  const isRx = cart.some((l) => l.type === "RX");

  return (
    <CustomerShell>
      <button
        onClick={() => router.push("/select-pharmacy")}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900"
      >
        <ArrowLeft size={16} /> Change pharmacy
      </button>

      <SectionTitle title={isRx ? "Prescription Order Summary" : "Order Summary"} />

      {isRx && (
        <Card className="mb-3 border-emerald-200 bg-emerald-50/60">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-emerald-900">Prescription status</p>
              <p className="text-xs text-emerald-800">
                {prescription
                  ? `${prescription.ref} · verified by ${prescription.verifiedByName ?? "pharmacist"}`
                  : "No verified prescription attached"}
              </p>
            </div>
            <Badge tone="green">Verified ✓</Badge>
          </div>
        </Card>
      )}

      <Card>
        <ul className="divide-y divide-ink-100">
          {cart.map((l) => {
            const line = offer.lines.find((x) => x.medicineId === l.medicineId);
            const price = line?.price ?? l.price;
            return (
              <li key={l.medicineId} className="flex items-center gap-3 py-3 first:pt-0">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-xl">
                  {l.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-900">{l.name}</p>
                  <p className="text-xs text-ink-500">
                    {l.form} · {l.strength} · Qty {l.qty}
                  </p>
                </div>
                <span className="text-sm font-semibold text-ink-800">{inr(price * l.qty)}</span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="mt-3">
        <KeyValue label="Pharmacy" value={offer.pharmacy.name} />
        <KeyValue label="Distance" value={`${offer.distanceKm} km`} />
        <KeyValue
          label="Estimated delivery"
          value={`Within ${offer.etaMinFrom}–${offer.etaMinTo} minutes`}
        />
        <div className="my-2 border-t border-ink-100" />
        <KeyValue label="Medicine total" value={inr(offer.itemsTotal)} />
        <KeyValue label="Delivery fee" value={inr(offer.deliveryFee)} />
        <div className="mt-2 flex items-baseline justify-between border-t border-ink-100 pt-3">
          <span className="font-semibold text-ink-900">Total</span>
          <span className="text-2xl font-bold text-ink-900">{inr(offer.total)}</span>
        </div>
      </Card>

      <Card className="mt-3">
        <Field label="Delivery address" required>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Flat / house, street, landmark"
          />
        </Field>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-500">
          <MapPin size={12} /> Rider will call on {user?.phone ?? "your registered number"}
        </p>
      </Card>

      <Card className="mt-3">
        <p className="mb-2 text-sm font-semibold text-ink-900">Payment method</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {PAY_OPTIONS.map(({ id, label, hint, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setPayment(id)}
              className={
                "flex items-center gap-2.5 rounded-xl border p-3 text-left transition-colors " +
                (payment === id
                  ? "border-brand-500 bg-brand-50"
                  : "border-ink-200 bg-white hover:bg-ink-50")
              }
            >
              <Icon size={18} className={payment === id ? "text-brand-700" : "text-ink-500"} />
              <span>
                <span className="block text-sm font-medium text-ink-900">{label}</span>
                <span className="block text-[11px] text-ink-400">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      </Card>

      {isRx && <ComplianceNote className="mt-3" variant="short" />}

      <div className="sticky bottom-20 mt-4 sm:bottom-4">
        <Button full size="lg" loading={placing} onClick={startPayment} disabled={!address.trim()}>
          Place Order · {inr(offer.total)}
        </Button>
        <p className="mt-2 text-center text-xs text-ink-400">
          By placing this order you confirm the details are correct.{" "}
          <Link href="/prescriptions" className="underline">
            Prescription policy
          </Link>
        </p>
      </div>

      {/* Simulated payment authorisation */}
      <Modal
        open={otpOpen}
        onClose={() => setOtpOpen(false)}
        title={payment === "UPI" ? "Approve UPI payment" : "Card verification"}
        footer={
          <Button full size="lg" loading={placing} onClick={placeOrder} disabled={otp.length < 4}>
            Confirm payment of {inr(offer.total)}
          </Button>
        }
      >
        <p className="text-sm text-ink-600">
          This is a <strong>simulated</strong> payment step. No real gateway is connected — enter
          any 4–6 digits to continue.
        </p>
        <div className="mt-3 rounded-xl bg-ink-50 p-3 text-xs text-ink-500">
          Demo OTP: <strong className="text-ink-800">123456</strong>
        </div>
        <Field label="Enter OTP / PIN">
          <Input
            value={otp}
            inputMode="numeric"
            maxLength={6}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            placeholder="••••••"
            className="mt-2 text-center text-2xl tracking-[0.5em]"
          />
        </Field>
      </Modal>
    </CustomerShell>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <CustomerShell>
          <Skeleton className="h-72" />
        </CustomerShell>
      }
    >
      <CheckoutInner />
    </Suspense>
  );
}
