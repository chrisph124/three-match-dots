import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // src/core is RN-free by rule. src/render/geometry.ts and
    // src/render/move-offsets.ts are pure arithmetic and are listed
    // explicitly so the rest of src/render (which imports Skia) stays out of
    // Vitest.
    include: [
      'src/core/**/*.test.ts',
      'src/render/geometry.test.ts',
      'src/render/move-offsets.test.ts',
    ],
  },
});
