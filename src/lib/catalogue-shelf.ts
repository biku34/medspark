/**
 * The browsable pharmacy shelf — everything a local chemist can send you that
 * does not need a prescription.
 *
 * All brand names and manufacturers are FICTIONAL. Nothing here claims
 * affiliation with, or equivalence to, any real product.
 *
 * Rows are compact tuples so the catalogue stays readable at ~90 products:
 *   [name, brand, form, strength, pack, mrp, emoji, description, usage]
 */

import type { Medicine } from "./types";

type Row = [
  name: string,
  brand: string,
  form: string,
  strength: string,
  pack: string,
  mrp: number,
  emoji: string,
  description: string,
  usage: string,
];

const MAKERS = [
  "Auralife Pharma",
  "Nordwin Labs",
  "Vitalis Healthcare",
  "CareKit Devices",
  "Bloom Personal Care",
  "PureLeaf Ayurveda",
];

/** Which top-level catalogue bucket each shelf category belongs to. */
const CATEGORY_OF: Record<string, Medicine["category"]> = {
  "pain-relief": "otc",
  "cold-cough-fever": "otc",
  digestive: "otc",
  "first-aid": "wellness",
  devices: "wellness",
  vitamins: "wellness",
  "feminine-care": "wellness",
  "sexual-wellness": "wellness",
  "baby-care": "wellness",
  "elderly-care": "wellness",
  "diabetic-care": "wellness",
  "skin-hair": "wellness",
  "oral-care": "wellness",
  hygiene: "wellness",
  ayurveda: "wellness",
};

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

