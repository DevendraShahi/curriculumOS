import type { NextConfig } from "next";

const isNextDevCommand = process.argv.includes("dev");
const isDevelopment = process.env.NODE_ENV === "development" || isNextDevCommand;

const nextConfig: NextConfig = {
  // Keep dev and production build artifacts isolated to avoid mixed chunk graphs.
  distDir: isDevelopment ? ".next-dev" : ".next",
  outputFileTracingRoot: "/Users/devendrashahithakuri/Work/curriculum/",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "images.clerk.dev" },
      { protocol: "https", hostname: "api.dicebear.com" },
    ],
  },
};

export default nextConfig;
