/**
 * Synthetic health documents as SVG data URLs.
 *
 * The care-plan flow only means anything if there is something to read, so the
 * seed ships a discharge summary and a lab report the care team can actually
 * open. Nothing here represents a real hospital, patient or result.
 */

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrap(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const FOOTER =
  "SAMPLE DOCUMENT — generated for the DawaQuick prototype. Not a real medical record.";

export interface DischargeSummaryInput {
  hospital: string;
  patient: string;
  age: string;
  admitted: string;
  discharged: string;
  diagnosis: string;
  procedure?: string;
  medicines: string[];
  advice: string[];
}

export function mockDischargeSummary(input: DischargeSummaryInput): string {
  const meds = input.medicines
    .map(
      (m, i) =>
        `<text x="66" y="${418 + i * 34}" font-family="Arial" font-size="17" fill="#1e293b">${i + 1}. ${escapeXml(m)}</text>`,
    )
    .join("");

  const advice = input.advice
    .map(
      (a, i) =>
        `<text x="66" y="${640 + i * 30}" font-family="Arial" font-size="16" fill="#334155">• ${escapeXml(a)}</text>`,
    )
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="660" height="900" viewBox="0 0 660 900">
    <rect width="660" height="900" fill="#ffffff"/>
    <rect x="0" y="0" width="660" height="104" fill="#1e3a8a"/>
    <text x="40" y="48" font-family="Georgia, serif" font-size="26" fill="#ffffff">${escapeXml(input.hospital)}</text>
    <text x="40" y="76" font-family="Arial" font-size="14" fill="#bfdbfe">DISCHARGE SUMMARY · Department of General Medicine</text>
    <text x="40" y="144" font-family="Arial" font-size="16" fill="#0f172a">Patient: <tspan font-weight="bold">${escapeXml(input.patient)}</tspan></text>
    <text x="420" y="144" font-family="Arial" font-size="16" fill="#0f172a">Age: ${escapeXml(input.age)}</text>
    <text x="40" y="172" font-family="Arial" font-size="16" fill="#0f172a">Admitted: ${escapeXml(input.admitted)}</text>
    <text x="420" y="172" font-family="Arial" font-size="16" fill="#0f172a">Discharged: ${escapeXml(input.discharged)}</text>
    <line x1="40" y1="196" x2="620" y2="196" stroke="#cbd5e1"/>
    <text x="40" y="232" font-family="Arial" font-size="13" font-weight="bold" fill="#64748b">FINAL DIAGNOSIS</text>
    <text x="40" y="262" font-family="Arial" font-size="18" fill="#0f172a">${escapeXml(input.diagnosis)}</text>
    ${
      input.procedure
        ? `<text x="40" y="306" font-family="Arial" font-size="13" font-weight="bold" fill="#64748b">PROCEDURE</text>
    <text x="40" y="336" font-family="Arial" font-size="17" fill="#0f172a">${escapeXml(input.procedure)}</text>`
        : ""
    }
    <text x="40" y="386" font-family="Arial" font-size="13" font-weight="bold" fill="#64748b">DISCHARGE MEDICATION</text>
    ${meds}
    <text x="40" y="610" font-family="Arial" font-size="13" font-weight="bold" fill="#64748b">ADVICE ON DISCHARGE</text>
    ${advice}
    <line x1="40" y1="790" x2="620" y2="790" stroke="#e2e8f0"/>
    <text x="400" y="826" font-family="Georgia, serif" font-size="20" fill="#1e3a8a" font-style="italic">Consultant Physician</text>
    <line x1="390" y1="838" x2="600" y2="838" stroke="#94a3b8"/>
    <text x="40" y="878" font-family="Arial" font-size="11" fill="#94a3b8">${FOOTER}</text>
  </svg>`;

  return wrap(svg);
}

export interface LabReportRow {
  test: string;
  result: string;
  unit: string;
  range: string;
  flag?: "H" | "L";
}

export function mockLabReport(input: {
  lab: string;
  patient: string;
  age: string;
  collected: string;
  panel: string;
  rows: LabReportRow[];
}): string {
  const rows = input.rows
    .map((r, i) => {
      const y = 340 + i * 38;
      const colour = r.flag ? (r.flag === "H" ? "#b91c1c" : "#1d4ed8") : "#0f172a";
      const flag = r.flag
        ? `<text x="588" y="${y}" font-family="Arial" font-size="15" font-weight="bold" fill="${colour}">${r.flag}</text>`
        : "";
      return `<text x="46" y="${y}" font-family="Arial" font-size="15" fill="#0f172a">${escapeXml(r.test)}</text>
    <text x="330" y="${y}" font-family="Arial" font-size="15" font-weight="bold" fill="${colour}">${escapeXml(r.result)}</text>
    <text x="404" y="${y}" font-family="Arial" font-size="14" fill="#475569">${escapeXml(r.unit)}</text>
    <text x="470" y="${y}" font-family="Arial" font-size="14" fill="#64748b">${escapeXml(r.range)}</text>
    ${flag}
    <line x1="40" y1="${y + 12}" x2="620" y2="${y + 12}" stroke="#f1f5f9"/>`;
    })
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="660" height="820" viewBox="0 0 660 820">
    <rect width="660" height="820" fill="#ffffff"/>
    <rect x="0" y="0" width="660" height="96" fill="#0f766e"/>
    <text x="40" y="46" font-family="Georgia, serif" font-size="25" fill="#ffffff">${escapeXml(input.lab)}</text>
    <text x="40" y="72" font-family="Arial" font-size="14" fill="#ccfbf1">NABL-accredited diagnostics · Gandhinagar</text>
    <text x="40" y="140" font-family="Arial" font-size="16" fill="#0f172a">Patient: <tspan font-weight="bold">${escapeXml(input.patient)}</tspan></text>
    <text x="420" y="140" font-family="Arial" font-size="16" fill="#0f172a">Age: ${escapeXml(input.age)}</text>
    <text x="40" y="168" font-family="Arial" font-size="16" fill="#0f172a">Collected: ${escapeXml(input.collected)}</text>
    <line x1="40" y1="196" x2="620" y2="196" stroke="#cbd5e1"/>
    <text x="40" y="238" font-family="Georgia, serif" font-size="20" fill="#0f766e">${escapeXml(input.panel)}</text>
    <rect x="40" y="272" width="580" height="34" fill="#f1f5f9"/>
    <text x="46" y="294" font-family="Arial" font-size="12" font-weight="bold" fill="#475569">TEST</text>
    <text x="330" y="294" font-family="Arial" font-size="12" font-weight="bold" fill="#475569">RESULT</text>
    <text x="404" y="294" font-family="Arial" font-size="12" font-weight="bold" fill="#475569">UNIT</text>
    <text x="470" y="294" font-family="Arial" font-size="12" font-weight="bold" fill="#475569">REFERENCE</text>
    ${rows}
    <text x="40" y="742" font-family="Arial" font-size="13" fill="#64748b">H = above reference range · L = below reference range</text>
    <text x="40" y="778" font-family="Arial" font-size="11" fill="#94a3b8">${FOOTER}</text>
  </svg>`;

  return wrap(svg);
}
