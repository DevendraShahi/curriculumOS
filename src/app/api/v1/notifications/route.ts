import { NextRequest } from "next/server";
import { jsonError, jsonOk, mapServiceError } from "@/lib/http";
import { requireActorContext } from "@/lib/services/auth-context";
import {
  listCurrentActorNotifications,
  parseNotificationCursor,
  parseNotificationLimit,
  parseUnreadOnly,
} from "@/lib/services/notification-service";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireActorContext(request);
    const searchParams = request.nextUrl.searchParams;

    const result = await listCurrentActorNotifications(actor, {
      limit: parseNotificationLimit(searchParams.get("limit")),
      cursor: parseNotificationCursor(searchParams.get("cursor")),
      unreadOnly: parseUnreadOnly(searchParams.get("unreadOnly")),
    });

    return jsonOk(result);
  } catch (error) {
    const mapped = mapServiceError(error);
    return jsonError(mapped.code, mapped.status);
  }
}
