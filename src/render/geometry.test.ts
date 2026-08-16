import { describe, expect, it } from 'vitest';
import {
  cellAtPoint,
  centerX,
  centerY,
  makeLayout,
  moveOffsetX,
  moveOffsetY,
  spawnOffsetY,
} from './geometry';

// 4x4 board, 40px wide -> 10px cells, touch radius 4px.
const layout = makeLayout(4, 4, 40);

describe('makeLayout', () => {
  it('derives cell size and touch radius from the board size', () => {
    expect(layout.cellSize).toBe(10);
    expect(layout.touchRadius).toBeCloseTo(4);
  });
});

describe('centerX / centerY', () => {
  it('centres a cell in its square', () => {
    expect(centerX(0, layout)).toBe(5);
    expect(centerY(0, layout)).toBe(5);
    expect(centerX(5, layout)).toBe(15); // row 1, col 1
    expect(centerY(5, layout)).toBe(15);
    expect(centerX(15, layout)).toBe(35); // row 3, col 3
    expect(centerY(15, layout)).toBe(35);
  });
});

describe('cellAtPoint', () => {
  it('hits a cell at its exact centre', () => {
    expect(cellAtPoint(5, 5, layout)).toBe(0);
    expect(cellAtPoint(35, 5, layout)).toBe(3);
    expect(cellAtPoint(15, 25, layout)).toBe(9); // row 2, col 1
  });

  it('hits at the edge of the touch radius', () => {
    expect(cellAtPoint(5, 1, layout)).toBe(0); // exactly 4px above centre
  });

  it('misses in the dead zone between dots', () => {
    expect(cellAtPoint(1, 1, layout)).toBe(-1); // corner of cell 0, ~5.66px away
    expect(cellAtPoint(10, 10, layout)).toBe(-1); // the four-corner junction
  });

  it('misses off the board', () => {
    expect(cellAtPoint(-1, 5, layout)).toBe(-1);
    expect(cellAtPoint(5, -1, layout)).toBe(-1);
    expect(cellAtPoint(45, 5, layout)).toBe(-1);
    expect(cellAtPoint(5, 45, layout)).toBe(-1);
  });

  it('widens with the touch fraction', () => {
    // Point (2,2) is 4.24px from cell 0's centre at (5,5).
    expect(cellAtPoint(2, 2, layout)).toBe(-1); // default radius 4 -> miss
    const generous = makeLayout(4, 4, 40, 0.5);
    expect(cellAtPoint(2, 2, generous)).toBe(0); // radius 5 -> hit
    expect(cellAtPoint(1, 1, generous)).toBe(-1); // 5.66px away -> still a miss
  });
});

describe('moveOffsetX / moveOffsetY', () => {
  it('reports where a dot came from, in pixels', () => {
    expect(moveOffsetY(2, 10, layout)).toBe(-20); // fell two rows
    expect(moveOffsetX(2, 10, layout)).toBe(0); // same column
    expect(moveOffsetX(0, 3, layout)).toBe(-30); // slid three columns right
  });

  it('is zero for a dot that did not move', () => {
    expect(moveOffsetX(7, 7, layout)).toBe(0);
    expect(moveOffsetY(7, 7, layout)).toBe(0);
  });
});

describe('spawnOffsetY', () => {
  it('starts every dot in a column the same distance above the board', () => {
    // A column with two holes: both new dots fall exactly two cells.
    expect(spawnOffsetY(0, 2, layout)).toBe(-20); // lands row 0, heightAbove 2
    expect(spawnOffsetY(4, 1, layout)).toBe(-20); // lands row 1, heightAbove 1
  });

  it('scales with the number of holes', () => {
    expect(spawnOffsetY(0, 1, layout)).toBe(-10);
    expect(spawnOffsetY(0, 4, layout)).toBe(-40);
  });
});
