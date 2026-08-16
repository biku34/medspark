"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight, Package, RotateCcw } from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { MiniTracker } from "@/components/order-tracker";
import { useApp } from "@/components/providers";
import { Badge, Button, Card, EmptyState, SectionTitle, Skeleton, Tabs } from "@/components/ui";
import { api } from "@/lib/client";
import { ORDER_LABELS, type Order } from "@/lib/types";
import { dateTime, inr } from "@/lib/utils";

type Tab = "active" | "previous";

export default function OrdersPage() {
  const { user, userLoading, addToCart, toast } = useApp();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("active");

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    api<{ orders: Order[] }>("/api/orders")
      .then((d) => setOrders(d.orders))
      .finally(() => setLoading(false));
  }, [user, userLoading]);

  if (!userLoading && !user) {
    return (
      <CustomerShell>
        <SectionTitle title="My Orders" />
        <EmptyState
          icon={<Package size={40} />}
          title="Sign in to see your orders"
          action={<Button onClick={() => router.push("/login?next=/orders")}>Sign in</Button>}
        />
      </CustomerShell>
    );
  }

  const active = orders.filter((o) => !["DELIVERED", "CANCELLED", "REJECTED"].includes(o.status));
  const previous = orders.filter((o) => ["DELIVERED", "CANCELLED", "REJECTED"].includes(o.status));
  const list = tab === "active" ? active : previous;

  return (
    <CustomerShell>
      <SectionTitle title="My Orders" />
      <Tabs<Tab>
        tabs={[
          { id: "active", label: "Active", count: active.length },
          { id: "previous", label: "Previous", count: previous.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="mt-4 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)
        ) : list.length === 0 ? (
          <EmptyState
            icon={<Package size={38} />}
            title={tab === "active" ? "No active orders" : "No past orders yet"}
            body="Your medicine orders will appear here with live tracking."
            action={<Button onClick={() => router.push("/search")}>Order medicines</Button>}
          />
        ) : (
          list.map((o) => (
            <Card key={o.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">
                    {o.items.map((i) => `${i.name} × ${i.qty}`).join(", ")}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {o.code} · {o.pharmacyName} · {dateTime(o.createdAt)}
                  </p>
                </div>
                <Badge tone={o.type === "RX" ? "amber" : "green"}>{o.type}</Badge>
              </div>

              <div className="mt-3">
                <MiniTracker status={o.status} />
                <p className="mt-1.5 text-xs font-medium text-ink-600">{ORDER_LABELS[o.status]}</p>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-3">
                <span className="font-semibold text-ink-900">{inr(o.total)}</span>
                <div className="flex gap-2">
                  {o.status === "DELIVERED" && o.type === "OTC" && (
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<RotateCcw size={14} />}
                      onClick={() => {
                        o.items.forEach((i) =>
                          addToCart(
                            {
                              medicineId: i.medicineId,
                              name: i.name,
                              strength: i.strength,
                              form: i.form,
                              type: i.type,
                              emoji: "💊",
                              price: i.price,
                            },
                            i.qty,
                          ),
                        );
                        toast({ kind: "success", title: "Added to cart" });
                        router.push("/cart");
                      }}
                    >
                      Reorder
                    </Button>
                  )}
                  <Link
                    href={`/orders/${o.id}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
                  >
                    {["DELIVERED", "CANCELLED", "REJECTED"].includes(o.status) ? "Details" : "Track"}
                    <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </CustomerShell>
  );
}
