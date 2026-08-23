import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from './config';
import { hasLegalMove } from './deadlock';
import { applyResolution, newGame } from './game';
import { resolveChain } from './resolve/resolve-chain';
import { EMPTY } from './types';

describe('newGame', () => {
  it('builds a full board of the configured size', () => {
    const state = newGame(DEFAULT_CONFIG, 2026);
    expect(state.board).toHaveLength(36);
    expect(state.board.includes(EMPTY)).toBe(false);
  });

  it('only uses colours within range', () => {
    for (const color of newGame(DEFAULT_CONFIG, 2026).board) {
      expect(color).toBeGreaterThanOrEqual(0);
      expect(color).toBeLessThan(DEFAULT_CONFIG.colors);
    }
  });

  it('starts at zero score', () => {
    expect(newGame(DEFAULT_CONFIG, 2026).score).toBe(0);
  });

  it('deals an opening board that has a legal move', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const state = newGame(DEFAULT_CONFIG, seed);
      expect(hasLegalMove(state.board, 6, 6, DEFAULT_CONFIG.minChain)).toBe(true);
    }
  });

  it('is reproducible for the same seed', () => {
    expect(newGame(DEFAULT_CONFIG, 42)).toEqual(newGame(DEFAULT_CONFIG, 42));
  });

  it('differs for a different seed', () => {
    expect(newGame(DEFAULT_CONFIG, 1).board).not.toEqual(newGame(DEFAULT_CONFIG, 2).board);
  });

  it('throws on a board smaller than 2x2', () => {
    expect(() => newGame({ ...DEFAULT_CONFIG, rows: 1 }, 1)).toThrow(/rows/);
    expect(() => newGame({ ...DEFAULT_CONFIG, cols: 1 }, 1)).toThrow(/cols/);
  });

  it('throws on fewer than two colours', () => {
    expect(() => newGame({ ...DEFAULT_CONFIG, colors: 1 }, 1)).toThrow(/colors/);
  });

  it('throws on a minimum chain below two', () => {
    expect(() => newGame({ ...DEFAULT_CONFIG, minChain: 1 }, 1)).toThrow(/minChain/);
  });
});

describe('applyResolution', () => {
  it('folds board, score, and rng state forward', () => {
    const state = newGame(DEFAULT_CONFIG, 2026);
    const cols = DEFAULT_CONFIG.cols;

    // Find any legal three-in-a-row to commit.
    let chain: number[] | null = null;
    for (let i = 0; i < state.board.length && chain === null; i++) {
      if (
        (i % cols) + 2 < cols &&
        state.board[i + 1] === state.board[i] &&
        state.board[i + 2] === state.board[i]
      ) {
        chain = [i, i + 1, i + 2];
      }
    }
    if (chain === null) {
      throw new Error('seed 2026 was expected to deal a horizontal triple');
    }

    const resolution = resolveChain(state, chain);
    if (resolution === null) {
      throw new Error('expected a resolution');
    }

    const nextState = applyResolution(state, resolution);
    expect(nextState.board).toEqual(resolution.board);
    expect(nextState.score).toBe(resolution.scoreDelta);
    expect(nextState.rngState).toBe(resolution.rngState);
    expect(nextState.config).toBe(state.config);
  });

  it('accumulates score across moves', () => {
    const state = newGame(DEFAULT_CONFIG, 2026);
    const fake = {
      kind: 'plain' as const,
      color: 0,
      cleared: [],
      falls: [],
      spawns: [],
      scoreDelta: 120,
      board: state.board,
      rngState: 5,
    };
    expect(applyResolution(applyResolution(state, fake), fake).score).toBe(240);
  });

  it('does not mutate the previous state', () => {
    const state = newGame(DEFAULT_CONFIG, 2026);
    const before = [...state.board];
    applyResolution(state, {
      kind: 'plain',
      color: 0,
      cleared: [],
      falls: [],
      spawns: [],
      scoreDelta: 10,
      board: [],
      rngState: 1,
    });
    expect(state.board).toEqual(before);
    expect(state.score).toBe(0);
  });

  describe('combo-heat carry', () => {
    it('starts a new game cold', () => {
      const state = newGame(DEFAULT_CONFIG, 2026);
      expect(state.heat).toBe(0);
      expect(state.lastKind).toBeNull();
    });

    it('carries the resolution heat and kind forward', () => {
      const state = newGame(DEFAULT_CONFIG, 2026);
      const next = applyResolution(state, {
        kind: 'line',
        color: 0,
        cleared: [],
        falls: [],
        spawns: [],
        scoreDelta: 150,
        board: state.board,
        rngState: 7,
        heat: 2,
      });
      expect(next.heat).toBe(2);
      expect(next.lastKind).toBe('line');
    });

    it('reads a heatless resolution (heat off) as cold and still tracks kind', () => {
      const state = newGame(DEFAULT_CONFIG, 2026);
      const next = applyResolution(state, {
        kind: 'plain',
        color: 0,
        cleared: [],
        falls: [],
        spawns: [],
        scoreDelta: 60,
        board: state.board,
        rngState: 7,
      });
      expect(next.heat).toBe(0);
      expect(next.lastKind).toBe('plain');
    });
  });
});
