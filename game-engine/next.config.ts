import path from "path";
import type { NextConfig } from "next";

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

  async redirects() {
    return [
      // Preserve bookmarks to this deployment's own pre-basePath URLs.
      { source: '/', destination: '/games', basePath: false, permanent: false },
      { source: '/lessons/:path*', destination: '/games/lessons/:path*', basePath: false, permanent: false },
    ];
  },
};

export default nextConfig;
