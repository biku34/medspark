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
  /** Shelf category used for browsing, e.g. "first-aid". See lib/shelf.ts. */
  subcategory: string;
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
  /** Set when a repeat-delivery schedule raised this order. */
  subscriptionId?: string;
  /** Subscriber saving taken off the subtotal. */
  discount?: number;
  /** Set when this order came out of an approved care plan. */
  carePlanId?: string;
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
  /**
   * Repeat authorisation, set by the pharmacist at approval.
   *
   * Auto-refilling against an expired or already-spent prescription is a real
   * compliance exposure, so a repeat delivery may only draw down against these
   * two numbers and stops itself when either runs out.
   */
  refillsAuthorised?: number;
  refillsUsed?: number;
  /** YYYY-MM-DD — after this date the prescription can no longer be dispensed. */
  validUntil?: string;
  /**
   * What the AI read, kept for audit.
   *
   * A draft, never a decision: it is shown on the verification desk for the
   * pharmacist to accept line by line, and carries the models used and the
   * lines that were filtered out so a dispensing decision can be traced back.
   */
  aiDraft?: AiPrescriptionDraft;
  createdAt: string;
  reviewedAt?: string;
}

export interface AiDraftLine extends PrescriptionMedicine {
  /** The words on the page this line was read from. */
  sourceText: string;
  /** Every model that had an opinion picked the same catalogue medicine. */
  agreed: boolean;
  proposedBy: string[];
}

export interface AiPrescriptionDraft {
  ok: boolean;
  unreadable: boolean;
  transcription: string;
  doctorName?: string;
  patientName?: string;
  lines: AiDraftLine[];
  /** Read from the page but matched nothing in the catalogue. */
  unmatched: string[];
  notes: string[];
  models: string[];
  createdAt: string;
  /** Set once a pharmacist pulls the draft into the form. */
  appliedAt?: string;
}

export interface Notification {
  id: string;
  userId: string;
  kind: "ORDER" | "PRESCRIPTION" | "DELIVERY" | "STOCK" | "CARE_PLAN" | "REPEAT";
  title: string;
  body: string;
  href?: string;
  read: boolean;
  createdAt: string;
}

/**
 * A rating left after a delivered order.
 *
 * Tied to the order it came from, so a review can only be written by somebody
 * who actually received the thing — the single rule that separates a review
 * section from a comments box. One row covers the pharmacy that dispensed and,
 * optionally, one medicine from that order.
 */
export interface Review {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  pharmacyId: string;
  /** Absent when the customer rated only the service, not a specific item. */
  medicineId?: string;
  /** 1–5. */
  rating: number;
  text?: string;
  createdAt: string;
}

/** Aggregate returned alongside a medicine or a pharmacy. */
export interface RatingSummary {
  average: number;
  count: number;
  /** Index 0 = one star … index 4 = five stars. */
  histogram: [number, number, number, number, number];
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
  /** Customer ratings, when this item has any. */
  rating?: RatingSummary;
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

/* ========================================================================== */
/* Health records & care plans                                                */
/* ========================================================================== */

export type HealthDocumentKind =
  | "LAB_REPORT"
  | "PRESCRIPTION"
  | "DISCHARGE_SUMMARY"
  | "OTHER";

export const DOCUMENT_META: Record<
  HealthDocumentKind,
  { label: string; short: string; emoji: string; hint: string }
> = {
  LAB_REPORT: {
    label: "Lab report",
    short: "Lab",
    emoji: "🧪",
    hint: "Blood work, imaging, pathology — anything with results on it.",
  },
  PRESCRIPTION: {
    label: "Prescription",
    short: "℞",
    emoji: "📝",
    hint: "The doctor's prescription. Needed before we can dispense any ℞ medicine.",
  },
  DISCHARGE_SUMMARY: {
    label: "Discharge summary",
    short: "Discharge",
    emoji: "🏥",
    hint: "The hospital's summary sheet — it drives the whole recovery plan.",
  },
  OTHER: {
    label: "Other document",
    short: "Other",
    emoji: "📄",
    hint: "Anything else your care team should read.",
  },
};

export interface HealthDocument {
  id: string;
  kind: HealthDocumentKind;
  fileName: string;
  mimeType: string;
  /** data: URL for the prototype. Production stores an object-storage key. */
  fileData: string;
  note?: string;
  uploadedAt: string;
}

export type CarePlanStatus =
  | "SUBMITTED"
  | "IN_REVIEW"
  | "PLAN_READY"
  | "CHANGES_REQUESTED"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED";

export const CARE_PLAN_LABELS: Record<CarePlanStatus, string> = {
  SUBMITTED: "Documents Received",
  IN_REVIEW: "Care Team Reviewing",
  PLAN_READY: "Plan Ready — Your Approval Needed",
  CHANGES_REQUESTED: "Changes Requested",
  ACTIVE: "Plan Active",
  COMPLETED: "Plan Completed",
  CANCELLED: "Plan Cancelled",
};

/** The happy path shown as a progress tracker to the customer. */
export const CARE_PLAN_FLOW: CarePlanStatus[] = [
  "SUBMITTED",
  "IN_REVIEW",
  "PLAN_READY",
  "ACTIVE",
  "COMPLETED",
];

/**
 * Medication reconciliation outcome for one line.
 *
 * Reconciling the discharge summary against what the patient already takes is
 * the single highest-value thing a pharmacist does after a hospital stay, so
 * every medicine line carries its verdict explicitly.
 */
export type ReconciliationVerdict = "CONTINUE" | "NEW" | "DOSE_CHANGE" | "STOP";

export const RECONCILIATION_META: Record<
  ReconciliationVerdict,
  { label: string; tone: "green" | "blue" | "amber" | "red" }
> = {
  CONTINUE: { label: "Continue as before", tone: "green" },
  NEW: { label: "Newly started", tone: "blue" },
  DOSE_CHANGE: { label: "Dose changed", tone: "amber" },
  STOP: { label: "Stop taking", tone: "red" },
};

export interface CarePlanMedicine {
  id: string;
  /** Set when the care team matched the line to the catalogue. */
  medicineId?: string;
  name: string;
  strength?: string;
  /** "1-0-1 after food" */
  dosage: string;
  durationDays: number;
  /** Units to deliver each cycle. */
  qtyPerCycle: number;
  type: MedicineType;
  reconciliation: ReconciliationVerdict;
  /** Care team suggests this line goes on a repeat delivery. */
  repeat: boolean;
  intervalDays?: number;
  note?: string;
}

export interface CarePlanVisit {
  id: string;
  serviceType: ServiceType;
  reason?: string;
  assistanceTypes: string[];
  hours: number;
  /** Number of visits in the course, and the gap between them. */
  visits: number;
  everyDays: number;
  /** YYYY-MM-DD — the care team's proposed first visit. */
  firstDate: string;
  slot: string;
  note?: string;
}

export interface CarePlanFollowUp {
  id: string;
  label: string;
  /** YYYY-MM-DD */
  dueDate: string;
  note?: string;
}

export interface CarePlanEvent {
  status: CarePlanStatus;
  at: string;
  by?: string;
  note?: string;
}

export interface CarePlan {
  id: string;
  ref: string; // CP-7K3D2
  customerId: string;
  customerName: string;
  customerPhone: string;

