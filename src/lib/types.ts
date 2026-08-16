/**
 * DawaQuick domain types.
 *
 * Every collection is keyed by a string `id` (not Mongo's `_id`) so the same
 * shapes work against both the in-memory prototype store and MongoDB Atlas.
 */

export type Role =
  | "customer"
  | "pharmacist"
  | "pharmacy"
  | "delivery"
  | "provider"
  | "admin";

export type MedicineType = "OTC" | "RX";

export type OrderStatus =
  | "PLACED"
  | "ACCEPTED"
  | "PREPARING"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "REJECTED";

export type PrescriptionStatus =
  | "PENDING"
  | "IN_REVIEW"
  | "CLARIFICATION"
  | "APPROVED"
  | "REJECTED";

export type PharmacyStatus = "ACTIVE" | "PENDING" | "SUSPENDED";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface SavedLocation {
  id: string;
  label: string;
  locality: string;
  address: string;
  lat: number;
  lng: number;
}

export interface User {
  id: string;
  role: Role;
  name: string;
  email: string;
  phone: string;
  /** Plaintext only because this is a demo seed. Production must hash. */
  password: string;
  address?: string;
  locality?: string;
  savedLocations?: SavedLocation[];
  /** Pharmacy staff + pharmacists are linked to a pharmacy. */
  pharmacyId?: string;
  /** Pharmacist licence / registration number. */
  licenseNo?: string;
  active: boolean;
  createdAt: string;
}

export interface Medicine {
  id: string;
  name: string;
  genericName: string;
  strength: string;
  form: string; // Tablet, Syrup, Capsule, Ointment...
  brand: string;
  manufacturer: string;
  type: MedicineType;
  category: "otc" | "prescription" | "wellness";
  /** Indicative MRP per pack — pharmacies price around this. */
  mrp: number;
  packLabel: string; // "strip of 15 tablets"
  description: string;
  usage: string;
  emoji: string;
  requiresColdChain?: boolean;
  /**
   * Scheduled / habit-forming drugs. The prototype blocks these from the
   * regular flow entirely and shows a compliance notice instead.
   */
  restricted?: boolean;
}

export interface InventoryItem {
  id: string;
  pharmacyId: string;
  medicineId: string;
  stock: number;
  price: number;
  updatedAt: string;
}

export interface Pharmacy {
  id: string;
  name: string;
  ownerName: string;
  phone: string;
  licenseNo: string;
  address: string;
  /** Locality / sector, e.g. "Sector 11" or "Navrangpura". */
  locality: string;
  city: string;
  /**
   * Real coordinates. Distance to the customer is a true great-circle
   * calculation, so a pharmacy only serves customers genuinely near it.
   */
  lat: number;
  lng: number;
  rating: number;
  ratingCount: number;
  deliveryFee: number;
  prepMinutes: number;
  openTime: string;
  closeTime: string;
  status: PharmacyStatus;
  verified: boolean;
  createdAt: string;
}

export interface OrderItem {
  medicineId: string;
  name: string;
  strength: string;
  form: string;
  qty: number;
  price: number;
  type: MedicineType;
}

export interface StatusEvent {
  status: OrderStatus;
  at: string;
  note?: string;
}

export interface Order {
  id: string;
  code: string; // DQ-2K93F1
  customerId: string;
  customerName: string;
  customerPhone: string;
  address: string;
  locality: string;
  pharmacyId: string;
  pharmacyName: string;
  type: MedicineType; // OTC order vs prescription order
  prescriptionId?: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMode: "COD" | "UPI" | "CARD";
  paymentStatus: "PENDING" | "PAID";
  distanceKm: number;
  etaMinFrom: number;
  etaMinTo: number;
  promisedFrom: string; // ISO
  promisedTo: string; // ISO
  status: OrderStatus;
  history: StatusEvent[];
  deliveryPartnerId?: string;
  deliveryPartnerName?: string;
  createdAt: string;
}

export interface PrescriptionMedicine {
  name: string;
  strength: string;
  dosage: string;
  qty: number;
  medicineId?: string;
}

