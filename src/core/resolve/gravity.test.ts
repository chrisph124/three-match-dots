import { describe, expect, it } from 'vitest';
import { formatBoard, parseBoard } from '../test-support/board-fixture';
import type { ClearedCell } from '../types';
import { applyGravity } from './gravity';

const clear = (indices: number[]): ClearedCell[] =>
  indices.map((index) => ({ index, color: 0, reason: 'chain' as const }));

describe('applyGravity', () => {
  it('drops survivors into the holes below them', () => {
    const { board, rows, cols } = parseBoard('RG/BG/RB');
    const result = applyGravity(board, clear([4]), rows, cols);
    expect(formatBoard(result.board, cols)).toBe('.G/RG/BB');
  });

  it('reports each fall as an explicit from -> to', () => {
    const { board, rows, cols } = parseBoard('RG/BG/RB');
    const result = applyGravity(board, clear([4]), rows, cols);
    expect(result.falls).toEqual([
      { from: 2, to: 4 },
      { from: 0, to: 2 },
    ]);
  });

  it('never reports a fall where from equals to', () => {
    const { board, rows, cols } = parseBoard('RG/BG/RB');
    const result = applyGravity(board, clear([0]), rows, cols);
    expect(result.falls).toEqual([]);
    expect(formatBoard(result.board, cols)).toBe('.G/BG/RB');
  });

  it('handles several holes in one column', () => {
    // Left column top-to-bottom is R, B, R, G. Clearing rows 1 and 3 leaves
    // R and R, which settle into the bottom two rows.
    const { board, rows, cols } = parseBoard('RG/BG/RB/GB');
    const result = applyGravity(board, clear([2, 6]), rows, cols);
    expect(formatBoard(result.board, cols)).toBe('.G/.G/RB/RB');
  });

  it('leaves a fully cleared column empty', () => {
    const { board, rows, cols } = parseBoard('RG/RG/RB');
    const result = applyGravity(board, clear([0, 2, 4]), rows, cols);
    expect(formatBoard(result.board, cols)).toBe('.G/.G/.B');
  });

  it('orders falls per column bottom-up, columns left to right', () => {
    const { board, rows, cols } = parseBoard('RGB/RGB/RGB');
    const result = applyGravity(board, clear([6, 7, 8]), rows, cols);
    expect(result.falls).toEqual([
      { from: 3, to: 6 },
      { from: 0, to: 3 },
      { from: 4, to: 7 },
      { from: 1, to: 4 },
      { from: 5, to: 8 },
      { from: 2, to: 5 },
    ]);
  });

  it('does not mutate the input board', () => {
    const { board, rows, cols } = parseBoard('RG/BG/RB');
    const before = [...board];
    applyGravity(board, clear([4]), rows, cols);
    expect(board).toEqual(before);
  });
});
