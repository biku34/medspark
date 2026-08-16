"use client";

/**
 * Dependency-free SVG charts.
 *
 * Deliberately small and readable — the prototype's analytics only need honest
 * shapes, and hand-rolled SVG keeps the bundle light and the theming consistent.
 */

const BRAND = "var(--color-brand-600)";
const BRAND_LIGHT = "var(--color-brand-300)";
const ACCENT = "var(--color-accent-500)";

function shortDay(day: string) {
  return new Date(day).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/* -------------------------------------------------------------------------- */

export function GroupedBars({
  data,
  height = 180,
}: {
  data: Array<{ day: string; otc: number; rx: number }>;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.otc + d.rx));
  const barW = 100 / (data.length * 1.6);

  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1="0"
            x2="100"
            y1={height - f * (height - 24)}
            y2={height - f * (height - 24)}
            stroke="var(--color-ink-200)"
            strokeWidth="0.5"
          />
        ))}
        {data.map((d, i) => {
          const x = (i + 0.3) * (100 / data.length);
          const otcH = (d.otc / max) * (height - 24);
          const rxH = (d.rx / max) * (height - 24);
          return (
            <g key={d.day}>
              <rect
                x={x}
                y={height - otcH}
                width={barW}
                height={otcH}
                rx="1.5"
                fill={BRAND}
              />
              <rect
                x={x}
                y={height - otcH - rxH}
                width={barW}
                height={rxH}
                rx="1.5"
                fill={ACCENT}
              />
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-ink-400">
        {data.map((d) => (
          <span key={d.day}>{shortDay(d.day)}</span>
        ))}
      </div>
      <div className="mt-2 flex gap-4 text-xs text-ink-600">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: BRAND }} /> OTC
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: ACCENT }} /> Prescription
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function Sparkline({
  data,
  height = 150,
  suffix = "",
  color = BRAND,
}: {
  data: Array<{ day: string; value: number }>;
  height?: number;
  suffix?: string;
  color?: string;
}) {
  const values = data.map((d) => d.value);
  const max = Math.max(1, ...values);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const pt = (v: number, i: number) => {
    const x = (i / Math.max(1, data.length - 1)) * 100;
    const y = height - 20 - ((v - min) / span) * (height - 34);
    return `${x},${y}`;
  };
  const line = data.map((d, i) => pt(d.value, i)).join(" ");
  const area = `0,${height - 20} ${line} 100,${height - 20}`;

  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        <polygon points={area} fill={color} opacity="0.12" />
        <polyline
          points={line}
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {data.map((d, i) => {
          const [x, y] = pt(d.value, i).split(",");
          return <circle key={d.day} cx={x} cy={y} r="1.6" fill={color} />;
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-ink-400">
        {data.map((d) => (
          <span key={d.day}>{shortDay(d.day)}</span>
        ))}
      </div>
      <p className="mt-1 text-xs text-ink-500">
        Latest: <strong className="text-ink-800">{values[values.length - 1]}{suffix}</strong>
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function Donut({
  slices,
  size = 150,
}: {
  slices: Array<{ label: string; value: number; color: string }>;
  size?: number;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox="0 0 100 100" className="shrink-0">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-ink-100)" strokeWidth="14" />
        {slices.map((s) => {
          const len = (s.value / total) * c;
          const el = (
            <circle
              key={s.label}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="14"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 50 50)"
            />
          );
          offset += len;
          return el;
        })}
        <text x="50" y="49" textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--color-ink-900)">
          {total}
        </text>
        <text x="50" y="61" textAnchor="middle" fontSize="7" fill="var(--color-ink-500)">
          ORDERS
        </text>
      </svg>
      <ul className="space-y-2">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3 rounded-sm" style={{ background: s.color }} />
            <span className="text-ink-600">{s.label}</span>
            <span className="font-semibold text-ink-900">
              {s.value}
              <span className="ml-1 text-xs font-normal text-ink-400">
                ({Math.round((s.value / total) * 100)}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function RankedBars({
  items,
  unit,
}: {
  items: Array<{ label: string; value: number; hint?: string }>;
  unit?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate capitalize text-ink-700">{i.label}</span>
            <span className="shrink-0 font-semibold text-ink-900">
              {i.value}
              {unit ? ` ${unit}` : ""}
              {i.hint && <span className="ml-1 text-xs font-normal text-ink-400">{i.hint}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-ink-100">
            <div
              className="h-full rounded-full"
              style={{ width: `${(i.value / max) * 100}%`, background: BRAND_LIGHT }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
