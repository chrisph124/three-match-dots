import { describe, expect, it } from 'vitest';
import { next, nextInt } from './rng';

describe('next', () => {
  it('returns a value in [0, 1)', () => {
    const step = next(12345);
    expect(step.value).toBeGreaterThanOrEqual(0);
    expect(step.value).toBeLessThan(1);
  });

  it('is deterministic for the same state', () => {
    expect(next(999)).toEqual(next(999));
  });

  it('advances the state', () => {
    expect(next(999).state).not.toBe(999);
  });

  it('produces a different value from the advanced state', () => {
    const first = next(999);
    const second = next(first.state);
    expect(second.value).not.toBe(first.value);
  });

  it('reproduces an identical sequence from the same seed', () => {
    const run = (seed: number): number[] => {
      let state = seed;
      const values: number[] = [];
      for (let i = 0; i < 20; i++) {
        const step = next(state);
        state = step.state;
        values.push(step.value);
      }
      return values;
    };
    expect(run(2026)).toEqual(run(2026));
  });
});

describe('nextInt', () => {
  it('stays within the bound', () => {
    let state = 7;
    for (let i = 0; i < 500; i++) {
      const step = nextInt(state, 3);
      state = step.state;
      expect(step.value).toBeGreaterThanOrEqual(0);
      expect(step.value).toBeLessThan(3);
      expect(Number.isInteger(step.value)).toBe(true);
    }
  });

  it('eventually produces every value in range', () => {
    let state = 42;
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const step = nextInt(state, 3);
      state = step.state;
      seen.add(step.value);
    }
    expect(seen.size).toBe(3);
  });
});
