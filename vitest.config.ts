import { defineConfig } from 'vitest/config';

// The one testable-surface list, shared by `include` (which specs run) and
// coverage `include` (which sources are measured). src/core is RN-free by rule.
// src/render/geometry.ts, move-offsets.ts and contrast.ts are pure
// arithmetic/data listed explicitly so the rest of src/render (which imports
// Skia) stays out of Vitest — and out of the coverage denominator, so the % is
// never diluted by native layers that Vitest can't reach.
const TESTABLE_SPECS = [
  'src/core/**/*.test.ts',
  'src/render/geometry.test.ts',
  'src/render/move-offsets.test.ts',
  'src/render/contrast.test.ts',
];

// Sources measured for coverage: the modules under test, not the *.test.ts
// specs. Mirrors TESTABLE_SPECS so the denominator is exactly the RN-free
// surface. Feeds the coverage diff-gate (scripts/check-coverage.mjs).
// (contrast has no source module — src/render/contrast.test.ts is a
// self-contained WCAG guard with its logic inline — so nothing to measure
// there; only geometry.ts and move-offsets.ts are real render sources.)
const COVERAGE_INCLUDE = [
  'src/core/**/*.ts',
  'src/render/geometry.ts',
  'src/render/move-offsets.ts',
];

export default defineConfig({
  test: {
    environment: 'node',
    include: TESTABLE_SPECS,
    coverage: {
      provider: 'v8',
      // json-summary feeds scripts/check-coverage.mjs; text is the human view.
      reporter: ['text', 'json-summary'],
      include: COVERAGE_INCLUDE,
      // Measure production sources only: drop the specs and the test-support
      // helpers (test infrastructure, not the surface the gate protects).
      exclude: ['**/*.test.ts', '**/test-support/**'],
      reportsDirectory: './coverage',
    },
  },
});
