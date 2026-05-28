import "server-only";

import { getMongoDb } from "@/lib/mongodb";
import { COLLECTIONS } from "@/lib/db/collections";
import type { SandboxSessionDocument } from "@/lib/db/models";
import type { SandboxLanguage } from "@/lib/sandbox/types";

type GetSandboxSessionInput = {
  userId: string;
  lessonId: string;
  exerciseId: string;
};

export async function getSandboxSession({
  userId,
  lessonId,
  exerciseId,
}: GetSandboxSessionInput) {
  const db = await getMongoDb();

  const session = await db
    .collection<SandboxSessionDocument>(COLLECTIONS.sandboxSessions)
    .findOne({
      userId,
      lessonId,
      exerciseId,
    });

  if (!session) return null;

  return {
    files: session.files.map((f) => ({
      ...f,
      language: f.language as SandboxLanguage,
    })),
    openFileIds: session.openFileIds,
    activeFileId: session.activeFileId,
    updatedAt: session.updatedAt,
  };
}
