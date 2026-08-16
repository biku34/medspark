/**
 * Demo seed data for the home-healthcare services (physiotherapy & nursing).
 *
 * Providers, patients and credentials here are FICTIONAL. Registration numbers
 * follow a plausible shape but do not correspond to any real practitioner.
 */

import type {
  ServiceBooking,
  ServiceProvider,
  ServiceSettings,
  ServiceType,
  User,
} from "./types";
import { haversineKm } from "./utils";

const iso = (d: Date) => d.toISOString();
const daysAgo = (d: number, hour = 11) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(hour, Math.floor(Math.random() * 59), 0, 0);
  return iso(t);
};
/** YYYY-MM-DD offset from today. */
export const dayKey = (offset: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

export const DEMO_PASSWORD = "demo1234";

/* -------------------------------------------------------------------------- */
/* Pricing — editable from the Admin dashboard                                */
/* -------------------------------------------------------------------------- */

export const SETTINGS_ID = "service_settings";

export function buildSettings(): ServiceSettings {
  return {
    id: SETTINGS_ID,
    physio: { rate: 500, platformFee: 49, minHours: 1, maxHours: 4 },
    nursing: { rate: 300, platformFee: 39, minHours: 2, maxHours: 12 },
    // Same-day booking is not offered: home visits need at least a day's notice.
    minAdvanceDays: 1,
    updatedAt: new Date().toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/* Provider login accounts                                                    */
/* -------------------------------------------------------------------------- */

export const PROVIDER_USERS: User[] = [
  {
    id: "usr_physio1",
    role: "provider",
    name: "Dr. Ankit Rawal (PT)",
    email: "physio@dawaquick.app",
    phone: "+91 98252 30011",
    password: DEMO_PASSWORD,
    licenseNo: "GSCPT-2016-3391",
    active: true,
    createdAt: daysAgo(240, 10),
  },
  {
    id: "usr_physio2",
    role: "provider",
    name: "Dr. Riya Bhavsar (PT)",
    email: "riya@dawaquick.app",
    phone: "+91 98252 30012",
    password: DEMO_PASSWORD,
    licenseNo: "GSCPT-2019-5522",
    active: true,
    createdAt: daysAgo(150, 12),
  },
  {
    id: "usr_physio3",
    role: "provider",
    name: "Dr. Manav Sheth (PT)",
    email: "manav@dawaquick.app",
    phone: "+91 98252 30013",
    password: DEMO_PASSWORD,
    licenseNo: "GSCPT-2021-7710",
    active: true,
    createdAt: daysAgo(60, 9),
  },
  {
    id: "usr_nurse1",
    role: "provider",
    name: "Sr. Kavita Patel (RN)",
    email: "nurse@dawaquick.app",
    phone: "+91 98252 40021",
    password: DEMO_PASSWORD,
    licenseNo: "GNC-RN-2015-8842",
    active: true,
    createdAt: daysAgo(220, 11),
  },
  {
    id: "usr_nurse2",
    role: "provider",
    name: "Sr. Alpa Chauhan (RN)",
    email: "alpa@dawaquick.app",
    phone: "+91 98252 40022",
    password: DEMO_PASSWORD,
    licenseNo: "GNC-RN-2018-2204",
    active: true,
    createdAt: daysAgo(130, 15),
  },
  {
    id: "usr_nurse3",
    role: "provider",
    name: "Sr. Firoz Shaikh (RN)",
    email: "firoz@dawaquick.app",
    phone: "+91 98252 40023",
    password: DEMO_PASSWORD,
    licenseNo: "GNC-RN-2020-6613",
    active: true,
    createdAt: daysAgo(20, 16),
  },
];

/* -------------------------------------------------------------------------- */
/* Providers                                                                  */
/* -------------------------------------------------------------------------- */

const WEEKDAYS_ALL = [1, 2, 3, 4, 5, 6];
const MORNING_EVENING = ["08:00-10:00", "10:00-12:00", "16:00-18:00", "18:00-20:00"];
const FULL_DAY = ["08:00-12:00", "12:00-16:00", "16:00-20:00", "20:00-08:00"];

export const PROVIDERS: ServiceProvider[] = [
  /* ------------------------------ Physiotherapy --------------------------- */
  {
    id: "prv_physio1",
    userId: "usr_physio1",
    type: "PHYSIO",
    name: "Dr. Ankit Rawal (PT)",
    emoji: "🧑‍⚕️",
    headline: "Post-operative & musculoskeletal rehabilitation",
    bio: "Home-visit physiotherapist working with post-surgical knee and hip patients, spine pain and sports injuries. Brings portable TENS and exercise bands to every session.",
    qualifications: ["BPT — Gujarat University", "MPT (Orthopaedics) — Ahmedabad"],
    registrationNo: "GSCPT-2016-3391",
    experienceYears: 9,
    languages: ["Gujarati", "Hindi", "English"],
    specialities: ["Post-operative rehab", "Back & neck pain", "Knee / joint pain", "Sports injury"],
    serviceAreas: ["Sector 11", "Sector 7", "Sector 21", "Pethapur"],
    city: "Gandhinagar",
    lat: 23.2265,
    lng: 72.6425,
    serviceRadiusKm: 12,
    hourlyRate: 500,
    rating: 4.8,
    ratingCount: 214,
    completedVisits: 486,
    availability: { weekdays: WEEKDAYS_ALL, slots: MORNING_EVENING },
    credentials: [
      {
        id: "cred_p1a",
        name: "BPT degree certificate",
        fileName: "bpt-degree.pdf",
        uploadedAt: daysAgo(240, 10),
        status: "VERIFIED",
      },
      {
        id: "cred_p1b",
        name: "State council registration",
        fileName: "gscpt-registration.pdf",
        uploadedAt: daysAgo(240, 10),
        status: "VERIFIED",
      },
    ],
    verified: true,
    status: "ACTIVE",
    createdAt: daysAgo(240, 10),
  },
  {
    id: "prv_physio2",
    userId: "usr_physio2",
    type: "PHYSIO",
    name: "Dr. Riya Bhavsar (PT)",
    emoji: "🧑‍⚕️",
    headline: "Neuro-rehabilitation & geriatric mobility",
    bio: "Specialises in stroke rehabilitation, Parkinson's mobility work and fall-prevention training for senior patients at home.",
    qualifications: ["BPT — Saurashtra University", "MPT (Neurology)"],
    registrationNo: "GSCPT-2019-5522",
    experienceYears: 6,
    languages: ["Gujarati", "Hindi", "English"],
    specialities: ["Stroke rehabilitation", "Mobility & balance", "Geriatric physiotherapy"],
    serviceAreas: ["Navrangpura", "Vastrapur", "Naranpura", "Paldi"],
    city: "Ahmedabad",
    lat: 23.0371,
    lng: 72.5605,
    serviceRadiusKm: 10,
    hourlyRate: 550,
    rating: 4.9,
    ratingCount: 168,
    completedVisits: 302,
    availability: { weekdays: [1, 2, 3, 4, 5], slots: MORNING_EVENING },
    credentials: [
      {
        id: "cred_p2a",
        name: "MPT (Neurology) certificate",
        fileName: "mpt-neuro.pdf",
        uploadedAt: daysAgo(150, 12),
        status: "VERIFIED",
      },
    ],
    verified: true,
    status: "ACTIVE",
    createdAt: daysAgo(150, 12),
  },
  {
    id: "prv_physio3",
    userId: "usr_physio3",
    type: "PHYSIO",
    name: "Dr. Manav Sheth (PT)",
    emoji: "🧑‍⚕️",
    headline: "Sports injury & post-fracture recovery",
    bio: "Works with recreational athletes and post-fracture patients on strength, gait and return-to-activity programmes.",
    qualifications: ["BPT — Gujarat University"],
    registrationNo: "GSCPT-2021-7710",
    experienceYears: 4,
    languages: ["Gujarati", "Hindi"],
    specialities: ["Sports injury", "Post-fracture physiotherapy", "Knee / joint pain"],
    serviceAreas: ["Kudasan", "Infocity (Sector 24)", "Sargasan", "Randesan"],
    city: "Gandhinagar",
    lat: 23.184,
    lng: 72.6349,
    serviceRadiusKm: 12,
    hourlyRate: 450,
    rating: 4.6,
    ratingCount: 61,
    completedVisits: 118,
    availability: { weekdays: WEEKDAYS_ALL, slots: ["10:00-12:00", "16:00-18:00", "18:00-20:00"] },
    credentials: [
      {
        id: "cred_p3a",
        name: "BPT degree certificate",
        fileName: "bpt-degree.pdf",
        uploadedAt: daysAgo(60, 9),
        status: "VERIFIED",
      },
    ],
    verified: true,
    status: "ACTIVE",
    createdAt: daysAgo(60, 9),
  },

  /* -------------------------------- Nursing ------------------------------- */
  {
    id: "prv_nurse1",
    userId: "usr_nurse1",
    type: "NURSING",
    name: "Sr. Kavita Patel (RN)",
    emoji: "👩‍⚕️",
    headline: "Post-hospitalisation & elderly home care",
    bio: "Registered nurse with ICU and ward experience. Supports discharged patients at home with wound care, vitals monitoring and medication schedules set by the treating doctor.",
    qualifications: ["GNM — Gujarat Nursing Council", "BSc Nursing"],
    registrationNo: "GNC-RN-2015-8842",
    experienceYears: 10,
    languages: ["Gujarati", "Hindi", "English"],
    specialities: [
      "Post-hospitalisation support",
      "Wound-care assistance",
      "Vital-sign monitoring",
      "Elderly care assistance",
    ],
    serviceAreas: ["Sector 11", "Sector 7", "Sector 21", "Kudasan"],
    city: "Gandhinagar",
    lat: 23.2258,
    lng: 72.6411,
    serviceRadiusKm: 12,
    hourlyRate: 300,
    rating: 4.9,
    ratingCount: 331,
    completedVisits: 742,
    availability: { weekdays: [0, 1, 2, 3, 4, 5, 6], slots: FULL_DAY },
    credentials: [
      {
        id: "cred_n1a",
        name: "BSc Nursing certificate",
        fileName: "bsc-nursing.pdf",
        uploadedAt: daysAgo(220, 11),
        status: "VERIFIED",
      },
      {
        id: "cred_n1b",
        name: "Nursing council registration",
        fileName: "gnc-registration.pdf",
        uploadedAt: daysAgo(220, 11),
        status: "VERIFIED",
      },
    ],
    verified: true,
    status: "ACTIVE",
    createdAt: daysAgo(220, 11),
  },
  {
    id: "prv_nurse2",
    userId: "usr_nurse2",
    type: "NURSING",
    name: "Sr. Alpa Chauhan (RN)",
    emoji: "👩‍⚕️",
    headline: "Elderly care & daily nursing assistance",
    bio: "Provides day-shift assistance for senior patients — mobility support, hygiene assistance, vitals charting and companionship during recovery.",
    qualifications: ["GNM — Gujarat Nursing Council"],
    registrationNo: "GNC-RN-2018-2204",
    experienceYears: 7,
    languages: ["Gujarati", "Hindi"],
    specialities: ["Elderly care assistance", "Basic patient support", "Medication assistance"],
    serviceAreas: ["Navrangpura", "Paldi", "Maninagar", "Naranpura"],
    city: "Ahmedabad",
    lat: 23.0362,
    lng: 72.5628,
    serviceRadiusKm: 12,
    hourlyRate: 300,
    rating: 4.7,
    ratingCount: 189,
    completedVisits: 410,
    availability: { weekdays: WEEKDAYS_ALL, slots: FULL_DAY },
    credentials: [
      {
        id: "cred_n2a",
        name: "GNM certificate",
        fileName: "gnm-certificate.pdf",
        uploadedAt: daysAgo(130, 15),
        status: "VERIFIED",
      },
    ],
    verified: true,
    status: "ACTIVE",
    createdAt: daysAgo(130, 15),
  },
  {
    id: "prv_nurse3",
    userId: "usr_nurse3",
    type: "NURSING",
    name: "Sr. Firoz Shaikh (RN)",
    emoji: "👨‍⚕️",
    headline: "Night-shift nursing & post-operative support",
    bio: "Night-duty registered nurse supporting post-operative patients at home with monitoring and prescribed care routines.",
    qualifications: ["GNM — Gujarat Nursing Council", "Critical care certification"],
    registrationNo: "GNC-RN-2020-6613",
    experienceYears: 5,
    languages: ["Gujarati", "Hindi", "English"],
    specialities: ["Post-hospitalisation support", "Vital-sign monitoring", "Basic nursing assistance"],
    serviceAreas: ["Vastrapur", "Satellite", "Bodakdev", "Prahlad Nagar"],
    city: "Ahmedabad",
    lat: 23.0349,
    lng: 72.5295,
    serviceRadiusKm: 12,
    hourlyRate: 350,
    rating: 0,
    ratingCount: 0,
    completedVisits: 0,
    availability: { weekdays: WEEKDAYS_ALL, slots: ["20:00-08:00", "16:00-20:00"] },
    credentials: [
      {
        id: "cred_n3a",
        name: "GNM certificate",
        fileName: "gnm-certificate.pdf",
        uploadedAt: daysAgo(20, 16),
        status: "PENDING",
      },
    ],
    // Awaiting credential verification — cannot receive bookings yet.
    verified: false,
    status: "PENDING",
    createdAt: daysAgo(20, 16),
  },
];

/* -------------------------------------------------------------------------- */
/* Bookings                                                                   */
/* -------------------------------------------------------------------------- */

interface BookingSeed {
  id: string;
  code: string;
  type: ServiceType;
  customerId: string;
  customerName: string;
  customerPhone: string;
  patientName: string;
  address: string;
  locality: string;
  city: string;
  lat: number;
  lng: number;
  providerId?: string;
  dayOffset: number;
  slot: string;
  hours: number;
  reason?: string;
  assistanceTypes?: string[];
  status: ServiceBooking["status"];
  rating?: number;
}

const AARAV = {
  customerId: "usr_aarav",
  customerName: "Aarav Mehta",
  customerPhone: "+91 98980 12345",
  address: "B-402, Shreenath Residency, Sector 11, Gandhinagar",
  locality: "Sector 11",
  city: "Gandhinagar",
  lat: 23.227,
  lng: 72.642,
};

const PRIYA = {
  customerId: "usr_priya",
  customerName: "Priya Nambiar",
  customerPhone: "+91 98980 54321",
  address: "Flat 9, Sapphire Apartments, Navrangpura, Ahmedabad",
  locality: "Navrangpura",
  city: "Ahmedabad",
  lat: 23.038,
  lng: 72.56,
};

const SEEDS: BookingSeed[] = [
  // Upcoming, fully confirmed — lands on the customer's bookings screen.
  {
    ...AARAV,
    id: "bkg_1",
    code: "BK-7QW2M",
    type: "PHYSIO",
    patientName: "Rameshbhai Mehta (father)",
    providerId: "prv_physio1",
    dayOffset: 1,
    slot: "10:00-12:00",
    hours: 2,
    reason: "Post-operative rehabilitation",
    status: "CONFIRMED",
  },
  // Fresh request awaiting a provider — drives the provider dashboard demo.
  {
    ...AARAV,
    id: "bkg_2",
    code: "BK-3KD8P",
    type: "NURSING",
    patientName: "Rameshbhai Mehta (father)",
    dayOffset: 2,
    slot: "08:00-12:00",
    hours: 4,
    assistanceTypes: ["Post-hospitalisation support", "Vital-sign monitoring"],
    status: "REQUESTED",
  },
  // Assigned but not yet confirmed.
  {
    ...PRIYA,
    id: "bkg_3",
    code: "BK-9LM4T",
    type: "NURSING",
    patientName: "Lakshmi Nambiar (mother)",
    providerId: "prv_nurse2",
    dayOffset: 3,
    slot: "12:00-16:00",
    hours: 4,
    assistanceTypes: ["Elderly care assistance", "Medication assistance"],
    status: "ASSIGNED",
  },
  // History for analytics.
  {
    ...AARAV,
    id: "bkg_4",
    code: "BK-2XN7R",
    type: "PHYSIO",
    patientName: "Aarav Mehta",
    providerId: "prv_physio1",
    dayOffset: -4,
    slot: "18:00-20:00",
    hours: 2,
    reason: "Back or neck pain",
    status: "COMPLETED",
    rating: 5,
  },
  {
    ...AARAV,
    id: "bkg_5",
    code: "BK-6BV3H",
    type: "PHYSIO",
    patientName: "Aarav Mehta",
    providerId: "prv_physio1",
    dayOffset: -11,
    slot: "18:00-20:00",
    hours: 1,
    reason: "Back or neck pain",
    status: "COMPLETED",
    rating: 5,
  },
  {
    ...PRIYA,
    id: "bkg_6",
    code: "BK-5TG9C",
    type: "NURSING",
    patientName: "Lakshmi Nambiar (mother)",
    providerId: "prv_nurse2",
    dayOffset: -6,
    slot: "08:00-12:00",
    hours: 4,
    assistanceTypes: ["Elderly care assistance", "Basic patient support"],
    status: "COMPLETED",
    rating: 4,
  },
  {
    ...PRIYA,
    id: "bkg_7",
    code: "BK-8HJ2W",
    type: "PHYSIO",
    patientName: "Lakshmi Nambiar (mother)",
    providerId: "prv_physio2",
    dayOffset: -9,
    slot: "10:00-12:00",
    hours: 2,
    reason: "Mobility & balance training",
    status: "COMPLETED",
    rating: 5,
  },
  {
    ...AARAV,
    id: "bkg_8",
    code: "BK-4RS6D",
    type: "NURSING",
    patientName: "Rameshbhai Mehta (father)",
    providerId: "prv_nurse1",
    dayOffset: -13,
    slot: "12:00-16:00",
    hours: 4,
    assistanceTypes: ["Wound-care assistance", "Vital-sign monitoring"],
    status: "COMPLETED",
    rating: 5,
  },
  {
    ...PRIYA,
    id: "bkg_9",
    code: "BK-1ZP5K",
    type: "PHYSIO",
    patientName: "Priya Nambiar",
    providerId: "prv_physio2",
    dayOffset: -2,
    slot: "16:00-18:00",
    hours: 1,
    reason: "Knee / joint pain",
    status: "CANCELLED",
  },
];

export function buildBookings(settings: ServiceSettings): ServiceBooking[] {
  return SEEDS.map((s) => {
    const cfg = s.type === "PHYSIO" ? settings.physio : settings.nursing;
    const provider = PROVIDERS.find((p) => p.id === s.providerId);
    const rate = provider?.hourlyRate ?? cfg.rate;
    const serviceCharge = rate * s.hours;
    const createdAt =
      s.dayOffset >= 0 ? daysAgo(1, 10) : daysAgo(Math.abs(s.dayOffset) + 1, 10);

    const flowUpTo = (statuses: ServiceBooking["status"][]) =>
      statuses.map((status, i) => ({
        status,
        at: iso(new Date(new Date(createdAt).getTime() + i * 45 * 60_000)),
      }));

    const historyByStatus: Record<string, ServiceBooking["status"][]> = {
      REQUESTED: ["REQUESTED"],
      ASSIGNED: ["REQUESTED", "ASSIGNED"],
      CONFIRMED: ["REQUESTED", "ASSIGNED", "CONFIRMED"],
      IN_VISIT: ["REQUESTED", "ASSIGNED", "CONFIRMED", "IN_VISIT"],
      COMPLETED:
        s.type === "PHYSIO"
          ? ["REQUESTED", "ASSIGNED", "CONFIRMED", "COMPLETED"]
          : ["REQUESTED", "ASSIGNED", "CONFIRMED", "IN_VISIT", "COMPLETED"],
      CANCELLED: ["REQUESTED", "CANCELLED"],
      REJECTED: ["REQUESTED", "REJECTED"],
    };

    return {
      id: s.id,
      code: s.code,
      serviceType: s.type,
      customerId: s.customerId,
      customerName: s.customerName,
      customerPhone: s.customerPhone,
      patientName: s.patientName,
      address: s.address,
      locality: s.locality,
      city: s.city,
      lat: s.lat,
      lng: s.lng,
      date: dayKey(s.dayOffset),
      slot: s.slot,
      hours: s.hours,
      providerId: s.providerId,
      providerName: provider?.name,
      reason: s.reason,
      assistanceTypes: s.assistanceTypes ?? [],
      rate,
      serviceCharge,
      platformFee: cfg.platformFee,
      total: serviceCharge + cfg.platformFee,
      paymentMode: "UPI",
      paymentStatus: s.status === "COMPLETED" ? "PAID" : "PENDING",
      status: s.status,
      history: flowUpTo(historyByStatus[s.status]),
      rating: s.rating,
      createdAt,
    } satisfies ServiceBooking;
  });
}

/** Distance between a provider's base and the patient's address. */
export function providerDistanceKm(
  provider: Pick<ServiceProvider, "lat" | "lng">,
  point: { lat: number; lng: number },
): number {
  return Math.round(haversineKm({ lat: provider.lat, lng: provider.lng }, point) * 1.25 * 10) / 10;
}
