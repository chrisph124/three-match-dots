import { describe, expect, it } from 'vitest';
import type { CellMove, ClearedCell, Resolution } from '../types';
import { buildCaged, chipLayers, chipLayersInner, protectedOf, remapMoves } from './caged-dot';

/** Minimal Resolution for overlay tests — only `cleared`/`protectedHits`/`falls` matter. */
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

function cells(indices: readonly number[], color = 0): ClearedCell[] {
  return indices.map((index) => ({ index, color, reason: 'chain' as const }));
}

describe('buildCaged', () => {
  it('seeds each cage from its {index, layers}', () => {
    const caged = buildCaged([
      { index: 5, layers: 1 },
      { index: 10, layers: 2 },
      { index: 22, layers: 3 },
    ]);
    expect([...caged.entries()]).toEqual([
      [5, 1],
      [10, 2],
      [22, 3],
    ]);
  });
});

describe('protectedOf', () => {
  it('protects only cages with two or more layers remaining', () => {
    const caged = buildCaged([
      { index: 5, layers: 1 },
      { index: 10, layers: 2 },
      { index: 22, layers: 3 },
    ]);
    expect([...protectedOf(caged)].sort((a, b) => a - b)).toEqual([10, 22]);
  });

  it('is empty for an all-1-layer overlay (⇒ the byte-identical classic resolve)', () => {
    const caged = buildCaged([
      { index: 5, layers: 1 },
      { index: 10, layers: 1 },
    ]);
    expect(protectedOf(caged).size).toBe(0);
  });
});

describe('chipLayers', () => {
  it('pops a 1-layer cage that was cleared (removed from the overlay)', () => {
    const caged = buildCaged([
      { index: 5, layers: 1 },
      { index: 10, layers: 1 },
    ]);
    const next = chipLayers(caged, res({ cleared: cells([5]) }));
    expect([...next.entries()]).toEqual([[10, 1]]);
  });

  it('decrements a multi-layer cage that was hit (protectedHits), keeping it caged', () => {
    const caged = buildCaged([
      { index: 5, layers: 2 },
      { index: 10, layers: 3 },
    ]);
    const next = chipLayers(caged, res({ protectedHits: cells([5, 10]) }));
    expect(next.get(5)).toBe(1); // 2 → 1, still present (1-layer is never protected)
    expect(next.get(10)).toBe(2); // 3 → 2
  });

  it('leaves untouched cages unchanged', () => {
    const caged = buildCaged([
      { index: 5, layers: 2 },
      { index: 10, layers: 1 },
    ]);
    const next = chipLayers(caged, res({ cleared: cells([3]) }));
    expect(next.get(5)).toBe(2);
    expect(next.get(10)).toBe(1);
  });

  it('does not mutate the input overlay', () => {
    const caged = buildCaged([{ index: 5, layers: 2 }]);
    chipLayers(caged, res({ protectedHits: cells([5]) }));
    expect(caged.get(5)).toBe(2);
  });
});

describe('chipLayersInner (the pure rule the solver shares)', () => {
  it('applies the same free/chip rule over plain index iterables', () => {
    const caged = buildCaged([
      { index: 5, layers: 1 },
      { index: 10, layers: 2 },
      { index: 22, layers: 1 },
    ]);
    const next = chipLayersInner(caged, [5], [10]);
    expect(next.has(5)).toBe(false); // 1-layer cleared → freed
    expect(next.get(10)).toBe(1); // 2-layer hit → 1
    expect(next.get(22)).toBe(1); // untouched
  });
});

describe('remapMoves', () => {
  it('follows a caged cell through a fall, carrying its layer value', () => {
    const next = remapMoves(buildCaged([{ index: 10, layers: 2 }]), [{ from: 10, to: 22 }]);
    expect([...next.entries()]).toEqual([[22, 2]]);
  });

  it('leaves a caged cell absent from the move list unchanged (identity)', () => {
    // gravity.ts emits a fall only when from !== to, so a stationary caged cell
    // never appears in `falls` and must stay put, not be dropped.
    const next = remapMoves(buildCaged([{ index: 10, layers: 3 }]), [{ from: 3, to: 15 }]);
    expect([...next.entries()]).toEqual([[10, 3]]);
  });

  it('remaps every caged index across a shuffle permutation, none dropped or duplicated', () => {
    // Same helper covers shuffleBoard.moves (Decision A): 1->9, 3->0, 2 stays.
    const moves: CellMove[] = [
      { from: 1, to: 9 },
      { from: 3, to: 0 },
    ];
    const next = remapMoves(
      buildCaged([
        { index: 1, layers: 1 },
        { index: 2, layers: 2 },
        { index: 3, layers: 3 },
      ]),
      moves,
    );
    expect(next.size).toBe(3);
    expect(next.get(9)).toBe(1);
    expect(next.get(2)).toBe(2);
    expect(next.get(0)).toBe(3);
  });

  it('does not mutate the input overlay', () => {
    const caged = buildCaged([{ index: 10, layers: 1 }]);
    remapMoves(caged, [{ from: 10, to: 22 }]);
    expect([...caged.entries()]).toEqual([[10, 1]]);
  });
});

describe('chip-then-remap (the per-resolution fold order)', () => {
  it('pops a cleared 1-layer cage, then follows a chipped survivor through its fall', () => {
    // 5 is a 1-layer cage that pops; 10 is a 2-layer cage that is hit (chips to 1)
    // and — because a cell below it cleared — rides gravity down to 22.
    const caged = buildCaged([
      { index: 5, layers: 1 },
      { index: 10, layers: 2 },
    ]);
    const resolution = res({
      cleared: cells([5]),
      protectedHits: cells([10]),
      falls: [{ from: 10, to: 22 }],
    });
    const chipped = chipLayers(caged, resolution);
    const settled = remapMoves(chipped, resolution.falls);
    expect([...settled.entries()]).toEqual([[22, 1]]);
  });
});
