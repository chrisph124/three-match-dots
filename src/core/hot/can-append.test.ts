import { describe, expect, it } from 'vitest';
import { canAppend } from './can-append';

const COLS = 4;
const R = 0;
const G = 1;

// 4x4, row-major:
//  R R G R
//  R R G R
//  G G R R
//  R G R G
const BOARD = [R, R, G, R, R, R, G, R, G, G, R, R, R, G, R, G];

describe('canAppend', () => {
  it('appends into an empty chain', () => {
    expect(canAppend([], 0, BOARD, COLS)).toBe('append');
  });

  it('rejects the cell the chain already ends on', () => {
    expect(canAppend([0, 1], 1, BOARD, COLS)).toBe('reject');
  });

  it('undoes when retracing onto the second-to-last dot', () => {
    expect(canAppend([0, 1], 0, BOARD, COLS)).toBe('undo');
  });

  it('rejects a non-adjacent cell', () => {
    expect(canAppend([0], 12, BOARD, COLS)).toBe('reject');
  });

  it('rejects a cell that wraps a row edge', () => {
    // cell 3 is row 0 col 3; cell 4 is row 1 col 0. Both R, but not adjacent.
    expect(canAppend([3], 4, BOARD, COLS)).toBe('reject');
  });

  it('rejects a colour mismatch', () => {
    expect(canAppend([0], 2, BOARD, COLS)).toBe('reject');
  });

  it('appends an adjacent same-colour cell', () => {
    expect(canAppend([0], 1, BOARD, COLS)).toBe('append');
  });

  it('appends diagonally', () => {
    expect(canAppend([0], 5, BOARD, COLS)).toBe('append');
  });

  it('closes the square on a revisit that completes a 2x2', () => {
    // Cells 0,1,5,4 are the R block at rows 0-1, cols 0-1.
    expect(canAppend([0, 1, 5, 4], 0, BOARD, COLS)).toBe('close-square');
  });

  it('rejects a revisit that does not complete a 2x2', () => {
    expect(canAppend([0, 1, 5], 0, BOARD, COLS)).toBe('reject');
  });

  it('rejects every append once the chain is sealed', () => {
    const sealed = [0, 1, 5, 4, 0];
    expect(canAppend(sealed, 8, BOARD, COLS)).toBe('reject');
    expect(canAppend(sealed, 1, BOARD, COLS)).toBe('reject');
  });
});
