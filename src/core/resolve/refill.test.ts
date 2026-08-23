import { describe, expect, it } from 'vitest';
import { parseBoard } from '../test-support/board-fixture';
import { EMPTY } from '../types';
import { refill } from './refill';

// Left column has two holes (rows 0 and 1); right column has one (row 0).
const ART = '../.G/RB';

describe('refill', () => {
  it('fills every empty cell', () => {
    const { board, rows, cols } = parseBoard(ART);
    expect(refill(board, rows, cols, 3, 2026).board.includes(EMPTY)).toBe(false);
  });

  it('leaves settled cells untouched', () => {
    const { board, rows, cols } = parseBoard(ART);
    const result = refill(board, rows, cols, 3, 2026);
    expect(result.board[3]).toBe(1); // the G at row 1, col 1
    expect(result.board[4]).toBe(0); // the R at row 2, col 0
    expect(result.board[5]).toBe(2); // the B at row 2, col 1
  });

  it('emits one spawn per empty cell', () => {
    const { board, rows, cols } = parseBoard(ART);
    expect(refill(board, rows, cols, 3, 2026).spawns).toHaveLength(3);
  });

  it('assigns heightAbove counting up from the lowest new dot', () => {
    const { board, rows, cols } = parseBoard(ART);
    const byCell = new Map(
      refill(board, rows, cols, 3, 2026).spawns.map((s) => [s.to, s.heightAbove]),
    );
    expect(byCell.get(2)).toBe(1); // left column, row 1 -> lands first
    expect(byCell.get(0)).toBe(2); // left column, row 0 -> starts higher
    expect(byCell.get(1)).toBe(1); // right column, single hole
  });

  it('consumes randomness columns left to right, rows top to bottom', () => {
    const { board, rows, cols } = parseBoard(ART);
    expect(refill(board, rows, cols, 3, 2026).spawns.map((s) => s.to)).toEqual([0, 2, 1]);
  });

  it('records the spawned colour on the board', () => {
    const { board, rows, cols } = parseBoard(ART);
    const result = refill(board, rows, cols, 3, 2026);
    for (const spawn of result.spawns) {
      expect(result.board[spawn.to]).toBe(spawn.color);
    }
  });

  it('only spawns colours within range', () => {
    const { board, rows, cols } = parseBoard(ART);
    for (const spawn of refill(board, rows, cols, 3, 2026).spawns) {
      expect(spawn.color).toBeGreaterThanOrEqual(0);
      expect(spawn.color).toBeLessThan(3);
    }
  });

  it('is reproducible for the same seed', () => {
    const { board, rows, cols } = parseBoard(ART);
    expect(refill(board, rows, cols, 3, 777)).toEqual(refill(board, rows, cols, 3, 777));
  });

  it('differs for a different seed', () => {
    const { board, rows, cols } = parseBoard('..../..../..../....');
    expect(refill(board, rows, cols, 3, 1).board).not.toEqual(
      refill(board, rows, cols, 3, 2).board,
    );
  });

  it('is a no-op on a full board', () => {
    const { board, rows, cols } = parseBoard('RG/BG/RB');
    const result = refill(board, rows, cols, 3, 777);
    expect(result.spawns).toEqual([]);
    expect(result.board).toEqual([...board]);
    expect(result.rngState).toBe(777);
  });

  it('does not mutate the input board', () => {
    const { board, rows, cols } = parseBoard(ART);
    const before = [...board];
    refill(board, rows, cols, 3, 777);
    expect(board).toEqual(before);
  });

  describe('post-sweep colour exclusion', () => {
    // A big all-holes board so a single refill draws many cells.
    const holes = (rows: number, cols: number) => new Array<number>(rows * cols).fill(EMPTY);

    it('is byte-identical to the plain refill when exclusion is off', () => {
      const { board, rows, cols } = parseBoard(ART);
      const base = refill(board, rows, cols, 3, 2026);
      // No excludeColor, undefined weight, and an excludeColor with weight 0 all
      // take the literal current loop — the RNG contract the seeded tests depend on.
      expect(refill(board, rows, cols, 3, 2026, undefined, undefined)).toEqual(base);
      expect(refill(board, rows, cols, 3, 2026, undefined, 1)).toEqual(base);
      expect(refill(board, rows, cols, 3, 2026, 0, 0)).toEqual(base);
    });

    it('never spawns the excluded colour under a full ban (weight 1)', () => {
      const board = holes(8, 8);
      const { spawns } = refill(board, 8, 8, 3, 2026, 0, 1);
      expect(spawns).toHaveLength(64);
      expect(spawns.every((s) => s.color !== 0)).toBe(true);
      expect(spawns.every((s) => s.color >= 0 && s.color < 3)).toBe(true);
    });

    it('full-ban excludes any of the colours, not just colour 0', () => {
      const board = holes(8, 8);
      for (const excluded of [0, 1, 2]) {
        const { spawns } = refill(board, 8, 8, 3, 4242, excluded, 1);
        expect(spawns.every((s) => s.color !== excluded)).toBe(true);
      }
    });

    it('down-weights but still spawns the excluded colour at a partial weight', () => {
      // Aggregate across many seeds so the frequency claim is robust, not seed-luck.
      let excluded = 0;
      let total = 0;
      for (let seed = 1; seed <= 200; seed++) {
        for (const s of refill(holes(6, 6), 6, 6, 3, seed, 0, 0.5).spawns) {
          total++;
          if (s.color === 0) excluded++;
        }
      }
      const share = excluded / total;
      // Weight 0.5 gives colour 0 relative weight 0.5 vs 1 for each other colour:
      // P = 0.5 / (0.5 + 1 + 1) = 0.2, well below the uniform 1/3, but non-zero.
      expect(share).toBeLessThan(1 / 3);
      expect(share).toBeGreaterThan(0);
    });

    it('is reproducible for the same seed with exclusion on', () => {
      const board = holes(6, 6);
      expect(refill(board, 6, 6, 3, 999, 1, 1)).toEqual(refill(board, 6, 6, 3, 999, 1, 1));
      expect(refill(board, 6, 6, 3, 999, 1, 0.5)).toEqual(refill(board, 6, 6, 3, 999, 1, 0.5));
    });
  });
});
