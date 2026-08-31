import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
    return [{ source: '/games/:path*', destination: `${gameEngineOrigin}/games/:path*` }];
  },
};

export default nextConfig;
