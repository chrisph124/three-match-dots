export type Cell = { row: number; col: number };

export function areAdjacent(a: Cell, b: Cell): boolean {
  const rowDelta = Math.abs(a.row - b.row);
  const colDelta = Math.abs(a.col - b.col);
  return rowDelta + colDelta === 1;
}
