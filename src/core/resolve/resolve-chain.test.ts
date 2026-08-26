import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../config';
import { parseBoard } from '../test-support/board-fixture';
import type { ChainKind, GameConfig, GameState } from '../types';
import { EMPTY } from '../types';
import { resolveChain } from './resolve-chain';

// 4x4:
//  R R G R
//  R R G R
//  G G R R
//  R G R G
const ART = 'RRGR/RRGR/GGRR/RGRG';

const stateFrom = (art: string, seed = 2026): GameState => {
  const { board, rows, cols } = parseBoard(art);
  return { config: { ...DEFAULT_CONFIG, rows, cols }, board, score: 0, rngState: seed };
};

describe('resolveChain', () => {
  it('returns null for a chain shorter than minChain', () => {
    expect(resolveChain(stateFrom(ART), [])).toBeNull();
    expect(resolveChain(stateFrom(ART), [0])).toBeNull();
    expect(resolveChain(stateFrom(ART), [0, 1])).toBeNull();
  });

  it('returns null for a chain with a non-adjacent step', () => {
    expect(resolveChain(stateFrom(ART), [0, 12, 13])).toBeNull();
  });

  it('returns null for a chain that wraps a row edge', () => {
    expect(resolveChain(stateFrom(ART), [3, 4, 5])).toBeNull();
  });

  it('returns null for a chain of mixed colours', () => {
    expect(resolveChain(stateFrom(ART), [1, 2, 6])).toBeNull();
  });

  it('resolves a plain chain', () => {
    const result = resolveChain(stateFrom(ART), [0, 1, 5]);
    expect(result?.kind).toBe('plain');
    expect(result?.color).toBe(0);
    expect(result?.cleared).toHaveLength(3);
    expect(result?.scoreDelta).toBe(60);
  });

  it('resolves a square-loop into a board-wide sweep', () => {
    const result = resolveChain(stateFrom(ART), [0, 1, 5, 4, 0]);
    expect(result?.kind).toBe('square-loop');
    expect(result?.cleared).toHaveLength(10); // ten R cells
    expect(result?.scoreDelta).toBe(300);
  });

  it('resolves a straight run of five into a sweep', () => {
    const result = resolveChain(stateFrom('RRRRR'), [0, 1, 2, 3, 4]);
    expect(result?.kind).toBe('line');
    expect(result?.cleared).toHaveLength(5);
    expect(result?.scoreDelta).toBe(150);
  });

  it('returns a board with no empty cells', () => {
    expect(resolveChain(stateFrom(ART), [0, 1, 5, 4, 0])?.board.includes(EMPTY)).toBe(false);
  });

  it('spawns exactly as many dots as it cleared', () => {
    const result = resolveChain(stateFrom(ART), [0, 1, 5, 4, 0]);
    expect(result?.spawns).toHaveLength(result?.cleared.length ?? -1);
  });

  it('never emits a fall where from equals to', () => {
    const result = resolveChain(stateFrom(ART), [0, 1, 5, 4, 0]);
    expect(result?.falls.every((f) => f.from !== f.to)).toBe(true);
  });

  it('emits duplicate-free cleared cells', () => {
    const indices =
      resolveChain(stateFrom(ART), [0, 1, 5, 4, 0])?.cleared.map((c) => c.index) ?? [];
    expect(new Set(indices).size).toBe(indices.length);
  });

  it('advances the rng state', () => {
    expect(resolveChain(stateFrom(ART, 555), [0, 1, 5])?.rngState).not.toBe(555);
  });

  it('is reproducible for the same seed', () => {
    expect(resolveChain(stateFrom(ART, 99), [0, 1, 5])).toEqual(
      resolveChain(stateFrom(ART, 99), [0, 1, 5]),
    );
  });

  it('does not mutate the input state', () => {
    const state = stateFrom(ART);
    const before = [...state.board];
    resolveChain(state, [0, 1, 5, 4, 0]);
    expect(state.board).toEqual(before);
    expect(state.score).toBe(0);
  });

  describe('combo heat (F5 override: all commits multiplied)', () => {
    // heatCap 3, heatStep 0.5 — factor = 1 + postMoveHeat * 0.5, capped at 2.5x.
    const heatState = (
      art: string,
      opts: {
        heat?: number;
        lastKind?: ChainKind | null;
        seed?: number;
        dials?: Partial<GameConfig>;
      } = {},
    ): GameState => {
      const { board, rows, cols } = parseBoard(art);
      return {
        config: { ...DEFAULT_CONFIG, rows, cols, heatCap: 3, heatStep: 0.5, ...opts.dials },
        board,
        score: 0,
        rngState: opts.seed ?? 2026,
        heat: opts.heat,
        lastKind: opts.lastKind,
      };
    };

    it('leaves DEFAULT_CONFIG (heat off) with no heat field and an unscaled score', () => {
      const result = resolveChain(stateFrom(ART), [0, 1, 5]);
      expect(result?.heat).toBeUndefined();
      expect(result?.doubleSweep).toBeUndefined();
      expect(result?.scoreDelta).toBe(60);
    });

    it('raises heat one tier on a sweep and scales by the post-move heat', () => {
      // square-loop clears 10 R -> 300 base; post-move heat 1 -> factor 1.5 -> 450.
      const result = resolveChain(heatState(ART, { heat: 0 }), [0, 1, 5, 4, 0]);
      expect(result?.heat).toBe(1);
      expect(result?.scoreDelta).toBe(450);
    });

    it('stacks heat on consecutive sweeps', () => {
      const result = resolveChain(heatState(ART, { heat: 2 }), [0, 1, 5, 4, 0]);
      expect(result?.heat).toBe(3); // 2 + 1
      expect(result?.scoreDelta).toBe(750); // 300 * (1 + 3*0.5) = 300 * 2.5
    });

    it('caps heat at heatCap', () => {
      const result = resolveChain(heatState(ART, { heat: 3 }), [0, 1, 5, 4, 0]);
      expect(result?.heat).toBe(3); // min(3, 4)
      expect(result?.scoreDelta).toBe(750);
    });

    it('cools one tier on a plain chain but still scales it by cooled heat (F5 override)', () => {
      // plain 3 R -> 60 base; heat 2 cools to 1 -> factor 1.5 -> 90.
      const result = resolveChain(heatState(ART, { heat: 2 }), [0, 1, 5]);
      expect(result?.heat).toBe(1);
      expect(result?.scoreDelta).toBe(90);
    });

    it('floors heat at 0 on a plain chain from cold', () => {
      const result = resolveChain(heatState(ART, { heat: 0 }), [0, 1, 5]);
      expect(result?.heat).toBe(0);
      expect(result?.scoreDelta).toBe(60); // factor 1
    });

    it('flags a double sweep only when the previous commit was also a sweep', () => {
      expect(resolveChain(heatState(ART, { lastKind: 'line' }), [0, 1, 5, 4, 0])?.doubleSweep).toBe(
        true,
      );
      expect(
        resolveChain(heatState(ART, { lastKind: 'plain' }), [0, 1, 5, 4, 0])?.doubleSweep,
      ).toBe(false);
      expect(resolveChain(heatState(ART, { lastKind: null }), [0, 1, 5, 4, 0])?.doubleSweep).toBe(
        false,
      );
    });

    it('excludes the swept colour from its own refill wave when weighted on', () => {
      const result = resolveChain(
        heatState('RRRRR', { dials: { sweepExclusionWeight: 1 } }),
        [0, 1, 2, 3, 4],
      );
      expect(result?.kind).toBe('line');
      expect(result?.spawns.every((s) => s.color !== 0)).toBe(true);
    });

    it('never applies refill exclusion to a plain chain', () => {
      // A plain commit must refill identically whether or not the dial is set,
      // because exclusion is a sweep-only effect.
      const withDial = resolveChain(
        heatState(ART, { dials: { sweepExclusionWeight: 1 } }),
        [0, 1, 5],
      );
      const without = resolveChain(heatState(ART), [0, 1, 5]);
      expect(withDial?.spawns).toEqual(without?.spawns);
    });
  });

  // The generic, mechanic-agnostic seam the layered-cage overlay and the solver
  // both build on: a cell can be linked and counted in the chain yet resist
  // removal. When the param is omitted or empty the output is byte-identical.
  describe('protected cells (layered-cage seam)', () => {
    const idxOf = (cells: readonly { index: number }[]) => cells.map((c) => c.index);

    it('is byte-identical when the protected set is omitted, empty, or non-intersecting', () => {
      const pairs: [string, number[]][] = [
        [ART, [0, 1, 5]], // plain
        [ART, [0, 1, 5, 4, 0]], // square-loop sweep
        ['RRRRR', [0, 1, 2, 3, 4]], // straight-five line sweep
        ['R/R/R', [0, 1, 2]], // vertical plain
      ];
      for (const seed of [1, 99, 2026, 555]) {
        for (const [art, chain] of pairs) {
          const twoArg = resolveChain(stateFrom(art, seed), chain);
          expect(resolveChain(stateFrom(art, seed), chain, new Set())).toEqual(twoArg);
          // Protecting a cell that never gets collected is a no-op: still identical.
          expect(resolveChain(stateFrom(art, seed), chain, new Set([999]))).toEqual(twoArg);
          // A byte-identical object shape means no `protectedHits` key at all.
          expect(twoArg && 'protectedHits' in twoArg).toBe(false);
        }
      }
    });

    it('excludes a protected cell from a plain chain and echoes it in protectedHits', () => {
      // chain [0,1,5] is three R; protecting 5 pops only 0 and 1.
      const result = resolveChain(stateFrom(ART), [0, 1, 5], new Set([5]));
      expect(result?.kind).toBe('plain'); // classified on the FULL 3-chain
      expect(idxOf(result?.cleared ?? [])).toEqual([0, 1]);
      expect(idxOf(result?.protectedHits ?? [])).toEqual([5]);
      expect(result?.falls).toHaveLength(0); // 0,1 are above 5; nothing falls
      expect(result?.scoreDelta).toBe(30); // plain 2 = 10*2*3/2, not the 3-chain's 60
      expect(result?.spawns).toHaveLength(2); // only the two popped holes refill
    });

    it('lets a protected cell ride gravity down when cells clear below it', () => {
      // vertical R/R/R, chain [0,1,2]; protect the top cell, pop the two below.
      const result = resolveChain(stateFrom('R/R/R'), [0, 1, 2], new Set([0]));
      expect(idxOf(result?.cleared ?? [])).toEqual([1, 2]);
      expect(idxOf(result?.protectedHits ?? [])).toEqual([0]);
      expect(result?.falls).toContainEqual({ from: 0, to: 2 });
    });

    it('keeps a protected cell in place when cells clear only above it', () => {
      const result = resolveChain(stateFrom('R/R/R'), [0, 1, 2], new Set([2]));
      expect(idxOf(result?.cleared ?? [])).toEqual([0, 1]);
      expect(idxOf(result?.protectedHits ?? [])).toEqual([2]);
      expect(result?.falls).toHaveLength(0);
    });

    it('handles two protected cells in one column, ordered row-major', () => {
      const result = resolveChain(stateFrom('R/R/R'), [0, 1, 2], new Set([0, 2]));
      expect(idxOf(result?.cleared ?? [])).toEqual([1]);
      expect(idxOf(result?.protectedHits ?? [])).toEqual([0, 2]);
      expect(result?.falls).toContainEqual({ from: 0, to: 1 });
    });

    it('preserves sweep classification while chipping only the protected cage-cells', () => {
      // square-loop sweeps all ten R; protect two R cells outside the loop.
      const result = resolveChain(stateFrom(ART), [0, 1, 5, 4, 0], new Set([3, 12]));
      expect(result?.kind).toBe('square-loop'); // still a loop despite the protection
      expect(result?.cleared).toHaveLength(8); // 10 R minus the 2 protected
      expect(idxOf(result?.protectedHits ?? [])).toEqual([3, 12]); // collected order
      expect(result?.scoreDelta).toBe(240); // sweep 8 = 10*8*3
    });

    it('accepts an all-protected loop: legal commit, empty cleared, zero score, no throw', () => {
      // 2x2 all-R loop with every corner protected clears nothing but still commits.
      const result = resolveChain(stateFrom('RR/RR'), [0, 1, 3, 2, 0], new Set([0, 1, 2, 3]));
      expect(result).not.toBeNull();
      expect(result?.cleared).toHaveLength(0);
      expect(result?.protectedHits).toHaveLength(4);
      expect(result?.scoreDelta).toBe(0);
      expect(result?.board).toEqual([0, 0, 0, 0]); // nothing removed or refilled
    });
  });

  describe('generic seam (skipCollect + expandCleared)', () => {
    const idxOf = (cells: readonly { index: number }[]) => cells.map((c) => c.index);

    it('is byte-identical to the classic path when the seam is omitted or a no-op', () => {
      for (const seed of [1, 99, 2026]) {
        const base = resolveChain(stateFrom('RR/RR/RR', seed), [0, 1, 3, 2, 0]);
        // An empty seam object, an empty skip set, and a []-returning expand are all no-ops.
        expect(resolveChain(stateFrom('RR/RR/RR', seed), [0, 1, 3, 2, 0], new Set(), {})).toEqual(
          base,
        );
        expect(
          resolveChain(stateFrom('RR/RR/RR', seed), [0, 1, 3, 2, 0], new Set(), {
            skipCollect: new Set(),
            expandCleared: () => [],
          }),
        ).toEqual(base);
        // A byte-identical shape carries no expandedCleared key.
        expect(base && 'expandedCleared' in base).toBe(false);
      }
    });

    it('skipCollect excludes a swept cell from cleared without touching the chain loop', () => {
      // 2x2 loop over 0,1,2,3 sweeps all six R; skipping the sweep cell 5 drops it.
      const result = resolveChain(stateFrom('RR/RR/RR'), [0, 1, 3, 2, 0], new Set(), {
        skipCollect: new Set([5]),
      });
      expect(result?.kind).toBe('square-loop');
      expect(idxOf(result?.cleared ?? [])).toEqual([0, 1, 3, 2, 4]); // drag order 0,1,3,2 then sweep 4; 5 skipped
      expect(result && 'expandedCleared' in result).toBe(false); // skip alone adds nothing
    });

    it('expandCleared empties an extra cell that then falls/refills and is echoed', () => {
      // Chain [3,4,5] pops the middle R row; expand cell 7 (a G) as an extra empty.
      // A B from row 0 col 1 falls into the freed cell 7 — it rejoins gravity.
      const result = resolveChain(stateFrom('BBB/RRR/GGG'), [3, 4, 5], new Set(), {
        expandCleared: () => [7],
      });
      expect(idxOf(result?.cleared ?? [])).toEqual([3, 4, 5]); // expanded NOT in cleared
      expect(result?.expandedCleared).toEqual([7]);
      expect(result?.falls).toContainEqual({ from: 1, to: 7 }); // a dot fell into the freed cell
    });

    it('scores ONLY cleared — an expanded cell contributes zero to the score', () => {
      const withExpand = resolveChain(stateFrom('BBB/RRR/GGG'), [3, 4, 5], new Set(), {
        expandCleared: () => [7],
      });
      const withoutExpand = resolveChain(stateFrom('BBB/RRR/GGG'), [3, 4, 5]);
      expect(withExpand?.scoreDelta).toBe(withoutExpand?.scoreDelta);
    });
  });
});
