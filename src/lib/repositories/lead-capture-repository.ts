import { ObjectId, type Db } from "mongodb";
import { leadCapturesCollection } from "@/lib/db/collections";
import type { LeadCaptureDocument } from "@/lib/db/models";

export async function upsertLeadCapture(
  db: Db,
  params: {
    tenantId: string;
    email: string;
    fullName?: string;
    source: string;
    userId?: ObjectId | null;
    metadata?: Record<string, unknown>;
  }
): Promise<LeadCaptureDocument> {
  const now = new Date();
  const emailLower = params.email.toLowerCase();

  const document = await leadCapturesCollection(db).findOneAndUpdate(
    {
      tenantId: params.tenantId,
      emailLower,
    },
    {
      $set: {
        email: params.email,
        emailLower,
        fullName: params.fullName,
        source: params.source,
        userId: params.userId ?? null,
        status: "new",
        capturedAt: now,
        metadata: params.metadata,
        updatedAt: now,
      },
      $setOnInsert: {
        _id: new ObjectId(),
        tenantId: params.tenantId,
        createdAt: now,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
    }
  );

  if (!document) {
    throw new Error("INTERNAL_ERROR");
  }

  return document;
}
