import { describe, expect, it } from 'vitest';
import {
  constraintOf,
  parseLevelScript,
  type Constraint,
  type LevelScript,
} from '../level/level-script';
import { generateLadder } from './generate-level';
import { applyCalibratedBudget, calibrateBudget, calibrateConstraint, solve } from './solver';
import { SOLVER_SAMPLES, SOLVER_TIMED_FLOOR_MS } from './voyage-config';

// Mirror the shipped runtime palette (`DOT_COLORS.length` = 6). A literal, not an
// import, keeps this core test RN-free — the palette lives in the render layer.
const PALETTE = 6;
const LADDER = generateLadder(80, PALETTE);
const seedOf = (level: LevelScript): number => level.seed ?? 0;

/** The first generated (non-curated, non-boss) level of a given constraint kind. */
function firstOfKind(kind: Constraint['type']): LevelScript {
  const level = LADDER.find(
    (l) => l.order > 10 && l.order % 10 !== 0 && l.constraint?.type === kind,
  );
  if (!level) {
    throw new Error(`no generated ${kind} level in the ladder`);
  }
  return level;
}

describe('calibrateBudget — moves', () => {
  const movesLevel = firstOfKind('moves');

  it('ships a budget the solver can win under', () => {
    expect(solve(movesLevel, seedOf(movesLevel)).won).toBe(true);
  });

  it('widens an impossibly tight budget until the level is winnable', () => {
    const tight = parseLevelScript(
      { ...movesLevel, constraint: { type: 'moves', budget: 1 } },
      PALETTE,
    );
    const widened = calibrateBudget(tight, seedOf(tight), SOLVER_SAMPLES);
    expect(widened).toBeGreaterThan(1);

    const fixed = parseLevelScript(
      { ...tight, constraint: applyCalibratedBudget({ type: 'moves', budget: 1 }, widened) },
      PALETTE,
    );
    expect(solve(fixed, seedOf(fixed)).won).toBe(true);
  });
});

describe('calibrateBudget — timed', () => {
  const timedLevel = firstOfKind('timed');

  it('ships a time budget the solver can win under', () => {
    expect(solve(timedLevel, seedOf(timedLevel)).won).toBe(true);
  });

  it('never drops below the timed floor', () => {
    const startMs = calibrateBudget(timedLevel, seedOf(timedLevel), SOLVER_SAMPLES);
    expect(startMs).toBeGreaterThanOrEqual(SOLVER_TIMED_FLOOR_MS);
  });
});

describe('calibrateBudget — mistakes', () => {
  const mistakesLevel = firstOfKind('mistakes');

  it('passes the forgiveness cap through unchanged (a perfect bot makes none)', () => {
    const constraint = constraintOf(mistakesLevel);
    const cap = constraint.type === 'mistakes' ? constraint.cap : -1;
    expect(calibrateBudget(mistakesLevel, seedOf(mistakesLevel), SOLVER_SAMPLES)).toBe(cap);
  });

  it('is winnable, since the greedy bot never makes an invalid attempt', () => {
    expect(solve(mistakesLevel, seedOf(mistakesLevel)).won).toBe(true);
  });
});

describe('calibrateConstraint', () => {
  it('preserves the constraint kind for every kind', () => {
    for (const kind of ['moves', 'timed', 'mistakes'] as const) {
      const level = firstOfKind(kind);
      expect(calibrateConstraint(level, SOLVER_SAMPLES).type).toBe(kind);
    }
  });
});
