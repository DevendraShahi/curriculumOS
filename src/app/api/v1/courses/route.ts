import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { jsonError, jsonOk, mapServiceError } from "@/lib/http";
import { resolveTenantId } from "@/lib/services/auth-context";
import {
  listPublicCoursesCatalog,
  parseCourseCursor,
  parseCourseLevel,
  parseCourseLimit,
  parseCourseSort,
} from "@/lib/services/course-service";
import { serverEnv } from "@/lib/server-env";

function normalizeOptional(value: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export async function GET(request: NextRequest) {
  try {
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

    const courses = await listPublicCoursesCatalog({
      tenantId,
      limit: parseCourseLimit(searchParams.get("limit")),
      search: normalizeOptional(searchParams.get("q")),
      category: normalizeOptional(searchParams.get("category")),
      level: parseCourseLevel(searchParams.get("level")),
      tag: normalizeOptional(searchParams.get("tag")),
      sort: parseCourseSort(searchParams.get("sort")),
      cursor: parseCourseCursor(searchParams.get("cursor")),
    });

    const response = jsonOk({
      tenantId,
      items: courses.items,
      count: courses.items.length,
      pageInfo: courses.pageInfo,
    });
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
