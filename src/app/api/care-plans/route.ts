import { bad, guard, ok, readJson } from "@/lib/api";
import { carePlanRef, MAX_DOCUMENTS, MAX_DOCUMENT_BYTES } from "@/lib/care";
import { getStore } from "@/lib/db";
import { notify } from "@/lib/services";
import type {
  CarePlan,
  HealthDocument,
  HealthDocumentKind,
  Prescription,
  User,
} from "@/lib/types";
import { newId, prescriptionRef } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KINDS: HealthDocumentKind[] = ["LAB_REPORT", "PRESCRIPTION", "DISCHARGE_SUMMARY", "OTHER"];

/** GET /api/care-plans — customers see their own; the care team sees the queue. */
export async function GET(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  const { session } = g;

  const store = await getStore();
  let plans = await store.list<CarePlan>("carePlans");

  if (session.role === "customer") {
    plans = plans.filter((p) => p.customerId === session.userId);
  } else if (session.role !== "pharmacist" && session.role !== "admin") {
    return bad("Not allowed", 403);
  }

  const status = new URL(req.url).searchParams.get("status");
  if (status) plans = plans.filter((p) => p.status === status);

  plans.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  return ok({ carePlans: plans });
}

/**
 * POST /api/care-plans — the customer hands over their documents.
 *
 * An uploaded prescription is forked into a real Prescription record straight
 * away, so it enters the same verification queue as any other ℞. The care plan
 * never becomes a side door around pharmacist verification.
 */
export async function POST(req: Request) {
  const g = await guard("customer");
  if ("error" in g) return g.error;
  const { session } = g;

  const body = await readJson<{
    patientName?: string;
    patientAge?: number;
    condition?: string;
    hospitalName?: string;
    dischargeDate?: string;
    allergies?: string;
    note?: string;
    documents?: Array<{
      kind?: HealthDocumentKind;
      fileName?: string;
      mimeType?: string;
      fileData?: string;
      note?: string;
    }>;
  }>(req);

  const docs = body?.documents ?? [];
  if (docs.length === 0) return bad("Upload at least one document so we have something to read");
  if (docs.length > MAX_DOCUMENTS) return bad(`Please upload at most ${MAX_DOCUMENTS} documents`);

  const store = await getStore();
  const customer = await store.one<User>("users", { id: session.userId });
  if (!customer) return bad("Customer not found", 404);

  const now = new Date().toISOString();
  const documents: HealthDocument[] = [];

  for (const d of docs) {
    if (!d?.fileData || !d.fileName) return bad("Every document needs a file");
    if (d.fileData.length > MAX_DOCUMENT_BYTES) {
      return bad(`${d.fileName} is too large — please keep each file under 5 MB`, 413);
    }
    documents.push({
      id: newId("doc"),
      kind: KINDS.includes(d.kind as HealthDocumentKind) ? (d.kind as HealthDocumentKind) : "OTHER",
      fileName: d.fileName,
      mimeType: d.mimeType ?? "image/jpeg",
      fileData: d.fileData,
      note: d.note?.trim() || undefined,
      uploadedAt: now,
    });
  }

  const patientName = body?.patientName?.trim() || customer.name;

  /* A prescription in the pile goes to the verification desk on its own. */
  let prescriptionId: string | undefined;
  const rxDoc = documents.find((d) => d.kind === "PRESCRIPTION");
  if (rxDoc) {
    const prescription: Prescription = {
      id: newId("rx"),
      ref: prescriptionRef(),
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      patientName,
      fileName: rxDoc.fileName,
      mimeType: rxDoc.mimeType,
      fileData: rxDoc.fileData,
      note: `Submitted with a care plan request${body?.condition ? ` — ${body.condition}` : ""}`,
      extractedMedicines: [],
      status: "PENDING",
      createdAt: now,
    };
    await store.insert("prescriptions", prescription);
    prescriptionId = prescription.id;
  }

  const plan: CarePlan = {
    id: newId("cp"),
    ref: carePlanRef(),
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    patientName,
    patientAge: Number.isFinite(body?.patientAge) ? Number(body?.patientAge) : undefined,
    condition: body?.condition?.trim() || undefined,
    hospitalName: body?.hospitalName?.trim() || undefined,
    dischargeDate: body?.dischargeDate || undefined,
    allergies: body?.allergies?.trim() || undefined,
    customerNote: body?.note?.trim() || undefined,
    documents,
    status: "SUBMITTED",
    medicines: [],
    visits: [],
    followUps: [],
    prescriptionId,
    scheduled: { orderIds: [], bookingIds: [], subscriptionIds: [] },
    history: [{ status: "SUBMITTED", at: now, by: customer.name }],
    createdAt: now,
    updatedAt: now,
  };

  await store.insert("carePlans", plan);

  await notify(customer.id, {
    kind: "CARE_PLAN",
    title: "Documents received",
    body: `${plan.ref} is with our care team. We'll send a plan for your approval.`,
    href: `/care/${plan.id}`,
  });

  const careTeam = await store.list<User>("users", { role: "pharmacist" });
  for (const member of careTeam) {
    await notify(member.id, {
      kind: "CARE_PLAN",
      title: "New care plan request",
      body: `${plan.ref} · ${patientName}${plan.condition ? ` · ${plan.condition}` : ""} · ${documents.length} document(s)`,
      href: `/pharmacist/care-plans/${plan.id}`,
    });
  }

  return ok({ carePlan: plan }, 201);
}
