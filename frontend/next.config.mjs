/** @type {import('next').NextConfig} */
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  reactStrictMode: true,

  // ── Webpack config for path aliases ─────────────────────────────────────────
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@form-engine': path.resolve(__dirname, '../lib/src'),
    };
    return config;
  },

  // ── Security headers ────────────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self), payment=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self' http://localhost:8000 http://127.0.0.1:8000 https://api.anthropic.com",
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },

  // ── Dev proxy to FastAPI backend ────────────────────────────────────────────
  async rewrites() {
    const backend = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
    return [
      // Auth API — MUST come before the general /api/* rule.
      //
      // Why /api/auth/* instead of /auth/*?
      //   Next.js has a page at route /auth. Rewriting /auth/:path* here
      //   would intercept that page (Next.js :path* matches zero segments),
      //   proxying the login page to FastAPI instead of rendering it.
      //   Fronting it with /api/auth/* avoids any page-route collision.
      //
      // Why must it come before /api/*?
      //   /api/:path* also matches /api/auth/* but rewrites the destination
      //   to /api/auth/* on the backend — which doesn't exist there.
      //   This specific rule rewrites to /auth/* on the backend instead.
      {
        source: "/auth/:path*",
        destination: `${backend}/auth/:path*`,
      },
      {
        source: "/api/auth/:path*",
        destination: `${backend}/auth/:path*`,
      },
      // General API proxy — forms, submissions, categories, etc.
      {
        source: "/api/:path*",
        destination: `${backend}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
