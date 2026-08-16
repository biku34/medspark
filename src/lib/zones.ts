/**
 * MedSpark service geography — Gandhinagar & Ahmedabad, Gujarat.
 *
 * The platform is hyperlocal, so geography is real: pharmacies carry actual
 * coordinates and distances are true great-circle distances. A pharmacy in
 * Ahmedabad therefore simply does not appear for a customer in Gandhinagar
 * (~22 km apart) — which is exactly how a local pharmacy network behaves.
 *
 * Coordinates are approximate to the locality/sector level. They are good
 * enough for realistic distances and ETAs, and are replaced by real geocoding
 * in production (see NEXT_PUBLIC_MAPS_API_KEY).
 */

import type { GeoPoint } from "./types";
import { haversineKm } from "./utils";

export type City = "Gandhinagar" | "Ahmedabad";

export const CITIES: City[] = ["Gandhinagar", "Ahmedabad"];

export interface ServiceArea {
  id: string;
  /** Locality / sector name shown to the customer. */
  name: string;
  city: City;
  lat: number;
  lng: number;
}

export const CITY_CENTERS: Record<City, GeoPoint> = {
  Gandhinagar: { lat: 23.2156, lng: 72.6369 },
  Ahmedabad: { lat: 23.0225, lng: 72.5714 },
};

/** Areas a customer can pick from, and where pharmacies are anchored. */
export const SERVICE_AREAS: ServiceArea[] = [
  /* ------------------------------ Gandhinagar ----------------------------- */
  { id: "gn_sec11", name: "Sector 11", city: "Gandhinagar", lat: 23.227, lng: 72.642 },
  { id: "gn_sec7", name: "Sector 7", city: "Gandhinagar", lat: 23.233, lng: 72.648 },
  { id: "gn_sec21", name: "Sector 21", city: "Gandhinagar", lat: 23.208, lng: 72.63 },
  { id: "gn_infocity", name: "Infocity (Sector 24)", city: "Gandhinagar", lat: 23.188, lng: 72.629 },
  { id: "gn_kudasan", name: "Kudasan", city: "Gandhinagar", lat: 23.1834, lng: 72.6353 },
  { id: "gn_sargasan", name: "Sargasan", city: "Gandhinagar", lat: 23.17, lng: 72.627 },
  { id: "gn_randesan", name: "Randesan", city: "Gandhinagar", lat: 23.178, lng: 72.648 },
  { id: "gn_pethapur", name: "Pethapur", city: "Gandhinagar", lat: 23.24, lng: 72.665 },
  { id: "gn_adalaj", name: "Adalaj", city: "Gandhinagar", lat: 23.166, lng: 72.581 },

  /* ------------------------------- Ahmedabad ------------------------------ */
  { id: "ah_navrangpura", name: "Navrangpura", city: "Ahmedabad", lat: 23.038, lng: 72.56 },
  { id: "ah_vastrapur", name: "Vastrapur", city: "Ahmedabad", lat: 23.035, lng: 72.529 },
  { id: "ah_satellite", name: "Satellite", city: "Ahmedabad", lat: 23.029, lng: 72.514 },
  { id: "ah_bodakdev", name: "Bodakdev", city: "Ahmedabad", lat: 23.042, lng: 72.508 },
  { id: "ah_prahladnagar", name: "Prahlad Nagar", city: "Ahmedabad", lat: 23.013, lng: 72.507 },
  { id: "ah_thaltej", name: "Thaltej (S.G. Highway)", city: "Ahmedabad", lat: 23.05, lng: 72.506 },
  { id: "ah_naranpura", name: "Naranpura", city: "Ahmedabad", lat: 23.056, lng: 72.562 },
  { id: "ah_paldi", name: "Paldi", city: "Ahmedabad", lat: 23.011, lng: 72.567 },
  { id: "ah_maninagar", name: "Maninagar", city: "Ahmedabad", lat: 22.9967, lng: 72.6014 },
  { id: "ah_chandkheda", name: "Chandkheda", city: "Ahmedabad", lat: 23.1128, lng: 72.5871 },
];

/**
 * How far a pharmacy may be from the customer and still deliver.
 * 10 km keeps intra-city delivery realistic (both cities' cores fit inside it)
 * while correctly excluding the ~22 km Gandhinagar <-> Ahmedabad hop.
 */
export const SERVICE_RADIUS_KM = 10;

/** Beyond this from either city centre, MedSpark simply isn't live yet. */
export const CITY_COVERAGE_KM = 25;

/** Where a first-time visitor starts before granting location access. */
export const DEFAULT_AREA: ServiceArea = SERVICE_AREAS[0]; // Sector 11, Gandhinagar

export function areasFor(city: City): ServiceArea[] {
  return SERVICE_AREAS.filter((a) => a.city === city);
}

export function areaById(id: string): ServiceArea | undefined {
  return SERVICE_AREAS.find((a) => a.id === id);
}

/** Closest known locality to a point — stands in for reverse geocoding. */
export function nearestArea(point: GeoPoint): ServiceArea {
  let best = SERVICE_AREAS[0];
  let bestKm = Infinity;
  for (const area of SERVICE_AREAS) {
    const km = haversineKm(point, area);
    if (km < bestKm) {
      bestKm = km;
      best = area;
    }
  }
  return best;
}

export function nearestCityKm(point: GeoPoint): { city: City; km: number } {
  const scored = CITIES.map((city) => ({ city, km: haversineKm(point, CITY_CENTERS[city]) }));
  return scored.sort((a, b) => a.km - b.km)[0];
}

/** True when the point is inside a city MedSpark currently operates in. */
export function isInServiceArea(point: GeoPoint): boolean {
  return nearestCityKm(point).km <= CITY_COVERAGE_KM;
}
