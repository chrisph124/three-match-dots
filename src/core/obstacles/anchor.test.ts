import { describe, expect, it } from 'vitest';
import type { CellMove } from '../types';
import { buildAnchors, dropAnchors, remapAnchors, removeAdjacent, toMask } from './anchor';

// A 6-wide board is used throughout so the row-major math matches the shipped
// 6x6 board and the caged-dot fixtures.
const COLS = 6;

describe('buildAnchors', () => {
  it('seeds a Set from the authored cell indices', () => {
    const anchors = buildAnchors([5, 10, 22]);
    expect([...anchors].sort((a, b) => a - b)).toEqual([5, 10, 22]);
  });

  it('dedups repeated indices (a Set, single-hit — no layer count)', () => {
    expect(buildAnchors([7, 7, 7]).size).toBe(1);
  });

  it('is empty for no anchors (⇒ the byte-identical anchor-free path)', () => {
    expect(buildAnchors([]).size).toBe(0);
  });
});

describe('removeAdjacent (the one shared removal rule)', () => {
  // Anchor at index 10 = row 1, col 4. Its 8 neighbours on a 6-wide board:
  //   up-left 3, up 4, up-right 5, left 9, right 11, down-left 15, down 16, down-right 17.
  it('removes an anchor when an orthogonally-adjacent cell clears', () => {
    for (const cleared of [4, 9, 11, 16]) {
      const { removed, survivors } = removeAdjacent(buildAnchors([10]), [cleared], COLS);
      expect(removed).toEqual([10]);
      expect(survivors.size).toBe(0);
    }
  });

  it('removes an anchor when a diagonally-adjacent cell clears (8-way)', () => {
    for (const cleared of [3, 5, 15, 17]) {
      const { removed, survivors } = removeAdjacent(buildAnchors([10]), [cleared], COLS);
      expect(removed).toEqual([10]);
      expect(survivors.size).toBe(0);
    }
  });

  it('leaves an anchor when no cleared cell is 8-way adjacent', () => {
    const { removed, survivors } = removeAdjacent(buildAnchors([10]), [0, 22, 30], COLS);
    expect(removed).toEqual([]);
    expect([...survivors]).toEqual([10]);
  });

  it('does not wrap across a row edge (col-decoded adjacency, not raw index delta)', () => {
    // Anchor 11 = row 1, col 5 (right edge). Cell 12 = row 2, col 0 — raw delta 1
    // but NOT adjacent. Reuses hot/adjacency, so the wrap is handled once.
    const { removed, survivors } = removeAdjacent(buildAnchors([11]), [12], COLS);
    expect(removed).toEqual([]);
    expect([...survivors]).toEqual([11]);
  });

  it('is single-hit: one qualifying adjacent clear removes it outright', () => {
    const { removed, survivors } = removeAdjacent(buildAnchors([10]), [9, 11], COLS);
    expect(removed).toEqual([10]); // removed once, not twice
    expect(survivors.size).toBe(0);
  });

  it('partitions a mixed set: adjacent anchors removed, the rest survive', () => {
    // cleared 9 is adjacent to anchor 10 only; anchors 30 and 22 are untouched.
    const { removed, survivors } = removeAdjacent(buildAnchors([10, 22, 30]), [9], COLS);
    expect(removed).toEqual([10]);
    expect([...survivors].sort((a, b) => a - b)).toEqual([22, 30]);
  });

  it('accepts any iterable of cleared indices (Set as well as array)', () => {
    const { removed } = removeAdjacent(buildAnchors([10]), new Set([11]), COLS);
    expect(removed).toEqual([10]);
  });

  it('does not mutate the input anchor set', () => {
    const anchors = buildAnchors([10]);
    removeAdjacent(anchors, [9], COLS);
    expect([...anchors]).toEqual([10]);
  });
});

describe('dropAnchors (consume the resolve echo of removed weights)', () => {
  it('removes exactly the echoed cells from the overlay', () => {
    const next = dropAnchors(buildAnchors([10, 22, 30]), [22]);
    expect([...next].sort((a, b) => a - b)).toEqual([10, 30]);
  });

  it('returns a faithful copy when the echo is undefined (nothing removed)', () => {
    const next = dropAnchors(buildAnchors([10, 22]), undefined);
    expect([...next].sort((a, b) => a - b)).toEqual([10, 22]);
  });

  it('returns a faithful copy when the echo is empty', () => {
    const next = dropAnchors(buildAnchors([10, 22]), []);
    expect([...next].sort((a, b) => a - b)).toEqual([10, 22]);
  });

  it('ignores an echoed cell that is not anchored', () => {
    const next = dropAnchors(buildAnchors([10]), [99]);
    expect([...next]).toEqual([10]);
  });

  it('does not mutate the input anchor set', () => {
    const anchors = buildAnchors([10, 22]);
    dropAnchors(anchors, [22]);
    expect([...anchors].sort((a, b) => a - b)).toEqual([10, 22]);
  });
});

describe('remapAnchors (gravity/shuffle remap over a Set)', () => {
  it('follows an anchor through a fall', () => {
    const next = remapAnchors(buildAnchors([10]), [{ from: 10, to: 22 }]);
    expect([...next]).toEqual([22]);
  });

  it('leaves an anchor absent from the move list unchanged (identity default)', () => {
    // gravity emits a fall only when from !== to, so a stationary anchor never
    // appears in `falls` and must stay put, not be dropped.
    const next = remapAnchors(buildAnchors([10]), [{ from: 3, to: 15 }]);
    expect([...next]).toEqual([10]);
  });

  it('remaps every anchor across a shuffle permutation, none dropped or duplicated', () => {
    const moves: CellMove[] = [
      { from: 1, to: 9 },
      { from: 3, to: 0 },
    ];
    const next = remapAnchors(buildAnchors([1, 2, 3]), moves);
    expect(next.size).toBe(3);
    expect([...next].sort((a, b) => a - b)).toEqual([0, 2, 9]);
  });

  it('does not mutate the input anchor set', () => {
    const anchors = buildAnchors([10]);
    remapAnchors(anchors, [{ from: 10, to: 22 }]);
    expect([...anchors]).toEqual([10]);
  });
});

describe('toMask (0/1 vector for the worklet input layer)', () => {
  it('produces a 0/1 mask indexed by cell', () => {
    expect(toMask(buildAnchors([1, 3]), 5)).toEqual([0, 1, 0, 1, 0]);
  });

  it('returns an all-zero mask for no anchors', () => {
    expect(toMask(buildAnchors([]), 4)).toEqual([0, 0, 0, 0]);
  });

  it('ignores an index outside [0, cellCount) rather than growing the mask', () => {
    // Defensive guard: a stale/oversized index never writes past the board vector.
    expect(toMask(buildAnchors([4, -1]), 3)).toEqual([0, 0, 0]);
  });

  it('is pure — a fresh array of length cellCount, input untouched', () => {
    const anchors = buildAnchors([2]);
    const mask = toMask(anchors, 4);
    expect(mask).toHaveLength(4);
    mask[0] = 9;
    expect(toMask(anchors, 4)).toEqual([0, 0, 1, 0]);
  });
});
