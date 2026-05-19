import { NextRequest } from "next/server";
import { jsonError, jsonOk, mapServiceError } from "@/lib/http";
import { requireActorContext } from "@/lib/services/auth-context";
import { markCurrentActorNotificationRead } from "@/lib/services/notification-service";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ notificationId: string }> }
) {
  try {
    const actor = await requireActorContext(request);
    const { notificationId } = await context.params;
    const notification = await markCurrentActorNotificationRead(
      actor,
      notificationId
    );
    return jsonOk(notification);
  } catch (error) {
    const mapped = mapServiceError(error);
    return jsonError(mapped.code, mapped.status);
  }
}
