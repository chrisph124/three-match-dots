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
});
