"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import {
  Bell,
  CalendarClock,
  CheckCheck,
  FileText,
  Hospital,
  Package,
  Truck,
} from "lucide-react";
import { useApp } from "./providers";
import { api, patch } from "@/lib/client";
import type { Notification } from "@/lib/types";
import { relativeTime } from "@/lib/utils";

/** Each kind gets the colour it already owns elsewhere in the app. */
const KIND = {
  ORDER: { icon: Package, tone: "bg-brand-50 text-brand-700" },
  DELIVERY: { icon: Truck, tone: "bg-brand-50 text-brand-700" },
  PRESCRIPTION: { icon: FileText, tone: "bg-rx-100 text-rx-700" },
  STOCK: { icon: Package, tone: "bg-ink-100 text-ink-600" },
  CARE_PLAN: { icon: Hospital, tone: "bg-care-100 text-care-700" },
  REPEAT: { icon: CalendarClock, tone: "bg-ok-100 text-ok-700" },
} as const;

/**
 * The notification bell.
 *
 * Every meaningful thing the platform does already raises a notification — a
 * pharmacy accepts, a pharmacist verifies, a repeat delivery goes out or stops
 * for want of a prescription. Until now the only way to read one was to open
 * Profile and find the right tab, which meant the app was talking to nobody.
 */
export function NotificationBell() {
  const { user } = useApp();
  const [list, setList] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const d = await api<{ notifications: Notification[]; unread: number }>(
        "/api/notifications",
      );
      setList(d.notifications.slice(0, 12));
      setUnread(d.unread);
    } catch {
      /* a failed poll just leaves the last count in place */
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setList([]);
      setUnread(0);
      return;
    }
    void load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [user, load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!user) return null;

  const markAll = async () => {
    setUnread(0);
    setList((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await patch("/api/notifications", { all: true });
    } catch {
      void load();
    }
  };

  const openOne = async (n: Notification) => {
    setOpen(false);
    if (n.read) return;
    setUnread((u) => Math.max(0, u - 1));
    setList((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    try {
      await patch("/api/notifications", { id: n.id });
    } catch {
      /* the badge corrects itself on the next poll */
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-white/85 hover:bg-white/10"
      >
        <Bell size={17} strokeWidth={2.4} />
        {unread > 0 && (
          <span className="nums absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rx-400 px-1 text-[10px] font-extrabold text-ink-900 ring-2 ring-brand-700">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-ink-200 bg-white shadow-2xl shadow-ink-900/20">
          <div className="flex items-center justify-between border-b border-ink-100 px-3 py-2">
            <p className="text-[13px] font-extrabold text-ink-900">Notifications</p>
            {unread > 0 && (
              <button
                onClick={markAll}
                className="inline-flex items-center gap-1 text-[12px] font-bold text-brand-700 hover:underline"
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
            {list.length === 0 ? (
              <p className="px-3 py-6 text-center text-[13px] text-ink-500">
                Nothing yet. Order updates land here.
              </p>
            ) : (
              list.map((n) => {
                const meta = KIND[n.kind] ?? KIND.STOCK;
                const Icon = meta.icon;
                const body = (
                  <>
                    <span
                      className={clsx(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        meta.tone,
                      )}
                    >
                      <Icon size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-bold text-ink-900">
                          {n.title}
                        </span>
                        {!n.read && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />
                        )}
                      </span>
                      <span className="clamp-2 block text-[12px] leading-snug text-ink-600">
                        {n.body}
                      </span>
                      <span className="mt-0.5 block text-[10.5px] text-ink-400">
                        {relativeTime(n.createdAt)}
                      </span>
                    </span>
                  </>
                );

                return n.href ? (
                  <Link
                    key={n.id}
                    href={n.href}
                    onClick={() => openOne(n)}
                    className={clsx(
                      "flex gap-2.5 border-b border-ink-100 px-3 py-2.5 last:border-0 hover:bg-ink-50",
                      !n.read && "bg-brand-50/40",
                    )}
                  >
                    {body}
                  </Link>
                ) : (
                  <div
                    key={n.id}
                    className={clsx(
                      "flex gap-2.5 border-b border-ink-100 px-3 py-2.5 last:border-0",
                      !n.read && "bg-brand-50/40",
                    )}
                  >
                    {body}
                  </div>
                );
              })
            )}
          </div>

          <Link
            href="/profile?tab=notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-ink-100 px-3 py-2.5 text-center text-[12.5px] font-bold text-brand-700 hover:bg-ink-50"
          >
            See all
          </Link>
        </div>
      )}
    </div>
  );
}
