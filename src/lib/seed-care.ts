/**
 * Demo data for care plans and repeat deliveries.
 *
 * The two features only read as real if you can see them mid-flight, so the
 * seed ships one plan waiting on the customer's approval, one already active,
 * one fresh request still sitting in the care team's queue, and three repeat
 * schedules — including one deliberately stopped for want of a prescription,
 * because that stop is the whole point of the design.
 */

import { mockPrescriptionImage } from "./sample-prescription";
import { mockDischargeSummary, mockLabReport } from "./sample-documents";
import { CUSTOMER_HOMES } from "./seed-people";
import type { CarePlan, HealthDocument, Prescription, Subscription } from "./types";
import { REPEAT_DISCOUNT_PCT } from "./types";

const iso = (d: Date) => d.toISOString();

const daysAgo = (d: number, hour = 11): string => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(hour, 15, 0, 0);
  return iso(t);
};

/** YYYY-MM-DD, n days from today (negative for the past). */
const dateIn = (n: number): string => {
  const t = new Date();
  t.setDate(t.getDate() + n);
  return t.toISOString().slice(0, 10);
};

const inIndia = (dateStr: string): string =>
  new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-IN");

/* -------------------------------------------------------------------------- */
/* documents                                                                  */
/* -------------------------------------------------------------------------- */

function dischargeDoc(id: string, uploadedAt: string): HealthDocument {
  return {
    id,
    kind: "DISCHARGE_SUMMARY",
    fileName: "discharge-summary.svg",
    mimeType: "image/svg+xml",
    fileData: mockDischargeSummary({
      hospital: "Civil Hospital, Gandhinagar",
      patient: "Rameshbhai Mehta",
      age: "68 Y / M",
      admitted: inIndia(dateIn(-9)),
      discharged: inIndia(dateIn(-3)),
      diagnosis: "Community-acquired pneumonia with decompensated hypertension",
      procedure: "Conservative management · IV antibiotics · chest physiotherapy",
      medicines: [
        "Tab. Amoxicillin 500 mg — 1 TDS × 5 days",
        "Tab. Telmisartan 40 mg — 1 OD (continue long term)",
        "Tab. Atorvastatin 10 mg — 1 at night (continue long term)",
        "Tab. Pantoprazole 40 mg — 1 before breakfast × 14 days",
        "Syp. Cough expectorant — 10 ml TDS × 7 days",
      ],
      advice: [
        "Chest physiotherapy at home, daily for two weeks",
        "Monitor blood pressure twice daily; record readings",
        "Nursing review of vitals for the first week",
        "Repeat chest X-ray and CBC after 14 days",
        "Review in OPD after 7 days",
      ],
    }),
    note: "Six-day admission for pneumonia.",
    uploadedAt,
  };
}

function labDoc(id: string, uploadedAt: string): HealthDocument {
  return {
    id,
    kind: "LAB_REPORT",
    fileName: "cbc-and-lipids.svg",
    mimeType: "image/svg+xml",
    fileData: mockLabReport({
      lab: "Sterling Diagnostics",
      patient: "Rameshbhai Mehta",
      age: "68 Y / M",
      collected: inIndia(dateIn(-4)),
      panel: "Complete blood count & lipid profile",
      rows: [
        { test: "Haemoglobin", result: "11.2", unit: "g/dL", range: "13.0 – 17.0", flag: "L" },
        { test: "Total leucocyte count", result: "13,400", unit: "/µL", range: "4,000 – 11,000", flag: "H" },
        { test: "Platelet count", result: "2.4", unit: "lakh/µL", range: "1.5 – 4.1" },
        { test: "Total cholesterol", result: "232", unit: "mg/dL", range: "< 200", flag: "H" },
        { test: "LDL cholesterol", result: "158", unit: "mg/dL", range: "< 100", flag: "H" },
        { test: "HDL cholesterol", result: "38", unit: "mg/dL", range: "> 40", flag: "L" },
        { test: "Serum creatinine", result: "1.0", unit: "mg/dL", range: "0.7 – 1.3" },
        { test: "Fasting glucose", result: "104", unit: "mg/dL", range: "70 – 100", flag: "H" },
      ],
    }),
    uploadedAt,
  };
}

