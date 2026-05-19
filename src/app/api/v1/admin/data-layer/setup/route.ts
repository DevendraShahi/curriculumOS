import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ensureDataLayer } from "@/lib/db/data-layer";
import { getMongoDb } from "@/lib/mongodb";

export async function POST() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized",
      },
      { status: 401 }
    );
  }

  try {
    const db = await getMongoDb();
    const result = await ensureDataLayer(db);

    return NextResponse.json({
      ok: true,
      checkedAt: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
