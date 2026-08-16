import clsx from "clsx";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export const BRAND = {
  name: "MedSpark",
  tagline: "Verified Medicines. Faster Delivery. Safer Care.",
  promise: "Verified medicines from nearby pharmacies, delivered to your doorstep.",
  differentiator: "Don't search pharmacy to pharmacy. Find the medicine near you.",
  positioning: "Your Local Healthcare, Delivered to Your Doorstep.",
};

/** Wordmark + spark glyph. Pure SVG so it scales and needs no assets. */
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
      <svg width={dims} height={dims} viewBox="0 0 48 48" aria-hidden="true">
        <rect
          x="2"
          y="2"
          width="44"
          height="44"
          rx="13"
          fill={mono ? "rgba(255,255,255,0.16)" : "var(--color-brand-600)"}
        />
        {/* cross + spark */}
        <path
          d="M24 12v24M12 24h24"
          stroke="#fff"
          strokeWidth="5.5"
          strokeLinecap="round"
          opacity="0.95"
        />
        <path
          d="M31 15l-8 11h6l-3 8"
          stroke={mono ? "#fff" : "var(--color-brand-200)"}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      <span
        className={clsx(
          "font-bold tracking-tight",
          text,
          mono ? "text-white" : "text-ink-900",
        )}
      >
        Med<span className={mono ? "text-brand-200" : "text-brand-600"}>Spark</span>
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
            applicable laws, prescription validity and pharmacist verification. MedSpark
            connects you to licensed local pharmacies — it does not itself dispense
            medicines, and it is not a substitute for medical advice.
          </>
        )}
      </p>
    </div>
  );
}

export function PrototypeRibbon() {
  return (
    <div className="bg-ink-900 px-4 py-1.5 text-center text-[11px] font-medium tracking-wide text-ink-300 no-print">
      PROTOTYPE · Simulated data, payments, OTP and calls · Not for real medical use
    </div>
  );
}