/* -------------------------------------------------------------------------- */
/* prescriptions behind the care plans and repeats                            */
/* -------------------------------------------------------------------------- */

const VERIFIED_CALL = (at: string) => ({
  calledAt: at,
  durationSec: 128,
  checklist: {
    identity: true,
    medicine: true,
    quantity: true,
    prescriptionDetails: true,
    address: true,
    orderConfirmed: true,
  },
  outcome: "VERIFIED" as const,
});

/**
 * Three prescriptions that show the whole repeat-authorisation lifecycle:
 * one with repeats left, one entirely spent, and one attached to a care plan
 * that is still waiting for the customer to approve it.
 */
export function buildCarePrescriptions(): Prescription[] {
  return [
    {
      id: "rx_care_ready",
      ref: "RX-6D2NV",
      customerId: "usr_aarav",
      customerName: "Aarav Mehta",
      customerPhone: "+91 98980 12345",
      patientName: "Rameshbhai Mehta",
      doctorName: "Dr. Ankit Vora",
      fileName: "discharge-prescription.svg",
      mimeType: "image/svg+xml",
      fileData: mockPrescriptionImage(
        "Dr. Ankit Vora",
        "Rameshbhai Mehta",
        [
          "Cap. Amoxicillin 500 mg — 1 TDS × 5 days",
          "Tab. Telmisartan 40 mg — 1 OD (continue)",
          "Tab. Atorvastatin 10 mg — 1 HS (continue)",
          "Tab. Pantoprazole 40 mg — 1 OD × 14 days",
        ],
        inIndia(dateIn(-3)),
      ),
      note: "Submitted with a care plan request — pneumonia recovery",
      extractedMedicines: [
        {
          name: "Amoxicillin 500 mg",
          strength: "500 mg",
          dosage: "1 capsule three times daily × 5 days",
          qty: 2,
          medicineId: "med_amoxicillin",
        },
        {
          name: "Telmisartan 40 mg",
          strength: "40 mg",
          dosage: "1 tablet each morning",
          qty: 2,
          medicineId: "med_telmisartan",
        },
        {
          name: "Atorvastatin 10 mg",
          strength: "10 mg",
          dosage: "1 tablet at night",
          qty: 1,
          medicineId: "med_atorvastatin",
        },
        {
          name: "Pantoprazole 40 mg",
          strength: "40 mg",
          dosage: "1 tablet before breakfast × 14 days",
          qty: 1,
          medicineId: "med_pantoprazole",
        },
      ],
      status: "APPROVED",
      verifiedById: "usr_pharmacist",
      verifiedByName: "Dr. Neha Sharma",
      verificationNote:
        "Discharge prescription verified against the hospital summary. Sulfa allergy confirmed with the family over call.",
      call: VERIFIED_CALL(daysAgo(2, 12)),
      refillsAuthorised: 6,
      refillsUsed: 0,
      validUntil: dateIn(180),
      createdAt: daysAgo(2, 9),
      reviewedAt: daysAgo(2, 13),
    },
    {
      id: "rx_chronic",
      ref: "RX-9T5BK",
      customerId: "usr_priya",
      customerName: "Priya Nambiar",
      customerPhone: "+91 99250 44112",
      patientName: "Lakshmi Nambiar",
      doctorName: "Dr. Meera Iyer",
      fileName: "chronic-bp.svg",
      mimeType: "image/svg+xml",
      fileData: mockPrescriptionImage(
        "Dr. Meera Iyer",
        "Lakshmi Nambiar",
        [
          "Tab. Telmisartan 40 mg — 1 OD, long term",
          "Tab. Atorvastatin 10 mg — 1 HS, long term",
        ],
        inIndia(dateIn(-31)),
      ),
      extractedMedicines: [
        {
          name: "Telmisartan 40 mg",
          strength: "40 mg",
          dosage: "1 tablet each morning",
          qty: 2,
          medicineId: "med_telmisartan",
        },
        {
          name: "Atorvastatin 10 mg",
          strength: "10 mg",
          dosage: "1 tablet at night",
          qty: 1,
          medicineId: "med_atorvastatin",
        },
      ],
      status: "APPROVED",
      verifiedById: "usr_pharmacist",
      verifiedByName: "Dr. Neha Sharma",
      verificationNote: "Chronic maintenance therapy. Six months of repeats authorised.",
      call: VERIFIED_CALL(daysAgo(31, 11)),
      refillsAuthorised: 6,
      refillsUsed: 1,
      validUntil: dateIn(150),
      createdAt: daysAgo(31, 10),
      reviewedAt: daysAgo(31, 12),
    },
    {
      id: "rx_spent",
      ref: "RX-4C8HL",
      customerId: "usr_aarav",
      customerName: "Aarav Mehta",
      customerPhone: "+91 98980 12345",
      patientName: "Aarav Mehta",
      doctorName: "Dr. Hiren Patel",
      fileName: "thyroid.svg",
      mimeType: "image/svg+xml",
      fileData: mockPrescriptionImage(
        "Dr. Hiren Patel",
        "Aarav Mehta",
        ["Tab. Levothyroxine 50 mcg — 1 OD on empty stomach"],
        inIndia(dateIn(-121)),
      ),
      extractedMedicines: [
        {
          name: "Levothyroxine 50 mcg",
          strength: "50 mcg",
          dosage: "1 tablet each morning on an empty stomach",
          qty: 1,
          medicineId: "med_levothyroxine",
        },
      ],
      status: "APPROVED",
      verifiedById: "usr_pharmacist",
      verifiedByName: "Dr. Neha Sharma",
      verificationNote: "Three repeats authorised pending a repeat TSH.",
      call: VERIFIED_CALL(daysAgo(121, 10)),
      refillsAuthorised: 3,
      refillsUsed: 3,
      validUntil: dateIn(60),
      createdAt: daysAgo(121, 9),
      reviewedAt: daysAgo(121, 11),
    },
  ];
}

