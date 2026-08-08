import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from './config';
import { hasLegalMove } from './deadlock';
import { shuffleBoard } from './shuffle';
import { parseBoard } from './test-support/board-fixture';

const DEADLOCKED_6X6 = 'BBRBRR/GRGGBG/GBBRRG/RRGGBB/GBBRRG/GRGGBG';

const configFor = (rows: number, cols: number) => ({ ...DEFAULT_CONFIG, rows, cols });

const tally = (board: readonly number[]): number[] => {
  const counts = [0, 0, 0];
  for (const color of board) {
    counts[color]++;
  }
  return counts;
};

describe('shuffleBoard', () => {
  it('preserves the colour counts exactly', () => {
    const { board, rows, cols } = parseBoard(DEADLOCKED_6X6);
    const result = shuffleBoard(board, configFor(rows, cols), 2026);
    expect(tally(result.board)).toEqual(tally(board));
  });

  it('produces a board with a legal move', () => {
    const { board, rows, cols } = parseBoard(DEADLOCKED_6X6);
    const result = shuffleBoard(board, configFor(rows, cols), 2026);
    expect(hasLegalMove(result.board, rows, cols, DEFAULT_CONFIG.minChain)).toBe(true);
  });

  it('actually rearranges the deadlocked board', () => {
    const { board, rows, cols } = parseBoard(DEADLOCKED_6X6);
    const result = shuffleBoard(board, configFor(rows, cols), 2026);
    expect(result.board).not.toEqual([...board]);
  });

  it('emits a move for every dot that changed cell', () => {
    const { board, rows, cols } = parseBoard(DEADLOCKED_6X6);
    const result = shuffleBoard(board, configFor(rows, cols), 2026);
    expect(result.moves.length).toBeGreaterThan(0);
    for (const move of result.moves) {
      expect(move.from).not.toBe(move.to);
      expect(result.board[move.to]).toBe(board[move.from]);
    }
  });

  it('emits no move for a dot that stayed put', () => {
    const { board, rows, cols } = parseBoard(DEADLOCKED_6X6);
    const result = shuffleBoard(board, configFor(rows, cols), 2026);
    const movedTo = new Set(result.moves.map((m) => m.to));
    for (let cell = 0; cell < board.length; cell++) {
      if (!movedTo.has(cell)) {
        expect(result.board[cell]).toBe(board[cell]);
      }
    }
  });

  it('is reproducible for the same seed', () => {
    const { board, rows, cols } = parseBoard(DEADLOCKED_6X6);
    expect(shuffleBoard(board, configFor(rows, cols), 42)).toEqual(
      shuffleBoard(board, configFor(rows, cols), 42),
    );
  });

  it('advances the rng state', () => {
    const { board, rows, cols } = parseBoard(DEADLOCKED_6X6);
    expect(shuffleBoard(board, configFor(rows, cols), 42).rngState).not.toBe(42);
  });

  it('does not mutate the input board', () => {
    const { board, rows, cols } = parseBoard(DEADLOCKED_6X6);
    const before = [...board];
    shuffleBoard(board, configFor(rows, cols), 42);
    expect(board).toEqual(before);
  });

  it('always returns a full, legal board', () => {
    // A single colour can never be deadlocked, so this exercises the happy
    // path of the fallback contract: the result is always legal and full.
    const { board, rows, cols } = parseBoard('RRR/RRR/RRR');
    const result = shuffleBoard(board, configFor(rows, cols), 7);
    expect(hasLegalMove(result.board, rows, cols, DEFAULT_CONFIG.minChain)).toBe(true);
    expect(result.board).toHaveLength(9);
  });
});
