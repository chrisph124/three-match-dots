import { describe, expect, it } from 'vitest';
import { areAdjacent, colOf, rowOf } from './adjacency';

const COLS = 6;

describe('rowOf / colOf', () => {
  it('decodes a flat index', () => {
    expect(rowOf(0, COLS)).toBe(0);
    expect(colOf(0, COLS)).toBe(0);
    expect(rowOf(7, COLS)).toBe(1);
    expect(colOf(7, COLS)).toBe(1);
    expect(rowOf(35, COLS)).toBe(5);
    expect(colOf(35, COLS)).toBe(5);
  });
});

describe('areAdjacent', () => {
  it('is true for orthogonal neighbours', () => {
    expect(areAdjacent(7, 6, COLS)).toBe(true);
    expect(areAdjacent(7, 8, COLS)).toBe(true);
    expect(areAdjacent(7, 1, COLS)).toBe(true);
    expect(areAdjacent(7, 13, COLS)).toBe(true);
  });

  it('is true for diagonal neighbours', () => {
    expect(areAdjacent(7, 0, COLS)).toBe(true);
    expect(areAdjacent(7, 2, COLS)).toBe(true);
    expect(areAdjacent(7, 12, COLS)).toBe(true);
    expect(areAdjacent(7, 14, COLS)).toBe(true);
  });

  it('is false for the same cell', () => {
    expect(areAdjacent(7, 7, COLS)).toBe(false);
  });

  it('is false for distant cells', () => {
    expect(areAdjacent(0, 35, COLS)).toBe(false);
    expect(areAdjacent(0, 2, COLS)).toBe(false);
    expect(areAdjacent(0, 12, COLS)).toBe(false);
  });

  // The bug this representation invites.
  it('does not wrap around a row edge', () => {
    expect(areAdjacent(5, 6, COLS)).toBe(false); // row 0 col 5 -> row 1 col 0
    expect(areAdjacent(11, 12, COLS)).toBe(false);
    expect(areAdjacent(5, 12, COLS)).toBe(false); // "down-left" by raw offset
    expect(areAdjacent(6, 5, COLS)).toBe(false);
  });

  it('handles corner cells', () => {
    expect(areAdjacent(0, 1, COLS)).toBe(true);
    expect(areAdjacent(0, 6, COLS)).toBe(true);
    expect(areAdjacent(0, 7, COLS)).toBe(true);
    expect(areAdjacent(35, 34, COLS)).toBe(true);
    expect(areAdjacent(35, 29, COLS)).toBe(true);
    expect(areAdjacent(35, 28, COLS)).toBe(true);
  });

  it('handles left- and right-edge cells', () => {
    expect(areAdjacent(12, 6, COLS)).toBe(true);
    expect(areAdjacent(12, 7, COLS)).toBe(true);
    expect(areAdjacent(12, 11, COLS)).toBe(false); // row 2 col 0 vs row 1 col 5
    expect(areAdjacent(17, 18, COLS)).toBe(false); // row 2 col 5 vs row 3 col 0
  });
});
