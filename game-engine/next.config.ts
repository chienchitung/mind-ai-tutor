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
};

export default nextConfig;
