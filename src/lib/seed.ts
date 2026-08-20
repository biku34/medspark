/**
 * Demo seed data for DawaQuick.
 *
 * Brand names, manufacturers, pharmacies and people here are FICTIONAL and
 * exist only to make the prototype demonstrable. No affiliation with any real
 * pharmaceutical company or pharmacy is claimed or implied.
 */

import type {
  InventoryItem,
  Medicine,
  Notification,
  Order,
  Pharmacy,
  Prescription,
  SearchLog,
  User,
} from "./types";
import { etaWindow, pharmacyDistanceKm } from "./utils";
import { mockPrescriptionImage } from "./sample-prescription";
import { LEGACY_SUBCATEGORY, buildShelfCatalogue } from "./catalogue-shelf";
import { RX_SUBCATEGORY } from "./shelf";
import {
  PROVIDERS,
  PROVIDER_USERS,
  buildBookings,
  buildSettings,
} from "./seed-home-care";

export { mockPrescriptionImage };

import { buildCarePlans, buildCarePrescriptions, buildSubscriptions } from "./seed-care";
import { CUSTOMER_HOMES } from "./seed-people";

const now = () => new Date();
const iso = (d: Date) => d.toISOString();
const minutesAgo = (m: number) => iso(new Date(Date.now() - m * 60_000));
const daysAgo = (d: number, hour = 11) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(hour, Math.floor(Math.random() * 59), 0, 0);
  return iso(t);
};

/* -------------------------------------------------------------------------- */
/* Medicines                                                                  */
/* -------------------------------------------------------------------------- */

