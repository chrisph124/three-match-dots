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
});
