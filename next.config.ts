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
};

export default nextConfig;
