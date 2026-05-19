import { auth } from "@clerk/nextjs/server";
import { getMongoDb } from "@/lib/mongodb";
import { upsertLeadCapture } from "@/lib/repositories/lead-capture-repository";
import { getUserByClerkId } from "@/lib/repositories/user-repository";
import { resolveTenantId } from "@/lib/services/auth-context";
import { serverEnv } from "@/lib/server-env";

type LeadCaptureDto = {
  id: string;
  email: string;
  fullName: string | null;
  source: string;
  status: "new" | "contacted" | "unsubscribed";
  capturedAt: string;
  updatedAt: string;
};

function normalizeOptionalString(
  value: unknown,
  options: { maxLength: number }
): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.length > options.maxLength) {
    throw new Error("INVALID_LEAD_CAPTURE");
  }
  return normalized;
}

function normalizeEmail(value: unknown): string {
  const email = normalizeOptionalString(value, { maxLength: 254 });
  if (!email) {
    throw new Error("INVALID_LEAD_CAPTURE");
  }

  // Intentionally practical validation, not full RFC parsing.
  const basicEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!basicEmailPattern.test(email)) {
    throw new Error("INVALID_LEAD_CAPTURE");
  }

  return email;
}

function normalizeSource(value: unknown): string {
  const source = normalizeOptionalString(value, { maxLength: 80 }) ?? "newsletter";
  const sourcePattern = /^[a-zA-Z0-9:_-]+$/;
  if (!sourcePattern.test(source)) {
    throw new Error("INVALID_LEAD_CAPTURE");
  }
  return source;
}

function normalizeMetadata(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("INVALID_LEAD_CAPTURE");
  }
  return value as Record<string, unknown>;
}

export function resolveLeadCaptureTenantId(
  request: Request,
  orgId: string | null | undefined
): string {
  const url = new URL(request.url);
  return (
    url.searchParams.get("tenantId") ||
    resolveTenantId(orgId) ||
    serverEnv.APP_DEFAULT_TENANT_ID
  );
}

export async function captureNewsletterLead(
  request: Request,
  input: unknown
): Promise<LeadCaptureDto> {
  if (!input || typeof input !== "object") {
    throw new Error("INVALID_LEAD_CAPTURE");
  }

  const payload = input as {
    email?: unknown;
    fullName?: unknown;
    source?: unknown;
    metadata?: unknown;
  };

  const authState = await auth();
  const tenantId = resolveLeadCaptureTenantId(request, authState.orgId);
  const email = normalizeEmail(payload.email);
  const fullName = normalizeOptionalString(payload.fullName, { maxLength: 120 });
  const source = normalizeSource(payload.source);
  const metadata = normalizeMetadata(payload.metadata);

  const db = await getMongoDb();

  let userId = null;
  if (authState.userId) {
    const user = await getUserByClerkId(db, tenantId, authState.userId);
    userId = user?._id ?? null;
  }

  const lead = await upsertLeadCapture(db, {
    tenantId,
    email,
    fullName,
    source,
    userId,
    metadata,
  });

  return {
    id: lead._id.toString(),
    email: lead.email,
    fullName: lead.fullName ?? null,
    source: lead.source,
    status: lead.status,
    capturedAt: lead.capturedAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };
}
