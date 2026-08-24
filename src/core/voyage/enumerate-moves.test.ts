import { describe, expect, it } from 'vitest';
import type { Board, GameConfig } from '../types';
import { enumerateMoves } from './enumerate-moves';

/** A minimal GameConfig for enumeration (only rows/cols/minChain/lineLength are read). */
function cfg(rows: number, cols: number, minChain: number, lineLength: number): GameConfig {
  return { rows, cols, colors: 9, minChain, lineLength, baseScore: 10, sweepMultiplier: 2 };
}

describe('enumerateMoves', () => {
  it('finds plain chains and 2×2 loops on a solid block', () => {
    // A 3×3 board all one colour: a long snake path plus four 2×2 square loops.
    const board: Board = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    const moves = enumerateMoves(board, cfg(3, 3, 3, 5));

    expect(moves.some((m) => m.kind === 'plain')).toBe(true);
    expect(moves.some((m) => m.kind === 'square-loop')).toBe(true);
    // A ≤3-wide board can't hold a 5-run, so no line sweeps here.
    expect(moves.some((m) => m.kind === 'line')).toBe(false);
  });

  it('finds a straight line sweep of exactly lineLength', () => {
    // Row 0 is a run of five colour-1 cells; row 1 breaks every 2×2 and column.
    const board: Board = [1, 1, 1, 1, 1, 0, 2, 0, 2, 0];
    const moves = enumerateMoves(board, cfg(2, 5, 3, 5));

    const line = moves.find((m) => m.kind === 'line');
    expect(line).toBeDefined();
    expect(new Set(line?.chain)).toEqual(new Set([0, 1, 2, 3, 4]));
    expect(moves.some((m) => m.kind === 'square-loop')).toBe(false);
  });

  it('classifies a 2×2 block as a square-loop over its four cells', () => {
    // Only the top-left 2×2 shares a colour; the rest are all distinct.
    const board: Board = [0, 0, 5, 0, 0, 6, 7, 8, 9];
    const moves = enumerateMoves(board, cfg(3, 3, 3, 5));

    const loop = moves.find((m) => m.kind === 'square-loop');
    expect(loop).toBeDefined();
    expect(new Set(loop?.chain)).toEqual(new Set([0, 1, 3, 4]));
  });

  it('returns no moves when no colour reaches minChain', () => {
    // Every cell a distinct colour: no adjacency links a legal chain.
    const board: Board = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    expect(enumerateMoves(board, cfg(3, 3, 3, 5))).toEqual([]);
  });

  it('emits no duplicate moves and is deterministic', () => {
    const board: Board = [
      0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 2, 2, 2, 2, 2, 2, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 2,
      2, 2, 2, 2, 2,
    ];
    const config = cfg(6, 6, 3, 5);
    const moves = enumerateMoves(board, config);

    const keys = moves.map(
      (m) => `${m.kind}:${[...new Set(m.chain)].sort((a, b) => a - b).join(',')}`,
    );
    expect(new Set(keys).size).toBe(moves.length);
    expect(enumerateMoves(board, config)).toEqual(moves);
  });
});
