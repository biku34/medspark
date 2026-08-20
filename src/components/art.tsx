/**
 * DawaQuick illustration set.
 *
 * Every shelf category and service is drawn, not emoji'd. Emoji render
 * differently on every device, carry another vendor's art direction, and read
 * as a placeholder — which is exactly what they are.
 *
 * One grammar throughout: a 48×48 grid, flat two-tone fills, 3px rounded
 * strokes, no gradients inside the object, and a single warm highlight. Each
 * glyph is tinted from a per-category palette so the tile, the artwork and the
 * category colour are the same decision.
 */

import type { SVGProps } from "react";

export interface Palette {
  /** Tile background. */
  well: string;
  /** Main body of the object. */
  base: string;
  /** Shadow side / detail. */
  deep: string;
  /** The one bright note. */
  pop: string;
}

/* -------------------------------------------------------------------------- */
/* palettes                                                                   */
/* -------------------------------------------------------------------------- */

export const CATEGORY_PALETTE: Record<string, Palette> = {
  "pain-relief": { well: "#FFEDEE", base: "#F2617A", deep: "#C93A56", pop: "#FFD166" },
  "cold-cough-fever": { well: "#E7F3FF", base: "#4A9BE8", deep: "#2A6CB0", pop: "#A8DCFF" },
  digestive: { well: "#E6F7EF", base: "#38B27E", deep: "#1F7D57", pop: "#B9F0D6" },
  "first-aid": { well: "#FFECE9", base: "#F2704F", deep: "#C24A2E", pop: "#FFD3C6" },
  devices: { well: "#ECEEFF", base: "#6D74E0", deep: "#454BB0", pop: "#B9BDFF" },
  vitamins: { well: "#FFF4E0", base: "#F2A93B", deep: "#C47C14", pop: "#FFE0A3" },
  "feminine-care": { well: "#FDEBF5", base: "#DE6BA8", deep: "#AF3F7C", pop: "#FBCDE6" },
  "sexual-wellness": { well: "#F3ECFE", base: "#8B62D8", deep: "#5D3AA6", pop: "#D6C3FA" },
  "baby-care": { well: "#FFF1E8", base: "#F5A26B", deep: "#C86F38", pop: "#FFD9BF" },
  "elderly-care": { well: "#EDF1F7", base: "#6C8AAE", deep: "#42597A", pop: "#C3D5EA" },
  "diabetic-care": { well: "#E9F6FB", base: "#3FA9C9", deep: "#1E7794", pop: "#B4E4F2" },
  "skin-hair": { well: "#FEF0E7", base: "#E8925F", deep: "#B4642F", pop: "#FBD5BC" },
  "oral-care": { well: "#E8F5FB", base: "#54AEDB", deep: "#2C7CA6", pop: "#C2E7F7" },
  hygiene: { well: "#E7F6F4", base: "#3EB1A6", deep: "#1E7D74", pop: "#B6EAE4" },
  ayurveda: { well: "#EEF6E2", base: "#7CAE43", deep: "#527A22", pop: "#CDE7A6" },
};

export const FALLBACK_PALETTE: Palette = {
  well: "#EFF1F4",
  base: "#7B8794",
  deep: "#4A5460",
  pop: "#CBD3DC",
};

export const paletteFor = (id: string): Palette => CATEGORY_PALETTE[id] ?? FALLBACK_PALETTE;

/* -------------------------------------------------------------------------- */
/* glyphs                                                                     */
/* -------------------------------------------------------------------------- */

type GlyphProps = SVGProps<SVGSVGElement> & { p: Palette };

const svg = (props: SVGProps<SVGSVGElement>) => ({
  viewBox: "0 0 48 48",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  ...props,
});

