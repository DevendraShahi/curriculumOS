import "server-only";

type ServerEnv = {
  APP_DEFAULT_TENANT_ID: string;
  MONGODB_URI: string;
  MONGODB_DB_NAME: string;
  PROGRESS_WRITE_RATE_LIMIT_PER_MINUTE: number;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  CLOUDINARY_UPLOAD_FOLDER: string;
};

function requireEnv(name: keyof ServerEnv): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export const serverEnv: ServerEnv = {
  APP_DEFAULT_TENANT_ID: process.env.APP_DEFAULT_TENANT_ID || "public",
  MONGODB_URI: requireEnv("MONGODB_URI"),
  MONGODB_DB_NAME: requireEnv("MONGODB_DB_NAME"),
  PROGRESS_WRITE_RATE_LIMIT_PER_MINUTE: parsePositiveInteger(
    process.env.PROGRESS_WRITE_RATE_LIMIT_PER_MINUTE,
    30
  ),
  CLOUDINARY_CLOUD_NAME: requireEnv("CLOUDINARY_CLOUD_NAME"),
  CLOUDINARY_API_KEY: requireEnv("CLOUDINARY_API_KEY"),
  CLOUDINARY_API_SECRET: requireEnv("CLOUDINARY_API_SECRET"),
  CLOUDINARY_UPLOAD_FOLDER:
    process.env.CLOUDINARY_UPLOAD_FOLDER || "curriculum-os",
};
