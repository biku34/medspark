/**
 * Recognising when someone is searching for a home visit, not a medicine.
 *
 * Typing "physiotherapy" into a pharmacy search box used to return nothing at
 * all, which is the clearest possible way to tell a customer that half the
 * platform does not exist. The catalogue has no row for a nurse, so the match
 * has to happen here.
 *
 * Client-safe: no store access, so the search screen can use it directly.
 */

import { SERVICE_META, type ServiceType } from "./types";

interface ServiceTerms {
  type: ServiceType;
  slug: string;
  /** Words a customer actually types, including the obvious misspellings. */
  terms: string[];
}

const SERVICE_TERMS: ServiceTerms[] = [
  {
    type: "PHYSIO",
    slug: "physiotherapy",
    terms: [
      "physio",
      "physiotherapy",
      "physiotherapist",
      "physical therapy",
      "physyo",
      "fizio",
      "rehab",
      "rehabilitation",
      "knee pain exercise",
      "back pain exercise",
      "stroke recovery",
      "post operative",
      "post-op",
      "mobility",
      "exercise therapy",
    ],
  },
  {
    type: "NURSING",
    slug: "nursing",
    terms: [
      "nurse",
      "nursing",
      "nurse at home",
      "home nurse",
      "attendant",
      "caretaker",
      "care taker",
      "elderly care",
      "old age care",
      "wound care",
      "dressing",
      "injection at home",
      "patient care",
      "bedridden",
      "post hospitalisation",
      "post hospitalization",
    ],
  },
];

/** Terms that mean "somebody should come to the house", without naming which. */
const GENERIC_TERMS = [
  "home visit",
  "home care",
  "at home",
  "visit at home",
  "home service",
  "doorstep care",
];

export interface ServiceHit {
  type: ServiceType;
  slug: string;
  label: string;
  short: string;
}

const hitFor = (s: ServiceTerms): ServiceHit => ({
  type: s.type,
  slug: s.slug,
  label: SERVICE_META[s.type].label,
  short: SERVICE_META[s.type].short,
});

/**
 * Which home-visit services a query is asking about.
 *
 * Matches loosely on purpose — someone typing "nurse for father" wants the
 * nursing service, and a pharmacy search box is the wrong place to be strict.
 */
export function matchServices(query: string): ServiceHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 3) return [];

  const hits = SERVICE_TERMS.filter((s) =>
    s.terms.some((t) => q.includes(t) || t.includes(q)),
  ).map(hitFor);

  if (hits.length) return hits;

  // "home visit" on its own is ambiguous, so offer both rather than guessing.
  if (GENERIC_TERMS.some((t) => q.includes(t) || t.includes(q))) {
    return SERVICE_TERMS.map(hitFor);
  }

  return [];
}
