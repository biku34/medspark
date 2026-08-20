/**
 * Care plans — the document-driven side of the platform.
 *
 * A customer uploads what they already have (a discharge summary, a lab
 * report, a prescription), and a pharmacist turns it into a plan: which
 * medicines to continue, which to stop, which nurse or physiotherapy visits to
 * book, and what to re-check and when.
 *
 * Two rules shape everything in this file:
 *
 *  1. Nothing is scheduled until the customer approves the plan. The care team
 *     proposes; the customer decides. There is no "we went ahead and booked it".
 *  2. Approving a plan does not bypass any existing gate. ℞ medicines still
 *     need a verified prescription, the customer still picks the pharmacy, and
 *     home visits still honour the advance-notice rule.
 */

import type {
  CarePlan,
  CarePlanMedicine,
  CarePlanStatus,
  CarePlanVisit,
  HealthDocumentKind,
  ServiceType,
} from "./types";
import { randomCode } from "./utils";

export const carePlanRef = (): string => `CP-${randomCode(5)}`;

/** Uploads we accept. Anything bigger is refused before it reaches the store. */
export const MAX_DOCUMENT_BYTES = 8_000_000;
export const MAX_DOCUMENTS = 8;

export const DOCUMENT_KINDS: HealthDocumentKind[] = [
  "DISCHARGE_SUMMARY",
  "PRESCRIPTION",
  "LAB_REPORT",
  "OTHER",
];

/** Statuses where the plan is still with the care team. */
export const IN_CARE_TEAM_HANDS: CarePlanStatus[] = ["SUBMITTED", "IN_REVIEW", "CHANGES_REQUESTED"];

/** Statuses where the customer owes an answer. */
export const AWAITING_CUSTOMER: CarePlanStatus[] = ["PLAN_READY"];

export const CLOSED_STATUSES: CarePlanStatus[] = ["COMPLETED", "CANCELLED"];

export function isEditableByCareTeam(status: CarePlanStatus): boolean {
  return !CLOSED_STATUSES.includes(status) && status !== "ACTIVE";
}

/* -------------------------------------------------------------------------- */
/* plan validation                                                            */
/* -------------------------------------------------------------------------- */

export interface PlanProblem {
  field: string;
  message: string;
}

/**
 * A plan may only be sent to the customer when it actually says something and
 * every line is complete enough to act on. Catching this here keeps half-built
 * plans out of the customer's inbox.
 */
export function validatePlanForProposal(plan: {
  summary?: string;
  medicines: CarePlanMedicine[];
  visits: CarePlanVisit[];
  followUps: Array<{ label: string; dueDate: string }>;
}): PlanProblem[] {
  const problems: PlanProblem[] = [];

  if (!plan.summary?.trim()) {
    problems.push({ field: "summary", message: "Write a short summary for the customer." });
  }
  if (!plan.medicines.length && !plan.visits.length && !plan.followUps.length) {
    problems.push({
      field: "plan",
      message: "A plan needs at least one medicine, visit or follow-up.",
    });
  }

  plan.medicines.forEach((m, i) => {
    if (!m.name?.trim()) {
      problems.push({ field: `medicine.${i}`, message: `Medicine ${i + 1} has no name.` });
    }
    if (!m.dosage?.trim()) {
      problems.push({ field: `medicine.${i}`, message: `${m.name || `Medicine ${i + 1}`} has no dosage.` });
    }
    // A line we intend to deliver has to be matched to the catalogue, or the
    // pharmacy has nothing to pick.
    if (m.reconciliation !== "STOP" && !m.medicineId) {
      problems.push({
        field: `medicine.${i}`,
        message: `${m.name || `Medicine ${i + 1}`} is not matched to the catalogue.`,
      });
    }
  });

  plan.visits.forEach((v, i) => {
    if (!v.firstDate) {
      problems.push({ field: `visit.${i}`, message: `Visit ${i + 1} has no start date.` });
    }
    if (!v.slot) {
      problems.push({ field: `visit.${i}`, message: `Visit ${i + 1} has no time slot.` });
    }
    if (v.visits < 1) {
      problems.push({ field: `visit.${i}`, message: `Visit ${i + 1} needs at least one session.` });
    }
  });

  plan.followUps.forEach((f, i) => {
    if (!f.label?.trim() || !f.dueDate) {
      problems.push({ field: `followUp.${i}`, message: `Follow-up ${i + 1} is incomplete.` });
    }
  });

  return problems;
}

