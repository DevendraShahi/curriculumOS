import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createSignedUploadParams } from "@/lib/cloudinary";

type RequestBody = {
  folder?: string;
  publicId?: string;
};

function isString(value: unknown): value is string {
  return typeof value === "string";
}

export async function POST(request: NextRequest) {
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

  let body: RequestBody = {};

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    body = {};
  }

  const folder = isString(body.folder) && body.folder.trim() ? body.folder.trim() : undefined;
  const publicId =
    isString(body.publicId) && body.publicId.trim() ? body.publicId.trim() : undefined;

  const signedParams = createSignedUploadParams({
    folder,
    publicId,
  });

  return NextResponse.json({
    ok: true,
    ...signedParams,
  });
}
