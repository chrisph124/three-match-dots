import type { CellIndex } from '../core/types';

export type BoardLayout = {
  readonly rows: number;
  readonly cols: number;
  readonly cellSize: number;
  /** A touch registers on a dot only within this distance of its centre. */
  readonly touchRadius: number;
};

/**
 * The dead zone the touch radius creates is deliberate. Without it, dragging
 * diagonally past a corner silently links a dot the player never aimed at.
 * Expect to tune `touchFraction` on device.
 */
export function makeLayout(
  rows: number,
  cols: number,
  boardSize: number,
  touchFraction = 0.4,
): BoardLayout {
  const cellSize = boardSize / cols;
  return { rows, cols, cellSize, touchRadius: cellSize * touchFraction };
}

export function centerX(cell: CellIndex, layout: BoardLayout): number {
  'worklet';
  return ((cell % layout.cols) + 0.5) * layout.cellSize;
}

export function centerY(cell: CellIndex, layout: BoardLayout): number {
  'worklet';
  return (Math.floor(cell / layout.cols) + 0.5) * layout.cellSize;
}

/** The cell under a point, or -1 when the point is off-board or between dots. */
export function cellAtPoint(x: number, y: number, layout: BoardLayout): CellIndex {
  'worklet';
  const col = Math.floor(x / layout.cellSize);
  const row = Math.floor(y / layout.cellSize);
  if (col < 0 || row < 0 || col >= layout.cols || row >= layout.rows) {
    return -1;
  }
  const cell = row * layout.cols + col;
  const dx = x - centerX(cell, layout);
  const dy = y - centerY(cell, layout);
  return dx * dx + dy * dy <= layout.touchRadius * layout.touchRadius ? cell : -1;
}

/** Horizontal distance from a dot's old cell to its new one, in pixels. */
export function moveOffsetX(from: CellIndex, to: CellIndex, layout: BoardLayout): number {
  'worklet';
  return ((from % layout.cols) - (to % layout.cols)) * layout.cellSize;
}

/** Vertical distance from a dot's old cell to its new one, in pixels. */
export function moveOffsetY(from: CellIndex, to: CellIndex, layout: BoardLayout): number {
  'worklet';
  return (Math.floor(from / layout.cols) - Math.floor(to / layout.cols)) * layout.cellSize;
}

/**
 * Where a spawned dot starts, relative to the cell it lands in.
 *
 * Every dot refilling one column falls the same distance: the number of holes
 * in that column, which `refill` encodes as heightAbove + the landing row.
 * That makes the incoming dots a stack that slides down as one, rather than a
 * set of dots each appearing at a different height.
 */
export function spawnOffsetY(to: CellIndex, heightAbove: number, layout: BoardLayout): number {
  'worklet';
  return -(heightAbove + Math.floor(to / layout.cols)) * layout.cellSize;
}
