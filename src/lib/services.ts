/**
 * Business logic shared by every route handler.
 *
 * The hyperlocal matching rule lives here: a medicine is "available" only if a
 * VERIFIED, ACTIVE pharmacy near the customer holds stock for it. There is no
 * central warehouse anywhere in this file.
 */

import { getStore } from "./db";
import type {
  GeoPoint,
  InventoryItem,
  Medicine,
  MedicineSearchResult,
  Notification,
  Order,
  OrderStatus,
  Pharmacy,
  PharmacyOffer,
  Prescription,
  SearchLog,
  User,
} from "./types";
import { etaWindow, newId, pharmacyDistanceKm } from "./utils";
import { DEFAULT_AREA, SERVICE_RADIUS_KM } from "./zones";

export type SortKey = "fastest" | "nearest" | "cheapest" | "rating";

export interface BasketLine {
  medicineId: string;
  qty: number;
}

/* -------------------------------------------------------------------------- */
/* catalogue + availability                                                   */
/* -------------------------------------------------------------------------- */

/** Where a request is measured from when the client hasn't sent coordinates. */
export const DEFAULT_ORIGIN: GeoPoint = { lat: DEFAULT_AREA.lat, lng: DEFAULT_AREA.lng };

/**
 * Pharmacies that can actually serve this customer: verified, active, and
 * genuinely within delivery range of their real coordinates.
 */
export async function servingPharmacies(
  origin: GeoPoint = DEFAULT_ORIGIN,
  maxKm = SERVICE_RADIUS_KM,
): Promise<Pharmacy[]> {
  const store = await getStore();
  const all = await store.list<Pharmacy>("pharmacies");
  return all
    .filter((p) => p.status === "ACTIVE" && p.verified)
    .filter((p) => pharmacyDistanceKm(p, origin) <= maxKm)
    .sort((a, b) => pharmacyDistanceKm(a, origin) - pharmacyDistanceKm(b, origin));
}

export async function searchMedicines(
  query: string,
  opts: { category?: string; limit?: number; origin?: GeoPoint } = {},
): Promise<MedicineSearchResult[]> {
  const origin = opts.origin ?? DEFAULT_ORIGIN;
  const store = await getStore();
  const [medicines, inventory, pharmacies] = await Promise.all([
    store.list<Medicine>("medicines"),
    store.list<InventoryItem>("inventory"),
    servingPharmacies(origin),
  ]);

  const q = query.trim().toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);

  let matched = medicines;
  if (terms.length) {
    matched = medicines.filter((m) => {
      const haystack =
        `${m.name} ${m.genericName} ${m.brand} ${m.form} ${m.strength} ${m.manufacturer} ${m.description}`.toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });
  }
  if (opts.category) matched = matched.filter((m) => m.category === opts.category);

  // Rank exact-ish name matches first.
  matched.sort((a, b) => {
    const an = a.name.toLowerCase();
    const bn = b.name.toLowerCase();
    const score = (n: string) => (n.startsWith(q) ? 0 : n.includes(q) ? 1 : 2);
    return score(an) - score(bn) || an.localeCompare(bn);
  });

  const byPharmacy = new Map(pharmacies.map((p) => [p.id, p]));

  const results = matched.slice(0, opts.limit ?? 60).map((medicine) => {
    const rows = inventory.filter(
      (i) => i.medicineId === medicine.id && i.stock > 0 && byPharmacy.has(i.pharmacyId),
    );
    const prices = rows.map((r) => r.price);
    const distances = rows.map((r) => pharmacyDistanceKm(byPharmacy.get(r.pharmacyId)!, origin));
    const etas = rows.map((r) => {
      const p = byPharmacy.get(r.pharmacyId)!;
      return etaWindow(pharmacyDistanceKm(p, origin), p.prepMinutes).from;
    });
    return {
      medicine,
      available: rows.length > 0,
      pharmacyCount: rows.length,
      minPrice: prices.length ? Math.min(...prices) : null,
      maxPrice: prices.length ? Math.max(...prices) : null,
      nearestKm: distances.length ? Math.min(...distances) : null,
      fastestEta: etas.length ? Math.min(...etas) : null,
    } satisfies MedicineSearchResult;
  });

  return results;
}

export async function medicineById(
  id: string,
  origin: GeoPoint = DEFAULT_ORIGIN,
): Promise<MedicineSearchResult | null> {
  const store = await getStore();
  const medicine = await store.one<Medicine>("medicines", { id });
  if (!medicine) return null;
  const [result] = await searchMedicines(medicine.name, { origin });
  return result && result.medicine.id === id
    ? result
    : {
        medicine,
        available: false,
        pharmacyCount: 0,
        minPrice: null,
        maxPrice: null,
        nearestKm: null,
        fastestEta: null,
      };
}

/* -------------------------------------------------------------------------- */
/* pharmacy matching for a basket                                             */
/* -------------------------------------------------------------------------- */