/* -------------------------------------------------------------------------- */
/* care plans                                                                 */
/* -------------------------------------------------------------------------- */

export function buildCarePlans(): CarePlan[] {
  /* 1 — waiting on the customer's approval ------------------------------- */
  const readySubmitted = daysAgo(2, 9);
  const readyProposed = daysAgo(1, 16);

  const ready: CarePlan = {
    id: "cp_ready",
    ref: "CP-4T9WQ",
    customerId: "usr_aarav",
    customerName: "Aarav Mehta",
    customerPhone: "+91 98980 12345",
    patientName: "Rameshbhai Mehta",
    patientAge: 68,
    condition: "Pneumonia recovery, hypertension",
    hospitalName: "Civil Hospital, Gandhinagar",
    dischargeDate: dateIn(-3),
    allergies: "Sulfa drugs",
    customerNote:
      "My father came home three days ago. He is weak and I am not sure which of his old tablets to continue.",
    documents: [dischargeDoc("doc_dis_1", readySubmitted), labDoc("doc_lab_1", readySubmitted)],
    status: "PLAN_READY",
    coordinatorId: "usr_pharmacist",
    coordinatorName: "Dr. Neha Sharma",
    summary:
      "Your father's discharge medicines have been reconciled against what he was already taking. The antibiotic finishes this course and stops. Telmisartan and Atorvastatin continue long term, so I have put those on a monthly repeat. Pantoprazole runs 14 days and then stops. His white cell count and LDL are both high, so I have set a repeat blood test in two weeks.",
    safetyNotes:
      "Sulfa allergy noted — nothing in this plan contains a sulfonamide. Blood pressure to be recorded twice daily; call us if the systolic reading stays above 160.",
    medicines: [
      {
        id: "cpm_1",
        medicineId: "med_amoxicillin",
        name: "Amoxicillin 500 mg",
        strength: "500 mg",
        dosage: "1 capsule three times a day, after food",
        durationDays: 5,
        qtyPerCycle: 2,
        type: "RX",
        reconciliation: "NEW",
        repeat: false,
        note: "Finish the full course even if he feels better.",
      },
      {
        id: "cpm_2",
        medicineId: "med_telmisartan",
        name: "Telmisartan 40 mg",
        strength: "40 mg",
        dosage: "1 tablet in the morning",
        durationDays: 30,
        qtyPerCycle: 2,
        type: "RX",
        reconciliation: "CONTINUE",
        repeat: true,
        intervalDays: 30,
        note: "Long-term blood pressure medicine — do not stop.",
      },
      {
        id: "cpm_3",
        medicineId: "med_atorvastatin",
        name: "Atorvastatin 10 mg",
        strength: "10 mg",
        dosage: "1 tablet at night",
        durationDays: 30,
        qtyPerCycle: 1,
        type: "RX",
        reconciliation: "DOSE_CHANGE",
        repeat: true,
        intervalDays: 30,
        note: "Dose raised from 5 mg on discharge because LDL is 158.",
      },
      {
        id: "cpm_4",
        medicineId: "med_pantoprazole",
        name: "Pantoprazole 40 mg",
        strength: "40 mg",
        dosage: "1 tablet before breakfast",
        durationDays: 14,
        qtyPerCycle: 1,
        type: "RX",
        reconciliation: "NEW",
        repeat: false,
        note: "Stomach cover while on the antibiotic. Stops after 14 days.",
      },
      {
        id: "cpm_5",
        name: "Ibuprofen 400 mg",
        strength: "400 mg",
        dosage: "Was taking 1 tablet twice daily for knee pain",
        durationDays: 0,
        qtyPerCycle: 0,
        type: "OTC",
        reconciliation: "STOP",
        repeat: false,
        note: "Stop this. It works against the blood pressure medicine and is hard on the kidneys at his age. Use paracetamol for the knee instead.",
      },
    ],
    visits: [
      {
        id: "cpv_1",
        serviceType: "NURSING",
        assistanceTypes: ["Post-hospitalisation support", "Vital-sign monitoring"],
        hours: 4,
        visits: 3,
        everyDays: 2,
        firstDate: dateIn(2),
        slot: "08:00-12:00",
        note: "Record blood pressure and temperature at every visit.",
      },
      {
        id: "cpv_2",
        serviceType: "PHYSIO",
        reason: "Post-operative rehabilitation",
        assistanceTypes: [],
        hours: 1,
        visits: 6,
        everyDays: 3,
        firstDate: dateIn(3),
        slot: "16:00-17:00",
        note: "Chest physiotherapy and graded walking.",
      },
    ],
    followUps: [
      { id: "cpf_1", label: "Repeat CBC and chest X-ray", dueDate: dateIn(11) },
      { id: "cpf_2", label: "Review with treating doctor", dueDate: dateIn(4) },
      {
        id: "cpf_3",
        label: "Repeat lipid profile",
        dueDate: dateIn(90),
        note: "To check the higher statin dose is working.",
      },
    ],
    prescriptionId: "rx_care_ready",
    scheduled: { orderIds: [], bookingIds: [], subscriptionIds: [] },
    history: [
      { status: "SUBMITTED", at: readySubmitted, by: "Aarav Mehta" },
      {
        status: "IN_REVIEW",
        at: daysAgo(2, 12),
        by: "Dr. Neha Sharma",
        note: "Care team started the review.",
      },
      {
        status: "PLAN_READY",
        at: readyProposed,
        by: "Dr. Neha Sharma",
        note: "Plan sent to the customer.",
      },
    ],
    createdAt: readySubmitted,
    updatedAt: readyProposed,
  };

  /* 2 — brand new, still in the care team's queue ------------------------ */
  const freshAt = daysAgo(0, 8);
  const fresh: CarePlan = {
    id: "cp_new",
    ref: "CP-8M2XD",
    customerId: "usr_priya",
    customerName: "Priya Nambiar",
    customerPhone: "+91 99250 44112",
    patientName: "Lakshmi Nambiar",
    patientAge: 71,
    condition: "Diabetes and hypertension follow-up",
    allergies: "None known",
    customerNote:
      "Her sugar readings have been high. Can someone look at the report and tell me what to do about her tablets?",
    documents: [labDoc("doc_lab_2", freshAt)],
    status: "SUBMITTED",
    medicines: [],
    visits: [],
    followUps: [],
    scheduled: { orderIds: [], bookingIds: [], subscriptionIds: [] },
    history: [{ status: "SUBMITTED", at: freshAt, by: "Priya Nambiar" }],
    createdAt: freshAt,
    updatedAt: freshAt,
  };

  /* 3 — approved and running -------------------------------------------- */
  const activeSubmitted = daysAgo(21, 10);
  const activeApproved = daysAgo(19, 17);
  const active: CarePlan = {
    id: "cp_active",
    ref: "CP-2H7KP",
    customerId: "usr_rohan",
    customerName: "Rohan Desai",
    customerPhone: "+91 97250 88190",
    patientName: "Rohan Desai",
    patientAge: 41,
    condition: "Post-operative knee rehabilitation",
    hospitalName: "Apollo Hospitals, Ahmedabad",
    dischargeDate: dateIn(-22),
    documents: [dischargeDoc("doc_dis_2", activeSubmitted)],
    status: "ACTIVE",
    coordinatorId: "usr_pharmacist",
    coordinatorName: "Dr. Neha Sharma",
    summary:
      "Knee replacement recovery. Pain relief for the first two weeks, then physiotherapy three times a week for a month. No long-term medicines needed.",
    safetyNotes: "Stop the ibuprofen if there is any stomach pain and call us.",
    medicines: [
      {
        id: "cpm_a1",
        medicineId: "med_para650",
        name: "Paracetamol 650 mg",
        strength: "650 mg",
        dosage: "1 tablet up to three times a day for pain",
        durationDays: 14,
        qtyPerCycle: 2,
        type: "OTC",
        reconciliation: "NEW",
        repeat: false,
      },
      {
        id: "cpm_a2",
        medicineId: "med_calcium",
        name: "Calcium + Vitamin D3",
        strength: "500 mg",
        dosage: "1 tablet after dinner",
        durationDays: 30,
        qtyPerCycle: 1,
        type: "OTC",
        reconciliation: "NEW",
        repeat: true,
        intervalDays: 30,
      },
    ],
    visits: [
      {
        id: "cpv_a1",
        serviceType: "PHYSIO",
        reason: "Post-operative rehabilitation",
        assistanceTypes: [],
        hours: 1,
        visits: 4,
        everyDays: 3,
        firstDate: dateIn(-16),
        slot: "10:00-11:00",
      },
    ],
    followUps: [{ id: "cpf_a1", label: "Surgical review", dueDate: dateIn(6) }],
    scheduled: {
      orderIds: [],
      bookingIds: [],
      subscriptionIds: ["sub_calcium"],
    },
    approvedAt: activeApproved,
    history: [
      { status: "SUBMITTED", at: activeSubmitted, by: "Rohan Desai" },
      { status: "IN_REVIEW", at: daysAgo(20, 11), by: "Dr. Neha Sharma" },
      { status: "PLAN_READY", at: daysAgo(20, 15), by: "Dr. Neha Sharma" },
      {
        status: "ACTIVE",
        at: activeApproved,
        by: "Rohan Desai",
        note: "Approved by the customer — scheduled 1 order, 1 repeat delivery, 4 home visit(s).",
      },
    ],
    createdAt: activeSubmitted,
    updatedAt: activeApproved,
  };

  return [ready, fresh, active];
}