const CORE_MEDICINES: Omit<Medicine, "subcategory">[] = [
  {
    id: "med_para650",
    name: "Paracetamol 650 mg",
    genericName: "Paracetamol (Acetaminophen)",
    strength: "650 mg",
    form: "Tablet",
    brand: "Febrinil 650",
    manufacturer: "Auralife Pharma",
    type: "OTC",
    category: "otc",
    mrp: 32,
    packLabel: "strip of 15 tablets",
    description: "Fever and pain relief. Commonly used for headache, body ache and fever.",
    usage: "1 tablet every 6 hours as needed. Do not exceed 4 tablets in 24 hours.",
    emoji: "💊",
  },
  {
    id: "med_para500",
    name: "Paracetamol 500 mg",
    genericName: "Paracetamol (Acetaminophen)",
    strength: "500 mg",
    form: "Tablet",
    brand: "Febrinil 500",
    manufacturer: "Auralife Pharma",
    type: "OTC",
    category: "otc",
    mrp: 24,
    packLabel: "strip of 15 tablets",
    description: "Mild fever and pain relief for adults and older children.",
    usage: "1 tablet every 6 hours as needed.",
    emoji: "💊",
  },
  {
    id: "med_paraSyrup",
    name: "Paracetamol Syrup 250 mg/5 ml",
    genericName: "Paracetamol",
    strength: "250 mg/5 ml",
    form: "Syrup",
    brand: "Febrinil Kids",
    manufacturer: "Auralife Pharma",
    type: "OTC",
    category: "otc",
    mrp: 78,
    packLabel: "60 ml bottle",
    description: "Paediatric fever and pain relief suspension.",
    usage: "Dose by body weight. Use the measuring cup provided.",
    emoji: "🧴",
  },
  {
    id: "med_cetirizine",
    name: "Cetirizine 10 mg",
    genericName: "Cetirizine Hydrochloride",
    strength: "10 mg",
    form: "Tablet",
    brand: "Histaclear 10",
    manufacturer: "Nordwin Labs",
    type: "OTC",
    category: "otc",
    mrp: 28,
    packLabel: "strip of 10 tablets",
    description: "Antihistamine for allergy, runny nose, sneezing and itching.",
    usage: "1 tablet at night. May cause drowsiness.",
    emoji: "💊",
  },
  {
    id: "med_ors",
    name: "ORS Electrolyte Sachet",
    genericName: "Oral Rehydration Salts",
    strength: "21.8 g",
    form: "Powder",
    brand: "Rehydra ORS",
    manufacturer: "Vitalis Healthcare",
    type: "OTC",
    category: "otc",
    mrp: 22,
    packLabel: "pack of 4 sachets",
    description: "Rehydration for dehydration caused by diarrhoea, vomiting or heat.",
    usage: "Dissolve one sachet in 1 litre of clean water.",
    emoji: "🥤",
  },
  {
    id: "med_antacid",
    name: "Antacid Suspension",
    genericName: "Magaldrate + Simethicone",
    strength: "400 mg + 20 mg / 5 ml",
    form: "Suspension",
    brand: "Acidsoothe",
    manufacturer: "Vitalis Healthcare",
    type: "OTC",
    category: "otc",
    mrp: 145,
    packLabel: "170 ml bottle",
    description: "Relief from acidity, heartburn and gas.",
    usage: "2 teaspoons after meals or as needed.",
    emoji: "🧴",
  },
  {
    id: "med_ibuprofen",
    name: "Ibuprofen 400 mg",
    genericName: "Ibuprofen",
    strength: "400 mg",
    form: "Tablet",
    brand: "Ibucalm 400",
    manufacturer: "Nordwin Labs",
    type: "OTC",
    category: "otc",
    mrp: 42,
    packLabel: "strip of 15 tablets",
    description: "Anti-inflammatory pain relief for muscle pain, sprains and cramps.",
    usage: "1 tablet after food, up to 3 times a day.",
    emoji: "💊",
  },
  {
    id: "med_diclogel",
    name: "Diclofenac Pain Relief Gel",
    genericName: "Diclofenac Diethylamine 1.16%",
    strength: "1.16% w/w",
    form: "Gel",
    brand: "Flexirelief Gel",
    manufacturer: "Auralife Pharma",
    type: "OTC",
    category: "otc",
    mrp: 132,
    packLabel: "30 g tube",
    description: "Topical relief for joint, back and muscle pain.",
    usage: "Apply a thin layer to the affected area 3–4 times daily.",
    emoji: "🧴",
  },
  {
    id: "med_povidone",
    name: "Povidone Iodine Ointment 5%",
    genericName: "Povidone Iodine",
    strength: "5% w/w",
    form: "Ointment",
    brand: "Betaguard",
    manufacturer: "Vitalis Healthcare",
    type: "OTC",
    category: "otc",
    mrp: 96,
    packLabel: "20 g tube",
    description: "Antiseptic for minor cuts, wounds and burns.",
    usage: "Clean the wound and apply a thin layer once or twice a day.",
    emoji: "🩹",
  },
  {
    id: "med_cough",
    name: "Cough Syrup (Dry Cough)",
    genericName: "Dextromethorphan Hydrobromide",
    strength: "10 mg/5 ml",
    form: "Syrup",
    brand: "Coughlin DX",
    manufacturer: "Nordwin Labs",
    type: "OTC",
    category: "otc",
    mrp: 118,
    packLabel: "100 ml bottle",
    description: "Relief from dry, irritating cough.",
    usage: "2 teaspoons three times a day. Not for children under 6.",
    emoji: "🧴",
  },
  {
    id: "med_bandage",
    name: "Adhesive Bandage Assorted",
    genericName: "Sterile Adhesive Dressing",
    strength: "—",
    form: "Dressing",
    brand: "MediWrap",
    manufacturer: "CareKit Devices",
    type: "OTC",
    category: "otc",
    mrp: 55,
    packLabel: "pack of 20",
    description: "Waterproof adhesive bandages for minor cuts and abrasions.",
    usage: "Clean and dry the area before applying.",
    emoji: "🩹",
  },
  {
    id: "med_vitc",
    name: "Vitamin C 500 mg Chewable",
    genericName: "Ascorbic Acid",
    strength: "500 mg",
    form: "Chewable Tablet",
    brand: "Immunova C",
    manufacturer: "Vitalis Healthcare",
    type: "OTC",
    category: "wellness",
    mrp: 165,
    packLabel: "bottle of 30",
    description: "Daily immunity and antioxidant support.",
    usage: "1 chewable tablet a day after a meal.",
    emoji: "🍊",
  },
  {
    id: "med_multivit",
    name: "Daily Multivitamin",
    genericName: "Multivitamin + Multimineral",
    strength: "—",
    form: "Tablet",
    brand: "Vitalis Daily",
    manufacturer: "Vitalis Healthcare",
    type: "OTC",
    category: "wellness",
    mrp: 285,
    packLabel: "bottle of 60",
    description: "Everyday vitamin and mineral supplement for adults.",
    usage: "1 tablet a day with breakfast.",
    emoji: "🌿",
  },
  {
    id: "med_calcium",
    name: "Calcium + Vitamin D3",
    genericName: "Calcium Carbonate + Cholecalciferol",
    strength: "500 mg + 250 IU",
    form: "Tablet",
    brand: "Osteova",
    manufacturer: "Nordwin Labs",
    type: "OTC",
    category: "wellness",
    mrp: 178,
    packLabel: "strip of 15 tablets",
    description: "Bone health support for adults and seniors.",
    usage: "1 tablet a day after a meal.",
    emoji: "🦴",
  },
  {
    id: "med_protein",
    name: "Whey Protein Powder (Chocolate)",
    genericName: "Whey Protein Concentrate",
    strength: "24 g protein/scoop",
    form: "Powder",
    brand: "NutriPeak",
    manufacturer: "Vitalis Nutrition",
    type: "OTC",
    category: "wellness",
    mrp: 1499,
    packLabel: "1 kg jar",
    description: "Protein supplement for fitness and recovery.",
    usage: "1 scoop in 250 ml water or milk, once daily.",
    emoji: "🥛",
  },
  {
    id: "med_thermometer",
    name: "Digital Thermometer",
    genericName: "Clinical Thermometer",
    strength: "—",
    form: "Device",
    brand: "CareKit Thermo",
    manufacturer: "CareKit Devices",
    type: "OTC",
    category: "wellness",
    mrp: 249,
    packLabel: "1 unit",
    description: "Fast, accurate digital temperature reading with fever alarm.",
    usage: "Place under the tongue until the beep sounds.",
    emoji: "🌡️",
  },
  {
    id: "med_oximeter",
    name: "Fingertip Pulse Oximeter",
    genericName: "SpO2 Monitor",
    strength: "—",
    form: "Device",
    brand: "CareKit Oxy",
    manufacturer: "CareKit Devices",
    type: "OTC",
    category: "wellness",
    mrp: 1290,
    packLabel: "1 unit",
    description: "Measures blood oxygen saturation and pulse rate.",
    usage: "Clip on the index finger and hold still for 10 seconds.",
    emoji: "🫁",
  },
  {
    id: "med_bpmonitor",
    name: "Digital BP Monitor",
    genericName: "Automatic Blood Pressure Monitor",
    strength: "—",
    form: "Device",
    brand: "CareKit BP",
    manufacturer: "CareKit Devices",
    type: "OTC",
    category: "wellness",
    mrp: 2150,
    packLabel: "1 unit",
    description: "Upper-arm automatic blood pressure monitor with memory.",
    usage: "Sit still for 5 minutes before measuring.",
    emoji: "❤️",
  },
  {
    id: "med_sanitizer",
    name: "Hand Sanitizer 70% Alcohol",
    genericName: "Ethyl Alcohol",
    strength: "70% v/v",
    form: "Gel",
    brand: "PureHands",
    manufacturer: "Vitalis Healthcare",
    type: "OTC",
    category: "wellness",
    mrp: 89,
    packLabel: "200 ml bottle",
    description: "Kills 99.9% of germs without water.",
    usage: "Rub into hands until dry.",
    emoji: "🧼",
  },
  {
    id: "med_mask",
    name: "N95 Respirator Mask",
    genericName: "Particulate Respirator",
    strength: "—",
    form: "Mask",
    brand: "AirShield N95",
    manufacturer: "CareKit Devices",
    type: "OTC",
    category: "wellness",
    mrp: 120,
    packLabel: "pack of 3",
    description: "Five-layer respirator with nose clip.",
    usage: "Single-use. Replace when damp or damaged.",
    emoji: "😷",
  },

  /* ------------------------------ Prescription ---------------------------- */
  {
    id: "med_amoxicillin",
    name: "Amoxicillin 500 mg",
    genericName: "Amoxicillin Trihydrate",
    strength: "500 mg",
    form: "Capsule",
    brand: "Amoxinol 500",
    manufacturer: "Nordwin Labs",
    type: "RX",
    category: "prescription",
    mrp: 96,
    packLabel: "strip of 10 capsules",
    description: "Broad-spectrum antibiotic for bacterial infections.",
    usage: "As directed by the prescriber. Complete the full course.",
    emoji: "💊",
  },
  {
    id: "med_azithromycin",
    name: "Azithromycin 500 mg",
    genericName: "Azithromycin",
    strength: "500 mg",
    form: "Tablet",
    brand: "Azinorm 500",
    manufacturer: "Auralife Pharma",
    type: "RX",
    category: "prescription",
    mrp: 132,
    packLabel: "strip of 3 tablets",
    description: "Macrolide antibiotic for respiratory and skin infections.",
    usage: "One tablet daily for 3 days, or as prescribed.",
    emoji: "💊",
  },
  {
    id: "med_metformin",
    name: "Metformin 500 mg",
    genericName: "Metformin Hydrochloride",
    strength: "500 mg",
    form: "Tablet",
    brand: "Glucomet 500",
    manufacturer: "Nordwin Labs",
    type: "RX",
    category: "prescription",
    mrp: 48,
    packLabel: "strip of 20 tablets",
    description: "Oral anti-diabetic for type 2 diabetes.",
    usage: "As prescribed, usually after meals.",
    emoji: "💊",
  },
  {
    id: "med_amlodipine",
    name: "Amlodipine 5 mg",
    genericName: "Amlodipine Besylate",
    strength: "5 mg",
    form: "Tablet",
    brand: "Amlopress 5",
    manufacturer: "Auralife Pharma",
    type: "RX",
    category: "prescription",
    mrp: 62,
    packLabel: "strip of 15 tablets",
    description: "Calcium channel blocker for high blood pressure.",
    usage: "One tablet daily, or as prescribed.",
    emoji: "💊",
  },
  {
    id: "med_atorvastatin",
    name: "Atorvastatin 10 mg",
    genericName: "Atorvastatin Calcium",
    strength: "10 mg",
    form: "Tablet",
    brand: "Lipinorm 10",
    manufacturer: "Nordwin Labs",
    type: "RX",
    category: "prescription",
    mrp: 88,
    packLabel: "strip of 15 tablets",
    description: "Statin used to lower cholesterol.",
    usage: "One tablet at night, or as prescribed.",
    emoji: "💊",
  },
  {
    id: "med_telmisartan",
    name: "Telmisartan 40 mg",
    genericName: "Telmisartan",
    strength: "40 mg",
    form: "Tablet",
    brand: "Telmicare 40",
    manufacturer: "Auralife Pharma",
    type: "RX",
    category: "prescription",
    mrp: 105,
    packLabel: "strip of 15 tablets",
    description: "Angiotensin receptor blocker for hypertension.",
    usage: "One tablet daily, or as prescribed.",
    emoji: "💊",
  },
  {
    id: "med_levothyroxine",
    name: "Levothyroxine 50 mcg",
    genericName: "Levothyroxine Sodium",
    strength: "50 mcg",
    form: "Tablet",
    brand: "Thyronorm-L 50",
    manufacturer: "Vitalis Healthcare",
    type: "RX",
    category: "prescription",
    mrp: 158,
    packLabel: "bottle of 100 tablets",
    description: "Thyroid hormone replacement for hypothyroidism.",
    usage: "One tablet on an empty stomach in the morning.",
    emoji: "💊",
  },
  {
    id: "med_pantoprazole",
    name: "Pantoprazole 40 mg",
    genericName: "Pantoprazole Sodium",
    strength: "40 mg",
    form: "Tablet",
    brand: "Pantogard 40",
    manufacturer: "Nordwin Labs",
    type: "RX",
    category: "prescription",
    mrp: 118,
    packLabel: "strip of 15 tablets",
    description: "Proton pump inhibitor for acid reflux and ulcers.",
    usage: "One tablet before breakfast, or as prescribed.",
    emoji: "💊",
  },
  {
    id: "med_montelukast",
    name: "Montelukast 10 mg",
    genericName: "Montelukast Sodium",
    strength: "10 mg",
    form: "Tablet",
    brand: "Montair-X 10",
    manufacturer: "Auralife Pharma",
    type: "RX",
    category: "prescription",
    mrp: 172,
    packLabel: "strip of 10 tablets",
    description: "Leukotriene antagonist for asthma and allergic rhinitis.",
    usage: "One tablet at night, or as prescribed.",
    emoji: "💊",
  },
  {
    id: "med_salbutamol",
    name: "Salbutamol Inhaler 100 mcg",
    genericName: "Salbutamol Sulphate",
    strength: "100 mcg/dose",
    form: "Inhaler",
    brand: "Asthalin-R",
    manufacturer: "Vitalis Healthcare",
    type: "RX",
    category: "prescription",
    mrp: 235,
    packLabel: "200 metered doses",
    description: "Fast-acting reliever inhaler for asthma and breathlessness.",
    usage: "2 puffs when needed, or as prescribed.",
    emoji: "🌬️",
  },
  {
    id: "med_sertraline",
    name: "Sertraline 50 mg",
    genericName: "Sertraline Hydrochloride",
    strength: "50 mg",
    form: "Tablet",
    brand: "Serenova 50",
    manufacturer: "Nordwin Labs",
    type: "RX",
    category: "prescription",
    mrp: 186,
    packLabel: "strip of 10 tablets",
    description: "SSRI used for depression and anxiety disorders.",
    usage: "Strictly as prescribed. Do not stop abruptly.",
    emoji: "💊",
  },
  {
    id: "med_insulin",
    name: "Insulin Glargine 100 IU/ml",
    genericName: "Insulin Glargine",
    strength: "100 IU/ml",
    form: "Cartridge",
    brand: "Glarine-100",
    manufacturer: "Vitalis Biologics",
    type: "RX",
    category: "prescription",
    mrp: 845,
    packLabel: "3 ml cartridge",
    description: "Long-acting basal insulin. Requires cold-chain handling.",
    usage: "Once daily subcutaneous injection as prescribed.",
    emoji: "❄️",
    requiresColdChain: true,
  },
  {
    id: "med_alprazolam",
    name: "Alprazolam 0.5 mg",
    genericName: "Alprazolam",
    strength: "0.5 mg",
    form: "Tablet",
    brand: "Alzolam 0.5",
    manufacturer: "Nordwin Labs",
    type: "RX",
    category: "prescription",
    mrp: 74,
    packLabel: "strip of 15 tablets",
    description:
      "Habit-forming anxiolytic. Classified as a restricted/scheduled drug.",
    usage: "Dispensed only against a valid original prescription with additional checks.",
    emoji: "⛔",
    restricted: true,
  },
];