export async function pharmacyOffers(
  basket: BasketLine[],
  sort: SortKey = "fastest",
  origin: GeoPoint = DEFAULT_ORIGIN,
): Promise<PharmacyOffer[]> {
  const store = await getStore();
  const [medicines, inventory, pharmacies] = await Promise.all([
    store.list<Medicine>("medicines"),
    store.list<InventoryItem>("inventory"),
    servingPharmacies(origin),
  ]);
  const medById = new Map(medicines.map((m) => [m.id, m]));

  const offers: PharmacyOffer[] = pharmacies.map((pharmacy) => {
    const distanceKm = pharmacyDistanceKm(pharmacy, origin);
    const eta = etaWindow(distanceKm, pharmacy.prepMinutes);

    const lines = basket.map((line) => {
      const med = medById.get(line.medicineId);
      const inv = inventory.find(
        (i) => i.pharmacyId === pharmacy.id && i.medicineId === line.medicineId,
      );
      const stock = inv?.stock ?? 0;
      return {
        medicineId: line.medicineId,
        name: med?.name ?? line.medicineId,
        qty: line.qty,
        price: inv?.price ?? med?.mrp ?? 0,
        stock,
        available: stock >= line.qty,
      };
    });

    const itemsTotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
    return {
      pharmacy,
      distanceKm,
      etaMinFrom: eta.from,
      etaMinTo: eta.to,
      deliveryFee: pharmacy.deliveryFee,
      itemsTotal,
      total: itemsTotal + pharmacy.deliveryFee,
      allAvailable: lines.length > 0 && lines.every((l) => l.available),
      lines,
    } satisfies PharmacyOffer;
  });

  const sorters: Record<SortKey, (a: PharmacyOffer, b: PharmacyOffer) => number> = {
    fastest: (a, b) => a.etaMinFrom - b.etaMinFrom,
    nearest: (a, b) => a.distanceKm - b.distanceKm,
    cheapest: (a, b) => a.total - b.total,
    rating: (a, b) => b.pharmacy.rating - a.pharmacy.rating,
  };

  // Pharmacies holding the full basket always rank above partial ones.
  return offers.sort(
    (a, b) => Number(b.allAvailable) - Number(a.allAvailable) || sorters[sort](a, b),
  );
}

/* -------------------------------------------------------------------------- */
/* orders                                                                     */
/* -------------------------------------------------------------------------- */

export const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  PLACED: "PREPARING",
  ACCEPTED: "PREPARING",
  PREPARING: "READY",
  READY: "OUT_FOR_DELIVERY",
  OUT_FOR_DELIVERY: "DELIVERED",
};

export async function transitionOrder(
  orderId: string,
  status: OrderStatus,
  extra: { note?: string; deliveryPartnerId?: string; deliveryPartnerName?: string } = {},
): Promise<Order | null> {
  const store = await getStore();
  const order = await store.one<Order>("orders", { id: orderId });
  if (!order) return null;

  const history = [...order.history, { status, at: new Date().toISOString(), note: extra.note }];
  const patch: Partial<Order> = { status, history };
  if (extra.deliveryPartnerId) patch.deliveryPartnerId = extra.deliveryPartnerId;
  if (extra.deliveryPartnerName) patch.deliveryPartnerName = extra.deliveryPartnerName;
  if (status === "DELIVERED" && order.paymentMode === "COD") patch.paymentStatus = "PAID";

  // Stock leaves the shelf when the pharmacy starts preparing.
  if (status === "PREPARING") await decrementStock(order);

  const updated = await store.update<Order>("orders", orderId, patch);

  const messages: Partial<Record<OrderStatus, string>> = {
    PREPARING: `${order.pharmacyName} is preparing order ${order.code}.`,
    READY: `Order ${order.code} is packed and ready for pickup.`,
    OUT_FOR_DELIVERY: `Your order ${order.code} is out for delivery.`,
    DELIVERED: `Order ${order.code} was delivered. Get well soon!`,
    REJECTED: `${order.pharmacyName} could not fulfil ${order.code}. Please pick another pharmacy.`,
    CANCELLED: `Order ${order.code} was cancelled.`,
  };
  if (messages[status]) {
    await notify(order.customerId, {
      kind: status === "DELIVERED" || status === "OUT_FOR_DELIVERY" ? "DELIVERY" : "ORDER",
      title: status === "REJECTED" ? "Order could not be fulfilled" : "Order update",
      body: messages[status]!,
      href: `/orders/${order.id}`,
    });
  }

  return updated;
}

async function decrementStock(order: Order): Promise<void> {
  const store = await getStore();
  for (const item of order.items) {
    const inv = await store.one<InventoryItem>("inventory", {
      pharmacyId: order.pharmacyId,
      medicineId: item.medicineId,
    });
    if (!inv) continue;
    await store.update<InventoryItem>("inventory", inv.id, {
      stock: Math.max(0, inv.stock - item.qty),
      updatedAt: new Date().toISOString(),
    });
  }
}

/* -------------------------------------------------------------------------- */
/* notifications                                                              */
/* -------------------------------------------------------------------------- */

export async function notify(
  userId: string,
  n: Pick<Notification, "kind" | "title" | "body"> & { href?: string },
): Promise<void> {
  const store = await getStore();
  await store.insert<Notification>("notifications", {
    id: newId("ntf"),
    userId,
    kind: n.kind,
    title: n.title,
    body: n.body,
    href: n.href,
    read: false,
    createdAt: new Date().toISOString(),
  });
}

