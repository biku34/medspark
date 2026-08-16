import clsx from "clsx";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export const BRAND = {
  name: "DawaQuick",
  tagline: "Verified Medicines. Faster Delivery. Safer Care.",
  promise: "Verified medicines from nearby pharmacies, delivered to your doorstep.",
  differentiator: "Don't search pharmacy to pharmacy. Find the medicine near you.",
  positioning: "Your Local Healthcare, Delivered to Your Doorstep.",
};

/**
 * DawaQuick mark: a capsule (dawa = medicine) leaning forward with motion
 * streaks behind it (quick). Same teal tile as before, so the brand still
 * reads as calm healthcare rather than a courier company.
 *
 * Pure SVG — scales to any size and needs no image assets.
 */
export function LogoMark({ size = 32, mono = false }: { size?: number; mono?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect
        x="2"
        y="2"
        width="44"
        height="44"
        rx="13"
        fill={mono ? "rgba(255,255,255,0.16)" : "var(--color-brand-600)"}
      />

      {/* speed streaks — the "quick" half of the name */}
      <g
        stroke={mono ? "rgba(255,255,255,0.55)" : "var(--color-brand-200)"}
        strokeWidth="2.6"
        strokeLinecap="round"
      >
        <path d="M8 16h7" />
        <path d="M6 24h9" />
        <path d="M8 32h7" />
      </g>

      {/* capsule — the "dawa" half, tilted into the direction of travel */}
      <g transform="translate(29 24) rotate(-38)">
        <rect x="-5.75" y="-11" width="11.5" height="22" rx="5.75" fill="#ffffff" />
        <path
          d="M-5.75 0h11.5"
          stroke={mono ? "var(--color-brand-700)" : "var(--color-brand-600)"}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

/** Wordmark + mark. */
export function Logo({
  size = "md",
  href = "/",
  mono = false,
}: {
  size?: "sm" | "md" | "lg";
  href?: string | null;
  mono?: boolean;
}) {
  const dims = { sm: 26, md: 32, lg: 44 }[size];
  const text = { sm: "text-lg", md: "text-xl", lg: "text-3xl" }[size];

  const mark = (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={dims} mono={mono} />
      <span
        className={clsx(
          "font-bold tracking-tight",
          text,
          mono ? "text-white" : "text-ink-900",
        )}
      >
        Dawa<span className={mono ? "text-brand-200" : "text-brand-600"}>Quick</span>
      </span>
    </span>
  );

  if (!href) return mark;
  return (
    <Link href={href} className="shrink-0" aria-label={`${BRAND.name} home`}>
      {mark}
    </Link>
  );
}

/**
 * Regulatory note. Shown on every prescription surface — the prototype must
 * never imply it is authorised to dispense on its own.
 */
export function ComplianceNote({
  variant = "full",
  className,
}: {
  variant?: "full" | "short";
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900",
        className,
      )}
    >
      <ShieldCheck size={18} className="mt-0.5 shrink-0 text-amber-600" />
      <p className="text-xs leading-relaxed">
        {variant === "short" ? (
          <>
            Prescription medicines are dispensed only after applicable prescription and
            pharmacist verification requirements are satisfied.
          </>
        ) : (
          <>
            <strong className="font-semibold">Compliance notice.</strong> Prescription
            medicines are dispensed only after applicable prescription and pharmacist
            verification requirements are satisfied. Final dispensing is subject to
            applicable laws, prescription validity and pharmacist verification. DawaQuick
            connects you to licensed local pharmacies — it does not itself dispense
            medicines, and it is not a substitute for medical advice.
          </>
        )}
      </p>
    </div>
  );
}
