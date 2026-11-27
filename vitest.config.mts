import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    // game-engine is a separate app with its own dependencies; its CI job runs its tests.
    exclude: [...configDefaults.exclude, 'game-engine/**'],
  },
});
