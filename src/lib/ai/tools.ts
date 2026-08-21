/**
 * What the operations agent is allowed to look at.
 *
 * Every tool here is READ-ONLY and scoped to the caller. That is the whole
 * safety model: an agent that can only look cannot dispense the wrong medicine,
 * cannot change a price, cannot approve a prescription. It reports and it
 * proposes; a human clicks.
 *
 * Scoping is enforced here rather than asked for in the prompt — a pharmacy
 * session can only ever see its own shelf and its own orders, whatever the
 * model decides to ask for.
 */

import { getStore } from "../db";
import { inr } from "../utils";
import type { Session } from "../session";
import type {
  InventoryItem,
  Medicine,
  Order,
  Prescription,
  SearchLog,
  Subscription,
} from "../types";

export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  run: (args: Record<string, unknown>, session: Session) => Promise<unknown>;
}

const minutesSince = (iso: string) =>
  Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));

/**
 * Hand the model finished strings, never raw numbers to format.
 *
 * Given `248` a model will happily write "$248" — it has seen far more dollars
 * than rupees. Given "₹248" it can only echo it. The same goes for durations:
 * "1349 minutes" is technically true and useless at a counter.
 */
const waited = (iso: string): string => {
  const m = minutesSince(iso);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
};

const today = () => new Date().toISOString().slice(0, 10);

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/* -------------------------------------------------------------------------- */
/* the tools                                                                  */
/* -------------------------------------------------------------------------- */

