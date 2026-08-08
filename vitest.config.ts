import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // src/core is RN-free by rule. src/render/geometry.ts is pure arithmetic
    // and is listed explicitly so the rest of src/render stays out of Vitest.
    include: ['src/core/**/*.test.ts', 'src/render/geometry.test.ts'],
  },
});
