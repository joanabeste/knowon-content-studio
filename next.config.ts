import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Silence multi-lockfile warning and pin to this project root.
  outputFileTracingRoot: path.join(__dirname),
  // Sharp is a native module — keep it external to the server bundle
  // so Vercel installs the prebuilt binaries correctly.
  serverExternalPackages: ["sharp", "pdf-parse"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.knowon.de" },
    ],
  },
  // Silence webpack's "Serializing big strings" performance hint from
  // its PackFileCacheStrategy. It's a build-cache optimization warning
  // triggered by pdf-parse / sharp internals and doesn't affect
  // correctness. Errors still show.
  webpack(config) {
    config.infrastructureLogging = {
      ...config.infrastructureLogging,
      level: "error",
    };
    return config;
  },
};

export default nextConfig;
