import { bad, guard, ok, readJson } from "@/lib/api";
import { getStore } from "@/lib/db";
import { notify } from "@/lib/services";
import type { Prescription, PrescriptionMedicine, User } from "@/lib/types";
import { newId, prescriptionRef } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** GET — customers see their own; pharmacists/admin see the verification queue. */
export async function GET(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  const { session } = g;

  const store = await getStore();
  let list = await store.list<Prescription>("prescriptions");

  if (session.role === "customer") {
    list = list.filter((p) => p.customerId === session.userId);
  } else if (session.role !== "pharmacist" && session.role !== "admin") {
    return bad("Not allowed", 403);
  }

  const status = new URL(req.url).searchParams.get("status");
  if (status) list = list.filter((p) => p.status === status);

  list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  return ok({ prescriptions: list });
}

/** POST — customer uploads a prescription for pharmacist verification. */
export async function POST(req: Request) {
  const g = await guard("customer");
  if ("error" in g) return g.error;
  const { session } = g;

  const body = await readJson<{
    fileName?: string;
    mimeType?: string;
    fileData?: string;
    patientName?: string;
    doctorName?: string;
    note?: string;
    medicines?: PrescriptionMedicine[];
  }>(req);

  if (!body?.fileData || !body.fileName) return bad("A prescription file is required");
  if (body.fileData.length > 8_000_000) return bad("File too large — please upload under 5 MB", 413);

  const store = await getStore();
  const customer = await store.one<User>("users", { id: session.userId });
  if (!customer) return bad("Customer not found", 404);

  const prescription: Prescription = {
    id: newId("rx"),
    ref: prescriptionRef(),
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    patientName: body.patientName?.trim() || customer.name,
    doctorName: body.doctorName?.trim() || undefined,
    fileName: body.fileName,
    mimeType: body.mimeType ?? "image/jpeg",
    fileData: body.fileData,
    note: body.note?.trim() || undefined,
    // Real deployments run OCR here (see OCR_API_KEY placeholder); the prototype
    // lets the pharmacist enter/confirm the lines during review.
    extractedMedicines: body.medicines ?? [],
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };

  await store.insert("prescriptions", prescription);

  await notify(customer.id, {
    kind: "PRESCRIPTION",
    title: "Prescription submitted",
    body: `${prescription.ref} is queued for pharmacist verification.`,
    href: `/prescriptions/${prescription.id}`,
  });

  const pharmacists = await store.list<User>("users", { role: "pharmacist" });
  for (const p of pharmacists) {
    await notify(p.id, {
      kind: "PRESCRIPTION",
      title: "New prescription to verify",
      body: `${prescription.ref} from ${customer.name} is awaiting review.`,
      href: `/pharmacist/${prescription.id}`,
    });
  }

  return ok({ prescription }, 201);
}
