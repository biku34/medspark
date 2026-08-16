/**
 * The DawaQuick shelf — how non-prescription products are grouped for browsing.
 *
 * Customers pick a category first and then see the items inside it, the way a
 * quick-commerce app works. Prescription medicines are deliberately absent:
 * they keep their own gated upload → pharmacist-verification flow.
 */

export interface ShelfCategory {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  /** Tailwind classes for the tile face. */
  tone: string;
}

export const SHELF_CATEGORIES: ShelfCategory[] = [
  {
    id: "pain-relief",
    name: "Pain Relief",
    emoji: "💊",
    blurb: "Tablets, gels, sprays & patches",
    tone: "bg-rose-50 border-rose-200",
  },
  {
    id: "cold-cough-fever",
    name: "Cold, Cough & Fever",
    emoji: "🤧",
    blurb: "Syrups, drops & lozenges",
    tone: "bg-sky-50 border-sky-200",
  },
  {
    id: "digestive",
    name: "Digestive Care",
    emoji: "🌿",
    blurb: "Acidity, ORS & probiotics",
    tone: "bg-emerald-50 border-emerald-200",
  },
  {
    id: "first-aid",
    name: "First Aid & Wound Care",
    emoji: "🩹",
    blurb: "Bandages, antiseptics & gauze",
    tone: "bg-red-50 border-red-200",
  },
  {
    id: "devices",
    name: "Health Devices",
    emoji: "🩺",
    blurb: "BP, sugar, oxygen & more",
    tone: "bg-indigo-50 border-indigo-200",
  },
  {
    id: "vitamins",
    name: "Vitamins & Supplements",
    emoji: "💪",
    blurb: "Daily nutrition & immunity",
    tone: "bg-amber-50 border-amber-200",
  },
  {
    id: "feminine-care",
    name: "Feminine Care",
    emoji: "🌸",
    blurb: "Pads, liners, cups & washes",
    tone: "bg-pink-50 border-pink-200",
  },
  {
    id: "sexual-wellness",
    name: "Sexual Wellness",
    emoji: "❤️",
    blurb: "Contraception & test kits",
    tone: "bg-fuchsia-50 border-fuchsia-200",
  },
  {
    id: "baby-care",
    name: "Baby & Mother Care",
    emoji: "👶",
    blurb: "Diapers, wipes & baby essentials",
    tone: "bg-cyan-50 border-cyan-200",
  },
  {
    id: "elderly-care",
    name: "Elderly Care",
    emoji: "🧓",
    blurb: "Mobility, supports & daily care",
    tone: "bg-orange-50 border-orange-200",
  },
  {
    id: "diabetic-care",
    name: "Diabetic Care",
    emoji: "🩸",
    blurb: "Strips, syringes & sugar-free",
    tone: "bg-violet-50 border-violet-200",
  },
  {
    id: "skin-hair",
    name: "Skin & Hair Care",
    emoji: "🧴",
    blurb: "Creams, sunscreen & shampoo",
    tone: "bg-teal-50 border-teal-200",
  },
  {
    id: "oral-care",
    name: "Oral Care",
    emoji: "🦷",
    blurb: "Toothpaste, rinses & brushes",
    tone: "bg-blue-50 border-blue-200",
  },
  {
    id: "hygiene",
    name: "Personal Hygiene",
    emoji: "🧼",
    blurb: "Sanitiser, masks & wipes",
    tone: "bg-lime-50 border-lime-200",
  },
  {
    id: "ayurveda",
    name: "Ayurveda & Immunity",
    emoji: "🌱",
    blurb: "Chyawanprash, tulsi & herbals",
    tone: "bg-green-50 border-green-200",
  },
];

export function shelfCategory(id: string): ShelfCategory | undefined {
  return SHELF_CATEGORIES.find((c) => c.id === id);
}

/** Subcategory used for prescription-only medicines, never shown on the shelf. */
export const RX_SUBCATEGORY = "prescription";
