import type { NextConfig } from "next";

// Supabase project origin, used to scope connect-src instead of leaving it
// wide open. Falls back to https: (any host) only if the env var is somehow
// missing at build time, so a misconfigured build fails open rather than
// breaking every fetch on the site.
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
  reactStrictMode: true,

  async headers() {
    return [
      {
        // Applies to every route, including the /games/* rewrite - the
        // proxied deployment sets its own headers for its own responses,
        // this only covers responses this app serves directly.
        source: '/:path*',
        headers: [
          // Clickjacking: nothing in this app is meant to be framed.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          {
            // script-src/style-src keep 'unsafe-inline' because this app has
            // no nonce plumbing yet for
            // Next's inline hydration script - tightening that is a
            // separate, riskier change. Even so, this still closes off the
            // exfiltration path for any injected-script XSS: connect-src
            // limits where a script can send stolen data to, and
            // frame-ancestors/object-src/base-uri block the other common
            // injection primitives.
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              scriptSource,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              `connect-src 'self' ${supabaseOrigin} ${supabaseWsOrigin}`,
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-src 'self' https://*.genially.com",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
  // Realtime's Node transport uses a dynamic require. Keep it native on the
  // server rather than asking webpack to infer the transport module.
  serverExternalPackages: ['@supabase/supabase-js'],
  images: {
    domains: ['avatars.githubusercontent.com'],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Multi-Zones: proxy the digital-games sub-app under this domain so
  // students see mindaitutor.com/games/... instead of its own vercel.app
  // URL. game-engine sets basePath: '/games' precisely so this single rule
  // also catches its /games/_next/* asset requests, not just its pages.
  // Override GAME_ENGINE_ORIGIN per environment if a Preview deployment of
  // game-engine should be proxied instead of production.
  async rewrites() {
    const gameEngineOrigin = process.env.GAME_ENGINE_ORIGIN || 'https://mindaitutor-game.vercel.app';
    return [
      // Keep the base route slashless. Expanding an empty `:path*` adds a
      // trailing slash upstream, which game-engine redirects back to /games;
      // that redirect becomes a self-redirect on the public domain.
      { source: '/games', destination: `${gameEngineOrigin}/games` },
      { source: '/games/:path*', destination: `${gameEngineOrigin}/games/:path*` },
    ];
  },
};

export default nextConfig;
