import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "sharp", "pg"],
  images: { unoptimized: true },
  poweredByHeader: false,
  // Polices utilisées pour fabriquer les visuels réseaux sociaux
  outputFileTracingIncludes: { "/**/*": ["./assets/fonts/**"] },
  async redirects() {
    // Anciennes adresses de passe-d.net
    return [
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/login.html", destination: "/admin/login", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
