import type { CellIndex } from '../types';

export function rowOf(cell: CellIndex, cols: number): number {
  'worklet';
  return Math.floor(cell / cols);
}

export function colOf(cell: CellIndex, cols: number): number {
  'worklet';
  return cell % cols;
}

/**
 * 8-way adjacency. Columns are decoded rather than compared as raw index
 * deltas, because cell+1 at the right edge is the next row's first cell.
 */
export function areAdjacent(a: CellIndex, b: CellIndex, cols: number): boolean {
  'worklet';
  if (a === b) {
    return false;
  }
  const rowDelta = Math.abs(rowOf(a, cols) - rowOf(b, cols));
  const colDelta = Math.abs(colOf(a, cols) - colOf(b, cols));
  return rowDelta <= 1 && colDelta <= 1;
}
