import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // src/core is RN-free by rule. src/render/geometry.ts,
    // src/render/move-offsets.ts and src/render/contrast.test.ts (pure colour
    // data) are pure arithmetic/data and are listed explicitly so the rest of
    // src/render (which imports Skia) stays out of Vitest.
    include: [
      'src/core/**/*.test.ts',
      'src/render/geometry.test.ts',
      'src/render/move-offsets.test.ts',
      'src/render/contrast.test.ts',
    ],
  },
});
