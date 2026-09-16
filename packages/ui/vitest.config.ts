import { defineConfig } from 'vitest/config';

export default defineConfig({
  // tsconfig says jsx: "preserve" for Next; tests need React's automatic runtime.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
