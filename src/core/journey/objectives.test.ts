import { describe, expect, it } from 'vitest';
import type { ClearedCell, Resolution } from '../types';
import { foldObjectives, initObjectives, type Objective } from './objectives';

function res(cells: readonly ClearedCell[]): Resolution {
  return {
    kind: 'plain',
    color: 0,
    cleared: cells,
    falls: [],
    spawns: [],
    scoreDelta: 0,
    board: [],
    rngState: 0,
  };
}

function cleared(spec: readonly (readonly [number, number])[]): ClearedCell[] {
  // [index, color] pairs.
  return spec.map(([index, color]) => ({ index, color, reason: 'chain' as const }));
}

const clearRed: Objective = { type: 'clearColor', color: 1, count: 5 };
const freeAll: Objective = { type: 'freeCaged' };

describe('initObjectives', () => {
  it('seeds clearColor with a count target and freeCaged with the cage count', () => {
    const progress = initObjectives([clearRed, freeAll], 3);
    expect(progress[0]).toEqual({ objective: clearRed, current: 0, target: 5, done: false });
    expect(progress[1]).toEqual({ objective: freeAll, current: 0, target: 3, done: false });
  });

  it('marks a freeCaged objective done immediately when there are no cages', () => {
    const progress = initObjectives([freeAll], 0);
    expect(progress[0]).toEqual({ objective: freeAll, current: 0, target: 0, done: true });
  });
});

describe('foldObjectives — clearColor', () => {
  it('counts only cleared cells of the objective colour and clamps to target', () => {
    let progress = initObjectives([clearRed], 0);
    progress = foldObjectives(
      progress,
      res(
        cleared([
          [0, 1],
          [1, 1],
          [2, 0],
        ]),
      ),
      new Set(),
    );
    expect(progress[0].current).toBe(2);
    expect(progress[0].done).toBe(false);

    progress = foldObjectives(
      progress,
      res(
        cleared([
          [3, 1],
          [4, 1],
          [5, 1],
          [6, 1],
        ]),
      ),
      new Set(),
    );
    expect(progress[0].current).toBe(5); // 2 + 4 clamped to target 5
    expect(progress[0].done).toBe(true);
  });
});

describe('foldObjectives — freeCaged', () => {
  it('tracks freed cages as initial-count minus remaining, done at zero remaining', () => {
    let progress = initObjectives([freeAll], 3);

    progress = foldObjectives(progress, res([]), new Set([10, 22]));
    expect(progress[0].current).toBe(1); // 3 - 2 remaining
    expect(progress[0].done).toBe(false);

    progress = foldObjectives(progress, res([]), new Set());
    expect(progress[0].current).toBe(3);
    expect(progress[0].done).toBe(true);
  });
});

describe('foldObjectives — mixed', () => {
  it('advances each objective independently in one fold', () => {
    let progress = initObjectives([clearRed, freeAll], 2);
    progress = foldObjectives(
      progress,
      res(
        cleared([
          [10, 1],
          [11, 1],
        ]),
      ),
      new Set([22]),
    );
    expect(progress[0].current).toBe(2); // two red cleared
    expect(progress[1].current).toBe(1); // one of two cages freed
    expect(progress.every((p) => p.done)).toBe(false);
  });

  it('does not mutate the previous progress array', () => {
    const progress = initObjectives([clearRed], 0);
    foldObjectives(progress, res(cleared([[0, 1]])), new Set());
    expect(progress[0].current).toBe(0);
  });
});
