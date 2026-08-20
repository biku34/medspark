"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { MedicineType, User } from "@/lib/types";
import { DEFAULT_AREA, isInServiceArea, nearestArea } from "@/lib/zones";

/* ========================================================================== */
/* Types                                                                      */
/* ========================================================================== */

export interface CartLine {
  medicineId: string;
  name: string;
  strength: string;
  form: string;
  type: MedicineType;
  emoji: string;
  /** Shelf category — drives the pack artwork in the cart. */
  subcategory?: string;
  /** Catalogue MRP, so the cart can show what the shelf price undercuts. */
  mrp?: number;
  price: number;
  qty: number;
}

export interface AppLocation {
  locality: string;
  city: string;
  address: string;
  lat: number;
  lng: number;
  source: "gps" | "manual" | "saved" | "none";
  /** True when the detected point is outside Gandhinagar / Ahmedabad. */
  outsideServiceArea?: boolean;
}

export interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  title: string;
  body?: string;
}

interface AppState {
  /* session */
  user: User | null;
  userLoading: boolean;
  setUser: (u: User | null) => void;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;

  /* location */
  location: AppLocation | null;
  /** Effective location — falls back to the default service area. */
  origin: AppLocation;
  /** `lat=..&lng=..` for API calls, always defined. */
  geoQuery: string;
  setLocation: (l: AppLocation | null) => void;
  locationAsked: boolean;
  markLocationAsked: () => void;
  detecting: boolean;
  detectLocation: () => Promise<AppLocation | null>;

  /* cart */
  cart: CartLine[];
  cartCount: number;
  cartTotal: number;
  addToCart: (line: Omit<CartLine, "qty">, qty?: number) => void;
  setQty: (medicineId: string, qty: number) => void;
  removeFromCart: (medicineId: string) => void;
  clearCart: () => void;

  /* prescription attached to the current basket (RX flow) */
  activePrescriptionId: string | null;
  setActivePrescriptionId: (id: string | null) => void;

  /* toasts */
  toasts: Toast[];
  toast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;
}

const Ctx = createContext<AppState | null>(null);

/* ========================================================================== */
/* Storage helpers                                                            */
/* ========================================================================== */

const LS = {
  cart: "dawaquick.cart",
  location: "dawaquick.location",
  asked: "dawaquick.locationAsked",
  rx: "dawaquick.activeRx",
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — the prototype degrades to in-memory state */
  }
}

/**
 * Reverse geocoding stand-in: snap to the nearest known locality in the
 * Gandhinagar / Ahmedabad service map. Production swaps this for the Maps API.
 */
function describePoint(lat: number, lng: number): {
  locality: string;
  city: string;
  outsideServiceArea: boolean;
} {
  const area = nearestArea({ lat, lng });
  const covered = isInServiceArea({ lat, lng });
  return {
    locality: covered ? area.name : "Outside service area",
    city: covered ? area.city : "—",
    outsideServiceArea: !covered,
  };
}

