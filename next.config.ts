import type { NextConfig } from "next";
import path from "path";

const isNextDevCommand = process.argv.includes("dev");
const isDevelopment = process.env.NODE_ENV === "development" || isNextDevCommand;

const nextConfig: NextConfig = {
  // Keep dev and production build artifacts isolated to avoid mixed chunk graphs.
  distDir: isDevelopment ? ".next-dev" : ".next",
  outputFileTracingRoot: path.join(__dirname, "..", ".."),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "images.clerk.dev" },
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "127.0.0.1:3000",
        "localhost:3002",
        "127.0.0.1:3002",
        "192.168.2.164:3000",
        "192.168.2.164:3002",
      ],
    },
  },
};

export default nextConfig;