/**
 * Full catalogue = the hand-written core (including every prescription
 * medicine) plus the browsable shelf. Shelf placement for the core items comes
 * from LEGACY_SUBCATEGORY; anything prescription-only is parked under the
 * RX subcategory so it never appears in shelf browsing.
 */
export const MEDICINES: Medicine[] = [
  ...CORE_MEDICINES.map((m) => ({
    ...m,
    subcategory:
      m.type === "RX" ? RX_SUBCATEGORY : (LEGACY_SUBCATEGORY[m.id] ?? "hygiene"),
  })),
  ...buildShelfCatalogue(),
];

/* -------------------------------------------------------------------------- */
/* Pharmacies                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Ten pharmacies across the Gandhinagar–Ahmedabad corridor.
 *
 * Because distances are real, the Gandhinagar cluster (5) and the Ahmedabad
 * cluster (4) serve different customers — the two cities are ~22 km apart, well
 * outside the 10 km delivery radius. That is the point: this is a network of
 * genuinely local pharmacies, not one warehouse pretending to be nearby.
 */
export const PHARMACIES: Pharmacy[] = [
  /* ------------------------------ Gandhinagar ----------------------------- */
  {
    id: "ph_sanjeevani",
    name: "Sanjeevani Pharmacy",
    ownerName: "Meeraben Joshi",
    phone: "+91 98250 77889",
    licenseNo: "GJ-GN-20B-7734",
    address: "Shop 3, Sector 11 Shopping Centre, near Central Vista",
    locality: "Sector 11",
    city: "Gandhinagar",
    lat: 23.2262,
    lng: 72.6438,
    rating: 4.8,
    ratingCount: 2043,
    deliveryFee: 15,
    prepMinutes: 18,
    openTime: "07:00",
    closeTime: "23:30",
    status: "ACTIVE",
    verified: true,
    createdAt: daysAgo(300, 15),
  },
  {
    id: "ph_healthfirst",
    name: "HealthFirst Pharmacy",
    ownerName: "Rameshbhai Patel",
    phone: "+91 98250 11223",
    licenseNo: "GJ-GN-20B-4471",
    address: "12, Sector 7 Market, opp. Community Hall",
    locality: "Sector 7",
    city: "Gandhinagar",
    lat: 23.2331,
    lng: 72.6472,
    rating: 4.7,
    ratingCount: 1284,
    deliveryFee: 19,
    prepMinutes: 8,
    openTime: "08:00",
    closeTime: "23:00",
    status: "ACTIVE",
    verified: true,
    createdAt: daysAgo(220, 10),
  },
  {
    id: "ph_lifeline",
    name: "LifeLine Medical Store",
    ownerName: "Arjun Thakkar",
    phone: "+91 98250 55667",
    licenseNo: "GJ-GN-20B-6612",
    address: "7, Sector 21 Commercial Complex",
    locality: "Sector 21",
    city: "Gandhinagar",
    lat: 23.2085,
    lng: 72.6312,
    rating: 4.3,
    ratingCount: 431,
    deliveryFee: 29,
    prepMinutes: 15,
    openTime: "09:30",
    closeTime: "21:30",
    status: "ACTIVE",
    verified: true,
    createdAt: daysAgo(150, 9),
  },
  {
    id: "ph_meditrust",
    name: "MediTrust 24×7",
    ownerName: "Faisal Vohra",
    phone: "+91 98250 99001",
    licenseNo: "GJ-GN-20B-8845",
    address: "101, Infocity Road, near Gujarat International Finance Tec-City",
    locality: "Infocity (Sector 24)",
    city: "Gandhinagar",
    lat: 23.1889,
    lng: 72.6294,
    rating: 4.6,
    ratingCount: 3110,
    deliveryFee: 35,
    prepMinutes: 6,
    openTime: "00:00",
    closeTime: "23:59",
    status: "ACTIVE",
    verified: true,
    createdAt: daysAgo(90, 16),
  },
  {
    id: "ph_arogyam",
    name: "Aarogyam Medical Store",
    ownerName: "Nileshbhai Prajapati",
    phone: "+91 99250 44556",
    licenseNo: "GJ-GN-20B-9120",
    address: "24, Kudasan Cross Road, near Swaminarayan Temple",
    locality: "Kudasan",
    city: "Gandhinagar",
    lat: 23.1836,
    lng: 72.6357,
    rating: 4.5,
    ratingCount: 917,
    deliveryFee: 25,
    prepMinutes: 12,
    openTime: "08:30",
    closeTime: "22:30",
    status: "ACTIVE",
    verified: true,
    createdAt: daysAgo(130, 11),
  },

  /* ------------------------------- Ahmedabad ------------------------------ */
  {
    id: "ph_careplus",
    name: "CarePlus Chemists",
    ownerName: "Sunitaben Shah",
    phone: "+91 98250 33445",
    licenseNo: "GJ-AH-20B-5590",
    address: "44, Chimanlal Girdharlal Road, near Navrangpura Bus Stand",
    locality: "Navrangpura",
    city: "Ahmedabad",
    lat: 23.0374,
    lng: 72.5612,
    rating: 4.5,
    ratingCount: 862,
    deliveryFee: 25,
    prepMinutes: 12,
    openTime: "09:00",
    closeTime: "22:00",
    status: "ACTIVE",
    verified: true,
    createdAt: daysAgo(180, 12),
  },
  {
    id: "ph_shreeji",
    name: "Shreeji Medical Store",
    ownerName: "Bhavesh Trivedi",
    phone: "+91 98250 66332",
    licenseNo: "GJ-AH-20B-6178",
    address: "9, Vastrapur Lake Road, near Mansi Circle",
    locality: "Vastrapur",
    city: "Ahmedabad",
    lat: 23.0356,
    lng: 72.5301,
    rating: 4.6,
    ratingCount: 1533,
    deliveryFee: 22,
    prepMinutes: 10,
    openTime: "08:00",
    closeTime: "23:00",
    status: "ACTIVE",
    verified: true,
    createdAt: daysAgo(200, 13),
  },
  {
    id: "ph_apnacare",
    name: "ApnaCare Pharmacy",
    ownerName: "Hetal Chokshi",
    phone: "+91 99250 88117",
    licenseNo: "GJ-AH-20B-7043",
    address: "302, Satellite Road, opp. Jodhpur Cross Road",
    locality: "Satellite",
    city: "Ahmedabad",
    lat: 23.0288,
    lng: 72.5149,
    rating: 4.4,
    ratingCount: 640,
    deliveryFee: 28,
    prepMinutes: 14,
    openTime: "09:00",
    closeTime: "22:30",
    status: "ACTIVE",
    verified: true,
    createdAt: daysAgo(110, 14),
  },
  {
    id: "ph_riddhi",
    name: "Riddhi Chemists",
    ownerName: "Jignesh Modi",
    phone: "+91 94260 21004",
    licenseNo: "GJ-AH-20B-8266",
    address: "5, Maninagar Station Road, near Krishnabaug Cross Road",
    locality: "Maninagar",
    city: "Ahmedabad",
    lat: 22.9989,
    lng: 72.6041,
    rating: 4.2,
    ratingCount: 388,
    deliveryFee: 30,
    prepMinutes: 16,
    openTime: "09:00",
    closeTime: "21:30",
    status: "ACTIVE",
    verified: true,
    createdAt: daysAgo(75, 10),
  },

  /* -------------------- awaiting licence verification --------------------- */
  {
    id: "ph_nirog",
    name: "Nirog Chemists",
    ownerName: "Kavita Modi",
    phone: "+91 98250 22110",
    licenseNo: "GJ-AH-20B-9901",
    address: "22, New Chandkheda Road, near Visat Circle",
    locality: "Chandkheda",
    city: "Ahmedabad",
    lat: 23.1128,
    lng: 72.5871,
    rating: 0,
    ratingCount: 0,
    deliveryFee: 25,
    prepMinutes: 14,
    openTime: "09:00",
    closeTime: "21:00",
    status: "PENDING",
    verified: false,
    createdAt: daysAgo(3, 14),
  },
];

