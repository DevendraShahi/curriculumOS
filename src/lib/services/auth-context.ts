import {
  auth,
  currentUser,
  type User as ClerkBackendUser,
} from "@clerk/nextjs/server";
import { serverEnv } from "@/lib/server-env";

export type ActorContext = {
  clerkUserId: string;
  tenantId: string;
  orgId: string | null;
  clerkUser: ClerkBackendUser;
};

export function resolveTenantId(orgId: string | null | undefined): string {
  return orgId || serverEnv.APP_DEFAULT_TENANT_ID;
}

function resolveTestActorContext(request?: Request): ActorContext | null {
  const isTestRuntime =
    process.env.NODE_ENV === "test" ||
    Boolean(process.env.NEXT_TEST_MODE) ||
    Boolean(process.env.__NEXT_TEST_MODE);
  if (!isTestRuntime) return null;

  const bypassSecret = process.env.TEST_AUTH_BYPASS_SECRET?.trim();
  if (!bypassSecret || !request) return null;
  if (request.headers.get("x-test-auth-bypass") !== bypassSecret) return null;

  const userId = request.headers.get("x-test-user-id")?.trim();
  if (!userId) {
    throw new Error("UNAUTHORIZED");
  }

  const tenantId =
    request.headers.get("x-test-tenant-id")?.trim() || resolveTenantId(null);
  const email =
    request.headers.get("x-test-user-email")?.trim() ||
    `${userId}@test.local`;
  const username = request.headers.get("x-test-user-username")?.trim() || userId;
  const firstName = request.headers.get("x-test-user-first-name")?.trim() || "Test";
  const lastName = request.headers.get("x-test-user-last-name")?.trim() || "User";
  const fullName = `${firstName} ${lastName}`.trim();

  const clerkUser = {
    id: userId,
    username,
    firstName,
    lastName,
    fullName,
    imageUrl: null,
    twoFactorEnabled: false,
    publicMetadata: {},
    privateMetadata: {},
    unsafeMetadata: {},
    lastSignInAt: Date.now(),
    primaryEmailAddress: {
      emailAddress: email,
    },
    emailAddresses: [
      {
        emailAddress: email,
        verification: {
          status: "verified",
        },
      },
    ],
  } as unknown as ClerkBackendUser;

  return {
    clerkUserId: userId,
    orgId: null,
    tenantId,
    clerkUser,
  };
}

export async function requireActorContext(request?: Request): Promise<ActorContext> {
  const testActor = resolveTestActorContext(request);
  if (testActor) return testActor;

  const { userId, orgId } = await auth();

  if (!userId) {
    throw new Error("UNAUTHORIZED");
  }

  const clerkUser = await currentUser();
  if (!clerkUser) {
    throw new Error("UNAUTHORIZED");
  }

  return {
    clerkUserId: userId,
    orgId: orgId ?? null,
    tenantId: resolveTenantId(orgId),
    clerkUser,
  };
}
