import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { pingCloudinary } from "@/lib/cloudinary";
import { pingMongo } from "@/lib/mongodb";

type CheckResult = {
  ok: boolean;
  error: string | null;
};

function normalizeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

export async function GET() {
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

  const checks: {
    mongodb: CheckResult;
    cloudinary: CheckResult;
  } = {
    mongodb: { ok: false, error: null },
    cloudinary: { ok: false, error: null },
  };

  try {
    checks.mongodb.ok = await pingMongo();
  } catch (error) {
    checks.mongodb.error = normalizeError(error);
  }

  try {
    checks.cloudinary.ok = await pingCloudinary();
  } catch (error) {
    checks.cloudinary.error = normalizeError(error);
  }

  const ok = checks.mongodb.ok && checks.cloudinary.ok;

  return NextResponse.json(
    {
      ok,
      checkedAt: new Date().toISOString(),
      checks,
    },
    { status: ok ? 200 : 503 }
  );
}