const SHELF: Record<string, Row[]> = {
  /* ------------------------------ pain relief ----------------------------- */
  "pain-relief": [
    ["Pain Relief Balm", "Relaxo Balm", "Balm", "25 g", "25 g jar", 95, "🫙",
      "Menthol and camphor balm for headache, cold-related heaviness and muscle stiffness.",
      "Massage a small quantity on the affected area. Avoid contact with eyes."],
    ["Muscle Spray (Cold Spray)", "Freezo Spray", "Spray", "150 ml", "150 ml can", 285, "🧊",
      "Instant cooling spray for sprains, sports strains and sudden muscle pain.",
      "Spray from 15 cm for 5 seconds. Do not apply on broken skin."],
    ["Joint Pain Roll-On", "Flexirelief Roll-On", "Roll-on", "50 ml", "50 ml bottle", 148, "🖊️",
      "No-mess roll-on for knee, shoulder and joint pain relief.",
      "Roll over the painful joint 3–4 times a day."],
    ["Pain Relief Heat Patch", "ThermaEase Patch", "Patch", "—", "pack of 3 patches", 210, "🔥",
      "Self-heating patch giving up to 8 hours of continuous warmth for back and neck pain.",
      "Apply on clean dry skin over clothing. Do not use while sleeping."],
    ["Aspirin 75 mg", "Cardiprin 75", "Tablet", "75 mg", "strip of 14 tablets", 18, "💊",
      "Low-dose aspirin. Commonly used long term only on a doctor's advice.",
      "Take as advised by your doctor, after food."],
  ],

  /* --------------------------- cold, cough, fever ------------------------- */
  "cold-cough-fever": [
    ["Cold & Flu Tablets", "Coldwin Total", "Tablet", "500 mg + 5 mg + 2 mg", "strip of 10 tablets", 68, "💊",
      "Paracetamol with decongestant and antihistamine for blocked nose, body ache and fever.",
      "1 tablet twice a day after food. May cause drowsiness."],
    ["Menthol Throat Lozenges", "Throatinol", "Lozenge", "—", "pack of 10 lozenges", 45, "🍬",
      "Soothes sore throat, hoarseness and throat irritation.",
      "Dissolve one lozenge slowly in the mouth every 3 hours."],
    ["Nasal Decongestant Drops", "Nasoclear 0.05%", "Nasal Drops", "0.05% w/v", "10 ml bottle", 62, "💧",
      "Relieves a blocked nose from cold, sinusitis or allergy.",
      "2 drops in each nostril twice daily. Do not use for more than 5 days."],
    ["Vaporub Chest Balm", "BreatheEasy Rub", "Ointment", "—", "50 ml jar", 132, "🌬️",
      "Camphor, menthol and eucalyptus rub for blocked nose and chesty cough.",
      "Rub on chest, back and throat. For steam, add to hot water."],
    ["Herbal Cough Syrup", "Kofrelief Herbal", "Syrup", "—", "100 ml bottle", 138, "🍯",
      "Honey and tulsi based syrup for dry and productive cough. Non-drowsy.",
      "2 teaspoons three times a day."],
    ["Steam Inhaler Capsules", "VaporCap", "Capsule", "—", "pack of 10", 78, "♨️",
      "Add to hot water for medicated steam inhalation.",
      "Drop one capsule into hot water and inhale the steam."],
  ],

  /* ----------------------------- digestive care --------------------------- */
  digestive: [
    ["Antacid Chewable Tablets", "Acidsoothe Chew", "Chewable Tablet", "—", "strip of 16 tablets", 42, "💊",
      "Fast relief from heartburn, acidity and gas after meals.",
      "Chew 1–2 tablets after meals or when needed."],
    ["Digestive Enzyme Syrup", "Digezyme", "Syrup", "—", "200 ml bottle", 165, "🧴",
      "Enzyme syrup for indigestion, bloating and heaviness after meals.",
      "2 teaspoons after meals, twice a day."],
    ["Probiotic Sachets", "Flora Balance", "Sachet", "—", "pack of 10 sachets", 220, "🦠",
      "Live cultures to restore gut balance after antibiotics or loose motions.",
      "One sachet daily in water or milk, or as advised."],
    ["Isabgol Husk Laxative", "Fibrosoft Husk", "Powder", "—", "200 g pack", 245, "🥣",
      "Natural fibre husk for constipation and regular bowel movement.",
      "1–2 teaspoons in a glass of water or milk at bedtime."],
    ["ORS with Zinc Sachets", "Rehydra Zinc", "Sachet", "—", "pack of 6 sachets", 68, "🥤",
      "Rehydration salts with zinc, useful during diarrhoea especially in children.",
      "Dissolve one sachet in the stated volume of clean water."],
  ],

  /* ----------------------------- first aid -------------------------------- */
  "first-aid": [
    ["Antiseptic Liquid", "Germiclear", "Liquid", "—", "500 ml bottle", 195, "🧴",
      "Multi-purpose antiseptic for wound cleaning, bathing and surface use.",
      "Dilute as directed on the label before use."],
    ["Absorbent Cotton Roll", "MediWrap Cotton", "Cotton", "—", "100 g roll", 78, "☁️",
      "Sterile absorbent cotton for cleaning and dressing wounds.",
      "Use a fresh piece each time. Dispose after use."],
    ["Sterile Gauze Pads", "MediWrap Gauze", "Dressing", "10 × 10 cm", "pack of 10 pads", 96, "🩹",
      "Sterile gauze for covering wounds and absorbing discharge.",
      "Apply over a cleaned wound and secure with tape."],
    ["Micropore Surgical Tape", "MediWrap Tape", "Tape", "1 inch", "1 roll", 58, "📏",
      "Gentle paper tape to hold dressings in place; easy on sensitive skin.",
      "Cut to length and press over the dressing edges."],
    ["Crepe Bandage", "FlexiWrap", "Bandage", "6 cm × 4 m", "1 roll", 115, "🎽",
      "Elastic compression bandage for sprains and swelling support.",
      "Wrap firmly but not tight enough to restrict circulation."],
    ["Burn Relief Gel", "Sootheaid Gel", "Gel", "—", "30 g tube", 168, "🔥",
      "Aloe-based cooling gel for minor burns, scalds and sunburn.",
      "Apply gently on cooled, unbroken skin 2–3 times a day."],
    ["Instant Cold Pack", "ChillPack", "Cold Pack", "—", "1 unit", 130, "🧊",
      "Single-use pack that turns cold instantly for sprains and swelling.",
      "Squeeze to activate and wrap in cloth before applying."],
    ["Home First Aid Kit", "CareKit Home", "Kit", "—", "1 box (28 items)", 649, "🧰",
      "Compact kit with dressings, antiseptic, tape, scissors and gloves.",
      "Keep accessible and replace items after use."],
  ],

  /* ------------------------------- devices -------------------------------- */
  devices: [
    ["Glucometer Kit", "CareKit Gluco", "Device", "—", "1 kit + 10 strips", 1150, "🩸",
      "Blood glucose meter with lancing device and starter strips.",
      "Follow the manual. Use a fresh lancet each time."],
    ["Nebulizer Machine", "CareKit Neb", "Device", "—", "1 unit", 1890, "🌬️",
      "Compressor nebulizer for asthma and respiratory medication at home.",
      "Use only with medication prescribed by your doctor."],
    ["Digital Weighing Scale", "CareKit Weigh", "Device", "—", "1 unit", 899, "⚖️",
      "Slim glass personal weighing scale with digital display.",
      "Place on a hard flat surface for accurate readings."],
    ["Hot Water Bag", "ThermaEase Bag", "Device", "2 L", "1 unit", 299, "♨️",
      "Rubber hot water bag for period cramps, back pain and stiffness.",
      "Fill with hot — not boiling — water and wrap in cloth."],
    ["Steam Vaporizer", "BreatheEasy Steamer", "Device", "—", "1 unit", 545, "💨",
      "Facial steamer for cold, blocked nose and sinus relief.",
      "Use for 5–10 minutes. Keep out of reach of children."],
  ],

  /* ------------------------------ vitamins -------------------------------- */
  vitamins: [
    ["Vitamin D3 60000 IU", "Sunova D3", "Sachet", "60000 IU", "pack of 4 sachets", 195, "☀️",
      "Weekly vitamin D3 sachet for deficiency and bone health.",
      "One sachet a week with milk, or as advised."],
    ["Iron + Folic Acid Tablets", "Hemova IF", "Tablet", "—", "strip of 30 tablets", 128, "🩸",
      "Iron with folic acid for anaemia support and pregnancy nutrition.",
      "One tablet daily after food. May darken stools."],
    ["Omega-3 Fish Oil", "Vitalis Omega", "Softgel", "1000 mg", "bottle of 60 softgels", 645, "🐟",
      "Omega-3 fatty acids for heart, brain and joint health.",
      "1 softgel a day with a meal."],
    ["Zinc 50 mg Tablets", "Zincova 50", "Tablet", "50 mg", "strip of 10 tablets", 88, "💊",
      "Zinc supplement supporting immunity and recovery.",
      "One tablet a day after food."],
    ["Biotin Hair & Nail Tablets", "Keratiplus", "Tablet", "10000 mcg", "bottle of 30", 499, "💇",
      "Biotin supplement for hair strength and nail health.",
      "One tablet daily after a meal."],
  ],

  /* --------------------------- feminine care ------------------------------ */
  "feminine-care": [
    ["Ultra Thin Sanitary Pads (Regular)", "Bloom Ultra", "Pads", "240 mm", "pack of 8 pads", 82, "🌸",
      "Ultra-thin pads with soft cotton cover and wings for everyday flow.",
      "Change every 4–6 hours. Dispose in the wrapper provided."],
    ["Overnight Sanitary Pads XL", "Bloom Overnight", "Pads", "320 mm", "pack of 6 pads", 98, "🌙",
      "Extra-long overnight pads with wider back for leak protection while sleeping.",
      "Change every 6–8 hours."],
    ["Panty Liners", "Bloom Liners", "Liners", "—", "pack of 20 liners", 105, "🩲",
      "Breathable daily liners for light discharge and end-of-period days.",
      "Change 2–3 times a day."],
    ["Menstrual Cup", "Bloom Cup (Medium)", "Cup", "Medium", "1 cup + pouch", 549, "🥤",
      "Reusable medical-grade silicone cup lasting up to 10 years.",
      "Sterilise in boiling water before and after each cycle."],
    ["Intimate Wash", "Bloom Intimate", "Wash", "—", "200 ml bottle", 235, "🧴",
      "pH-balanced daily intimate wash with mild, non-irritating cleansers.",
      "Use externally once daily. Do not use internally."],
    ["Tampons (Regular)", "Bloom Tampons", "Tampons", "Regular", "pack of 16", 265, "🌷",
      "Regular-absorbency tampons with a smooth applicator.",
      "Change every 4–6 hours. Never exceed 8 hours."],
  ],

  /* --------------------------- sexual wellness ---------------------------- */
  "sexual-wellness": [
    ["Condoms — Ultra Thin", "Trueguard Ultra", "Condoms", "—", "pack of 10", 199, "❤️",
      "Lubricated ultra-thin latex condoms for contraception and STI risk reduction.",
      "Use a new condom each time. Check the expiry date before use."],
    ["Condoms — Dotted", "Trueguard Dotted", "Condoms", "—", "pack of 3", 79, "❤️",
      "Textured lubricated latex condoms.",
      "Use a new condom each time. Store away from heat."],
    ["Personal Lubricant Gel", "Trueguard Glide", "Gel", "—", "50 ml tube", 260, "💧",
      "Water-based lubricant, safe with latex condoms.",
      "Apply as needed. Discontinue if irritation occurs."],
    ["Pregnancy Test Kit", "Certain Check", "Test Kit", "—", "1 test card", 55, "🧪",
      "Rapid home urine test for early pregnancy detection.",
      "Use the first morning urine. Read the result within 5 minutes."],
    ["Ovulation Test Kit", "Certain Ovu", "Test Kit", "—", "pack of 5 strips", 399, "📈",
      "Home test strips that help identify the fertile window.",
      "Test daily around mid-cycle as described in the leaflet."],
    ["Emergency Contraceptive Tablet", "Nextday 1.5", "Tablet", "1.5 mg", "1 tablet", 110, "⏱️",
      "Levonorgestrel single-dose emergency contraceptive. Not for regular contraception — ask the pharmacist if you are unsure.",
      "Take as early as possible, within 72 hours. Consult a doctor if vomiting occurs within 2 hours."],
  ],

  /* ---------------------------- baby & mother ----------------------------- */
  "baby-care": [
    ["Baby Diapers (Medium)", "TinySteps Pants M", "Diapers", "7–12 kg", "pack of 46 pants", 649, "👶",
      "Pant-style diapers with up to 12-hour absorption and a soft waistband.",
      "Change promptly when soiled to prevent rashes."],
    ["Baby Wipes", "TinySteps Wipes", "Wipes", "—", "pack of 72 wipes", 199, "🧻",
      "Fragrance-free aloe wipes for gentle everyday cleaning.",
      "For external use. Keep the lid closed to retain moisture."],
    ["Gripe Water", "TinySteps Gripe", "Liquid", "—", "130 ml bottle", 105, "🍼",
      "Traditional herbal preparation for infant gas and colic discomfort.",
      "Use the enclosed measure. Follow age directions on the pack."],
    ["Baby Massage Oil", "TinySteps Oil", "Oil", "—", "200 ml bottle", 285, "🫒",
      "Light non-sticky oil for daily baby massage.",
      "Warm slightly and massage before a bath."],
    ["Baby Lotion", "TinySteps Lotion", "Lotion", "—", "200 ml bottle", 245, "🧴",
      "Daily moisturiser for delicate baby skin.",
      "Apply after a bath on slightly damp skin."],
    ["Nipple Care Cream", "TinySteps Mother", "Cream", "—", "25 g tube", 320, "🤱",
      "Lanolin cream that soothes sore, cracked nipples during breastfeeding.",
      "Apply after each feed. No need to wipe off before the next feed."],
  ],

  /* ----------------------------- elderly care ----------------------------- */
  "elderly-care": [
    ["Adult Diapers (Large)", "ComfortCare Adult L", "Diapers", "Large", "pack of 10", 595, "🧓",
      "High-absorbency adult diapers for bed-bound or incontinent patients.",
      "Change every 6–8 hours or when soiled to protect the skin."],
    ["Foldable Walking Stick", "SteadyStep", "Device", "Adjustable", "1 unit", 745, "🦯",
      "Lightweight adjustable aluminium stick with anti-slip tip.",
      "Set the height so the handle reaches your wrist crease."],
    ["Knee Support Cap", "SteadyStep Knee", "Support", "Medium", "pair", 429, "🦵",
      "Elastic knee cap giving compression and warmth for weak or painful knees.",
      "Wear during activity. Remove if it feels too tight."],
    ["Weekly Pill Organizer", "DoseMate 7", "Organiser", "7-day", "1 unit", 199, "💊",
      "Seven-day box with morning and evening compartments.",
      "Refill weekly. Keep out of reach of children."],
    ["Lumbar Back Support Belt", "SteadyStep Lumbar", "Support", "Medium", "1 unit", 899, "🪢",
      "Contoured belt supporting the lower back during sitting or standing.",
      "Wear over a thin layer of clothing, not directly on skin, all day if advised."],
    ["Cervical Contour Pillow", "SteadyStep Pillow", "Pillow", "—", "1 unit", 749, "🛏️",
      "Shaped pillow supporting the neck for cervical spondylosis comfort.",
      "Use while sleeping on your back or side."],
  ],

  /* ---------------------------- diabetic care ----------------------------- */
  "diabetic-care": [
    ["Glucometer Test Strips", "CareKit Gluco Strips", "Strips", "—", "box of 50 strips", 899, "🩸",
      "Replacement test strips compatible with the CareKit Gluco meter.",
      "Check the expiry and code before use. Store the vial closed."],
    ["Insulin Syringes", "SafeJect 1 ml", "Syringes", "1 ml / 100 IU", "pack of 10", 145, "💉",
      "Single-use insulin syringes with fine needles.",
      "Use once and dispose in a sharps container."],
    ["Sugar-Free Sweetener Tablets", "SucraLite", "Tablet", "—", "bottle of 300 tablets", 199, "🍬",
      "Zero-calorie sweetener for tea, coffee and cooking.",
      "One tablet replaces roughly one teaspoon of sugar."],
    ["Diabetic Foot Cream", "SoftSole Diabetic", "Cream", "—", "50 g tube", 340, "🦶",
      "Intensive urea-based cream for dry, cracked diabetic feet.",
      "Massage into feet daily, avoiding the area between the toes."],
    ["Diabetic Socks", "SoftSole Socks", "Socks", "Free size", "pair", 399, "🧦",
      "Seam-free non-binding socks that protect sensitive feet.",
      "Wear daily. Inspect feet each day for injuries."],
  ],

  /* ----------------------------- skin & hair ------------------------------ */
  "skin-hair": [
    ["Moisturising Lotion", "DermaSoft Daily", "Lotion", "—", "250 ml bottle", 295, "🧴",
      "Everyday non-greasy moisturiser for dry and normal skin.",
      "Apply twice daily, especially after bathing."],
    ["Sunscreen SPF 50 PA+++", "DermaSoft Shield", "Cream", "SPF 50", "50 g tube", 425, "🌞",
      "Broad-spectrum sunscreen, light and non-sticky.",
      "Apply 20 minutes before sun exposure. Reapply every 3 hours."],
    ["Anti-Dandruff Shampoo", "ScalpCare AD", "Shampoo", "—", "150 ml bottle", 345, "🧴",
      "Ketoconazole-free anti-dandruff shampoo for itchy, flaky scalp.",
      "Massage into wet scalp, leave 3 minutes and rinse. Twice a week."],
    ["Antifungal Cream", "Fungicure 1%", "Cream", "1% w/w", "15 g tube", 118, "🍄",
      "Clotrimazole cream for ringworm, athlete's foot and fungal itching.",
      "Apply thinly twice daily and continue 2 weeks after it clears."],
    ["Calamine Lotion", "SootheCalm", "Lotion", "—", "100 ml bottle", 132, "🌸",
      "Classic calamine for prickly heat, rashes and insect bites.",
      "Shake well and dab on the affected area with cotton."],
    ["Medicated Lip Balm SPF 15", "DermaSoft Lip", "Balm", "SPF 15", "4.5 g stick", 175, "💄",
      "Protects and heals chapped lips with sun protection.",
      "Apply as often as needed."],
  ],

  /* ------------------------------ oral care ------------------------------- */
  "oral-care": [
    ["Sensitive Teeth Toothpaste", "DentaCare Sensitive", "Toothpaste", "—", "100 g tube", 215, "🦷",
      "Daily toothpaste that reduces sensitivity to cold and hot foods.",
      "Brush twice daily. Use for at least 4 weeks for full effect."],
    ["Antiseptic Mouthwash", "DentaCare Rinse", "Mouthwash", "—", "250 ml bottle", 185, "🫧",
      "Alcohol-free mouthwash for gum health and fresh breath.",
      "Rinse 10 ml for 30 seconds twice daily. Do not swallow."],
    ["Soft Bristle Toothbrush", "DentaCare Soft", "Toothbrush", "Soft", "pack of 2", 99, "🪥",
      "Soft rounded bristles that are gentle on gums and enamel.",
      "Replace every 3 months or when bristles splay."],
    ["Dental Floss", "DentaCare Floss", "Floss", "50 m", "1 dispenser", 165, "🧵",
      "Waxed mint floss for cleaning between teeth.",
      "Floss once daily, ideally before brushing at night."],
    ["Mouth Ulcer Gel", "OraSoothe Gel", "Gel", "—", "10 g tube", 128, "😖",
      "Numbing gel that relieves pain from mouth ulcers and sore gums.",
      "Dab on the ulcer up to 3 times a day."],
  ],

  /* ------------------------------ hygiene --------------------------------- */
  hygiene: [
    ["Antibacterial Wet Wipes", "PureHands Wipes", "Wipes", "—", "pack of 40 wipes", 129, "🧻",
      "Alcohol-based wipes for hands and surfaces on the go.",
      "Single use. Do not flush."],
    ["Liquid Handwash Refill", "PureHands Refill", "Handwash", "—", "750 ml pouch", 189, "🧼",
      "Germ-protection handwash refill pouch.",
      "Refill the pump bottle. Wash for at least 20 seconds."],
    ["Surface Disinfectant Spray", "PureHands Surface", "Spray", "—", "500 ml bottle", 249, "🧴",
      "Disinfectant spray for door handles, tables and bathroom surfaces.",
      "Spray and leave for 60 seconds. Wipe if needed."],
    ["3-Ply Surgical Masks", "AirShield 3-Ply", "Mask", "—", "pack of 50", 199, "😷",
      "Disposable three-layer masks with a nose clip and ear loops.",
      "Single use. Replace when damp."],
    ["Pocket Tissue Pack", "PureHands Tissue", "Tissue", "—", "pack of 6", 89, "🤧",
      "Soft two-ply pocket tissues.",
      "For everyday personal use."],
  ],

  /* ---------------------------- ayurveda ---------------------------------- */
  ayurveda: [
    ["Chyawanprash", "PureLeaf Chyawan", "Paste", "—", "500 g jar", 385, "🍯",
      "Traditional herbal jam with amla for daily immunity support.",
      "1–2 teaspoons daily, preferably with warm milk."],
    ["Tulsi Drops", "PureLeaf Tulsi", "Drops", "—", "30 ml bottle", 225, "🌿",
      "Concentrated five-tulsi extract for immunity and throat comfort.",
      "2–3 drops in water, tea or honey twice daily."],
    ["Ashwagandha Tablets", "PureLeaf Ashwa", "Tablet", "500 mg", "bottle of 60 tablets", 449, "🌱",
      "Ashwagandha root extract traditionally used for stress and stamina.",
      "1 tablet twice daily after meals, or as directed."],
    ["Herbal Immunity Tea", "PureLeaf Kadha", "Tea", "—", "100 g pack", 265, "🍵",
      "Ginger, tulsi and mulethi blend for a daily immunity kadha.",
      "Boil one teaspoon in a cup of water, strain and drink warm."],
    ["Pure Forest Honey", "PureLeaf Honey", "Honey", "—", "500 g jar", 399, "🍯",
      "Unprocessed honey for daily use and to soothe a sore throat.",
      "A teaspoon with warm water, or as a sugar substitute."],
  ],
};

