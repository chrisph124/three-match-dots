import type { Board, Color } from './types';

/** The eight (dRow, dCol) offsets of a cell's 8-neighbourhood. */
const NEIGHBOUR_OFFSETS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

/**
 * True when a same-colour simple path of at least `minChain` cells begins at
 * `cell`. A depth-limited backtracking DFS over the 8-neighbourhood: it marks
 * the growing path in `seen`, recurses into unvisited same-colour neighbours,
 * and unwinds `seen` on every failed branch. Because a failed search restores
 * `seen` to all-false, one `seen` array is safely reused across start cells.
 *
 * `depth` counts the cells already on the path including `cell`, so the search
 * succeeds the moment the path reaches `minChain` cells.
 */
function chainFrom(
  board: Board,
  seen: boolean[],
  cell: number,
  depth: number,
  rows: number,
  cols: number,
  color: Color,
  minChain: number,
): boolean {
  if (depth >= minChain) {
    return true;
  }
  seen[cell] = true;
  const row = Math.floor(cell / cols);
  const col = cell % cols;
  for (const [dRow, dCol] of NEIGHBOUR_OFFSETS) {
    const nRow = row + dRow;
    const nCol = col + dCol;
    if (nRow < 0 || nCol < 0 || nRow >= rows || nCol >= cols) {
      continue;
    }
    const neighbour = nRow * cols + nCol;
    if (board[neighbour] !== color || seen[neighbour]) {
      continue;
    }
    if (chainFrom(board, seen, neighbour, depth + 1, rows, cols, color, minChain)) {
      return true;
    }
  }
  seen[cell] = false;
  return false;
}

/**
 * True when the board still has a legal chain — some same-colour, 8-connected
 * simple path of at least `minChain` cells. When false, the board is a genuine
 * deadlock and the caller must reshuffle.
 *
 * This searches for a real path rather than merely a large same-colour
 * component. The two are NOT equivalent: a component of `minChain` cells need
 * not contain a path of `minChain` cells. A cell can have three mutually
 * non-adjacent same-colour neighbours (e.g. its N, SW, and SE cells), forming a
 * 4-cell star whose longest chain is only 3 — so a size-only check reports a
 * legal move that does not exist and soft-locks the player at `minChain` 4.
 * The path search is sound for every `minChain` and matches the old size check
 * exactly at `minChain` 3 (any 3-plus-cell component contains a 3-path).
 *
 * This must NOT be written as a scan for adjacent same-colour pairs. Under
 * 8-way adjacency the four cells of any 2x2 block are pairwise adjacent, so
 * with three colours the pigeonhole principle guarantees a same-colour pair on
 * every board — a pair-based check would always return true.
 */
export function hasLegalMove(board: Board, rows: number, cols: number, minChain: number): boolean {
  const seen = new Array<boolean>(rows * cols).fill(false);
  for (let start = 0; start < board.length; start++) {
    if (chainFrom(board, seen, start, 1, rows, cols, board[start], minChain)) {
      return true;
    }
  }
  return false;
}