/** Capsule + tablet. */
function PainRelief({ p, ...rest }: GlyphProps) {
  return (
    <svg {...svg(rest)}>
      <g transform="rotate(-38 26 20)">
        <rect x="8" y="12" width="36" height="17" rx="8.5" fill={p.base} />
        <path d="M26 12h9.5A8.5 8.5 0 0 1 44 20.5 8.5 8.5 0 0 1 35.5 29H26z" fill={p.deep} />
        <rect x="11.5" y="15.5" width="7" height="4" rx="2" fill="#fff" opacity=".55" />
      </g>
      <circle cx="16" cy="35" r="8" fill={p.pop} />
      <path d="M16 30.5v9M11.5 35h9" stroke={p.deep} strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

/** Syrup bottle with a dosing cap. */
function ColdCough({ p, ...rest }: GlyphProps) {
  return (
    <svg {...svg(rest)}>
      <rect x="18" y="4" width="12" height="6" rx="2" fill={p.deep} />
      <path d="M19 10h10v4l3 3v23a4 4 0 0 1-4 4H20a4 4 0 0 1-4-4V17l3-3z" fill={p.base} />
      <rect x="19" y="24" width="10" height="14" rx="2" fill="#fff" opacity=".85" />
      <path d="M21 28h6M21 32h4" stroke={p.deep} strokeWidth="2" strokeLinecap="round" />
      <path d="M34 30h8v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z" fill={p.pop} />
    </svg>
  );
}

/** Fizzing glass — antacid and ORS. */
function Digestive({ p, ...rest }: GlyphProps) {
  return (
    <svg {...svg(rest)}>
      <path d="M12 16h24l-2.5 24a4 4 0 0 1-4 3.5H18.5a4 4 0 0 1-4-3.5z" fill={p.base} />
      <path d="M13.4 26h21.2l-1.1 14a4 4 0 0 1-4 3.5H18.5a4 4 0 0 1-4-3.5z" fill={p.deep} opacity=".35" />
      <circle cx="20" cy="10" r="3.5" fill={p.pop} />
      <circle cx="28" cy="6.5" r="2.5" fill={p.pop} />
      <circle cx="26" cy="13" r="2" fill={p.pop} />
      <rect x="10" y="13" width="28" height="5" rx="2.5" fill={p.deep} />
    </svg>
  );
}

/** Adhesive plaster. */
function FirstAid({ p, ...rest }: GlyphProps) {
  return (
    <svg {...svg(rest)}>
      <g transform="rotate(-40 24 24)">
        <rect x="2" y="16" width="44" height="16" rx="8" fill={p.base} />
        <rect x="16" y="16" width="16" height="16" fill={p.pop} />
        <g fill={p.deep}>
          <circle cx="20" cy="21" r="1.6" />
          <circle cx="24" cy="21" r="1.6" />
          <circle cx="28" cy="21" r="1.6" />
          <circle cx="20" cy="27" r="1.6" />
          <circle cx="24" cy="27" r="1.6" />
          <circle cx="28" cy="27" r="1.6" />
        </g>
      </g>
    </svg>
  );
}

/** Stethoscope. */
function Devices({ p, ...rest }: GlyphProps) {
  return (
    <svg {...svg(rest)}>
      <path
        d="M13 6v10a9 9 0 0 0 18 0V6"
        stroke={p.base}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M22 25v6a9 9 0 0 0 9 9h1"
        stroke={p.deep}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="36" cy="36" r="7" fill={p.base} />
      <circle cx="36" cy="36" r="3" fill={p.pop} />
      <rect x="9" y="4" width="8" height="6" rx="3" fill={p.deep} />
      <rect x="27" y="4" width="8" height="6" rx="3" fill={p.deep} />
    </svg>
  );
}

/** Supplement jar. */
function Vitamins({ p, ...rest }: GlyphProps) {
  return (
    <svg {...svg(rest)}>
      <rect x="14" y="6" width="20" height="7" rx="2.5" fill={p.deep} />
      <rect x="11" y="13" width="26" height="31" rx="5" fill={p.base} />
      <rect x="15" y="21" width="18" height="13" rx="3" fill="#fff" opacity=".9" />
      <path
        d="M24 24.5v6M21 27.5h6"
        stroke={p.deep}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="31" cy="39" r="3" fill={p.pop} />
    </svg>
  );
}

/** Sanitary pad with wings. */
function FeminineCare({ p, ...rest }: GlyphProps) {
  return (
    <svg {...svg(rest)}>
      <path
        d="M18 8h12a5 5 0 0 1 5 5v22a5 5 0 0 1-5 5H18a5 5 0 0 1-5-5V13a5 5 0 0 1 5-5z"
        fill={p.base}
      />
      <path d="M13 18l-6 3a3 3 0 0 0 0 5.4l6 3zM35 18l6 3a3 3 0 0 1 0 5.4l-6 3z" fill={p.deep} />
      <rect x="20" y="16" width="8" height="16" rx="4" fill={p.pop} />
    </svg>
  );
}

/** Discreet foil packet. */
function SexualWellness({ p, ...rest }: GlyphProps) {
  return (
    <svg {...svg(rest)}>
      <rect x="9" y="11" width="30" height="26" rx="4" fill={p.base} />
      <path d="M9 17h30M9 31h30" stroke={p.deep} strokeWidth="2.4" strokeDasharray="3 3" />
      <circle cx="24" cy="24" r="5" fill={p.pop} />
      <path
        d="M24 27c-2.4-1.7-3.6-3-3.6-4.2A1.9 1.9 0 0 1 24 21.6a1.9 1.9 0 0 1 3.6 1.2c0 1.2-1.2 2.5-3.6 4.2z"
        fill={p.deep}
      />
    </svg>
  );
}

/** Feeding bottle. */
function BabyCare({ p, ...rest }: GlyphProps) {
  return (
    <svg {...svg(rest)}>
      <path d="M21 3h6v5h-6z" fill={p.deep} />
      <path d="M18 8h12v4H18z" fill={p.pop} />
      <rect x="15" y="12" width="18" height="32" rx="6" fill={p.base} />
      <path d="M19 20h10M19 26h7M19 32h10" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity=".85" />
    </svg>
  );
}

/** Walking cane. */
function ElderlyCare({ p, ...rest }: GlyphProps) {
  return (
    <svg {...svg(rest)}>
      <path
        d="M30 42V19a8 8 0 1 0-16 0v3"
        stroke={p.base}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <circle cx="30" cy="43" r="3.5" fill={p.deep} />
      <path d="M18 12a8 8 0 0 1 12 7" stroke={p.pop} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Glucometer with a blood drop. */
function DiabeticCare({ p, ...rest }: GlyphProps) {
  return (
    <svg {...svg(rest)}>
      <rect x="10" y="8" width="22" height="34" rx="5" fill={p.base} />
      <rect x="14" y="13" width="14" height="10" rx="2.5" fill="#fff" opacity=".92" />
      <path d="M17 18h8" stroke={p.deep} strokeWidth="2.4" strokeLinecap="round" />
      <g fill={p.deep}>
        <circle cx="17" cy="29" r="2.2" />
        <circle cx="25" cy="29" r="2.2" />
        <circle cx="17" cy="36" r="2.2" />
        <circle cx="25" cy="36" r="2.2" />
      </g>
      <path d="M38 14c3.6 4.5 5 6.9 5 9a5 5 0 1 1-10 0c0-2.1 1.4-4.5 5-9z" fill={p.pop} />
    </svg>
  );
}

/** Cream tube. */
function SkinHair({ p, ...rest }: GlyphProps) {
  return (
    <svg {...svg(rest)}>
      <rect x="19" y="4" width="10" height="6" rx="2" fill={p.deep} />
      <path d="M16 10h16l-2 30a4 4 0 0 1-4 3.6h-4a4 4 0 0 1-4-3.6z" fill={p.base} />
      <path d="M16 10h16l-.5 7h-15z" fill={p.pop} />
      <path d="M21 24h6" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" opacity=".9" />
    </svg>
  );
}

/** Toothbrush. */
function OralCare({ p, ...rest }: GlyphProps) {
  return (
    <svg {...svg(rest)}>
      <g transform="rotate(38 24 24)">
        <rect x="21" y="14" width="6" height="30" rx="3" fill={p.base} />
        <rect x="19" y="6" width="10" height="10" rx="3" fill={p.deep} />
        <g fill={p.pop}>
          <rect x="18" y="2" width="3" height="6" rx="1.5" />
          <rect x="22.5" y="2" width="3" height="6" rx="1.5" />
          <rect x="27" y="2" width="3" height="6" rx="1.5" />
        </g>
      </g>
    </svg>
  );
}

/** Pump bottle. */
function Hygiene({ p, ...rest }: GlyphProps) {
  return (
    <svg {...svg(rest)}>
      <path d="M24 4h8v3h-8z" fill={p.deep} />
      <path d="M24 7h3v5h-3z" fill={p.deep} />
      <rect x="19" y="12" width="8" height="4" rx="1.5" fill={p.pop} />
      <rect x="13" y="16" width="20" height="28" rx="5" fill={p.base} />
      <rect x="17" y="23" width="12" height="10" rx="2.5" fill="#fff" opacity=".9" />
      <circle cx="38" cy="14" r="3" fill={p.pop} />
      <circle cx="42" cy="21" r="2" fill={p.pop} />
    </svg>
  );
}

/** Mortar, pestle and a leaf. */
function Ayurveda({ p, ...rest }: GlyphProps) {
  return (
    <svg {...svg(rest)}>
      <path d="M10 24h28a14 14 0 0 1-14 16A14 14 0 0 1 10 24z" fill={p.base} />
      <rect x="7" y="21" width="34" height="5" rx="2.5" fill={p.deep} />
      <rect
        x="30"
        y="6"
        width="5"
        height="18"
        rx="2.5"
        fill={p.deep}
        transform="rotate(22 32.5 15)"
      />
      <path
        d="M18 18c-3-6 0-11 6-13 1 7-1 11-6 13z"
        fill={p.pop}
      />
    </svg>
  );
}

const GLYPHS: Record<string, (props: GlyphProps) => React.ReactElement> = {
  "pain-relief": PainRelief,
  "cold-cough-fever": ColdCough,
  digestive: Digestive,
  "first-aid": FirstAid,
  devices: Devices,
  vitamins: Vitamins,
  "feminine-care": FeminineCare,
  "sexual-wellness": SexualWellness,
  "baby-care": BabyCare,
  "elderly-care": ElderlyCare,
  "diabetic-care": DiabeticCare,
  "skin-hair": SkinHair,
  "oral-care": OralCare,
  hygiene: Hygiene,
  ayurveda: Ayurveda,
};

/** Draws the glyph for a shelf category. Falls back to a generic pill box. */
export function CategoryArt({
  id,
  size = 44,
  className,
}: {
  id: string;
  size?: number;
  className?: string;
}) {
  const p = paletteFor(id);
  const Glyph = GLYPHS[id];
  if (!Glyph) {
    return (
      <svg width={size} height={size} className={className} {...svg({})}>
        <rect x="9" y="13" width="30" height="24" rx="5" fill={p.base} />
        <rect x="14" y="19" width="20" height="4" rx="2" fill="#fff" opacity=".85" />
      </svg>
    );
  }
  return <Glyph p={p} width={size} height={size} className={className} />;
}

/* -------------------------------------------------------------------------- */
/* service artwork                                                            */
/* -------------------------------------------------------------------------- */

export const SERVICE_PALETTE = {
  rx: { well: "#FFF3DC", base: "#F0A32B", deep: "#B96F09", pop: "#FFE1A8" },
  care: { well: "#EAF1FF", base: "#4C7DF0", deep: "#2A55B8", pop: "#BBD0FF" },
  repeat: { well: "#E4F6EE", base: "#17A472", deep: "#0A6E4A", pop: "#AFE9D0" },
  physio: { well: "#EDEBFF", base: "#7B6BE8", deep: "#4E3EB4", pop: "#C7C0FF" },
  nursing: { well: "#FFEDF3", base: "#E86C9B", deep: "#B23C6E", pop: "#FFC7DC" },
} as const;

export type ServiceArtKind = keyof typeof SERVICE_PALETTE;

/** Prescription sheet with an ℞ mark. */
function RxArt({ p }: { p: Palette }) {
  return (
    <>
      <rect x="10" y="5" width="28" height="38" rx="4" fill="#fff" />
      <rect x="10" y="5" width="28" height="38" rx="4" stroke={p.deep} strokeWidth="2.5" />
      <rect x="10" y="5" width="28" height="8" rx="4" fill={p.base} />
      <path
        d="M17 22v10m0-10h4a3 3 0 0 1 0 6h-4m4 0l4 4"
        stroke={p.deep}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M28 22h6M28 28h6M17 37h17" stroke={p.pop} strokeWidth="2.6" strokeLinecap="round" />
    </>
  );
}

/** Clipboard with a pulse line — the care plan. */
function CareArt({ p }: { p: Palette }) {
  return (
    <>
      <rect x="9" y="8" width="30" height="35" rx="4" fill={p.base} />
      <rect x="13" y="14" width="22" height="25" rx="3" fill="#fff" />
      <rect x="17" y="4" width="14" height="8" rx="3" fill={p.deep} />
      <path
        d="M16 27h4l2.5-6 3.5 12 2.5-6h4"
        stroke={p.deep}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="34" cy="35" r="7" fill={p.pop} />
      <path
        d="M34 38.4c-2.6-1.9-4-3.4-4-4.8a2.1 2.1 0 0 1 4-1 2.1 2.1 0 0 1 4 1c0 1.4-1.4 2.9-4 4.8z"
        fill={p.deep}
      />
    </>
  );
}

/** A pill inside a repeating loop. */
function RepeatArt({ p }: { p: Palette }) {
  return (
    <>
      <path
        d="M38 20a15 15 0 1 1-5.5-9"
        stroke={p.base}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path d="M39 4v9h-9" stroke={p.base} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <g transform="rotate(-40 24 26)">
        <rect x="13" y="21" width="22" height="11" rx="5.5" fill={p.deep} />
        <path d="M24 21h5.5a5.5 5.5 0 0 1 0 11H24z" fill={p.pop} />
      </g>
    </>
  );
}

/** Physiotherapy — a knee joint under motion arcs. */
function PhysioArt({ p }: { p: Palette }) {
  return (
    <>
      <path
        d="M14 6v13a9 9 0 0 0 5 8l9 4.5a9 9 0 0 1 5 8V43"
        stroke={p.base}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="23" cy="24" r="7" fill={p.deep} />
      <circle cx="23" cy="24" r="2.8" fill="#fff" />
      <path d="M36 14a11 11 0 0 1 0 12" stroke={p.pop} strokeWidth="3.4" strokeLinecap="round" />
      <path d="M41 10a17 17 0 0 1 0 20" stroke={p.pop} strokeWidth="3.4" strokeLinecap="round" opacity=".6" />
    </>
  );
}

/** Nursing — cap and cross. */
function NursingArt({ p }: { p: Palette }) {
  return (
    <>
      <path d="M10 30a14 14 0 0 1 28 0v3a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4z" fill={p.base} />
      <path d="M13 16h22l3 11H10z" fill="#fff" />
      <path d="M13 16h22l3 11H10z" stroke={p.deep} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M22 18h4v3h3v4h-3v3h-4v-3h-3v-4h3z" fill={p.deep} />
      <circle cx="24" cy="41" r="4" fill={p.pop} />
    </>
  );
}

const SERVICE_GLYPHS: Record<ServiceArtKind, (props: { p: Palette }) => React.ReactElement> = {
  rx: RxArt,
  care: CareArt,
  repeat: RepeatArt,
  physio: PhysioArt,
  nursing: NursingArt,
};

export function ServiceArt({
  kind,
  size = 48,
  className,
}: {
  kind: ServiceArtKind;
  size?: number;
  className?: string;
}) {
  const p = SERVICE_PALETTE[kind];
  const Glyph = SERVICE_GLYPHS[kind];
  return (
    <svg width={size} height={size} className={className} {...svg({})}>
      <Glyph p={p} />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* product artwork                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Stand-in pack shot for a catalogue item.
 *
 * Real listings carry photography from the manufacturer. Until those exist,
 * a drawn pack in the category's own colours beats a grey box or an emoji —
 * the shelf still reads as a shelf.
 */
export function ProductArt({
  subcategory,
  form,
  size = 72,
  className,
}: {
  subcategory: string;
  form?: string;
  size?: number;
  className?: string;
}) {
  const p = paletteFor(subcategory);
  const f = (form ?? "").toLowerCase();

  // Pick the pack shape from the dosage form, not the category, so a syrup in
  // the pain-relief aisle still looks like a bottle.
  const shape =
    /syrup|drop|solution|suspension|liquid/.test(f)
      ? "bottle"
      : /cream|gel|ointment|tube|paste/.test(f)
        ? "tube"
        : /spray|inhaler|sanitiser|sanitizer/.test(f)
          ? "spray"
          : /device|monitor|meter|thermo|oximeter/.test(f)
            ? "device"
            : /capsule|tablet|strip/.test(f)
              ? "strip"
              : "box";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {shape === "strip" && (
        <>
          <rect x="10" y="18" width="44" height="28" rx="4" fill={p.base} />
          <rect x="10" y="18" width="44" height="9" rx="4" fill={p.deep} />
          <g fill="#fff" opacity=".92">
            {[0, 1, 2, 3].map((i) => (
              <circle key={i} cx={17 + i * 10} cy={36} r="4" />
            ))}
          </g>
        </>
      )}

      {shape === "bottle" && (
        <>
          <rect x="26" y="8" width="12" height="6" rx="2" fill={p.deep} />
          <path d="M27 14h10v3l4 4v29a4 4 0 0 1-4 4H27a4 4 0 0 1-4-4V21l4-4z" fill={p.base} />
          <rect x="26" y="30" width="12" height="14" rx="2" fill="#fff" opacity=".92" />
          <path d="M29 35h6" stroke={p.deep} strokeWidth="2.4" strokeLinecap="round" />
        </>
      )}

      {shape === "tube" && (
        <>
          <rect x="26" y="9" width="12" height="6" rx="2" fill={p.deep} />
          <path d="M22 15h20l-2.5 36a4 4 0 0 1-4 3.6h-7a4 4 0 0 1-4-3.6z" fill={p.base} />
          <path d="M22 15h20l-.6 8H22.6z" fill={p.pop} />
        </>
      )}

      {shape === "spray" && (
        <>
          <rect x="28" y="6" width="8" height="7" rx="2" fill={p.deep} />
          <rect x="22" y="13" width="20" height="42" rx="7" fill={p.base} />
          <rect x="27" y="24" width="10" height="12" rx="3" fill="#fff" opacity=".92" />
          <circle cx="48" cy="12" r="3" fill={p.pop} />
          <circle cx="53" cy="19" r="2" fill={p.pop} />
        </>
      )}

      {shape === "device" && (
        <>
          <rect x="14" y="12" width="36" height="40" rx="6" fill={p.base} />
          <rect x="20" y="19" width="24" height="15" rx="3" fill="#fff" opacity=".95" />
          <path d="M24 27h5l2-4 3 8 2-4h4" stroke={p.deep} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <g fill={p.deep}>
            <circle cx="24" cy="42" r="3" />
            <circle cx="34" cy="42" r="3" />
            <circle cx="44" cy="42" r="3" opacity=".5" />
          </g>
        </>
      )}

      {shape === "box" && (
        <>
          <rect x="13" y="14" width="38" height="36" rx="5" fill={p.base} />
          <rect x="13" y="14" width="38" height="11" rx="5" fill={p.deep} />
          <rect x="19" y="31" width="26" height="4" rx="2" fill="#fff" opacity=".9" />
          <rect x="19" y="39" width="16" height="4" rx="2" fill="#fff" opacity=".6" />
        </>
      )}
    </svg>
  );
}