/** Expands the compact rows into full catalogue entries. */
export function buildShelfCatalogue(): Medicine[] {
  const out: Medicine[] = [];
  let n = 0;

  for (const [subcategory, rows] of Object.entries(SHELF)) {
    for (const [name, brand, form, strength, pack, mrp, emoji, description, usage] of rows) {
      out.push({
        id: `med_${slug(name)}`,
        name,
        genericName: name,
        strength,
        form,
        brand,
        manufacturer: MAKERS[n++ % MAKERS.length],
        type: "OTC",
        category: CATEGORY_OF[subcategory] ?? "wellness",
        subcategory,
        mrp,
        packLabel: pack,
        description,
        usage,
        emoji,
      });
    }
  }
  return out;
}

/** Shelf placement for the medicines defined in the original seed. */
export const LEGACY_SUBCATEGORY: Record<string, string> = {
  med_para650: "pain-relief",
  med_para500: "pain-relief",
  med_paraSyrup: "cold-cough-fever",
  med_cetirizine: "cold-cough-fever",
  med_cough: "cold-cough-fever",
  med_ors: "digestive",
  med_antacid: "digestive",
  med_ibuprofen: "pain-relief",
  med_diclogel: "pain-relief",
  med_povidone: "first-aid",
  med_bandage: "first-aid",
  med_vitc: "vitamins",
  med_multivit: "vitamins",
  med_calcium: "vitamins",
  med_protein: "vitamins",
  med_thermometer: "devices",
  med_oximeter: "devices",
  med_bpmonitor: "devices",
  med_sanitizer: "hygiene",
  med_mask: "hygiene",
};
