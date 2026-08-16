import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../config';
import { parseBoard } from '../test-support/board-fixture';
import type { GameState } from '../types';
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
});