  patientName: string;
  patientAge?: number;
  condition?: string;
  hospitalName?: string;
  /** YYYY-MM-DD — present when this plan follows a hospital stay. */
  dischargeDate?: string;
  allergies?: string;
  customerNote?: string;

  documents: HealthDocument[];

  status: CarePlanStatus;
  coordinatorId?: string;
  coordinatorName?: string;

  /** The care team's plain-language summary, shown to the customer. */
  summary?: string;
  safetyNotes?: string;

  medicines: CarePlanMedicine[];
  visits: CarePlanVisit[];
  followUps: CarePlanFollowUp[];

  /** Prescription record raised from the uploaded ℞, once verified. */
  prescriptionId?: string;
  changeRequest?: string;
  approvedAt?: string;

  /** What the approval actually created. */
  scheduled: {
    orderIds: string[];
    bookingIds: string[];
    subscriptionIds: string[];
  };

  history: CarePlanEvent[];
  createdAt: string;
  updatedAt: string;
}

/* ========================================================================== */
/* Repeat delivery (subscriptions)                                            */
/* ========================================================================== */

export type RepeatFrequency = "WEEKLY" | "FORTNIGHTLY" | "MONTHLY" | "CUSTOM";

export const REPEAT_META: Record<RepeatFrequency, { label: string; days: number }> = {
  WEEKLY: { label: "Every week", days: 7 },
  FORTNIGHTLY: { label: "Every 2 weeks", days: 14 },
  MONTHLY: { label: "Every month", days: 30 },
  CUSTOM: { label: "Custom interval", days: 0 },
};

export type SubscriptionStatus =
  | "ACTIVE"
  | "PAUSED"
  | "AWAITING_RX"
  | "CANCELLED"
  | "COMPLETED";

export const SUBSCRIPTION_LABELS: Record<SubscriptionStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  AWAITING_RX: "Needs a fresh prescription",
  CANCELLED: "Cancelled",
  COMPLETED: "Finished",
};

/** Standing saving for committing to a repeat schedule. */
export const REPEAT_DISCOUNT_PCT = 5;

export interface SubscriptionItem {
  medicineId: string;
  name: string;
  strength: string;
  form: string;
  qty: number;
  type: MedicineType;
}

export interface SubscriptionEvent {
  at: string;
  event:
    | "CREATED"
    | "ORDER_PLACED"
    | "SKIPPED"
    | "PAUSED"
    | "RESUMED"
    | "CANCELLED"
    | "RX_REQUIRED"
    | "OUT_OF_STOCK"
    | "UPDATED";
  note?: string;
  orderId?: string;
}

export interface Subscription {
  id: string;
  ref: string; // RD-8J2K4
  customerId: string;
  customerName: string;
  customerPhone: string;

  /** Chosen by the customer, exactly like a one-off order. Never auto-assigned. */
  pharmacyId: string;
  pharmacyName: string;

  address: string;
  locality: string;
  lat: number;
  lng: number;

  items: SubscriptionItem[];
  /** RX when any line needs a prescription — drives the refill gate. */
  type: MedicineType;
  prescriptionId?: string;

  frequency: RepeatFrequency;
  intervalDays: number;
  /** YYYY-MM-DD */
  startDate: string;
  nextDate: string;
  /** Customer asked to skip exactly one upcoming cycle. */
  skipNext: boolean;

  status: SubscriptionStatus;
  paymentMode: "COD" | "UPI" | "CARD";
  discountPct: number;

  deliveriesMade: number;
  lastOrderId?: string;
  lastRunAt?: string;
  /** Set when the plan that created this subscription is known. */
  carePlanId?: string;

  history: SubscriptionEvent[];
  createdAt: string;
  updatedAt: string;
}
