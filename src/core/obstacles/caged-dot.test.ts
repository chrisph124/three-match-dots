import { describe, expect, it } from 'vitest';
import type { CellMove, ClearedCell, Resolution } from '../types';
import { buildCaged, freeCleared, remapMoves } from './caged-dot';

/** Minimal Resolution for overlay tests — only `cleared`/`falls` matter here. */
function res(over: Partial<Resolution>): Resolution {
  return {
    kind: 'plain',
    color: 0,
    cleared: [],
    falls: [],
    spawns: [],
    scoreDelta: 0,
    board: [],
    rngState: 0,
    ...over,
  };
}

function cleared(indices: readonly number[], color = 0): ClearedCell[] {
  return indices.map((index) => ({ index, color, reason: 'chain' as const }));
}

describe('buildCaged', () => {
  it('builds a set from the level obstacle cells', () => {
    expect([...buildCaged([5, 10, 22])]).toEqual([5, 10, 22]);
  });
});

describe('freeCleared', () => {
  it('narrows the caged set only for cells that were cleared', () => {
    const caged = buildCaged([5, 10]);
    const next = freeCleared(caged, res({ cleared: cleared([5]) }));
    expect([...next]).toEqual([10]);
  });

  it('leaves the set intact when no caged cell was cleared', () => {
    const caged = buildCaged([5, 10]);
    const next = freeCleared(caged, res({ cleared: cleared([3, 7]) }));
    expect([...next].sort((a, b) => a - b)).toEqual([5, 10]);
  });

  it('does not mutate the input set', () => {
    const caged = buildCaged([5, 10]);
    freeCleared(caged, res({ cleared: cleared([5]) }));
    expect([...caged].sort((a, b) => a - b)).toEqual([5, 10]);
  });
});

describe('remapMoves', () => {
  it('follows a caged cell that moves through the fall list', () => {
    // The dot at 10 falls into 22 (a cell below it cleared). Cage follows.
    const next = remapMoves(buildCaged([10]), [{ from: 10, to: 22 }]);
    expect([...next]).toEqual([22]);
  });

  it('leaves a caged cell absent from the move list unchanged (identity)', () => {
    // gravity.ts emits a fall only when from !== to, so a stationary caged
    // cell never appears in `falls` and must stay put, not be dropped.
    const next = remapMoves(buildCaged([10]), [{ from: 3, to: 15 }]);
    expect([...next]).toEqual([10]);
  });

  it('remaps every caged index across a shuffle permutation with none dropped or duplicated', () => {
    // Same helper covers shuffleBoard.moves (Decision A): 1->9, 3->0, 2 stays.
    const moves: CellMove[] = [
      { from: 1, to: 9 },
      { from: 3, to: 0 },
    ];
    const next = remapMoves(buildCaged([1, 2, 3]), moves);
    expect([...next].sort((a, b) => a - b)).toEqual([0, 2, 9]);
    expect(next.size).toBe(3);
  });

  it('does not mutate the input set', () => {
    const caged = buildCaged([10]);
    remapMoves(caged, [{ from: 10, to: 22 }]);
    expect([...caged]).toEqual([10]);
  });
});

describe('free-then-remap (the per-resolution journey order)', () => {
  it('frees a cleared cage, then follows a survivor through its fall', () => {
    const caged = buildCaged([5, 10]);
    const resolution = res({ cleared: cleared([5]), falls: [{ from: 10, to: 22 }] });
    const freed = freeCleared(caged, resolution);
    const settled = remapMoves(freed, resolution.falls);
    expect([...settled]).toEqual([22]);
  });
});
