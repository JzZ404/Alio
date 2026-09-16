import { defineConfig } from 'vitest/config';

export default defineConfig({
  // tsconfig says jsx: "preserve" for Next; tests need React's automatic
  // runtime. Vite's default transform is now oxc (esbuild options are
  // ignored), so the override has to go through `oxc`, not `esbuild`.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
