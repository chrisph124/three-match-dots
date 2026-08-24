import { classifyChain } from '../resolve/classify-chain';
import type { Board, CellIndex, ChainKind, GameConfig } from '../types';

/**
 * Headless move enumeration for the Phase-5 solver bot. Given a board it returns
 * the committable moves a player could make: monochrome chains (≥ `minChain`),
 * straight-line sweeps (≥ `lineLength`), and 2×2 square-loop sweeps. Each move is
 * classified with the shipped `classifyChain` authority, so a move's `kind` is
 * exactly what `resolveChain` will produce for it.
 *
 * It is deliberately *representative*, not exhaustive: one greedy longest path
 * per start cell (plus every sweep shape), which is ample for a greedy solver on
 * a ≤64-cell board while staying deterministic and cheap.
 *
 * Soundness w.r.t. deadlock: `hasLegalMove` decides a live board by the same
 * question this asks — is there a same-colour simple path of ≥ `minChain` cells?
 * The greedy path can strand below `minChain` even when such a path exists, so a
 * complete depth-limited DFS (`findChain`) is run as a fallback for any start
 * whose greedy path fell short. That mirrors `hasLegalMove`'s own per-start path
 * search, so `enumerateMoves` finds a move whenever `hasLegalMove` reports one —
 * otherwise the solver would falsely halt on a live board. (A same-colour
 * *component* of `minChain` cells is not enough: a 4-cell star has no 4-chain.)
 *
 * Pure TS over the `src/core/hot/` grid math — no RN/Skia.
 */

/** A committable move: an ordered chain plus the kind `resolveChain` will assign. */
export type Move = {
  readonly chain: readonly CellIndex[];
  readonly kind: ChainKind;
};

/** The four canonical line directions (dRow, dCol); reverses are duplicates. */
const LINE_DIRS: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

/** The lowest-index same-colour neighbour of `cell` not already in `visited`. */
function nextNeighbour(
  board: Board,
  cell: CellIndex,
  color: number,
  visited: readonly boolean[],
  rows: number,
  cols: number,
): CellIndex {
  const row = Math.floor(cell / cols);
  const col = cell % cols;
  let best = -1;
  for (let dRow = -1; dRow <= 1; dRow += 1) {
    for (let dCol = -1; dCol <= 1; dCol += 1) {
      if (dRow === 0 && dCol === 0) {
        continue;
      }
      const nRow = row + dRow;
      const nCol = col + dCol;
      if (nRow < 0 || nCol < 0 || nRow >= rows || nCol >= cols) {
        continue;
      }
      const n = nRow * cols + nCol;
      if (board[n] === color && !visited[n] && (best === -1 || n < best)) {
        best = n;
      }
    }
  }
  return best;
}

/** A greedy simple path from `start`, always extending to the lowest-index cell. */
function greedyPath(board: Board, start: CellIndex, rows: number, cols: number): CellIndex[] {
  const color = board[start];
  const visited = new Array<boolean>(board.length).fill(false);
  visited[start] = true;
  const path: CellIndex[] = [start];
  for (;;) {
    const next = nextNeighbour(board, path[path.length - 1], color, visited, rows, cols);
    if (next === -1) {
      break;
    }
    visited[next] = true;
    path.push(next);
  }
  return path;
}

/** Every same-colour 8-neighbour of `cell` (ascending index). */
function sameColorNeighbours(
  board: Board,
  cell: CellIndex,
  color: number,
  rows: number,
  cols: number,
): CellIndex[] {
  const row = Math.floor(cell / cols);
  const col = cell % cols;
  const out: CellIndex[] = [];
  for (let dRow = -1; dRow <= 1; dRow += 1) {
    for (let dCol = -1; dCol <= 1; dCol += 1) {
      if (dRow === 0 && dCol === 0) {
        continue;
      }
      const nRow = row + dRow;
      const nCol = col + dCol;
      if (nRow < 0 || nCol < 0 || nRow >= rows || nCol >= cols) {
        continue;
      }
      const n = nRow * cols + nCol;
      if (board[n] === color) {
        out.push(n);
      }
    }
  }
  return out;
}

/**
 * A complete depth-limited search for a monochrome simple path of length
 * `minLen` from `start`. Unlike `greedyPath` this backtracks, so it finds a
 * length-`minLen` chain whenever one exists from `start` — the soundness net
 * that keeps `enumerateMoves` in agreement with `hasLegalMove`. Depth is capped
 * at `minLen` (3–4), so the search is cheap and always terminates.
 */
