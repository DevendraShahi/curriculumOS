import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { jsonError, jsonOk, mapServiceError } from "@/lib/http";
import { resolveTenantId } from "@/lib/services/auth-context";
import { getPublicCourseByIdOrSlug } from "@/lib/services/course-service";
import { serverEnv } from "@/lib/server-env";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const requestedTenantId = searchParams.get("tenantId");
    const hasCookie = Boolean(request.headers.get("cookie"));
    let authOrgId: string | null = null;

    if (!requestedTenantId && hasCookie) {
      const authResult = await auth();
      authOrgId = authResult.orgId ?? null;
    }

    const tenantId =
      requestedTenantId ||
      resolveTenantId(authOrgId) ||
      serverEnv.APP_DEFAULT_TENANT_ID;

    const course = await getPublicCourseByIdOrSlug({
      tenantId,
      courseIdOrSlug: courseId,
    });

    if (!course) {
      return jsonError("COURSE_NOT_FOUND", 404);
    }

    const response = jsonOk(course);
    const isAnonymousDefaultTenant =
      !hasCookie &&
      tenantId === serverEnv.APP_DEFAULT_TENANT_ID &&
      !requestedTenantId;
    if (isAnonymousDefaultTenant) {
      response.headers.set(
        "Cache-Control",
        "public, s-maxage=120, stale-while-revalidate=600"
      );
    }
    return response;
  } catch (error) {
    const mapped = mapServiceError(error);
    return jsonError(mapped.code, mapped.status);
  }
}
