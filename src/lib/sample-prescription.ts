/**
 * Generates a synthetic prescription image as an SVG data URL.
 *
 * Used by the seed data and by the "use a sample prescription" demo button, so
 * the prescription workflow can be demonstrated without a real document.
 * Nothing here represents a real doctor, patient or prescription.
 */
export function mockPrescriptionImage(
  doctor: string,
  patient: string,
  lines: string[],
  date: string,
): string {
  const rows = lines
    .map(
      (l, i) =>
        `<text x="70" y="${300 + i * 46}" font-family="Georgia, serif" font-size="21" fill="#1e293b">${i + 1}. ${escapeXml(l)}</text>`,
    )
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="880" viewBox="0 0 640 880">
    <rect width="640" height="880" fill="#fdfcf7"/>
    <rect x="0" y="0" width="640" height="112" fill="#0f766e"/>
    <text x="40" y="52" font-family="Georgia, serif" font-size="27" fill="#ffffff">${escapeXml(doctor)}</text>
    <text x="40" y="82" font-family="Arial" font-size="15" fill="#ccfbf1">MBBS, MD (General Medicine) · Reg. No. 44127</text>
    <text x="40" y="102" font-family="Arial" font-size="13" fill="#99f6e4">Wellspring Clinic · Sector 11, Gandhinagar · +91 79 4000 2200</text>
    <line x1="40" y1="150" x2="600" y2="150" stroke="#cbd5e1" stroke-width="1"/>
    <text x="40" y="182" font-family="Arial" font-size="16" fill="#334155">Patient: <tspan font-weight="bold">${escapeXml(patient)}</tspan></text>
    <text x="430" y="182" font-family="Arial" font-size="16" fill="#334155">Date: ${escapeXml(date)}</text>
    <text x="40" y="212" font-family="Arial" font-size="16" fill="#334155">Age / Sex: 34 Y / —</text>
    <line x1="40" y1="236" x2="600" y2="236" stroke="#e2e8f0" stroke-width="1"/>
    <text x="44" y="292" font-family="Georgia, serif" font-size="44" fill="#0f766e">℞</text>
    ${rows}
    <line x1="40" y1="700" x2="600" y2="700" stroke="#e2e8f0" stroke-width="1"/>
    <text x="40" y="732" font-family="Arial" font-size="14" fill="#64748b">Advice: Plenty of fluids. Review after 5 days if symptoms persist.</text>
    <text x="380" y="800" font-family="Georgia, serif" font-size="24" fill="#1e3a8a" font-style="italic">${escapeXml(doctor.replace("Dr. ", ""))}</text>
    <line x1="370" y1="812" x2="580" y2="812" stroke="#94a3b8" stroke-width="1"/>
    <text x="404" y="834" font-family="Arial" font-size="13" fill="#64748b">Signature &amp; Seal</text>
    <text x="40" y="862" font-family="Arial" font-size="11" fill="#94a3b8">SAMPLE DOCUMENT — generated for the DawaQuick prototype. Not a real prescription.</text>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Ready-made samples offered on the upload screen. */
export const SAMPLE_PRESCRIPTIONS = [
  {
    id: "sample-infection",
    label: "Antibiotic course",
    doctor: "Dr. Hiren Patel",
    lines: [
      "Tab. Azithromycin 500 mg — 1 OD × 3 days",
      "Cap. Amoxicillin 500 mg — 1 TDS × 5 days",
      "Tab. Paracetamol 650 mg — 1 SOS (fever)",
    ],
    medicines: [
      {
        name: "Azithromycin 500 mg",
        strength: "500 mg",
        dosage: "1 tablet once daily × 3 days",
        qty: 1,
        medicineId: "med_azithromycin",
      },
      {
        name: "Amoxicillin 500 mg",
        strength: "500 mg",
        dosage: "1 capsule three times daily × 5 days",
        qty: 2,
        medicineId: "med_amoxicillin",
      },
    ],
  },
  {
    id: "sample-chronic",
    label: "Monthly chronic refill",
    doctor: "Dr. Sneha Trivedi",
    lines: [
      "Tab. Telmisartan 40 mg — 1 OD × 30 days",
      "Tab. Atorvastatin 10 mg — 1 HS × 30 days",
      "Tab. Metformin 500 mg — 1 BD × 30 days",
    ],
    medicines: [
      {
        name: "Telmisartan 40 mg",
        strength: "40 mg",
        dosage: "1 tablet once daily",
        qty: 2,
        medicineId: "med_telmisartan",
      },
      {
        name: "Metformin 500 mg",
        strength: "500 mg",
        dosage: "1 tablet twice daily",
        qty: 2,
        medicineId: "med_metformin",
      },
    ],
  },
];
