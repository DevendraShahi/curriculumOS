import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { jsonError, jsonOk, mapServiceError } from "@/lib/http";
import { requireActorContext, resolveTenantId } from "@/lib/services/auth-context";
import {
  createCommunityThread,
  listCommunityThreads,
  parseThreadListParams,
} from "@/lib/services/community-service";
import type { ActorContext } from "@/lib/services/auth-context";
import { serverEnv } from "@/lib/server-env";

export async function GET(request: NextRequest) {
  try {
    const authState = await auth();
    let actor: ActorContext | null = null;

    try {
      actor = await requireActorContext(request);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "UNAUTHORIZED") {
        throw error;
      }
    }

    const tenantId =
      request.nextUrl.searchParams.get("tenantId") ||
      actor?.tenantId ||
      resolveTenantId(authState.orgId) ||
      serverEnv.APP_DEFAULT_TENANT_ID;

    const query = parseThreadListParams(request.nextUrl.searchParams);
    const result = await listCommunityThreads({
      tenantId,
      actor,
      ...query,
    });

    return jsonOk(result);
  } catch (error) {
    const mapped = mapServiceError(error);
    return jsonError(mapped.code, mapped.status);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireActorContext(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("INVALID_COMMUNITY_THREAD", 400);
    }

    const thread = await createCommunityThread(actor, body);
    return jsonOk(thread, 201);
  } catch (error) {
    const mapped = mapServiceError(error);
    return jsonError(mapped.code, mapped.status);
  }
}
