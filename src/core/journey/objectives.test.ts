import { describe, expect, it } from 'vitest';
import type { ClearedCell, Resolution } from '../types';
import { foldObjectives, initObjectives, type Objective } from './objectives';

function res(cells: readonly ClearedCell[], protectedHits?: readonly ClearedCell[]): Resolution {
  return {
    kind: 'plain',
    color: 0,
    cleared: cells,
    falls: [],
    spawns: [],
    scoreDelta: 0,
    board: [],
    rngState: 0,
    ...(protectedHits ? { protectedHits } : {}),
  };
}

function cleared(spec: readonly (readonly [number, number])[]): ClearedCell[] {
  // [index, color] pairs.
  return spec.map(([index, color]) => ({ index, color, reason: 'chain' as const }));
}

const clearRed: Objective = { type: 'clearColor', color: 1, count: 5 };
const freeAll: Objective = { type: 'freeCaged' };
const clearAllAnchors: Objective = { type: 'clearAnchors' };

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

  it('seeds clearAnchors with the anchor count from the third argument', () => {
    const progress = initObjectives([clearAllAnchors], 0, 2);
    expect(progress[0]).toEqual({ objective: clearAllAnchors, current: 0, target: 2, done: false });
  });

  it('defaults the anchor count to 0 (byte-identical pre-anchor call) ⇒ done immediately', () => {
    const progress = initObjectives([clearAllAnchors], 0);
    expect(progress[0]).toEqual({ objective: clearAllAnchors, current: 0, target: 0, done: true });
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
      new Map(),
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
      new Map(),
    );
    expect(progress[0].current).toBe(5); // 2 + 4 clamped to target 5
    expect(progress[0].done).toBe(true);
  });

  it('does not advance on a chip-only commit — a chipped cage is not a cleared dot', () => {
    // A multi-layer cage in the chain is HIT (protectedHits) but not popped, so
    // `cleared` is empty. clearColor counts cleared dots only, so `current` holds.
    let progress = initObjectives([clearRed], 0);
    progress = foldObjectives(
      progress,
      res([], cleared([[1, 1]])), // colour-1 cage chipped, nothing cleared
      new Map([[1, 1]]), // the chipped cage now sits at 1 layer, still present
    );
    expect(progress[0].current).toBe(0);
    expect(progress[0].done).toBe(false);
  });
});

describe('foldObjectives — freeCaged', () => {
  it('tracks freed cages as initial-count minus remaining, done at zero remaining', () => {
    let progress = initObjectives([freeAll], 3);

    progress = foldObjectives(
      progress,
      res([]),
      new Map([
        [10, 1],
        [22, 1],
      ]),
    );
    expect(progress[0].current).toBe(1); // 3 - 2 remaining
    expect(progress[0].done).toBe(false);

    progress = foldObjectives(progress, res([]), new Map());
    expect(progress[0].current).toBe(3);
    expect(progress[0].done).toBe(true);
  });

  it('counts a multi-layer cage as freed only when its last layer is gone', () => {
    // A 2-layer cage: chipped to 1 (still present ⇒ not freed), then cleared.
    let progress = initObjectives([freeAll], 1);
    progress = foldObjectives(progress, res([]), new Map([[10, 1]])); // was 2, now 1
    expect(progress[0].current).toBe(0); // still caged
    expect(progress[0].done).toBe(false);

    progress = foldObjectives(progress, res([]), new Map()); // last layer gone
    expect(progress[0].current).toBe(1);
    expect(progress[0].done).toBe(true);
  });
});

describe('foldObjectives — clearAnchors', () => {
  it('tracks removed anchors as initial-count minus remaining, done at zero remaining', () => {
    let progress = initObjectives([clearAllAnchors], 0, 3);

    progress = foldObjectives(progress, res([]), new Map(), new Set([10, 22]));
    expect(progress[0].current).toBe(1); // 3 - 2 remaining
    expect(progress[0].done).toBe(false);

    progress = foldObjectives(progress, res([]), new Map(), new Set());
    expect(progress[0].current).toBe(3);
    expect(progress[0].done).toBe(true);
  });

  it('reads the anchor overlay, not the caged overlay (the two are independent)', () => {
    // A stray caged entry must NOT satisfy a clearAnchors objective, and vice
    // versa — each objective drains only its own overlay.
    const progress = foldObjectives(
      initObjectives([clearAllAnchors], 0, 1),
      res([]),
      new Map([[5, 1]]), // a cage still present — irrelevant to clearAnchors
      new Set(), // no anchors remain
    );
    expect(progress[0].current).toBe(1);
    expect(progress[0].done).toBe(true);
  });
});

describe('foldObjectives — mixed', () => {
  it('advances each objective independently in one fold', () => {
    let progress = initObjectives([clearRed, freeAll, clearAllAnchors], 2, 2);
    progress = foldObjectives(
      progress,
      res(
        cleared([
          [10, 1],
          [11, 1],
        ]),
      ),
      new Map([[22, 1]]),
      new Set([30]),
    );
    expect(progress[0].current).toBe(2); // two red cleared
    expect(progress[1].current).toBe(1); // one of two cages freed
    expect(progress[2].current).toBe(1); // one of two anchors removed
    expect(progress.every((p) => p.done)).toBe(false);
  });

  it('does not mutate the previous progress array', () => {
    const progress = initObjectives([clearRed], 0);
    foldObjectives(progress, res(cleared([[0, 1]])), new Map());
    expect(progress[0].current).toBe(0);
  });
});
