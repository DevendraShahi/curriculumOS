import "server-only";

import { v2 as cloudinary } from "cloudinary";
import { serverEnv } from "@/lib/server-env";

let configured = false;

function requireCloudinaryEnv() {
  const cloudName = serverEnv.CLOUDINARY_CLOUD_NAME;
  const apiKey = serverEnv.CLOUDINARY_API_KEY;
  const apiSecret = serverEnv.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary environment is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
    );
  }

  return { cloudName, apiKey, apiSecret };
}

function getCloudinary() {
  if (!configured) {
    const { cloudName, apiKey, apiSecret } = requireCloudinaryEnv();
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
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
  const { cloudName, apiKey, apiSecret } = requireCloudinaryEnv();
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
    apiSecret
  );

  return {
    cloudName,
    apiKey,
    timestamp,
    signature,
    folder,
    publicId: options?.publicId ?? null,
  };
}
