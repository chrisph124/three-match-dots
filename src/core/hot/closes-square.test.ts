import { describe, expect, it } from 'vitest';
import { closesSquare, formsSquareLoop } from './closes-square';

const COLS = 6;
// The 2x2 block at rows 0-1, cols 0-1 is cells 0, 1, 7, 6.
const SQUARE = [0, 1, 7, 6];

describe('closesSquare', () => {
  it('is true when the last four cells form a 2x2 and the cell closes it', () => {
    expect(closesSquare(SQUARE, 0, COLS)).toBe(true);
  });

  it('is true when the square is at the tail of a long winding chain', () => {
    expect(closesSquare([14, 8, 2, ...SQUARE], 0, COLS)).toBe(true);
  });

  it('is false when the closing cell is not the 4th from the end', () => {
    expect(closesSquare([0, 1, 7, 6, 12], 0, COLS)).toBe(false);
    expect(closesSquare([0, 1, 7], 0, COLS)).toBe(false);
  });

  it('is false when the last four cells are not a 2x2 block', () => {
    expect(closesSquare([0, 1, 2, 3], 0, COLS)).toBe(false); // straight four
    expect(closesSquare([0, 1, 2, 8], 0, COLS)).toBe(false); // an L
  });

  it('is false when the four cells span more than one row or column', () => {
    expect(closesSquare([0, 1, 7, 13], 0, COLS)).toBe(false);
  });

  it('is false for a chain shorter than four', () => {
    expect(closesSquare([0, 1], 0, COLS)).toBe(false);
    expect(closesSquare([], 0, COLS)).toBe(false);
  });
});

describe('formsSquareLoop', () => {
  it('is true for a sealed chain', () => {
    expect(formsSquareLoop([...SQUARE, 0], COLS)).toBe(true);
  });

  it('is true for a sealed chain with a winding lead-in', () => {
    expect(formsSquareLoop([14, 8, 2, ...SQUARE, 0], COLS)).toBe(true);
  });

  // The reason the closing cell is appended at all.
  it('is false for a chain that merely ends on four square-shaped cells', () => {
    expect(formsSquareLoop(SQUARE, COLS)).toBe(false);
  });

  it('is false when the repeated cell does not bound a 2x2', () => {
    expect(formsSquareLoop([0, 1, 2, 3, 0], COLS)).toBe(false);
  });

  it('is false for a long chain that ends on a square without revisiting it', () => {
    expect(formsSquareLoop([14, 8, 2, ...SQUARE], COLS)).toBe(false);
  });
});
