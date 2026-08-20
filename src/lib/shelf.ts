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
}

export const SHELF_CATEGORIES: ShelfCategory[] = [
  {
    id: "pain-relief",
    name: "Pain Relief",
    emoji: "💊",
    blurb: "Tablets, gels, sprays & patches",
  },
  {
    id: "cold-cough-fever",
    name: "Cold, Cough & Fever",
    emoji: "🤧",
    blurb: "Syrups, drops & lozenges",
  },
  {
    id: "digestive",
    name: "Digestive Care",
    emoji: "🌿",
    blurb: "Acidity, ORS & probiotics",
  },
  {
    id: "first-aid",
    name: "First Aid & Wound Care",
    emoji: "🩹",
    blurb: "Bandages, antiseptics & gauze",
  },
  {
    id: "devices",
    name: "Health Devices",
    emoji: "🩺",
    blurb: "BP, sugar, oxygen & more",
  },
  {
    id: "vitamins",
    name: "Vitamins & Supplements",
    emoji: "💪",
    blurb: "Daily nutrition & immunity",
  },
  {
    id: "feminine-care",
    name: "Feminine Care",
    emoji: "🌸",
    blurb: "Pads, liners, cups & washes",
  },
  {
    id: "sexual-wellness",
    name: "Sexual Wellness",
    emoji: "❤️",
    blurb: "Contraception & test kits",
  },
  {
    id: "baby-care",
    name: "Baby & Mother Care",
    emoji: "👶",
    blurb: "Diapers, wipes & baby essentials",
  },
  {
    id: "elderly-care",
    name: "Elderly Care",
    emoji: "🧓",
    blurb: "Mobility, supports & daily care",
  },
  {
    id: "diabetic-care",
    name: "Diabetic Care",
    emoji: "🩸",
    blurb: "Strips, syringes & sugar-free",
  },
  {
    id: "skin-hair",
    name: "Skin & Hair Care",
    emoji: "🧴",
    blurb: "Creams, sunscreen & shampoo",
  },
  {
    id: "oral-care",
    name: "Oral Care",
    emoji: "🦷",
    blurb: "Toothpaste, rinses & brushes",
  },
  {
    id: "hygiene",
    name: "Personal Hygiene",
    emoji: "🧼",
    blurb: "Sanitiser, masks & wipes",
  },
  {
    id: "ayurveda",
    name: "Ayurveda & Immunity",
    emoji: "🌱",
    blurb: "Chyawanprash, tulsi & herbals",
  },
];

export function shelfCategory(id: string): ShelfCategory | undefined {
  return SHELF_CATEGORIES.find((c) => c.id === id);
}

/** Subcategory used for prescription-only medicines, never shown on the shelf. */
export const RX_SUBCATEGORY = "prescription";
