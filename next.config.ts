import type { NextConfig } from 'next';

/**
 * Two build modes:
 *  - default: a normal Next.js server (Vercel, Cloud Run).
 *  - STATIC_EXPORT=1: plain files in out/ for GitHub Pages or any static host. Used for the
 *    installable demo together with NEXT_PUBLIC_API_MOCK=1. NEXT_PUBLIC_BASE_PATH is the
 *    sub-path the site lives under, e.g. "/servenow-portal" for <user>.github.io/servenow-portal.
 */
const isStaticExport = process.env.STATIC_EXPORT === '1';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  basePath,
  ...(isStaticExport
    ? {
        output: 'export',
        trailingSlash: true, // /jobs/ → jobs/index.html, which static hosts serve without rewrites
        images: { unoptimized: true },
      }
    : {
        // Static hosts can't send headers; the server build does (Blueprint §10 security questionnaires).
        async headers() {
          return [{ source: '/(.*)', headers: securityHeaders }];
        },
      }),
};

export default nextConfig;
