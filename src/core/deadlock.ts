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
 * because any connected component with n vertices contains a path of n
 * vertices when n is small, and always contains one of length minChain when
 * its size reaches minChain.
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
