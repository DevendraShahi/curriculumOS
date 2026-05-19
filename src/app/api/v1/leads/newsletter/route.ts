import { NextRequest } from "next/server";
import { jsonError, jsonOk, mapServiceError } from "@/lib/http";
import { captureNewsletterLead } from "@/lib/services/lead-capture-service";

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("INVALID_LEAD_CAPTURE", 400);
    }

    const lead = await captureNewsletterLead(request, body);
    return jsonOk(lead, 201);
  } catch (error) {
    const mapped = mapServiceError(error);
    return jsonError(mapped.code, mapped.status);
  }
}
