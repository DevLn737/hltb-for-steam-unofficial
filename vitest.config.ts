import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    exclude: ['tests/browser/**', 'node_modules/**', '.output/**'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/**/*.ts', 'entrypoints/**/*.ts'],
      exclude: ['src/ui/widget-styles.ts'],
    },
  },
});
