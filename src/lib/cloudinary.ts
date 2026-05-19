import "server-only";

import { v2 as cloudinary } from "cloudinary";
import { serverEnv } from "@/lib/server-env";

let configured = false;

function getCloudinary() {
  if (!configured) {
    cloudinary.config({
      cloud_name: serverEnv.CLOUDINARY_CLOUD_NAME,
      api_key: serverEnv.CLOUDINARY_API_KEY,
      api_secret: serverEnv.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }

  return cloudinary;
}

export async function pingCloudinary(): Promise<boolean> {
  const cld = getCloudinary();
  const result = await cld.api.ping();
  return result?.status === "ok";
}

type SignedUploadOptions = {
  folder?: string;
  publicId?: string;
};

export function createSignedUploadParams(options?: SignedUploadOptions) {
  const cld = getCloudinary();
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = options?.folder || serverEnv.CLOUDINARY_UPLOAD_FOLDER;

  const paramsToSign: Record<string, string | number> = {
    folder,
    timestamp,
  };

  if (options?.publicId) {
    paramsToSign.public_id = options.publicId;
  }

  const signature = cld.utils.api_sign_request(
    paramsToSign,
    serverEnv.CLOUDINARY_API_SECRET
  );

  return {
    cloudName: serverEnv.CLOUDINARY_CLOUD_NAME,
    apiKey: serverEnv.CLOUDINARY_API_KEY,
    timestamp,
    signature,
    folder,
    publicId: options?.publicId ?? null,
  };
}
