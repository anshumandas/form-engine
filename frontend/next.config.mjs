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
          // Prevent clickjacking
          { key: "X-Frame-Options", value: "DENY" },
          // Prevent MIME sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Referrer policy
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // XSS protection (legacy browsers)
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // Permissions policy
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self), payment=()",
          },
          // Content Security Policy
          // NOTE: unsafe-eval is intentionally added — required for Next.js dev hot-reloading.
          // unsafe-inline is limited to styles only (required by Tailwind inline styles).
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",   // Next.js needs unsafe-eval for dev hot-reload
              "style-src 'self' 'unsafe-inline'",    // Tailwind inline styles
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
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