/* -------------------------------------------------------------------------- */
/* repeat deliveries                                                          */
/* -------------------------------------------------------------------------- */

export function buildSubscriptions(): Subscription[] {
  const aaravHome = CUSTOMER_HOMES.usr_aarav;
  const priyaHome = CUSTOMER_HOMES.usr_priya;
  const rohanHome = CUSTOMER_HOMES.usr_rohan;

  /* 1 — a healthy OTC repeat, next delivery a few days out --------------- */
  const vitamins: Subscription = {
    id: "sub_vitamins",
    ref: "RD-6QX2A",
    customerId: "usr_aarav",
    customerName: "Aarav Mehta",
    customerPhone: "+91 98980 12345",
    pharmacyId: "ph_healthfirst",
    pharmacyName: "HealthFirst Pharmacy",
    address: aaravHome.address,
    locality: aaravHome.locality,
    lat: aaravHome.lat,
    lng: aaravHome.lng,
    items: [
      {
        medicineId: "med_multivit",
        name: "Multivitamin Daily",
        strength: "—",
        form: "Tablet",
        qty: 1,
        type: "OTC",
      },
      {
        medicineId: "med_vitc",
        name: "Vitamin C 500 mg Chewable",
        strength: "500 mg",
        form: "Chewable Tablet",
        qty: 1,
        type: "OTC",
      },
    ],
    type: "OTC",
    frequency: "MONTHLY",
    intervalDays: 30,
    startDate: dateIn(-60),
    nextDate: dateIn(4),
    skipNext: false,
    status: "ACTIVE",
    paymentMode: "UPI",
    discountPct: REPEAT_DISCOUNT_PCT,
    deliveriesMade: 2,
    history: [
      {
        at: daysAgo(60, 9),
        event: "CREATED",
        note: "Every month from HealthFirst Pharmacy.",
      },
      { at: daysAgo(60, 9), event: "ORDER_PLACED", note: "DQ-M1V2K3" },
      { at: daysAgo(30, 9), event: "ORDER_PLACED", note: "DQ-P8R4T2" },
    ],
    createdAt: daysAgo(60, 9),
    updatedAt: daysAgo(30, 9),
  };

  /* 2 — a chronic ℞ repeat with pharmacist-authorised refills left -------- */
  const bp: Subscription = {
    id: "sub_bp",
    ref: "RD-9KD3M",
    customerId: "usr_priya",
    customerName: "Priya Nambiar",
    customerPhone: "+91 99250 44112",
    pharmacyId: "ph_careplus",
    pharmacyName: "CarePlus Chemists",
    address: priyaHome.address,
    locality: priyaHome.locality,
    lat: priyaHome.lat,
    lng: priyaHome.lng,
    items: [
      {
        medicineId: "med_telmisartan",
        name: "Telmisartan 40 mg",
        strength: "40 mg",
        form: "Tablet",
        qty: 2,
        type: "RX",
      },
      {
        medicineId: "med_atorvastatin",
        name: "Atorvastatin 10 mg",
        strength: "10 mg",
        form: "Tablet",
        qty: 1,
        type: "RX",
      },
    ],
    type: "RX",
    prescriptionId: "rx_chronic",
    frequency: "MONTHLY",
    intervalDays: 30,
    startDate: dateIn(-30),
    nextDate: dateIn(2),
    skipNext: false,
    status: "ACTIVE",
    paymentMode: "COD",
    discountPct: REPEAT_DISCOUNT_PCT,
    deliveriesMade: 1,
    history: [
      {
        at: daysAgo(30, 10),
        event: "CREATED",
        note: "Every month from CarePlus Chemists. 5 repeats authorised by Dr. Neha Sharma.",
      },
      { at: daysAgo(30, 10), event: "ORDER_PLACED", note: "DQ-T7K1L9" },
    ],
    createdAt: daysAgo(30, 10),
    updatedAt: daysAgo(30, 10),
  };

  /* 3 — stopped, because the prescription ran out of repeats -------------- */
  const thyroid: Subscription = {
    id: "sub_thyroid",
    ref: "RD-5WP8N",
    customerId: "usr_aarav",
    customerName: "Aarav Mehta",
    customerPhone: "+91 98980 12345",
    pharmacyId: "ph_healthfirst",
    pharmacyName: "HealthFirst Pharmacy",
    address: aaravHome.address,
    locality: aaravHome.locality,
    lat: aaravHome.lat,
    lng: aaravHome.lng,
    items: [
      {
        medicineId: "med_levothyroxine",
        name: "Levothyroxine 50 mcg",
        strength: "50 mcg",
        form: "Tablet",
        qty: 1,
        type: "RX",
      },
    ],
    type: "RX",
    prescriptionId: "rx_spent",
    frequency: "MONTHLY",
    intervalDays: 30,
    startDate: dateIn(-120),
    nextDate: dateIn(-1),
    skipNext: false,
    status: "AWAITING_RX",
    paymentMode: "UPI",
    discountPct: REPEAT_DISCOUNT_PCT,
    deliveriesMade: 3,
    history: [
      { at: daysAgo(120, 9), event: "CREATED", note: "Every month. 3 repeats authorised." },
      { at: daysAgo(120, 9), event: "ORDER_PLACED", note: "DQ-A2C4E6" },
      { at: daysAgo(90, 9), event: "ORDER_PLACED", note: "DQ-B3D5F7" },
      { at: daysAgo(60, 9), event: "ORDER_PLACED", note: "DQ-C4E6G8" },
      {
        at: daysAgo(1, 6),
        event: "RX_REQUIRED",
        note: "All repeat dispensings authorised on this prescription have been used.",
      },
    ],
    createdAt: daysAgo(120, 9),
    updatedAt: daysAgo(1, 6),
  };

  /* 4 — started by the active care plan ---------------------------------- */
  const calcium: Subscription = {
    id: "sub_calcium",
    ref: "RD-3JT7B",
    customerId: "usr_rohan",
    customerName: "Rohan Desai",
    customerPhone: "+91 97250 88190",
    pharmacyId: "ph_sanjeevani",
    pharmacyName: "Sanjeevani Pharmacy",
    address: rohanHome.address,
    locality: rohanHome.locality,
    lat: rohanHome.lat,
    lng: rohanHome.lng,
    items: [
      {
        medicineId: "med_calcium",
        name: "Calcium + Vitamin D3",
        strength: "500 mg",
        form: "Tablet",
        qty: 1,
        type: "OTC",
      },
    ],
    type: "OTC",
    frequency: "MONTHLY",
    intervalDays: 30,
    startDate: dateIn(-19),
    nextDate: dateIn(11),
    skipNext: false,
    status: "ACTIVE",
    paymentMode: "COD",
    discountPct: REPEAT_DISCOUNT_PCT,
    deliveriesMade: 1,
    carePlanId: "cp_active",
    history: [
      {
        at: daysAgo(19, 17),
        event: "CREATED",
        note: "Started from care plan CP-2H7KP — every 30 days.",
      },
      { at: daysAgo(19, 17), event: "ORDER_PLACED", note: "DQ-R9T2W4" },
    ],
    createdAt: daysAgo(19, 17),
    updatedAt: daysAgo(19, 17),
  };

  return [vitamins, bp, thyroid, calcium];
}
