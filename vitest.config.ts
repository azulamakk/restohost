import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/pipeline/**/*.test.ts'],
    environment: 'node',
  },
});
