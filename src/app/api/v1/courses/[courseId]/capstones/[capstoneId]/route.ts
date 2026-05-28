import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { jsonError, jsonOk, mapServiceError } from "@/lib/http";
import { getCapstoneRuntime } from "@/lib/services/capstone-runtime-service";
import { requireActorContext, resolveTenantId } from "@/lib/services/auth-context";
import type { ActorContext } from "@/lib/services/auth-context";
import { serverEnv } from "@/lib/server-env";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ courseId: string; capstoneId: string }> }
) {
  try {
    const { courseId, capstoneId } = await context.params;
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

    const data = await getCapstoneRuntime({
      tenantId,
      courseIdOrSlug: courseId,
      capstoneIdOrSlug: capstoneId,
      actor,
    });

    return jsonOk(data);
  } catch (error) {
    const mapped = mapServiceError(error);
    return jsonError(mapped.code, mapped.status);
  }
}
