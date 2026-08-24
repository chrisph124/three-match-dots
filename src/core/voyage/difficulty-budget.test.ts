import { describe, expect, it } from 'vitest';
import { budget, dialPointCost, spend } from './difficulty-budget';
import {
  BASE_COLORS,
  BASE_MIN_CHAIN,
  MAX_MIN_CHAIN,
  MAX_MOVES_TIGHTEN,
  PROFILES,
  type BoardLimits,
  type DialVector,
} from './voyage-config';

const BOARD_6X6: BoardLimits = { paletteSize: 5, rows: 6, cols: 6 };
const ALL_PROFILES = Object.values(PROFILES);

/** Asserts a dial vector sits inside the schema's legality envelope. */
function expectLegal(dials: DialVector, limits: BoardLimits) {
  expect(dials.colors).toBeGreaterThanOrEqual(BASE_COLORS);
  expect(dials.colors).toBeLessThanOrEqual(limits.paletteSize);
  expect(dials.minChain).toBeGreaterThanOrEqual(BASE_MIN_CHAIN);
  expect(dials.minChain).toBeLessThanOrEqual(MAX_MIN_CHAIN);
  expect(dials.colors * dials.minChain).toBeLessThanOrEqual(limits.rows * limits.cols);
  expect(dials.obstacleCount).toBeGreaterThanOrEqual(0);
  expect(dials.movesTighten).toBeGreaterThanOrEqual(0);
  expect(dials.movesTighten).toBeLessThanOrEqual(MAX_MOVES_TIGHTEN);
}

describe('budget', () => {
  it('is round(10 · d)', () => {
    expect(budget(1.0)).toBe(10);
    expect(budget(1.23)).toBe(12);
    expect(budget(0.44)).toBe(4);
    expect(budget(0)).toBe(0);
  });
});

describe('spend', () => {
  it('is deterministic for a fixed seed', () => {
    const a = spend(15, PROFILES.balanced, 999, BOARD_6X6);
    const b = spend(15, PROFILES.balanced, 999, BOARD_6X6);
    expect(a.dials).toEqual(b.dials);
    expect(a.rngState).toBe(b.rngState);
  });

  it('never overspends and never emits an illegal dial vector', () => {
    for (let D = 0; D <= 40; D += 1) {
      for (const profile of ALL_PROFILES) {
        for (const seed of [1, 2, 3, 7, 4242]) {
          const { dials } = spend(D, profile, seed, BOARD_6X6);
          expect(dialPointCost(dials)).toBeLessThanOrEqual(D);
          expectLegal(dials, BOARD_6X6);
        }
      }
    }
  });

  it('produces measurably different vectors for different profiles at equal D', () => {
    // At D=4, colours-first spends both points on colour (→ 5) while minChain-first
    // buys the 3pt chain step; the vectors cannot coincide.
    const tight = spend(4, PROFILES.tightMoves, 55, BOARD_6X6).dials;
    const heavy = spend(4, PROFILES.obstacleHeavy, 55, BOARD_6X6).dials;
    expect(tight).not.toEqual(heavy);
    expect(tight.colors).toBe(5); // colours-first maxed the colour dial
    expect(heavy.minChain).toBe(MAX_MIN_CHAIN); // minChain-first raised the chain
  });

  it('biases cheap spend toward the profile axis', () => {
    // obstacleBias 0.8 vs 0.15 over many seeds ⇒ obstacle-heavy buys more cages.
    let heavyObstacles = 0;
    let tightObstacles = 0;
    for (let seed = 1; seed <= 60; seed += 1) {
      heavyObstacles += spend(20, PROFILES.obstacleHeavy, seed, BOARD_6X6).dials.obstacleCount;
      tightObstacles += spend(20, PROFILES.tightMoves, seed, BOARD_6X6).dials.obstacleCount;
    }
    expect(heavyObstacles).toBeGreaterThan(tightObstacles);
  });

  it('clamps colours and minChain on a board too small to raise them', () => {
    const tiny: BoardLimits = { paletteSize: 5, rows: 3, cols: 3 }; // 9 cells
    const { dials } = spend(20, PROFILES.balanced, 1, tiny);
    // 4 colours × minChain 3 = 12 > 9, and 3 × 4 = 12 > 9 — neither dial can move.
    expect(dials.colors).toBe(BASE_COLORS);
    expect(dials.minChain).toBe(BASE_MIN_CHAIN);
    expectLegal(dials, tiny);
  });
});
