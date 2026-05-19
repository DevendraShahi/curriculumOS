import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { jsonError, jsonOk, mapServiceError } from "@/lib/http";
import {
  listPublicProjectsService,
  parseProjectLimit,
} from "@/lib/services/project-service";
import {
  requireActorContext,
  resolveTenantId,
  type ActorContext,
} from "@/lib/services/auth-context";
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

    const items = await listPublicProjectsService({
      tenantId,
      actor,
      limit: parseProjectLimit(request.nextUrl.searchParams.get("limit")),
    });

    return jsonOk({
      tenantId,
      items,
      count: items.length,
    });
  } catch (error) {
    const mapped = mapServiceError(error);
    return jsonError(mapped.code, mapped.status);
  }
}
