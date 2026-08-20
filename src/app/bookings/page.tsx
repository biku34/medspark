"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, ChevronRight, HeartPulse } from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { ServiceArt } from "@/components/art";
import { MiniBookingTracker } from "@/components/booking-tracker";
import { useApp } from "@/components/providers";
import { Badge, Button, Card, EmptyState, SectionTitle, Skeleton, Tabs } from "@/components/ui";
import { api } from "@/lib/client";
import { bookingDateLabel } from "@/lib/booking-utils";
import { SERVICE_META, bookingLabel, type ServiceBooking } from "@/lib/types";
import { inr } from "@/lib/utils";

type Tab = "upcoming" | "past";

export default function BookingsPage() {
  const { user, userLoading } = useApp();
  const router = useRouter();
  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("upcoming");

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    api<{ bookings: ServiceBooking[] }>("/api/bookings")
      .then((d) => setBookings(d.bookings))
      .finally(() => setLoading(false));
  }, [user, userLoading]);

  if (!userLoading && !user) {
    return (
      <CustomerShell>
        <SectionTitle title="My Home Visits" />
        <EmptyState
          icon={<CalendarDays size={40} />}
          title="Sign in to see your bookings"
          action={<Button onClick={() => router.push("/login?next=/bookings")}>Sign in</Button>}
        />
      </CustomerShell>
    );
  }

  const closed = ["COMPLETED", "CANCELLED", "REJECTED"];
  const upcoming = bookings.filter((b) => !closed.includes(b.status));
  const past = bookings.filter((b) => closed.includes(b.status));
  const list = tab === "upcoming" ? upcoming : past;

  return (
    <CustomerShell>
      <SectionTitle
        title="My Home Visits"
        subtitle="Physiotherapy and nursing bookings"
        action={
          <Button size="sm" onClick={() => router.push("/services/physiotherapy")}>
            Book a visit
          </Button>
        }
      />

      <Tabs<Tab>
        tabs={[
          { id: "upcoming", label: "Upcoming", count: upcoming.length },
          { id: "past", label: "Past", count: past.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="mt-4 space-y-3">
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32" />)
        ) : list.length === 0 ? (
          <EmptyState
            icon={<HeartPulse size={38} />}
            title={tab === "upcoming" ? "No upcoming home visits" : "No past visits yet"}
            body="Book a physiotherapist or a nurse for a home visit — minimum one day in advance."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => router.push("/services/physiotherapy")}>
                  Book physiotherapy
                </Button>
                <Button variant="outline" onClick={() => router.push("/services/nursing")}>
                  Book nursing help
                </Button>
              </div>
            }
          />
        ) : (
          list.map((b) => {
            const meta = SERVICE_META[b.serviceType];
            return (
              <Card key={b.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-50">
                      <ServiceArt
                        kind={b.serviceType === "PHYSIO" ? "physio" : "nursing"}
                        size={32}
                      />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-900">{meta.short}</p>
                      <p className="text-xs text-ink-500">
                        {bookingDateLabel(b.date)} · {b.slot} · {b.hours}h
                      </p>
                      <p className="mt-0.5 truncate text-xs text-ink-400">
                        {b.code} · {b.providerName ?? "Provider being assigned"}
                      </p>
                    </div>
                  </div>
                  <Badge
                    className="max-w-[45%] shrink-0 truncate sm:max-w-none"
                    tone={
                      b.status === "COMPLETED"
                        ? "green"
                        : b.status === "CANCELLED" || b.status === "REJECTED"
                          ? "red"
                          : "amber"
                    }
                  >
                    {bookingLabel(b.serviceType, b.status)}
                  </Badge>
                </div>

                <div className="mt-3">
                  <MiniBookingTracker status={b.status} serviceType={b.serviceType} />
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-3">
                  <span className="font-semibold text-ink-900">{inr(b.total)}</span>
                  <Link
                    href={`/bookings/${b.id}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
                  >
                    Details <ChevronRight size={14} />
                  </Link>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </CustomerShell>
  );
}