export interface VerificationCall {
  calledAt: string;
  durationSec: number;
  checklist: {
    identity: boolean;
    medicine: boolean;
    quantity: boolean;
    prescriptionDetails: boolean;
    address: boolean;
    orderConfirmed: boolean;
  };
  outcome: "VERIFIED" | "UNREACHABLE" | "MISMATCH";
}

export interface Prescription {
  id: string;
  ref: string; // RX-4471
  customerId: string;
  customerName: string;
  customerPhone: string;
  patientName: string;
  doctorName?: string;
  fileName: string;
  mimeType: string;
  /** data: URL for the prototype. Production stores an object-storage key. */
  fileData: string;
  note?: string;
  /** OCR placeholder — seeded/entered by the pharmacist in the prototype. */
  extractedMedicines: PrescriptionMedicine[];
  status: PrescriptionStatus;
  verifiedByName?: string;
  verifiedById?: string;
  verificationNote?: string;
  clarificationMessage?: string;
  rejectionReason?: string;
  call?: VerificationCall;
  orderId?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface Notification {
  id: string;
  userId: string;
  kind: "ORDER" | "PRESCRIPTION" | "DELIVERY" | "STOCK";
  title: string;
  body: string;
  href?: string;
  read: boolean;
  createdAt: string;
}

export interface SearchLog {
  id: string;
  term: string;
  medicineId?: string;
  userId?: string;
  createdAt: string;
}

export interface StockAlert {
  id: string;
  medicineId: string;
  medicineName: string;
  userId: string;
  phone: string;
  createdAt: string;
}

/** Shape returned by /api/pharmacies when matching a basket. */
export interface PharmacyOffer {
  pharmacy: Pharmacy;
  distanceKm: number;
  etaMinFrom: number;
  etaMinTo: number;
  deliveryFee: number;
  itemsTotal: number;
  total: number;
  allAvailable: boolean;
  lines: Array<{
    medicineId: string;
    name: string;
    qty: number;
    price: number;
    stock: number;
    available: boolean;
  }>;
}

/** Shape returned by /api/medicines search results. */
export interface MedicineSearchResult {
  medicine: Medicine;
  available: boolean;
  pharmacyCount: number;
  minPrice: number | null;
  maxPrice: number | null;
  nearestKm: number | null;
  fastestEta: number | null;
}

export const ORDER_FLOW: OrderStatus[] = [
  "PLACED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

export const ORDER_LABELS: Record<OrderStatus, string> = {
  PLACED: "Order Confirmed",
  ACCEPTED: "Accepted by Pharmacy",
  PREPARING: "Pharmacy Preparing",
  READY: "Ready for Pickup",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REJECTED: "Rejected — Out of Stock",
};

/* ========================================================================== */
/* Home healthcare — physiotherapy & nursing home visits                      */
/* ========================================================================== */

export type ServiceType = "PHYSIO" | "NURSING";

export type BookingStatus =
  | "REQUESTED"
  | "ASSIGNED"
  | "CONFIRMED"
  | "IN_VISIT"
  | "COMPLETED"
  | "CANCELLED"
  | "REJECTED";

export interface ProviderAvailability {
  /** 0 = Sunday … 6 = Saturday */
  weekdays: number[];
  /** "09:00-11:00" style windows the provider works. */
  slots: string[];
}

export interface ProviderCredential {
  id: string;
  name: string;
  /** Prototype stores a filename only; production stores an object-storage key. */
  fileName: string;
  uploadedAt: string;
  status: "PENDING" | "VERIFIED" | "REJECTED";
}

export interface ServiceProvider {
  id: string;
  /** Login account for this provider. */
  userId: string;
  type: ServiceType;
  name: string;
  emoji: string;
  headline: string;
  bio: string;
  qualifications: string[];
  /** Council registration — verified by admin before the provider goes live. */
  registrationNo: string;
  experienceYears: number;
  languages: string[];
  specialities: string[];
  /** Human-readable coverage, e.g. ["Sector 11", "Sector 7"]. */
  serviceAreas: string[];
  city: string;
  lat: number;
  lng: number;
  serviceRadiusKm: number;
  /** Provider's own rate; falls back to the platform rate when unset. */
  hourlyRate: number;
  rating: number;
  ratingCount: number;
  completedVisits: number;
  availability: ProviderAvailability;
  credentials: ProviderCredential[];
  verified: boolean;
  status: PharmacyStatus; // ACTIVE | PENDING | SUSPENDED — same lifecycle
  createdAt: string;
}

export interface BookingEvent {
  status: BookingStatus;
  at: string;
  note?: string;
}

export interface ServiceBooking {
  id: string;
  code: string; // BK-7QW2M
  serviceType: ServiceType;

  customerId: string;
  customerName: string;
  customerPhone: string;
  patientName: string;

  address: string;
  locality: string;
  city: string;
  lat: number;
  lng: number;

  /** YYYY-MM-DD — always at least `minAdvanceDays` ahead of booking time. */
  date: string;
  slot: string;
  hours: number;

  preferredProviderId?: string;
  providerId?: string;
  providerName?: string;

  /** Physiotherapy: reason for the visit. */
  reason?: string;
  /** Nursing: the kinds of assistance requested. */
  assistanceTypes: string[];
  patientNotes?: string;

  rate: number;
  serviceCharge: number;
  platformFee: number;
  total: number;

  paymentMode: "COD" | "UPI" | "CARD";
  paymentStatus: "PENDING" | "PAID";

  status: BookingStatus;
  history: BookingEvent[];
  rating?: number;
  createdAt: string;
}

export interface ServiceRateConfig {
  rate: number;
  platformFee: number;
  minHours: number;
  maxHours: number;
}

/** Admin-configurable pricing for both home-visit services. */
export interface ServiceSettings {
  id: string;
  physio: ServiceRateConfig;
  nursing: ServiceRateConfig;
  /** Minimum days between booking and visit. Same-day booking is blocked. */
  minAdvanceDays: number;
  updatedAt: string;
}

export const SERVICE_META: Record<
  ServiceType,
  { label: string; short: string; emoji: string; providerNoun: string; slug: string }
> = {
  PHYSIO: {
    label: "Physiotherapy at Home",
    short: "Physiotherapy",
    emoji: "🧑‍⚕️",
    providerNoun: "Physiotherapist",
    slug: "physiotherapy",
  },
  NURSING: {
    label: "Nursing Assistance at Home",
    short: "Nursing Assistance",
    emoji: "👩‍⚕️",
    providerNoun: "Nurse",
    slug: "nursing",
  },
};

/** Nursing adds an explicit "home visit in progress" stage. */
export const BOOKING_FLOW: Record<ServiceType, BookingStatus[]> = {
  PHYSIO: ["REQUESTED", "ASSIGNED", "CONFIRMED", "COMPLETED"],
  NURSING: ["REQUESTED", "ASSIGNED", "CONFIRMED", "IN_VISIT", "COMPLETED"],
};

export function bookingLabel(type: ServiceType, status: BookingStatus): string {
  const noun = SERVICE_META[type].providerNoun;
  const labels: Record<BookingStatus, string> = {
    REQUESTED: "Booking Requested",
    ASSIGNED: `${noun} Assigned`,
    CONFIRMED: "Booking Confirmed",
    IN_VISIT: "Home Visit",
    COMPLETED: type === "PHYSIO" ? "Home Visit Completed" : "Service Completed",
    CANCELLED: "Booking Cancelled",
    REJECTED: "Request Declined",
  };
  return labels[status];
}

/** Options offered on the nursing booking form. */
export const NURSING_ASSISTANCE_TYPES = [
  "Basic nursing assistance",
  "Post-hospitalisation support",
  "Elderly care assistance",
  "Medication assistance",
  "Wound-care assistance",
  "Vital-sign monitoring",
  "Basic patient support",
];

export const PHYSIO_REASONS = [
  "Post-operative rehabilitation",
  "Back or neck pain",
  "Knee / joint pain",
  "Stroke rehabilitation",
  "Sports injury recovery",
  "Mobility & balance training",
  "Post-fracture physiotherapy",
];

export const PRESCRIPTION_LABELS: Record<PrescriptionStatus, string> = {
  PENDING: "Pending Pharmacist Verification",
  IN_REVIEW: "Under Pharmacist Review",
  CLARIFICATION: "Clarification Requested",
  APPROVED: "Verified ✓",
  REJECTED: "Rejected",
};