/* -------------------------------------------------------------------------- */
/* Users — demo credentials                                                   */
/* -------------------------------------------------------------------------- */

export const DEMO_PASSWORD = "demo1234";

/** Where each demo customer lives — drives order distances and ETAs. */
export { CUSTOMER_HOMES };

export const USERS: User[] = [
  {
    id: "usr_aarav",
    role: "customer",
    name: "Aarav Mehta",
    email: "customer@dawaquick.app",
    phone: "+91 98980 12345",
    password: DEMO_PASSWORD,
    address: CUSTOMER_HOMES.usr_aarav.address,
    locality: "Sector 11",
    savedLocations: [
      {
        id: "loc_home",
        label: "Home",
        locality: "Sector 11, Gandhinagar",
        address: "B-402, Shreenath Residency, Sector 11, Gandhinagar",
        lat: 23.227,
        lng: 72.642,
      },
      {
        id: "loc_hostel",
        label: "Hostel",
        locality: "Infocity, Gandhinagar",
        address: "Room 214, Block C, Boys Hostel, Infocity Road, Gandhinagar",
        lat: 23.188,
        lng: 72.629,
      },
      {
        id: "loc_parents",
        label: "Parents (senior care)",
        locality: "Maninagar, Ahmedabad",
        address: "18, Rambaug Society, Maninagar, Ahmedabad",
        lat: 22.9967,
        lng: 72.6014,
      },
    ],
    active: true,
    createdAt: daysAgo(210, 10),
  },
  {
    id: "usr_priya",
    role: "customer",
    name: "Priya Nambiar",
    email: "priya@dawaquick.app",
    phone: "+91 98980 54321",
    password: DEMO_PASSWORD,
    address: CUSTOMER_HOMES.usr_priya.address,
    locality: "Navrangpura",
    savedLocations: [
      {
        id: "loc_p_home",
        label: "Home",
        locality: "Navrangpura, Ahmedabad",
        address: "Flat 9, Sapphire Apartments, Navrangpura, Ahmedabad",
        lat: 23.038,
        lng: 72.56,
      },
      {
        id: "loc_p_mother",
        label: "Mother's home",
        locality: "Maninagar, Ahmedabad",
        address: "7, Krishnabaug Society, Maninagar, Ahmedabad",
        lat: 22.9967,
        lng: 72.6014,
      },
    ],
    active: true,
    createdAt: daysAgo(60, 18),
  },
  {
    id: "usr_rohan",
    role: "customer",
    name: "Rohan Desai",
    email: "rohan@dawaquick.app",
    phone: "+91 99790 40182",
    password: DEMO_PASSWORD,
    address: CUSTOMER_HOMES.usr_rohan.address,
    locality: "Sector 11",
    savedLocations: [],
    active: true,
    createdAt: daysAgo(40, 17),
  },
  {
    id: "usr_pharmacist",
    role: "pharmacist",
    name: "Dr. Neha Shah",
    email: "pharmacist@dawaquick.app",
    phone: "+91 98250 60001",
    password: DEMO_PASSWORD,
    licenseNo: "GSPC-2019-88412",
    pharmacyId: "ph_healthfirst",
    active: true,
    createdAt: daysAgo(200, 11),
  },
  {
    id: "usr_pharmacist2",
    role: "pharmacist",
    name: "Dr. Vikram Bhatt",
    email: "vikram@dawaquick.app",
    phone: "+91 98250 60002",
    password: DEMO_PASSWORD,
    licenseNo: "GSPC-2021-11907",
    pharmacyId: "ph_careplus",
    active: true,
    createdAt: daysAgo(120, 11),
  },
  {
    id: "usr_pharmacy",
    role: "pharmacy",
    name: "HealthFirst Pharmacy Desk",
    email: "pharmacy@dawaquick.app",
    phone: "+91 98250 11223",
    password: DEMO_PASSWORD,
    pharmacyId: "ph_healthfirst",
    active: true,
    createdAt: daysAgo(220, 10),
  },
  {
    id: "usr_pharmacy2",
    role: "pharmacy",
    name: "CarePlus Chemists Desk",
    email: "careplus@dawaquick.app",
    phone: "+91 98250 33445",
    password: DEMO_PASSWORD,
    pharmacyId: "ph_careplus",
    active: true,
    createdAt: daysAgo(180, 12),
  },
  {
    id: "usr_rider",
    role: "delivery",
    name: "Imran Qureshi",
    email: "rider@dawaquick.app",
    phone: "+91 98795 77712",
    password: DEMO_PASSWORD,
    active: true,
    createdAt: daysAgo(150, 9),
  },
  {
    id: "usr_rider2",
    role: "delivery",
    name: "Sneha Chauhan",
    email: "sneha@dawaquick.app",
    phone: "+91 98795 77713",
    password: DEMO_PASSWORD,
    active: true,
    createdAt: daysAgo(70, 9),
  },
  {
    id: "usr_admin",
    role: "admin",
    name: "DawaQuick Ops",
    email: "admin@dawaquick.app",
    phone: "+91 79 4000 1000",
    password: DEMO_PASSWORD,
    active: true,
    createdAt: daysAgo(365, 8),
  },
];

