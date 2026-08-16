import { bad, guard, ok, readJson } from "@/lib/api";
import { getStore } from "@/lib/db";
import type { ProviderCredential, ServiceProvider } from "@/lib/types";
import { newId } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** `me` resolves to the signed-in provider's own record. */
async function resolve(id: string, userId: string): Promise<ServiceProvider | null> {
  const store = await getStore();
  return id === "me"
    ? store.one<ServiceProvider>("providers", { userId })
    : store.one<ServiceProvider>("providers", { id });
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const g = await guard();
  if ("error" in g) return g.error;

  const provider = await resolve(id, g.session.userId);
  if (!provider) return bad("Provider not found", 404);
  return ok({ provider });
}

/**
 * PATCH /api/providers/:id
 *   provider (own record): profile | availability | add_credential
 *   admin:                 verify | approve | suspend | reactivate | verify_credential
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("provider", "admin");
  if ("error" in g) return g.error;
  const { session } = g;

  const { id } = await ctx.params;
  const provider = await resolve(id, session.userId);
  if (!provider) return bad("Provider not found", 404);

  const isOwner = provider.userId === session.userId;
  const isAdmin = session.role === "admin";
  if (!isOwner && !isAdmin) return bad("Not allowed", 403);

  const body = await readJson<{
    action?: string;
    profile?: Partial<ServiceProvider>;
    credentialId?: string;
    credential?: { name?: string; fileName?: string };
  }>(req);

  const store = await getStore();

  switch (body?.action) {
    /* ------------------------------ provider ----------------------------- */
    case "profile": {
      if (!isOwner && !isAdmin) return bad("Not allowed", 403);
      const p = body.profile ?? {};
      // Verification state and identity are never self-editable.
      const patch: Partial<ServiceProvider> = {
        headline: p.headline ?? provider.headline,
        bio: p.bio ?? provider.bio,
        qualifications: p.qualifications ?? provider.qualifications,
        experienceYears: p.experienceYears ?? provider.experienceYears,
        languages: p.languages ?? provider.languages,
        specialities: p.specialities ?? provider.specialities,
        serviceAreas: p.serviceAreas ?? provider.serviceAreas,
        serviceRadiusKm: p.serviceRadiusKm ?? provider.serviceRadiusKm,
        hourlyRate: p.hourlyRate ?? provider.hourlyRate,
      };
      const updated = await store.update<ServiceProvider>("providers", provider.id, patch);
      return ok({ provider: updated });
    }

    case "availability": {
      const availability = body.profile?.availability;
      if (!availability) return bad("availability required");
      const updated = await store.update<ServiceProvider>("providers", provider.id, {
        availability,
      });
      return ok({ provider: updated });
    }

    case "add_credential": {
      if (!body.credential?.name) return bad("Credential name required");
      const credential: ProviderCredential = {
        id: newId("cred"),
        name: body.credential.name,
        // Prototype records the filename only — production uploads to storage.
        fileName: body.credential.fileName ?? "credential.pdf",
        uploadedAt: new Date().toISOString(),
        status: "PENDING",
      };
      const updated = await store.update<ServiceProvider>("providers", provider.id, {
        credentials: [...provider.credentials, credential],
      });
      return ok({ provider: updated });
    }

    /* -------------------------------- admin ------------------------------ */
    case "verify_credential": {
      if (!isAdmin) return bad("Only an admin can verify credentials", 403);
      const credentials = provider.credentials.map((c) =>
        c.id === body.credentialId ? { ...c, status: "VERIFIED" as const } : c,
      );
      const updated = await store.update<ServiceProvider>("providers", provider.id, {
        credentials,
      });
      return ok({ provider: updated });
    }

    case "verify":
    case "approve": {
      if (!isAdmin) return bad("Only an admin can approve providers", 403);
      if (!provider.credentials.length) {
        return bad("Provider has not uploaded any credentials yet", 409);
      }
      const updated = await store.update<ServiceProvider>("providers", provider.id, {
        verified: true,
        status: "ACTIVE",
        credentials: provider.credentials.map((c) => ({ ...c, status: "VERIFIED" as const })),
      });
      return ok({ provider: updated });
    }

    case "suspend": {
      if (!isAdmin) return bad("Only an admin can suspend providers", 403);
      const updated = await store.update<ServiceProvider>("providers", provider.id, {
        status: "SUSPENDED",
      });
      return ok({ provider: updated });
    }

    case "reactivate": {
      if (!isAdmin) return bad("Only an admin can reactivate providers", 403);
      const updated = await store.update<ServiceProvider>("providers", provider.id, {
        status: "ACTIVE",
      });
      return ok({ provider: updated });
    }

    default:
      return bad(`Unknown action "${body?.action}"`);
  }
}
