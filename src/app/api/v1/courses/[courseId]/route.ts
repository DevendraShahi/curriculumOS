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
    const authResult = await auth();
    const tenantId =
      request.nextUrl.searchParams.get("tenantId") ||
      resolveTenantId(authResult.orgId) ||
      serverEnv.APP_DEFAULT_TENANT_ID;

    const course = await getPublicCourseByIdOrSlug({
      tenantId,
      courseIdOrSlug: courseId,
    });

    if (!course) {
      return jsonError("COURSE_NOT_FOUND", 404);
    }

    return jsonOk(course);
  } catch (error) {
    const mapped = mapServiceError(error);
    return jsonError(mapped.code, mapped.status);
  }
}
