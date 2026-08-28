import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Note: To ignore ESLint errors during builds, use: next build --no-lint

  // This app lives inside the mind-ai-tutor monorepo as an independently
  // deployed sibling (its own package.json/lockfile, not an npm workspace),
  // so Turbopack must not infer the outer mind-ai-tutor package-lock.json
  // as its workspace root.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