/* -------------------------------------------------------------------------- */
/* derived views                                                              */
/* -------------------------------------------------------------------------- */

/** Lines the customer will actually receive — "stop taking" is not delivered. */
export function deliverableMedicines(plan: Pick<CarePlan, "medicines">): CarePlanMedicine[] {
  return plan.medicines.filter((m) => m.reconciliation !== "STOP" && m.medicineId);
}

export function repeatMedicines(plan: Pick<CarePlan, "medicines">): CarePlanMedicine[] {
  return deliverableMedicines(plan).filter((m) => m.repeat);
}

export function needsPrescription(plan: Pick<CarePlan, "medicines">): boolean {
  return deliverableMedicines(plan).some((m) => m.type === "RX");
}

/** Every individual visit date a course expands into. */
export function visitDates(visit: Pick<CarePlanVisit, "firstDate" | "visits" | "everyDays">): string[] {
  const dates: string[] = [];
  for (let i = 0; i < Math.max(1, visit.visits); i++) {
    const d = new Date(`${visit.firstDate}T00:00:00`);
    d.setDate(d.getDate() + i * Math.max(1, visit.everyDays));
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export function totalVisitCount(plan: Pick<CarePlan, "visits">): number {
  return plan.visits.reduce((s, v) => s + Math.max(1, v.visits), 0);
}

/* -------------------------------------------------------------------------- */
/* suggestions                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Starting points the care team can accept or overwrite.
 *
 * Post-discharge practice is fairly settled — a nurse in the first days to
 * check the wound and reconcile medicines, physiotherapy once the patient is
 * stable enough to move — so the builder opens with that rather than blank.
 */
export const VISIT_TEMPLATES: Array<{
  id: string;
  label: string;
  serviceType: ServiceType;
  hours: number;
  visits: number;
  everyDays: number;
  afterDischargeDays: number;
  reason?: string;
  assistanceTypes: string[];
}> = [
  {
    id: "post-discharge-nursing",
    label: "Post-discharge nursing check",
    serviceType: "NURSING",
    hours: 4,
    visits: 3,
    everyDays: 2,
    afterDischargeDays: 1,
    assistanceTypes: ["Post-hospitalisation support", "Vital-sign monitoring"],
  },
  {
    id: "wound-care",
    label: "Wound-care course",
    serviceType: "NURSING",
    hours: 2,
    visits: 5,
    everyDays: 2,
    afterDischargeDays: 1,
    assistanceTypes: ["Wound-care assistance"],
  },
  {
    id: "post-op-physio",
    label: "Post-operative physiotherapy",
    serviceType: "PHYSIO",
    hours: 1,
    visits: 6,
    everyDays: 3,
    afterDischargeDays: 3,
    reason: "Post-operative rehabilitation",
    assistanceTypes: [],
  },
  {
    id: "mobility-physio",
    label: "Mobility & balance training",
    serviceType: "PHYSIO",
    hours: 1,
    visits: 8,
    everyDays: 3,
    afterDischargeDays: 5,
    reason: "Mobility & balance training",
    assistanceTypes: [],
  },
  {
    id: "elderly-support",
    label: "Elderly care support",
    serviceType: "NURSING",
    hours: 6,
    visits: 4,
    everyDays: 7,
    afterDischargeDays: 2,
    assistanceTypes: ["Elderly care assistance", "Medication assistance"],
  },
];

/** Follow-ups worth proposing by default; the care team edits the dates. */
export const FOLLOW_UP_TEMPLATES: Array<{ label: string; afterDays: number }> = [
  { label: "Review with treating doctor", afterDays: 7 },
  { label: "Repeat blood work", afterDays: 14 },
  { label: "Blood pressure check", afterDays: 3 },
  { label: "Repeat HbA1c", afterDays: 90 },
  { label: "Wound review", afterDays: 5 },
];

export function planProgressIndex(status: CarePlanStatus): number {
  const order: CarePlanStatus[] = ["SUBMITTED", "IN_REVIEW", "PLAN_READY", "ACTIVE", "COMPLETED"];
  const i = order.indexOf(status);
  if (i >= 0) return i;
  // CHANGES_REQUESTED sits back at review; CANCELLED has no place on the track.
  return status === "CHANGES_REQUESTED" ? 1 : 0;
}