/* -------------------------------------------------------------------------- */
/* Inventory                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Stock is deliberately uneven so the demo shows real trade-offs:
 *  - Paracetamol 650 is stocked by 4 of 5 active pharmacies (LifeLine is out).
 *  - Insulin Glargine is out of stock everywhere -> "notify me" flow.
 *  - Alprazolam is stocked but restricted -> blocked at the UI layer.
 */
const STOCK_PLAN: Record<string, Record<string, number>> = {
  ph_healthfirst: {
    med_para650: 42,
    med_para500: 30,
    med_paraSyrup: 12,
    med_cetirizine: 55,
    med_ors: 40,
    med_antacid: 18,
    med_ibuprofen: 26,
    med_diclogel: 14,
    med_povidone: 9,
    med_cough: 16,
    med_bandage: 30,
    med_vitc: 22,
    med_multivit: 15,
    med_calcium: 20,
    med_thermometer: 6,
    med_oximeter: 3,
    med_sanitizer: 25,
    med_mask: 40,
    med_amoxicillin: 24,
    med_azithromycin: 18,
    med_metformin: 35,
    med_amlodipine: 28,
    med_atorvastatin: 22,
    med_telmisartan: 16,
    med_levothyroxine: 12,
    med_pantoprazole: 30,
    med_montelukast: 14,
    med_salbutamol: 8,
    med_sertraline: 6,
    med_insulin: 0,
    med_alprazolam: 5,
  },
  ph_careplus: {
    med_para650: 25,
    med_para500: 18,
    med_cetirizine: 30,
    med_ors: 22,
    med_antacid: 10,
    med_ibuprofen: 12,
    med_diclogel: 8,
    med_cough: 9,
    med_bandage: 18,
    med_vitc: 14,
    med_multivit: 9,
    med_calcium: 11,
    med_protein: 4,
    med_thermometer: 4,
    med_sanitizer: 16,
    med_mask: 25,
    med_amoxicillin: 15,
    med_azithromycin: 10,
    med_metformin: 20,
    med_amlodipine: 18,
    med_atorvastatin: 12,
    med_pantoprazole: 16,
    med_montelukast: 7,
    med_salbutamol: 5,
    med_insulin: 0,
  },
  ph_lifeline: {
    med_para650: 0,
    med_para500: 14,
    med_paraSyrup: 6,
    med_cetirizine: 18,
    med_ors: 12,
    med_ibuprofen: 8,
    med_povidone: 5,
    med_cough: 6,
    med_bandage: 10,
    med_vitc: 8,
    med_calcium: 7,
    med_thermometer: 2,
    med_mask: 14,
    med_amoxicillin: 9,
    med_metformin: 14,
    med_amlodipine: 10,
    med_atorvastatin: 8,
    med_pantoprazole: 11,
    med_levothyroxine: 5,
    med_insulin: 0,
  },
  ph_sanjeevani: {
    med_para650: 60,
    med_para500: 44,
    med_paraSyrup: 20,
    med_cetirizine: 48,
    med_ors: 52,
    med_antacid: 24,
    med_ibuprofen: 30,
    med_diclogel: 18,
    med_povidone: 14,
    med_cough: 20,
    med_bandage: 36,
    med_vitc: 30,
    med_multivit: 22,
    med_calcium: 26,
    med_protein: 8,
    med_thermometer: 9,
    med_oximeter: 5,
    med_bpmonitor: 3,
    med_sanitizer: 34,
    med_mask: 60,
    med_amoxicillin: 30,
    med_azithromycin: 22,
    med_metformin: 40,
    med_amlodipine: 32,
    med_atorvastatin: 28,
    med_telmisartan: 20,
    med_levothyroxine: 16,
    med_pantoprazole: 34,
    med_montelukast: 18,
    med_salbutamol: 11,
    med_sertraline: 9,
    med_insulin: 0,
    med_alprazolam: 4,
  },
  ph_meditrust: {
    med_para650: 33,
    med_para500: 26,
    med_paraSyrup: 10,
    med_cetirizine: 36,
    med_ors: 28,
    med_antacid: 16,
    med_ibuprofen: 20,
    med_diclogel: 12,
    med_povidone: 8,
    med_cough: 13,
    med_bandage: 22,
    med_vitc: 18,
    med_multivit: 12,
    med_calcium: 15,
    med_protein: 6,
    med_thermometer: 7,
    med_oximeter: 4,
    med_bpmonitor: 2,
    med_sanitizer: 20,
    med_mask: 45,
    med_amoxicillin: 20,
    med_azithromycin: 16,
    med_metformin: 26,
    med_amlodipine: 24,
    med_atorvastatin: 18,
    med_telmisartan: 14,
    med_levothyroxine: 10,
    med_pantoprazole: 24,
    med_montelukast: 12,
    med_salbutamol: 9,
    med_sertraline: 7,
    med_insulin: 0,
  },
  ph_arogyam: {
    med_para650: 28,
    med_para500: 20,
    med_paraSyrup: 8,
    med_cetirizine: 32,
    med_ors: 26,
    med_antacid: 14,
    med_ibuprofen: 18,
    med_diclogel: 10,
    med_povidone: 7,
    med_cough: 12,
    med_bandage: 20,
    med_vitc: 16,
    med_multivit: 10,
    med_calcium: 13,
    med_thermometer: 5,
    med_sanitizer: 18,
    med_mask: 30,
    med_amoxicillin: 17,
    med_azithromycin: 12,
    med_metformin: 24,
    med_amlodipine: 20,
    med_atorvastatin: 15,
    med_telmisartan: 11,
    med_pantoprazole: 21,
    med_montelukast: 9,
    med_salbutamol: 6,
    med_insulin: 0,
  },
  ph_shreeji: {
    med_para650: 46,
    med_para500: 34,
    med_paraSyrup: 15,
    med_cetirizine: 40,
    med_ors: 38,
    med_antacid: 20,
    med_ibuprofen: 24,
    med_diclogel: 15,
    med_povidone: 11,
    med_cough: 17,
    med_bandage: 28,
    med_vitc: 24,
    med_multivit: 17,
    med_calcium: 19,
    med_protein: 7,
    med_thermometer: 8,
    med_oximeter: 4,
    med_bpmonitor: 2,
    med_sanitizer: 26,
    med_mask: 44,
    med_amoxicillin: 26,
    med_azithromycin: 19,
    med_metformin: 33,
    med_amlodipine: 27,
    med_atorvastatin: 23,
    med_telmisartan: 17,
    med_levothyroxine: 13,
    med_pantoprazole: 28,
    med_montelukast: 15,
    med_salbutamol: 10,
    med_sertraline: 8,
    med_insulin: 0,
  },
  ph_apnacare: {
    med_para650: 22,
    med_para500: 16,
    med_paraSyrup: 7,
    med_cetirizine: 24,
    med_ors: 18,
    med_antacid: 12,
    med_ibuprofen: 14,
    med_diclogel: 9,
    med_cough: 10,
    med_bandage: 16,
    med_vitc: 12,
    med_calcium: 10,
    med_thermometer: 3,
    med_oximeter: 2,
    med_sanitizer: 14,
    med_mask: 22,
    med_amoxicillin: 13,
    med_azithromycin: 9,
    med_metformin: 18,
    med_amlodipine: 15,
    med_atorvastatin: 11,
    med_pantoprazole: 14,
    med_montelukast: 6,
    med_insulin: 0,
  },
  ph_riddhi: {
    med_para650: 0,
    med_para500: 12,
    med_cetirizine: 16,
    med_ors: 14,
    med_ibuprofen: 7,
    med_povidone: 4,
    med_cough: 5,
    med_bandage: 9,
    med_vitc: 7,
    med_calcium: 6,
    med_mask: 12,
    med_amoxicillin: 8,
    med_metformin: 12,
    med_amlodipine: 9,
    med_atorvastatin: 7,
    med_pantoprazole: 10,
    med_levothyroxine: 4,
    med_insulin: 0,
  },
  ph_nirog: {
    med_para650: 20,
    med_cetirizine: 15,
    med_ors: 10,
  },
};

