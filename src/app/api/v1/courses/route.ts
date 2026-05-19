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
    const authResult = await auth();
    const searchParams = request.nextUrl.searchParams;

    const tenantId =
      searchParams.get("tenantId") ||
      resolveTenantId(authResult.orgId) ||
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

    return jsonOk({
      tenantId,
      items: courses.items,
      count: courses.items.length,
      pageInfo: courses.pageInfo,
    });
  } catch (error) {
    const mapped = mapServiceError(error);
    return jsonError(mapped.code, mapped.status);
  }
}
