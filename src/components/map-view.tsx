"use client";

import { Bike, Home, Store } from "lucide-react";

/**
 * Simulated map.
 *
 * A real deployment swaps this component for Google Maps / Mapbox using
 * NEXT_PUBLIC_MAPS_API_KEY — the props (origin, destination, progress) are
 * already the ones a real map integration needs.
 */
export function MapView({
  pharmacyName,
  customerLocality,
  distanceKm,
  progress = 0,
  riderName,
  height = 220,
}: {
  pharmacyName: string;
  customerLocality: string;
  distanceKm: number;
  /** 0 = at pharmacy, 1 = at customer door */
  progress?: number;
  riderName?: string;
  height?: number;
}) {
  const p = Math.max(0, Math.min(1, progress));

  // Route: pharmacy (60,150) -> bend (170,150) -> bend (170,70) -> home (300,70)
  const pts = [
    { x: 60, y: 150 },
    { x: 170, y: 150 },
    { x: 170, y: 70 },
    { x: 300, y: 70 },
  ];
  const segLens = pts.slice(1).map((pt, i) => Math.hypot(pt.x - pts[i].x, pt.y - pts[i].y));
  const totalLen = segLens.reduce((a, b) => a + b, 0);
  let travelled = p * totalLen;
  let rider = { x: pts[0].x, y: pts[0].y };
  for (let i = 0; i < segLens.length; i++) {
    if (travelled <= segLens[i]) {
      const t = segLens[i] === 0 ? 0 : travelled / segLens[i];
      rider = {
        x: pts[i].x + (pts[i + 1].x - pts[i].x) * t,
        y: pts[i].y + (pts[i + 1].y - pts[i].y) * t,
      };
      break;
    }
    travelled -= segLens[i];
    rider = { x: pts[i + 1].x, y: pts[i + 1].y };
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-200 bg-[#eaf1f0]">
      <svg viewBox="0 0 360 200" style={{ height }} className="w-full" role="img"
        aria-label={`Route from ${pharmacyName} to ${customerLocality}, ${distanceKm} km`}>
        <defs>
          <pattern id="ms-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M24 0H0V24" fill="none" stroke="#d7e3e1" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="360" height="200" fill="#eef4f3" />
        <rect width="360" height="200" fill="url(#ms-grid)" />

        {/* Blocks + a park + water for a city-like feel */}
        <rect x="24" y="24" width="80" height="56" rx="6" fill="#e3ece9" />
        <rect x="220" y="120" width="110" height="60" rx="6" fill="#e3ece9" />
        <rect x="200" y="16" width="60" height="34" rx="6" fill="#dcece0" />
        <circle cx="80" cy="182" r="26" fill="#dbe9f2" />

        {/* Main roads */}
        <path d="M0 150H360" stroke="#ffffff" strokeWidth="12" />
        <path d="M170 0V200" stroke="#ffffff" strokeWidth="12" />
        <path d="M0 70H360" stroke="#ffffff" strokeWidth="9" />

        {/* Route */}
        <polyline
          points={pts.map((pt) => `${pt.x},${pt.y}`).join(" ")}
          fill="none"
          stroke="var(--color-brand-600)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="route-dash"
          opacity="0.85"
        />

        {/* Pharmacy pin */}
        <g transform="translate(60,150)">
          <circle r="16" fill="#fff" stroke="var(--color-brand-600)" strokeWidth="2.5" />
          <foreignObject x="-9" y="-9" width="18" height="18">
            <div style={{ color: "#0d8c6f" }}>
              <Store size={18} />
            </div>
          </foreignObject>
        </g>

        {/* Customer pin */}
        <g transform="translate(300,70)">
          <circle r="18" fill="var(--color-brand-600)" opacity="0.18" className="pulse-ring" />
          <circle r="16" fill="#fff" stroke="#f25c26" strokeWidth="2.5" />
          <foreignObject x="-9" y="-9" width="18" height="18">
            <div style={{ color: "#f25c26" }}>
              <Home size={18} />
            </div>
          </foreignObject>
        </g>

        {/* Rider */}
        {p > 0 && p < 1 && (
          <g transform={`translate(${rider.x},${rider.y})`}>
            <circle r="13" fill="#161e24" />
            <foreignObject x="-8" y="-8" width="16" height="16">
              <div style={{ color: "#fff" }}>
                <Bike size={16} />
              </div>
            </foreignObject>
          </g>
        )}

        <text x="60" y="182" textAnchor="middle" fontSize="9" fill="#4e626f" fontWeight="600">
          Pharmacy
        </text>
        <text x="300" y="44" textAnchor="middle" fontSize="9" fill="#4e626f" fontWeight="600">
          You
        </text>
      </svg>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-200 bg-white px-3 py-2 text-xs">
        <span className="font-medium text-ink-700">{pharmacyName}</span>
        <span className="text-ink-400">→</span>
        <span className="font-medium text-ink-700">{customerLocality}</span>
        <span className="ml-auto rounded-full bg-ink-100 px-2 py-0.5 font-semibold text-ink-600">
          {distanceKm} km
        </span>
        {riderName && (
          <span className="rounded-full bg-brand-50 px-2 py-0.5 font-semibold text-brand-700">
            {riderName}
          </span>
        )}
      </div>
      <p className="bg-white px-3 pb-2 text-[10px] text-ink-400">
        Simulated map view · production uses a live maps provider
      </p>
    </div>
  );
}