/** Small per-pharmacy price variation around MRP so "lowest total" sorting matters. */
const PRICE_FACTOR: Record<string, number> = {
  ph_sanjeevani: 0.92,
  ph_healthfirst: 1.0,
  ph_lifeline: 1.04,
  ph_meditrust: 1.06,
  ph_arogyam: 0.95,
  ph_careplus: 0.96,
  ph_shreeji: 0.93,
  ph_apnacare: 1.03,
  ph_riddhi: 1.05,
  ph_nirog: 1.0,
};

/**
 * Stable hash so generated stock is identical on every reseed — a demo where
 * availability flickers between reloads is worse than useless.
 */
function stableHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Hard caps on how many pharmacies stock a given item.
 * Without these, nine pharmacies between them carry everything and the
 * "available nearby / notify me" behaviour never gets to show itself.
 */
const SCARCE: Record<string, number> = {
  "med_nebulizer-machine": 0, // out of stock everywhere -> "notify me" flow
  "med_menstrual-cup": 1,
  "med_ovulation-test-kit": 1,
  "med_cervical-contour-pillow": 1,
  "med_home-first-aid-kit": 2,
  "med_glucometer-kit": 2,
};

/** How much of the wider shelf each pharmacy carries (0–100). */
const SHELF_BREADTH: Record<string, number> = {
  ph_sanjeevani: 92,
  ph_shreeji: 90,
  ph_meditrust: 86,
  ph_healthfirst: 84,
  ph_careplus: 74,
  ph_arogyam: 72,
  ph_apnacare: 66,
  ph_lifeline: 58,
  ph_riddhi: 52,
};

export function buildInventory(): InventoryItem[] {
  const items: InventoryItem[] = [];
  const seen = new Set<string>();

  const push = (pharmacyId: string, medicineId: string, stock: number) => {
    const key = `${pharmacyId}|${medicineId}`;
    if (seen.has(key)) return;
    const med = MEDICINES.find((m) => m.id === medicineId);
    if (!med) return;
    seen.add(key);
    items.push({
      id: `inv_${pharmacyId}_${medicineId}`,
      pharmacyId,
      medicineId,
      stock,
      price: Math.round(med.mrp * (PRICE_FACTOR[pharmacyId] ?? 1)),
      updatedAt: minutesAgo(Math.floor(Math.random() * 4000)),
    });
  };

  // Hand-written plan first: it encodes the deliberate demo scenarios
  // (Paracetamol 650 out at LifeLine, insulin out everywhere, and so on).
  for (const [pharmacyId, plan] of Object.entries(STOCK_PLAN)) {
    for (const [medicineId, stock] of Object.entries(plan)) push(pharmacyId, medicineId, stock);
  }

  // Then fill the rest of the shelf so browsing a category shows real depth.
  // Nirog stays deliberately sparse — it is still awaiting verification.
  // Medicines are the outer loop so SCARCE caps can be applied per product.
  for (const med of MEDICINES) {
    if (med.type === "RX") continue; // prescription stock stays hand-tuned
    const cap = SCARCE[med.id];
    let carried = 0;
    for (const [pharmacyId, breadth] of Object.entries(SHELF_BREADTH)) {
      if (cap !== undefined && carried >= cap) break;
      const roll = stableHash(`${pharmacyId}:${med.id}`) % 100;
      if (roll >= breadth) continue; // this pharmacy simply doesn't carry it
      const qty = 3 + (stableHash(`${med.id}:${pharmacyId}`) % 38);
      push(pharmacyId, med.id, qty);
      carried++;
    }
  }

  return items;
}

/* -------------------------------------------------------------------------- */
/* Prescriptions                                                              */
/* -------------------------------------------------------------------------- */

