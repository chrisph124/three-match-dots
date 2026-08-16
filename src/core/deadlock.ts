import type { Board, Color } from './types';

/**
 * Push all unvisited same-colour 8-connected neighbours of cell onto stack.
 */
function pushNeighbours(
  stack: number[],
  seen: boolean[],
  board: Board,
  cell: number,
  rows: number,
  cols: number,
  color: Color,
): void {
  const row = Math.floor(cell / cols);
  const col = cell % cols;
  for (let dRow = -1; dRow <= 1; dRow++) {
    for (let dCol = -1; dCol <= 1; dCol++) {
      if (dRow === 0 && dCol === 0) {
        continue;
      }
      const nRow = row + dRow;
      const nCol = col + dCol;
      if (nRow < 0 || nCol < 0 || nRow >= rows || nCol >= cols) {
        continue;
      }
      const neighbour = nRow * cols + nCol;
      if (!seen[neighbour] && board[neighbour] === color) {
        seen[neighbour] = true;
        stack.push(neighbour);
      }
    }
  }
}

/**
 * True when some same-colour, 8-connected component is at least `minChain`
 * cells large — which is exactly the condition for a legal chain to exist,
 * PROVIDED `minChain` is 3 or 4.
 *
 * The general claim "a component of size >= minChain always contains a path
 * of minChain vertices" is false (a star graph has arbitrarily many vertices
 * but no path longer than 3). It holds here only up to size 4, and only
 * because of a property specific to the 8-neighbourhood on a grid: any cell
 * has at most 2 mutually non-adjacent neighbours among its 8, so any 3
 * same-colour cells within a component must contain an adjacent pair — which
 * is enough to guarantee both a 3-path and a 4-path once a component reaches
 * that size. It is NOT enough to guarantee a 5-path or longer.
 *
 * Do not raise `minChain` above 4 without replacing this size check with a
 * real path search: past that bound this function can report a legal move
 * that does not exist, which is a genuine soft-lock for the player, not a
 * cosmetic bug.
 *
 * This must NOT be written as a scan for adjacent same-colour pairs. Under
 * 8-way adjacency the four cells of any 2x2 block are pairwise adjacent, so
 * with three colours the pigeonhole principle guarantees a same-colour pair
 * on every board — a pair-based check would always return true.
 */
export function hasLegalMove(board: Board, rows: number, cols: number, minChain: number): boolean {
  const seen = new Array<boolean>(rows * cols).fill(false);

  for (let start = 0; start < board.length; start++) {
    if (seen[start]) {
      continue;
    }
    const color = board[start];
    const stack = [start];
    seen[start] = true;
    let size = 0;

    while (stack.length > 0) {
      const cell = stack.pop() as number;
      size++;
      if (size >= minChain) {
        return true;
      }
      pushNeighbours(stack, seen, board, cell, rows, cols, color);
    }
  }
  return false;
}
