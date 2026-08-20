import type { GeoPoint, Pharmacy } from "./types";

/* -------------------------------------------------------------------------- */
/* ids                                                                        */
/* -------------------------------------------------------------------------- */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomCode(len = 6): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function orderCode(): string {
  return `DQ-${randomCode(6)}`;
}

export function prescriptionRef(): string {
  return `RX-${randomCode(5)}`;
}

/* -------------------------------------------------------------------------- */
/* money + time formatting                                                    */
/* -------------------------------------------------------------------------- */

export function inr(value: number): string {
  return `₹${value.toFixed(2).replace(/\.00$/, "")}`;
}

export function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/* -------------------------------------------------------------------------- */
/* geo                                                                        */
/* -------------------------------------------------------------------------- */

/** Great-circle distance in km. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Road distance runs ~1.25× straight-line on a dense Indian city grid. */
const ROAD_FACTOR = 1.25;

/**
 * Distance a rider actually travels between a pharmacy and the customer.
 * Real coordinates on both sides — a pharmacy across town genuinely is far.
 */
export function pharmacyDistanceKm(
  pharmacy: Pick<Pharmacy, "lat" | "lng">,
  origin: GeoPoint,
): number {
  const straight = haversineKm({ lat: pharmacy.lat, lng: pharmacy.lng }, origin);
  return Math.round(straight * ROAD_FACTOR * 10) / 10;
}

/** Prep time + travel time, rounded to a friendly 10-minute window. */
export function etaWindow(
  distanceKm: number,
  prepMinutes: number,
): { from: number; to: number } {
  const travel = distanceKm * 4.5; // ~13 km/h average on a two-wheeler in traffic
  const base = prepMinutes + travel;
  const from = Math.max(10, Math.round(base / 10) * 10);
  return { from, to: from + 10 };
}

export function windowLabel(fromIso: string, toIso: string): string {
  return `${timeOfDay(fromIso)} – ${timeOfDay(toIso)}`;
}

/* -------------------------------------------------------------------------- */
/* misc                                                                       */
/* -------------------------------------------------------------------------- */

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Honorifics and post-nominals carry no identity, so they never become an initial. */
const NAME_NOISE = /^(dr|sr|mr|mrs|ms|shri|smt|prof)\.?$/i;

/**
 * Initials for an avatar.
 *
 * Naively taking the first two words turns "Dr. Ankit Rawal (PT)" into "DA",
 * which belongs to nobody. Strip the title and the qualification first.
 */
export function initials(name: string): string {
  const parts = name
    .replace(/\([^)]*\)/g, " ")
    .split(/[\s.]+/)
    .filter((w) => w.length > 0 && !NAME_NOISE.test(w));

  const picked = parts.length ? parts : name.split(/\s+/);
  return picked
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}