export function buildPrescriptions(): Prescription[] {
  const today = now().toLocaleDateString("en-IN");
  return [
    {
      id: "rx_1",
      ref: "RX-8K2M1",
      customerId: "usr_aarav",
      customerName: "Aarav Mehta",
      customerPhone: "+91 98980 12345",
      patientName: "Aarav Mehta",
      doctorName: "Dr. Hiren Patel",
      fileName: "prescription-venkatesh.svg",
      mimeType: "image/svg+xml",
      fileData: mockPrescriptionImage(
        "Dr. Hiren Patel",
        "Aarav Mehta",
        [
          "Tab. Azithromycin 500 mg — 1 OD × 3 days",
          "Tab. Paracetamol 650 mg — 1 SOS (fever)",
          "Cap. Amoxicillin 500 mg — 1 TDS × 5 days",
        ],
        today,
      ),
      note: "Doctor advised starting today evening.",
      extractedMedicines: [
        {
          name: "Azithromycin 500 mg",
          strength: "500 mg",
          dosage: "1 tablet once daily × 3 days",
          qty: 1,
          medicineId: "med_azithromycin",
        },
        {
          name: "Amoxicillin 500 mg",
          strength: "500 mg",
          dosage: "1 capsule three times daily × 5 days",
          qty: 2,
          medicineId: "med_amoxicillin",
        },
      ],
      status: "PENDING",
      createdAt: minutesAgo(14),
    },
    {
      id: "rx_2",
      ref: "RX-3P9QT",
      customerId: "usr_priya",
      customerName: "Priya Nambiar",
      customerPhone: "+91 98980 54321",
      patientName: "Lakshmi Nambiar (mother)",
      doctorName: "Dr. Sneha Trivedi",
      fileName: "prescription-kulkarni.svg",
      mimeType: "image/svg+xml",
      fileData: mockPrescriptionImage(
        "Dr. Sneha Trivedi",
        "Lakshmi Nambiar",
        [
          "Tab. Telmisartan 40 mg — 1 OD × 30 days",
          "Tab. Atorvastatin 10 mg — 1 HS × 30 days",
          "Tab. Metformin 500 mg — 1 BD × 30 days",
        ],
        today,
      ),
      note: "Monthly refill for my mother — she lives in Maninagar and cannot travel to a pharmacy.",
      extractedMedicines: [
        {
          name: "Telmisartan 40 mg",
          strength: "40 mg",
          dosage: "1 tablet once daily",
          qty: 2,
          medicineId: "med_telmisartan",
        },
        {
          name: "Atorvastatin 10 mg",
          strength: "10 mg",
          dosage: "1 tablet at night",
          qty: 2,
          medicineId: "med_atorvastatin",
        },
      ],
      status: "PENDING",
      createdAt: minutesAgo(41),
    },
    {
      id: "rx_3",
      ref: "RX-7L4WZ",
      customerId: "usr_aarav",
      customerName: "Aarav Mehta",
      customerPhone: "+91 98980 12345",
      patientName: "Aarav Mehta",
      doctorName: "Dr. Hiren Patel",
      fileName: "prescription-old.svg",
      mimeType: "image/svg+xml",
      fileData: mockPrescriptionImage(
        "Dr. Hiren Patel",
        "Aarav Mehta",
        ["Tab. Pantoprazole 40 mg — 1 OD × 14 days"],
        new Date(Date.now() - 12 * 864e5).toLocaleDateString("en-IN"),
      ),
      extractedMedicines: [
        {
          name: "Pantoprazole 40 mg",
          strength: "40 mg",
          dosage: "1 tablet before breakfast",
          qty: 1,
          medicineId: "med_pantoprazole",
        },
      ],
      status: "APPROVED",
      verifiedById: "usr_pharmacist",
      verifiedByName: "Dr. Neha Sharma",
      verificationNote: "Prescription verified. Customer details confirmed over call.",
      call: {
        calledAt: daysAgo(12, 10),
        durationSec: 96,
        checklist: {
          identity: true,
          medicine: true,
          quantity: true,
          prescriptionDetails: true,
          address: true,
          orderConfirmed: true,
        },
        outcome: "VERIFIED",
      },
      orderId: "ord_hist_3",
      createdAt: daysAgo(12, 9),
      reviewedAt: daysAgo(12, 10),
    },
  ];
}

/* -------------------------------------------------------------------------- */
/* Orders                                                                     */
/* -------------------------------------------------------------------------- */

function makeOrder(partial: Partial<Order> & Pick<Order, "id" | "code">): Order {
  const pharmacy = PHARMACIES.find((p) => p.id === partial.pharmacyId) ?? PHARMACIES[0];

  // Distance is measured from the customer's real home to the real pharmacy.
  const customerId = partial.customerId ?? "usr_aarav";
  const home = CUSTOMER_HOMES[customerId] ?? CUSTOMER_HOMES.usr_aarav;
  const customer = USERS.find((u) => u.id === customerId);

  const distance = pharmacyDistanceKm(pharmacy, { lat: home.lat, lng: home.lng });
  const eta = etaWindow(distance, pharmacy.prepMinutes);
  const createdAt = partial.createdAt ?? minutesAgo(30);
  const items = partial.items ?? [];
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const status = partial.status ?? "PLACED";
  return {
    id: partial.id,
    code: partial.code,
    customerId,
    customerName: partial.customerName ?? customer?.name ?? "Aarav Mehta",
    customerPhone: partial.customerPhone ?? customer?.phone ?? "+91 98980 12345",
    address: partial.address ?? home.address,
    locality: partial.locality ?? `${home.locality}, ${home.city}`,
    pharmacyId: pharmacy.id,
    pharmacyName: pharmacy.name,
    type: partial.type ?? "OTC",
    prescriptionId: partial.prescriptionId,
    items,
    subtotal,
    deliveryFee: pharmacy.deliveryFee,
    total: subtotal + pharmacy.deliveryFee,
    paymentMode: partial.paymentMode ?? "UPI",
    paymentStatus: partial.paymentStatus ?? "PAID",
    distanceKm: distance,
    etaMinFrom: eta.from,
    etaMinTo: eta.to,
    promisedFrom: iso(new Date(new Date(createdAt).getTime() + eta.from * 60_000)),
    promisedTo: iso(new Date(new Date(createdAt).getTime() + eta.to * 60_000)),
    status,
    history: partial.history ?? [{ status: "PLACED", at: createdAt }],
    deliveryPartnerId: partial.deliveryPartnerId,
    deliveryPartnerName: partial.deliveryPartnerName,
    createdAt,
  };
}

function line(medicineId: string, qty: number, pharmacyId: string) {
  const m = MEDICINES.find((x) => x.id === medicineId)!;
  return {
    medicineId,
    name: m.name,
    strength: m.strength,
    form: m.form,
    qty,
    price: Math.round(m.mrp * (PRICE_FACTOR[pharmacyId] ?? 1)),
    type: m.type,
  };
}

