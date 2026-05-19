import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { jsonError, jsonOk, mapServiceError } from "@/lib/http";
import { resolveTenantId } from "@/lib/services/auth-context";
import { getDashboardHomeData } from "@/lib/services/dashboard-home-service";
import { serverEnv } from "@/lib/server-env";

export async function GET(request: NextRequest) {
  try {
    const authResult = await auth();
    const tenantId =
      request.nextUrl.searchParams.get("tenantId") ||
      resolveTenantId(authResult.orgId) ||
      serverEnv.APP_DEFAULT_TENANT_ID;

    const data = await getDashboardHomeData({ tenantId });
    return jsonOk(data);
  } catch (error) {
    const mapped = mapServiceError(error);
    return jsonError(mapped.code, mapped.status);
  }
}

