import path from "path";
import type { NextConfig } from "next";

const supabaseOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : 'https:';
  } catch {
    return 'https:';
  }
})();
const supabaseWsOrigin = supabaseOrigin.replace(/^https:/, 'wss:');
const scriptSource = process.env.NODE_ENV === 'development'
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

const nextConfig: NextConfig = {
  // Note: To ignore ESLint errors during builds, use: next build --no-lint

  // This app lives inside the mind-ai-tutor monorepo as an independently
  // deployed sibling (its own package.json/lockfile, not an npm workspace).
  // Vercel auto-infers outputFileTracingRoot as the outer repo root because
  // it sees mind-ai-tutor's package-lock.json above this directory; if that
  // disagrees with turbopack.root, Next.js resolves the conflict in favor of
  // outputFileTracingRoot, which drags Turbopack's workspace root (and its
  // root-file resolution, e.g. middleware.ts) up to the monorepo root and
  // pulls in mind-ai-tutor's own middleware.ts. Pin both explicitly to this
  // directory so neither gets silently widened.
  outputFileTracingRoot: path.join(__dirname),
  turbopack: {
    root: path.join(__dirname),
  },

  // Lets mindaitutor.com/games/* reverse-proxy to this deployment (see the
  // matching rewrite in the main app's next.config.ts) without its own
  // /_next/* asset paths colliding with the main app's. Every route in this
  // app is now served under /games as a result - app/page.tsx (legacy,
  // gameId-less) becomes /games, app/lessons/[id] becomes /games/lessons/[id].
  basePath: '/games',

  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            scriptSource,
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https:",
            "font-src 'self' data:",
            `connect-src 'self' ${supabaseOrigin} ${supabaseWsOrigin}`,
            "frame-src https:",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
          ].join('; '),
        },
      ],
    }];
  },

  async redirects() {
    return [
      // Preserve bookmarks to this deployment's own pre-basePath URLs.
      { source: '/', destination: '/games', basePath: false, permanent: false },
      { source: '/lessons/:path*', destination: '/games/lessons/:path*', basePath: false, permanent: false },
    ];
  },
};

export default nextConfig;
