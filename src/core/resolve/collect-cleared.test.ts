import { describe, expect, it } from 'vitest';
import { parseBoard } from '../test-support/board-fixture';
import { collectCleared } from './collect-cleared';

// 4x4:
//  R R G R
//  R R G R
//  G G R R
//  R G R G
const { board } = parseBoard('RRGR/RRGR/GGRR/RGRG');

describe('collectCleared', () => {
  it('clears exactly the chain for a plain chain', () => {
    expect(collectCleared(board, [0, 1, 5], 'plain')).toEqual([
      { index: 0, color: 0, reason: 'chain' },
      { index: 1, color: 0, reason: 'chain' },
      { index: 5, color: 0, reason: 'chain' },
    ]);
  });

  it('keeps chain cells in drag order', () => {
    const cleared = collectCleared(board, [5, 4, 0, 1], 'plain');
    expect(cleared.map((c) => c.index)).toEqual([5, 4, 0, 1]);
  });

  it('sweeps every cell of the colour for a square-loop', () => {
    const cleared = collectCleared(board, [0, 1, 5, 4, 0], 'square-loop');
    // Every R on the board: 0,1,3,4,5,7,10,11,12,14
    expect(cleared.map((c) => c.index).sort((a, b) => a - b)).toEqual([
      0, 1, 3, 4, 5, 7, 10, 11, 12, 14,
    ]);
  });

  it("counts a sealed chain's repeated closing cell only once", () => {
    const indices = collectCleared(board, [0, 1, 5, 4, 0], 'square-loop').map((c) => c.index);
    expect(new Set(indices).size).toBe(indices.length);
  });

  it('tags chain cells first in drag order, then sweep cells row-major', () => {
    const cleared = collectCleared(board, [0, 1, 5, 4, 0], 'square-loop');
    expect(cleared.filter((c) => c.reason === 'chain').map((c) => c.index)).toEqual([0, 1, 5, 4]);
    expect(cleared.filter((c) => c.reason === 'color-sweep').map((c) => c.index)).toEqual([
      3, 7, 10, 11, 12, 14,
    ]);
    expect(cleared.slice(0, 4).every((c) => c.reason === 'chain')).toBe(true);
  });

  it('sweeps for a line the same way it does for a loop', () => {
    const cleared = collectCleared(board, [2, 6], 'line');
    // Every G: 2,6,8,9,13,15
    expect(cleared.map((c) => c.index).sort((a, b) => a - b)).toEqual([2, 6, 8, 9, 13, 15]);
    expect(cleared.some((c) => c.reason === 'color-sweep')).toBe(true);
  });
});
