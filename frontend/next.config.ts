import type { NextConfig } from "next";

// The browser only talks to this Next.js app; /api/* is proxied to the NestJS backend,
// so the login cookie stays first-party on the frontend's domain.
const API_URL = process.env.API_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