export const TOOLS: ToolSpec[] = [
  {
    name: "list_open_orders",
    description:
      "Orders at this pharmacy that still need action, oldest first, with how many minutes each has been waiting.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["PLACED", "PREPARING", "READY", "OUT_FOR_DELIVERY"],
          description: "Optional filter. Omit for everything still open.",
        },
      },
      required: [],
    },
    async run(args, session) {
      const store = await getStore();
      const all = await store.list<Order>("orders", { pharmacyId: session.pharmacyId });
      const open = all
        .filter((o) => !["DELIVERED", "CANCELLED", "REJECTED"].includes(o.status))
        .filter((o) => (args.status ? o.status === args.status : true))
        .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
        .slice(0, 25);

      return {
        count: open.length,
        orders: open.map((o) => ({
          code: o.code,
          status: o.status,
          waiting: waited(o.createdAt),
          waitingMinutes: minutesSince(o.createdAt),
          type: o.type,
          items: o.items.map((i) => `${i.name} x${i.qty}`),
          total: inr(o.total),
          rider: o.deliveryPartnerName ?? null,
        })),
      };
    },
  },

  {
    name: "list_low_stock",
    description:
      "Medicines on this pharmacy's shelf at or below a stock threshold, including ones at zero.",
    parameters: {
      type: "object",
      properties: {
        threshold: { type: "integer", description: "Units. Try 5 for 'running low'." },
      },
      required: ["threshold"],
    },
    async run(args, session) {
      const threshold = clampInt(args.threshold, 0, 100, 5);
      const store = await getStore();
      const [inventory, medicines] = await Promise.all([
        store.list<InventoryItem>("inventory", { pharmacyId: session.pharmacyId }),
        store.list<Medicine>("medicines"),
      ]);
      const byId = new Map(medicines.map((m) => [m.id, m]));

      const low = inventory
        .filter((i) => i.stock <= threshold)
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 30);

      return {
        threshold,
        outOfStock: low.filter((i) => i.stock === 0).length,
        items: low.map((i) => ({
          medicine: byId.get(i.medicineId)?.name ?? i.medicineId,
          type: byId.get(i.medicineId)?.type ?? "OTC",
          stock: i.stock,
          price: inr(i.price),
        })),
      };
    },
  },

  {
    name: "list_pending_prescriptions",
    description:
      "The prescription verification queue, oldest first, with how long each has been waiting.",
    parameters: { type: "object", properties: {}, required: [] },
    async run() {
      const store = await getStore();
      const all = await store.list<Prescription>("prescriptions");
      const queue = all
        .filter((p) => ["PENDING", "IN_REVIEW", "CLARIFICATION"].includes(p.status))
        .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
        .slice(0, 20);

      return {
        count: queue.length,
        prescriptions: queue.map((p) => ({
          ref: p.ref,
          status: p.status,
          waiting: waited(p.createdAt),
          patient: p.patientName,
          lines: p.extractedMedicines.length,
          callLogged: Boolean(p.call),
          aiRead: Boolean(p.aiDraft),
        })),
      };
    },
  },

  {
    name: "list_due_repeats",
    description:
      "Repeat deliveries this pharmacy is due to fill soon, and whether the shelf can currently cover each one.",
    parameters: {
      type: "object",
      properties: { days: { type: "integer", description: "Look ahead this many days." } },
      required: ["days"],
    },
    async run(args, session) {
      const days = clampInt(args.days, 1, 30, 7);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + days);
      const limit = cutoff.toISOString().slice(0, 10);

      const store = await getStore();
      const [subs, inventory, medicines] = await Promise.all([
        store.list<Subscription>("subscriptions", { pharmacyId: session.pharmacyId }),
        store.list<InventoryItem>("inventory", { pharmacyId: session.pharmacyId }),
        store.list<Medicine>("medicines"),
      ]);
      const stock = new Map(inventory.map((i) => [i.medicineId, i.stock]));
      const byId = new Map(medicines.map((m) => [m.id, m]));

      const due = subs
        .filter((s) => s.status === "ACTIVE" && s.nextDate <= limit)
        .sort((a, b) => a.nextDate.localeCompare(b.nextDate))
        .slice(0, 20);

      return {
        days,
        count: due.length,
        repeats: due.map((s) => {
          const short = s.items.filter((i) => (stock.get(i.medicineId) ?? 0) < i.qty);
          return {
            ref: s.ref,
            dueOn: s.nextDate,
            customer: s.customerName,
            items: s.items.map((i) => `${i.name} x${i.qty}`),
            canFill: short.length === 0,
            shortOf: short.map(
              (i) =>
                `${byId.get(i.medicineId)?.name ?? i.medicineId} (need ${i.qty}, have ${stock.get(i.medicineId) ?? 0})`,
            ),
          };
        }),
      };
    },
  },

  {
    name: "list_expiring_prescription_cover",
    description:
      "Repeat deliveries whose prescription is running out of authorised refills or is close to expiry, which will stop them.",
    parameters: { type: "object", properties: {}, required: [] },
    async run(_args, session) {
      const store = await getStore();
      const subs = await store.list<Subscription>("subscriptions", {
        pharmacyId: session.pharmacyId,
      });
      const rxSubs = subs.filter((s) => s.type === "RX" && s.prescriptionId);

      const rows = [];
      for (const s of rxSubs.slice(0, 20)) {
        const rx = await store.one<Prescription>("prescriptions", { id: s.prescriptionId! });
        if (!rx) continue;
        const left = (rx.refillsAuthorised ?? 0) - (rx.refillsUsed ?? 0);
        const expiringSoon = rx.validUntil ? rx.validUntil <= addDays(today(), 30) : false;
        if (left > 1 && !expiringSoon && s.status === "ACTIVE") continue;
        rows.push({
          ref: s.ref,
          status: s.status,
          customer: s.customerName,
          prescription: rx.ref,
          refillsLeft: left,
          validUntil: rx.validUntil ?? null,
        });
      }
      return { count: rows.length, repeats: rows };
    },
  },

  {
    name: "unmet_demand",
    description:
      "Medicines customers searched for recently that this pharmacy does not stock, or holds at zero. Useful for deciding what to order in.",
    parameters: {
      type: "object",
      properties: { days: { type: "integer", description: "How far back to look." } },
      required: ["days"],
    },
    async run(args, session) {
      const days = clampInt(args.days, 1, 90, 14);
      const since = Date.now() - days * 864e5;

      const store = await getStore();
      const [logs, inventory, medicines] = await Promise.all([
        store.list<SearchLog>("searchLogs"),
        store.list<InventoryItem>("inventory", { pharmacyId: session.pharmacyId }),
        store.list<Medicine>("medicines"),
      ]);
      const stock = new Map(inventory.map((i) => [i.medicineId, i.stock]));
      const byId = new Map(medicines.map((m) => [m.id, m]));

      const counts = new Map<string, number>();
      for (const l of logs) {
        if (!l.medicineId || +new Date(l.createdAt) < since) continue;
        counts.set(l.medicineId, (counts.get(l.medicineId) ?? 0) + 1);
      }

      const gaps = [...counts.entries()]
        .filter(([id]) => (stock.get(id) ?? 0) === 0)
        .map(([id, searches]) => ({
          medicine: byId.get(id)?.name ?? id,
          type: byId.get(id)?.type ?? "OTC",
          searches,
          onShelf: stock.has(id),
        }))
        .sort((a, b) => b.searches - a.searches)
        .slice(0, 12);

      return { days, count: gaps.length, gaps };
    },
  },

  {
    name: "todays_numbers",
    description: "Headline figures for this pharmacy today: orders, revenue, delivered, rejected.",
    parameters: { type: "object", properties: {}, required: [] },
    async run(_args, session) {
      const store = await getStore();
      const orders = await store.list<Order>("orders", { pharmacyId: session.pharmacyId });
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const todays = orders.filter((o) => new Date(o.createdAt) >= start);
      const delivered = todays.filter((o) => o.status === "DELIVERED");

      return {
        ordersToday: todays.length,
        delivered: delivered.length,
        rejected: todays.filter((o) => o.status === "REJECTED").length,
        revenueToday: inr(delivered.reduce((s, o) => s + o.subtotal, 0)),
        openNow: orders.filter(
          (o) => !["DELIVERED", "CANCELLED", "REJECTED"].includes(o.status),
        ).length,
      };
    },
  },
];

function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export const TOOL_MAP = new Map(TOOLS.map((t) => [t.name, t]));

/** The OpenAI/Groq function-calling shape. */
export const toolSchemas = () =>
  TOOLS.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
