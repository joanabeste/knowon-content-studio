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
  // Baseline security response headers. Intentionally no CSP here —
  // Next.js still emits inline styles/scripts during hydration and
  // a strict CSP needs per-request nonces (a dedicated middleware
  // pass). The headers below cover the common, easy wins:
  // - X-Frame-Options DENY → no clickjacking via iframe
  // - X-Content-Type-Options nosniff → no MIME sniffing games
  // - Referrer-Policy → don't leak internal URLs to outbound links
  // - HSTS → force HTTPS for two years, include subdomains
  // - Permissions-Policy → explicitly disable the sensor APIs we
  //   don't use, so a compromised 3rd-party script can't probe them
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
