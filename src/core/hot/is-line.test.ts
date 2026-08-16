import { describe, expect, it } from 'vitest';
import { isCollinearRun } from './is-line';

const COLS = 6;
const MIN = 5;

/** Build a straight run of `length` cells from (row, col) stepping by (dRow, dCol). */
const run = (row: number, col: number, dRow: number, dCol: number, length: number): number[] => {
  const cells: number[] = [];
  for (let i = 0; i < length; i++) {
    cells.push((row + dRow * i) * COLS + (col + dCol * i));
  }
  return cells;
};

describe('isCollinearRun', () => {
  it('is true for a horizontal run of five', () => {
    expect(isCollinearRun(run(2, 0, 0, 1, 5), COLS, MIN)).toBe(true);
  });

  it('is true for a vertical run of five', () => {
    expect(isCollinearRun(run(0, 3, 1, 0, 5), COLS, MIN)).toBe(true);
  });

  it('is true for all eight directions', () => {
    const deltas = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
    for (const [dRow, dCol] of deltas) {
      const startRow = dRow >= 0 ? 0 : 5;
      const startCol = dCol >= 0 ? 0 : 5;
      expect(isCollinearRun(run(startRow, startCol, dRow, dCol, 5), COLS, MIN)).toBe(true);
    }
  });

  it('is true for a run longer than the minimum', () => {
    expect(isCollinearRun(run(0, 0, 0, 1, 6), COLS, MIN)).toBe(true);
  });

  it('is false for a straight run of only four', () => {
    expect(isCollinearRun(run(2, 0, 0, 1, 4), COLS, MIN)).toBe(false);
  });

  it('is false when the run bends at the sixth dot', () => {
    expect(isCollinearRun([...run(0, 0, 0, 1, 5), 11], COLS, MIN)).toBe(false);
  });

  it('is false for a chain shorter than the minimum', () => {
    expect(isCollinearRun([], COLS, MIN)).toBe(false);
    expect(isCollinearRun([0], COLS, MIN)).toBe(false);
    expect(isCollinearRun([0, 1], COLS, MIN)).toBe(false);
  });

  it('honours a different minimum length', () => {
    expect(isCollinearRun(run(2, 0, 0, 1, 4), COLS, 4)).toBe(true);
    expect(isCollinearRun(run(2, 0, 0, 1, 5), COLS, 6)).toBe(false);
  });
});
