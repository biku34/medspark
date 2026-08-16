"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight, FileText, Upload } from "lucide-react";
import { CustomerShell } from "@/components/customer-shell";
import { ComplianceNote } from "@/components/brand";
import { useApp } from "@/components/providers";
import { Badge, Button, Card, EmptyState, SectionTitle, Skeleton } from "@/components/ui";
import { api } from "@/lib/client";
import { PRESCRIPTION_LABELS, type Prescription, type PrescriptionStatus } from "@/lib/types";
import { dateTime } from "@/lib/utils";

const TONE: Record<PrescriptionStatus, "amber" | "green" | "red" | "blue" | "slate"> = {
  PENDING: "amber",
  IN_REVIEW: "blue",
  CLARIFICATION: "amber",
  APPROVED: "green",
  REJECTED: "red",
};

export default function PrescriptionsPage() {
  const { user, userLoading } = useApp();
  const router = useRouter();
  const [list, setList] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    api<{ prescriptions: Prescription[] }>("/api/prescriptions")
      .then((d) => setList(d.prescriptions))
      .finally(() => setLoading(false));
  }, [user, userLoading]);

  return (
    <CustomerShell>
      <SectionTitle
        title="My Prescriptions"
        subtitle="Upload history and verification status"
        action={
          <Button size="sm" icon={<Upload size={14} />} onClick={() => router.push("/prescriptions/upload")}>
            Upload
          </Button>
        }
      />

      <ComplianceNote className="mb-4" variant="short" />

      {!user && !userLoading ? (
        <EmptyState
          icon={<FileText size={38} />}
          title="Sign in to see your prescriptions"
          action={<Button onClick={() => router.push("/login?next=/prescriptions")}>Sign in</Button>}
        />
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<FileText size={38} />}
          title="No prescriptions uploaded yet"
          body="Upload a prescription and a registered pharmacist will verify it, usually within a few minutes."
          action={
            <Button onClick={() => router.push("/prescriptions/upload")}>Upload Prescription</Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {list.map((p) => (
            <li key={p.id}>
              <Link href={`/prescriptions/${p.id}`}>
                <Card className="flex items-center gap-3.5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink-50">
                    <FileText size={20} className="text-ink-500" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                      {p.ref}
                      <Badge tone={TONE[p.status]}>{PRESCRIPTION_LABELS[p.status]}</Badge>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-ink-500">
                      {p.patientName} · {dateTime(p.createdAt)}
                    </p>
                    {p.extractedMedicines.length > 0 && (
                      <p className="mt-0.5 truncate text-xs text-ink-400">
                        {p.extractedMedicines.map((m) => m.name).join(", ")}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-ink-400" />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </CustomerShell>
  );
}
