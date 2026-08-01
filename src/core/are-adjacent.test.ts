import { describe, expect, it } from 'vitest';
import { areAdjacent } from './are-adjacent';

describe('areAdjacent', () => {
  it('is true for orthogonal neighbors', () => {
    expect(areAdjacent({ row: 0, col: 0 }, { row: 0, col: 1 })).toBe(true);
    expect(areAdjacent({ row: 1, col: 1 }, { row: 0, col: 1 })).toBe(true);
  });

  it('is false for diagonal neighbors', () => {
    expect(areAdjacent({ row: 0, col: 0 }, { row: 1, col: 1 })).toBe(false);
  });

  it('is false for the same cell', () => {
    expect(areAdjacent({ row: 2, col: 2 }, { row: 2, col: 2 })).toBe(false);
  });

  it('is false for distant cells', () => {
    expect(areAdjacent({ row: 0, col: 0 }, { row: 0, col: 3 })).toBe(false);
  });
});
