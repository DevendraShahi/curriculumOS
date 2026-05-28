import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/**
 * Checks if the current user has the "admin" role.
 * If not, redirects them to the homepage.
 * Safe to use in Server Components and Server Actions.
 */
export async function requireAdmin() {
  const authObject = await auth();
  
  if (!authObject.userId) {
    redirect("/sign-in");
  }

  if (authObject.sessionClaims?.metadata?.role !== "admin") {
    redirect("/");
  }

  return authObject;
}
