import { describe, expect, it } from 'vitest';
import { hasLegalMove } from '../deadlock';
import type { Board, CellIndex, GameConfig } from '../types';
import { enumerateMoves } from './enumerate-moves';

/** A minimal GameConfig for enumeration (only rows/cols/minChain/lineLength are read). */
function cfg(rows: number, cols: number, minChain: number, lineLength: number): GameConfig {
  return { rows, cols, colors: 9, minChain, lineLength, baseScore: 10, sweepMultiplier: 2 };
}

/** Every cell any enumerated move touches — a chain member of some proposed move. */
function touchedCells(moves: { chain: readonly CellIndex[] }[]): Set<CellIndex> {
  const cells = new Set<CellIndex>();
  for (const move of moves) {
    for (const cell of move.chain) {
      cells.add(cell);
    }
  }
  return cells;
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

describe('enumerateMoves — anchors', () => {
  it('is byte-identical to passing no set when the anchor set is empty', () => {
    const board: Board = [
      0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 2, 2, 2, 2, 2, 2, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 2,
      2, 2, 2, 2, 2,
    ];
    const config = cfg(6, 6, 3, 5);
    expect(enumerateMoves(board, config, new Set())).toEqual(enumerateMoves(board, config));
  });

  it('never routes a chain or sweep through an anchored cell', () => {
    // A solid one-colour 3×3: every path/loop would normally cross the centre.
    const board: Board = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    const anchors = new Set<CellIndex>([4]); // the centre cell holds a weight
    const moves = enumerateMoves(board, cfg(3, 3, 3, 5), anchors);

    expect(moves.length).toBeGreaterThan(0);
    expect(touchedCells(moves).has(4)).toBe(false);
    // The four 2×2 loops each include the centre, so all are suppressed.
    expect(moves.some((m) => m.kind === 'square-loop')).toBe(false);
  });

  it('agrees with hasLegalMove on an anchor board (both find a move, or neither)', () => {
    // Row 0 is a run of three colour-0 cells; anchoring the middle one strands
    // the only 3-chain (cells 0 and 2 are not 8-adjacent to each other around it…
    // actually they are diagonally via row 1). Assert the two authorities agree.
    const fixtures: { board: Board; rows: number; cols: number }[] = [
      { board: [0, 0, 0, 1, 2, 1, 2, 1, 2], rows: 3, cols: 3 },
      { board: [0, 0, 0, 0, 0, 0, 0, 0, 0], rows: 3, cols: 3 },
      { board: [0, 1, 0, 1, 0, 1, 0, 1, 0], rows: 3, cols: 3 },
    ];
    const anchorSets: CellIndex[][] = [[], [4], [0, 4, 8], [1, 3, 5, 7]];

    for (const { board, rows, cols } of fixtures) {
      for (const cells of anchorSets) {
        const anchors = new Set<CellIndex>(cells);
        const config = cfg(rows, cols, 3, 5);
        const enumerated = enumerateMoves(board, config, anchors).length > 0;
        const legal = hasLegalMove(board, rows, cols, 3, anchors);
        expect(enumerated).toBe(legal);
      }
    }
  });
});
