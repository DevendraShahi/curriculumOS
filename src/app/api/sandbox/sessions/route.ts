import { NextResponse } from "next/server";
import { getMongoDb } from "@/lib/mongodb";
import { COLLECTIONS } from "@/lib/db/collections";
import { requireActorContext } from "@/lib/services/auth-context";

export async function POST(request: Request) {
  try {
    let actor;
    try {
      actor = await requireActorContext(request);
    } catch (_e) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const userId = actor.clerkUserId;

    const body = await request.json();

    if (
      !body.lessonId ||
      !body.exerciseId ||
      !Array.isArray(body.files) ||
      !Array.isArray(body.openFileIds)
    ) {
      return NextResponse.json(
        { error: "Invalid sandbox session payload." },
        { status: 400 }
      );
    }

    const db = await getMongoDb();
    const updatedAt = new Date();

    await db.collection(COLLECTIONS.sandboxSessions).findOneAndUpdate(
      {
        userId,
        lessonId: body.lessonId,
        exerciseId: body.exerciseId,
      },
      {
        $set: {
          files: body.files,
          openFileIds: body.openFileIds,
          activeFileId: body.activeFileId ?? null,
          updatedAt,
        },
        $setOnInsert: {
          createdAt: updatedAt,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
      }
    );

    return NextResponse.json({
      ok: true,
      savedAt: updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("[SANDBOX_SESSION_SAVE_ERROR]", error);

    return NextResponse.json(
      { error: "Failed to save sandbox session." },
      { status: 500 }
    );
  }
}