export function buildOrders(): Order[] {
  const orders: Order[] = [];

  // A live order mid-delivery — lands on the tracking screen straight away.
  const activeCreated = minutesAgo(18);
  orders.push(
    makeOrder({
      id: "ord_active_1",
      code: "DQ-4TR7QK",
      pharmacyId: "ph_sanjeevani",
      type: "OTC",
      items: [line("med_cetirizine", 1, "ph_sanjeevani"), line("med_ors", 2, "ph_sanjeevani")],
      status: "OUT_FOR_DELIVERY",
      createdAt: activeCreated,
      deliveryPartnerId: "usr_rider",
      deliveryPartnerName: "Imran Qureshi",
      history: [
        { status: "PLACED", at: activeCreated },
        { status: "PREPARING", at: minutesAgo(15) },
        { status: "READY", at: minutesAgo(9) },
        { status: "OUT_FOR_DELIVERY", at: minutesAgo(6), note: "Picked up by Imran Qureshi" },
      ],
    }),
  );

  // A brand-new order waiting on the pharmacy dashboard (Accept / Reject demo).
  const newCreated = minutesAgo(3);
  orders.push(
    makeOrder({
      id: "ord_new_1",
      code: "DQ-9WD2LC",
      pharmacyId: "ph_healthfirst",
      customerId: "usr_rohan",
      type: "OTC",
      items: [line("med_para650", 2, "ph_healthfirst"), line("med_vitc", 1, "ph_healthfirst")],
      status: "PLACED",
      createdAt: newCreated,
      paymentMode: "COD",
      paymentStatus: "PENDING",
      history: [{ status: "PLACED", at: newCreated }],
    }),
  );

  /**
   * History for analytics + "reorder".
   * Gandhinagar customers order from Gandhinagar pharmacies and Ahmedabad
   * customers from Ahmedabad ones — the 22 km gap makes anything else
   * impossible, and the seed data has to respect that.
   */
  const history: Array<
    [string, string, number, string, string, "OTC" | "RX", Array<[string, number]>]
  > = [
    // --- Aarav Mehta · Sector 11, Gandhinagar ---
    ["ord_hist_1", "DQ-2K93F1", 1, "usr_aarav", "ph_healthfirst", "OTC", [["med_para650", 2], ["med_ors", 1]]],
    ["ord_hist_3", "DQ-1QA8ZP", 12, "usr_aarav", "ph_healthfirst", "RX", [["med_pantoprazole", 1]]],
    ["ord_hist_4", "DQ-5NB3RT", 3, "usr_aarav", "ph_sanjeevani", "OTC", [["med_diclogel", 1], ["med_para500", 1]]],
    ["ord_hist_5", "DQ-8CV6YU", 4, "usr_aarav", "ph_meditrust", "RX", [["med_metformin", 2]]],
    ["ord_hist_6", "DQ-3ZX9WM", 5, "usr_aarav", "ph_sanjeevani", "OTC", [["med_multivit", 1]]],
    ["ord_hist_7", "DQ-7BN2EQ", 5, "usr_aarav", "ph_sanjeevani", "OTC", [["med_mask", 2], ["med_sanitizer", 1]]],
    ["ord_hist_9", "DQ-9PL5DF", 6, "usr_aarav", "ph_healthfirst", "OTC", [["med_para650", 1]]],
    ["ord_hist_11", "DQ-6TY3JH", 0, "usr_aarav", "ph_sanjeevani", "OTC", [["med_thermometer", 1]]],
    ["ord_hist_13", "DQ-5UI9OP", 2, "usr_aarav", "ph_arogyam", "OTC", [["med_ibuprofen", 1]]],
    ["ord_hist_14", "DQ-8AS2DG", 3, "usr_aarav", "ph_healthfirst", "RX", [["med_montelukast", 1]]],

    // --- Priya Nambiar · Navrangpura, Ahmedabad ---
    ["ord_hist_2", "DQ-6HJ4XB", 2, "usr_priya", "ph_careplus", "OTC", [["med_cetirizine", 1]]],
    ["ord_hist_8", "DQ-4GH7KL", 6, "usr_priya", "ph_careplus", "RX", [["med_amlodipine", 1]]],
    ["ord_hist_10", "DQ-2MN8VC", 7, "usr_priya", "ph_shreeji", "OTC", [["med_antacid", 1]]],
    ["ord_hist_12", "DQ-1WE4RB", 1, "usr_priya", "ph_shreeji", "RX", [["med_atorvastatin", 1]]],
    ["ord_hist_15", "DQ-3FG6HJ", 4, "usr_priya", "ph_apnacare", "OTC", [["med_cough", 1]]],

    // --- Rohan Desai · Sector 11, Gandhinagar ---
    ["ord_hist_16", "DQ-4KD9NR", 2, "usr_rohan", "ph_lifeline", "OTC", [["med_cetirizine", 2]]],
    ["ord_hist_17", "DQ-7XC2VB", 5, "usr_rohan", "ph_arogyam", "OTC", [["med_vitc", 1]]],
  ];

  for (const [id, code, ago, customerId, pharmacyId, type, items] of history) {
    const createdAt = daysAgo(ago, 9 + Math.floor(Math.random() * 10));
    const created = new Date(createdAt).getTime();
    orders.push(
      makeOrder({
        id,
        code,
        pharmacyId,
        type,
        customerId,
        items: items.map(([m, q]) => line(m, q, pharmacyId)),
        status: "DELIVERED",
        createdAt,
        prescriptionId: id === "ord_hist_3" ? "rx_3" : undefined,
        deliveryPartnerId: "usr_rider",
        deliveryPartnerName: "Imran Qureshi",
        history: [
          { status: "PLACED", at: createdAt },
          { status: "PREPARING", at: iso(new Date(created + 4 * 60_000)) },
          { status: "READY", at: iso(new Date(created + 11 * 60_000)) },
          { status: "OUT_FOR_DELIVERY", at: iso(new Date(created + 15 * 60_000)) },
          {
            status: "DELIVERED",
            at: iso(new Date(created + (24 + Math.floor(Math.random() * 14)) * 60_000)),
          },
        ],
      }),
    );
  }

  // One cancelled order for the admin "Cancelled" tab.
  const cancelledAt = daysAgo(2, 20);
  orders.push(
    makeOrder({
      id: "ord_cancel_1",
      code: "DQ-7QW1ZX",
      pharmacyId: "ph_lifeline",
      type: "OTC",
      items: [line("med_para500", 1, "ph_lifeline")],
      status: "CANCELLED",
      createdAt: cancelledAt,
      paymentMode: "COD",
      paymentStatus: "PENDING",
      history: [
        { status: "PLACED", at: cancelledAt },
        { status: "CANCELLED", at: cancelledAt, note: "Cancelled by customer" },
      ],
    }),
  );

  return orders;
}

/* -------------------------------------------------------------------------- */
/* Notifications + search logs                                                */
/* -------------------------------------------------------------------------- */

export function buildNotifications(): Notification[] {
  return [
    {
      id: "ntf_1",
      userId: "usr_aarav",
      kind: "DELIVERY",
      title: "Out for delivery",
      body: "Imran is on the way with order DQ-4TR7QK.",
      href: "/orders/ord_active_1",
      read: false,
      createdAt: minutesAgo(6),
    },
    {
      id: "ntf_2",
      userId: "usr_aarav",
      kind: "PRESCRIPTION",
      title: "Prescription received",
      body: "RX-8K2M1 is queued for pharmacist verification.",
      href: "/prescriptions/rx_1",
      read: false,
      createdAt: minutesAgo(14),
    },
    {
      id: "ntf_3",
      userId: "usr_aarav",
      kind: "ORDER",
      title: "Delivered",
      body: "Order DQ-2K93F1 was delivered. Rate your pharmacy.",
      href: "/orders/ord_hist_1",
      read: true,
      createdAt: daysAgo(1, 12),
    },
  ];
}

export function buildSearchLogs(): SearchLog[] {
  const weights: Array<[string, string, number]> = [
    ["paracetamol 650", "med_para650", 38],
    ["cetirizine", "med_cetirizine", 24],
    ["ors", "med_ors", 19],
    ["pantoprazole", "med_pantoprazole", 16],
    ["azithromycin", "med_azithromycin", 14],
    ["metformin", "med_metformin", 12],
    ["vitamin c", "med_vitc", 11],
    ["insulin", "med_insulin", 9],
    ["salbutamol inhaler", "med_salbutamol", 8],
    ["thermometer", "med_thermometer", 7],
    ["amoxicillin", "med_amoxicillin", 6],
    ["pain relief gel", "med_diclogel", 5],
  ];
  const logs: SearchLog[] = [];
  let n = 0;
  for (const [term, medicineId, count] of weights) {
    for (let i = 0; i < count; i++) {
      logs.push({
        id: `sl_${n++}`,
        term,
        medicineId,
        userId: i % 2 === 0 ? "usr_aarav" : "usr_priya",
        createdAt: daysAgo(Math.floor(Math.random() * 7), 8 + (i % 12)),
      });
    }
  }
  return logs;
}

/* -------------------------------------------------------------------------- */

export function buildSeed() {
  const settings = buildSettings();
  return {
    // Provider logins live in the same users collection as every other role.
    users: [...USERS, ...PROVIDER_USERS].map((u) => ({ ...u })),
    medicines: MEDICINES.map((m) => ({ ...m })),
    pharmacies: PHARMACIES.map((p) => ({ ...p })),
    inventory: buildInventory(),
    orders: buildOrders(),
    prescriptions: [...buildPrescriptions(), ...buildCarePrescriptions()],
    notifications: buildNotifications(),
    searchLogs: buildSearchLogs(),
    stockAlerts: [],
    providers: PROVIDERS.map((p) => ({ ...p })),
    bookings: buildBookings(settings),
    settings: [settings],
    carePlans: buildCarePlans(),
    subscriptions: buildSubscriptions(),
  };
}