/* ========================================================================== */
/* Provider                                                                   */
/* ========================================================================== */

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [location, setLocationState] = useState<AppLocation | null>(null);
  const [locationAsked, setLocationAsked] = useState(true); // assume asked until hydrated
  const [detecting, setDetecting] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [activePrescriptionId, setActivePrescriptionIdState] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  /* ---------------------------------------------------------------- hydrate */
  useEffect(() => {
    setCart(read<CartLine[]>(LS.cart, []));
    setLocationState(read<AppLocation | null>(LS.location, null));
    setLocationAsked(read<boolean>(LS.asked, false));
    setActivePrescriptionIdState(read<string | null>(LS.rx, null));
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setUserLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  /* ------------------------------------------------------------------ toast */
  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  /* --------------------------------------------------------------- location */
  const setLocation = useCallback((l: AppLocation | null) => {
    setLocationState(l);
    write(LS.location, l);
    write(LS.asked, true);
    setLocationAsked(true);
  }, []);

  const markLocationAsked = useCallback(() => {
    setLocationAsked(true);
    write(LS.asked, true);
  }, []);

  const detectLocation = useCallback(async (): Promise<AppLocation | null> => {
    markLocationAsked();
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast({ kind: "error", title: "Location not supported on this device" });
      return null;
    }
    setDetecting(true);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          const described = describePoint(lat, lng);
          const next: AppLocation = {
            lat,
            lng,
            locality: described.locality,
            city: described.city,
            address: "Current location",
            source: "gps",
            outsideServiceArea: described.outsideServiceArea,
          };
          setLocation(next);
          setDetecting(false);
          toast(
            described.outsideServiceArea
              ? {
                  kind: "info",
                  title: "DawaQuick isn't live in your area yet",
                  body: "We currently deliver in Gandhinagar and Ahmedabad — pick an area to explore the demo.",
                }
              : {
                  kind: "success",
                  title: `Location set — ${next.locality}, ${next.city}`,
                  body: "Showing pharmacies near you.",
                },
          );
          resolve(next);
        },
        () => {
          setDetecting(false);
          toast({
            kind: "error",
            title: "Couldn't get your location",
            body: "Enter your locality manually to continue.",
          });
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
      );
    });
  }, [markLocationAsked, setLocation, toast]);

  /* ------------------------------------------------------------------- cart */
  const persistCart = useCallback((next: CartLine[]) => {
    setCart(next);
    write(LS.cart, next);
  }, []);

  const addToCart = useCallback(
    (line: Omit<CartLine, "qty">, qty = 1) => {
      setCart((prev) => {
        const existing = prev.find((l) => l.medicineId === line.medicineId);
        const next = existing
          ? prev.map((l) =>
              l.medicineId === line.medicineId ? { ...l, qty: l.qty + qty } : l,
            )
          : [...prev, { ...line, qty }];
        write(LS.cart, next);
        return next;
      });
    },
    [],
  );

  const setQty = useCallback((medicineId: string, qty: number) => {
    setCart((prev) => {
      const next =
        qty <= 0
          ? prev.filter((l) => l.medicineId !== medicineId)
          : prev.map((l) => (l.medicineId === medicineId ? { ...l, qty } : l));
      write(LS.cart, next);
      return next;
    });
  }, []);

  const removeFromCart = useCallback((medicineId: string) => {
    setCart((prev) => {
      const next = prev.filter((l) => l.medicineId !== medicineId);
      write(LS.cart, next);
      return next;
    });
  }, []);

  const clearCart = useCallback(() => persistCart([]), [persistCart]);

  const setActivePrescriptionId = useCallback((id: string | null) => {
    setActivePrescriptionIdState(id);
    write(LS.rx, id);
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    clearCart();
    setActivePrescriptionId(null);
  }, [clearCart, setActivePrescriptionId]);

  /* ------------------------------------------------------------------ value */

  /**
   * Everything that asks "what's near me?" measures from here. A visitor who
   * hasn't set a location yet browses the default service area rather than
   * seeing an empty app.
   */
  const origin = useMemo<AppLocation>(() => {
    if (location && !location.outsideServiceArea) return location;
    return {
      locality: DEFAULT_AREA.name,
      city: DEFAULT_AREA.city,
      address: `${DEFAULT_AREA.name}, ${DEFAULT_AREA.city}`,
      lat: DEFAULT_AREA.lat,
      lng: DEFAULT_AREA.lng,
      source: "none",
    };
  }, [location]);

  const geoQuery = useMemo(() => `lat=${origin.lat}&lng=${origin.lng}`, [origin]);

  const value = useMemo<AppState>(
    () => ({
      user,
      userLoading,
      setUser,
      refreshUser,
      signOut,
      location,
      origin,
      geoQuery,
      setLocation,
      locationAsked,
      markLocationAsked,
      detecting,
      detectLocation,
      cart,
      cartCount: cart.reduce((s, l) => s + l.qty, 0),
      cartTotal: cart.reduce((s, l) => s + l.qty * l.price, 0),
      addToCart,
      setQty,
      removeFromCart,
      clearCart,
      activePrescriptionId,
      setActivePrescriptionId,
      toasts,
      toast,
      dismissToast,
    }),
    [
      user,
      userLoading,
      refreshUser,
      signOut,
      location,
      origin,
      geoQuery,
      setLocation,
      locationAsked,
      markLocationAsked,
      detecting,
      detectLocation,
      cart,
      addToCart,
      setQty,
      removeFromCart,
      clearCart,
      activePrescriptionId,
      setActivePrescriptionId,
      toasts,
      toast,
      dismissToast,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