/* -------------------------------------------------------------------------- */
/* search logging (feeds admin analytics)                                     */
/* -------------------------------------------------------------------------- */

export async function logSearch(term: string, userId?: string, medicineId?: string) {
  if (!term.trim()) return;
  const store = await getStore();
  await store.insert<SearchLog>("searchLogs", {
    id: newId("sl"),
    term: term.trim().toLowerCase(),
    medicineId,
    userId,
    createdAt: new Date().toISOString(),
  });
}

/* -------------------------------------------------------------------------- */
/* admin analytics                                                            */
/* -------------------------------------------------------------------------- */

export interface AdminStats {
  totals: {
    customers: number;
    pharmacies: number;
    activePharmacies: number;
    pharmacists: number;
    riders: number;
    ordersToday: number;
    otcToday: number;
    rxToday: number;
    completedDeliveries: number;
    pendingVerifications: number;
    avgDeliveryMinutes: number;
    revenueToday: number;
  };
  ordersPerDay: Array<{ day: string; otc: number; rx: number }>;
  deliveryTimes: Array<{ day: string; minutes: number }>;
  topSearches: Array<{ term: string; count: number }>;
  topPharmacies: Array<{ name: string; orders: number; revenue: number }>;
  customerGrowth: Array<{ day: string; total: number }>;
  mix: { otc: number; rx: number };
}

export async function adminStats(): Promise<AdminStats> {
  const store = await getStore();
  const [users, pharmacies, orders, prescriptions, searches] = await Promise.all([
    store.list<User>("users"),
    store.list<Pharmacy>("pharmacies"),
    store.list<Order>("orders"),
    store.list<Prescription>("prescriptions"),
    store.list<SearchLog>("searchLogs"),
  ]);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todays = orders.filter((o) => new Date(o.createdAt) >= startOfToday);
  const delivered = orders.filter((o) => o.status === "DELIVERED");

  const minutesFor = (o: Order) => {
    const end = o.history.find((h) => h.status === "DELIVERED")?.at;
    if (!end) return null;
    return Math.round((new Date(end).getTime() - new Date(o.createdAt).getTime()) / 60000);
  };
  const durations = delivered.map(minutesFor).filter((m): m is number => m !== null);
  const avg = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);

  const ordersPerDay = days.map((day) => {
    const dayOrders = orders.filter((o) => dayKey(o.createdAt) === day);
    return {
      day,
      otc: dayOrders.filter((o) => o.type === "OTC").length,
      rx: dayOrders.filter((o) => o.type === "RX").length,
    };
  });

  const deliveryTimes = days.map((day) => {
    const mins = delivered
      .filter((o) => dayKey(o.createdAt) === day)
      .map(minutesFor)
      .filter((m): m is number => m !== null);
    return {
      day,
      minutes: mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : 0,
    };
  });

  const searchCounts = new Map<string, number>();
  for (const s of searches) searchCounts.set(s.term, (searchCounts.get(s.term) ?? 0) + 1);
  const topSearches = [...searchCounts.entries()]
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const pharmacyAgg = new Map<string, { name: string; orders: number; revenue: number }>();
  for (const o of orders) {
    if (o.status === "CANCELLED" || o.status === "REJECTED") continue;
    const entry = pharmacyAgg.get(o.pharmacyId) ?? {
      name: o.pharmacyName,
      orders: 0,
      revenue: 0,
    };
    entry.orders += 1;
    entry.revenue += o.total;
    pharmacyAgg.set(o.pharmacyId, entry);
  }
  const topPharmacies = [...pharmacyAgg.values()]
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 6);

  const customers = users.filter((u) => u.role === "customer");
  const customerGrowth = days.map((day) => ({
    day,
    total: customers.filter((c) => dayKey(c.createdAt) <= day).length + 1180, // demo baseline
  }));

  return {
    totals: {
      customers: customers.length + 1180,
      pharmacies: pharmacies.length,
      activePharmacies: pharmacies.filter((p) => p.status === "ACTIVE").length,
      pharmacists: users.filter((u) => u.role === "pharmacist").length,
      riders: users.filter((u) => u.role === "delivery").length,
      ordersToday: todays.length,
      otcToday: todays.filter((o) => o.type === "OTC").length,
      rxToday: todays.filter((o) => o.type === "RX").length,
      completedDeliveries: delivered.length,
      pendingVerifications: prescriptions.filter(
        (p) => p.status === "PENDING" || p.status === "IN_REVIEW" || p.status === "CLARIFICATION",
      ).length,
      avgDeliveryMinutes: avg,
      revenueToday: Math.round(todays.reduce((s, o) => s + o.total, 0)),
    },
    ordersPerDay,
    deliveryTimes,
    topSearches,
    topPharmacies,
    customerGrowth,
    mix: {
      otc: orders.filter((o) => o.type === "OTC").length,
      rx: orders.filter((o) => o.type === "RX").length,
    },
  };
}