function findChain(
  board: Board,
  start: CellIndex,
  rows: number,
  cols: number,
  minLen: number,
): CellIndex[] | null {
  const color = board[start];
  const visited = new Array<boolean>(board.length).fill(false);
  const path: CellIndex[] = [];

  const extend = (cell: CellIndex): boolean => {
    visited[cell] = true;
    path.push(cell);
    if (path.length >= minLen) {
      return true;
    }
    for (const next of sameColorNeighbours(board, cell, color, rows, cols)) {
      if (!visited[next] && extend(next)) {
        return true;
      }
    }
    path.pop();
    visited[cell] = false;
    return false;
  };

  return extend(start) ? [...path] : null;
}

/** The straight run of `lineLength` cells from `start` in `(dRow, dCol)`, or null. */
function lineRun(
  board: Board,
  start: CellIndex,
  dRow: number,
  dCol: number,
  rows: number,
  cols: number,
  lineLength: number,
): CellIndex[] | null {
  const color = board[start];
  const row = Math.floor(start / cols);
  const col = start % cols;
  const run: CellIndex[] = [];
  for (let step = 0; step < lineLength; step += 1) {
    const r = row + dRow * step;
    const c = col + dCol * step;
    if (r < 0 || c < 0 || r >= rows || c >= cols || board[r * cols + c] !== color) {
      return null;
    }
    run.push(r * cols + c);
  }
  return run;
}

/** The 2×2 loop chain at top-left `(r, c)` when all four cells share a colour. */
function squareLoop(board: Board, r: number, c: number, cols: number): CellIndex[] | null {
  const tl = r * cols + c;
  const tr = tl + 1;
  const bl = tl + cols;
  const br = bl + 1;
  const color = board[tl];
  if (board[tr] !== color || board[bl] !== color || board[br] !== color) {
    return null;
  }
  return [tl, tr, br, bl, tl];
}

/** A stable dedupe key: kind plus the sorted unique cell set the move clears. */
function moveKey(chain: readonly CellIndex[], kind: ChainKind): string {
  const cells = Array.from(new Set(chain)).sort((a, b) => a - b);
  return `${kind}:${cells.join(',')}`;
}

/**
 * The plain chain seeded at `start`: the greedy long path when it reaches
 * `minChain`, otherwise a complete search — greedy can strand below `minChain`
 * on a board that still has a legal chain, and only the complete search keeps
 * `enumerateMoves` in agreement with `hasLegalMove` (else the solver halts).
 */
function chainAt(
  board: Board,
  start: CellIndex,
  rows: number,
  cols: number,
  minChain: number,
): CellIndex[] | null {
  const path = greedyPath(board, start, rows, cols);
  if (path.length >= minChain) {
    return path;
  }
  return findChain(board, start, rows, cols, minChain);
}

/** Every straight sweep run of `lineLength` cells seeded at `start`. */
function lineRunsAt(
  board: Board,
  start: CellIndex,
  rows: number,
  cols: number,
  lineLength: number,
): CellIndex[][] {
  const runs: CellIndex[][] = [];
  for (const [dRow, dCol] of LINE_DIRS) {
    const run = lineRun(board, start, dRow, dCol, rows, cols, lineLength);
    if (run !== null) {
      runs.push(run);
    }
  }
  return runs;
}

/** Every 2×2 loop sweep on the board. */
function squareLoops(board: Board, rows: number, cols: number): CellIndex[][] {
  const loops: CellIndex[][] = [];
  for (let r = 0; r < rows - 1; r += 1) {
    for (let c = 0; c < cols - 1; c += 1) {
      const loop = squareLoop(board, r, c, cols);
      if (loop !== null) {
        loops.push(loop);
      }
    }
  }
  return loops;
}

/** Every representative committable move on the board, deduped and classified. */
export function enumerateMoves(board: Board, config: GameConfig): Move[] {
  const { rows, cols, minChain, lineLength } = config;
  const moves: Move[] = [];
  const seen = new Set<string>();

  const add = (chain: CellIndex[]): void => {
    const kind = classifyChain(chain, cols, lineLength);
    const key = moveKey(chain, kind);
    if (!seen.has(key)) {
      seen.add(key);
      moves.push({ chain, kind });
    }
  };

  for (let start = 0; start < board.length; start += 1) {
    const chain = chainAt(board, start, rows, cols, minChain);
    if (chain !== null) {
      add(chain);
    }
    for (const run of lineRunsAt(board, start, rows, cols, lineLength)) {
      add(run);
    }
  }
  for (const loop of squareLoops(board, rows, cols)) {
    add(loop);
  }

  return moves;
}
