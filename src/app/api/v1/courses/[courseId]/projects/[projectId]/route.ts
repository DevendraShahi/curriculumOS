import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { jsonError, jsonOk, mapServiceError } from "@/lib/http";
import { getProjectRuntime } from "@/lib/services/project-runtime-service";
import { requireActorContext, resolveTenantId } from "@/lib/services/auth-context";
import type { ActorContext } from "@/lib/services/auth-context";
import { serverEnv } from "@/lib/server-env";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ courseId: string; projectId: string }> }
) {
  try {
    const { courseId, projectId } = await context.params;
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

    const data = await getProjectRuntime({
      tenantId,
      courseIdOrSlug: courseId,
      projectIdOrSlug: projectId,
      actor,
    });

    return jsonOk(data);
  } catch (error) {
    const mapped = mapServiceError(error);
    return jsonError(mapped.code, mapped.status);
  }
}
