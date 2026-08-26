import { hasLegalMove } from './deadlock';
import { nextInt } from './rng';
import type { Board, CellIndex, CellMove, Color, GameConfig } from './types';

/** Enough attempts that exhausting them is a bug, few enough to never hang. */
const MAX_ATTEMPTS = 100;

/** A shared, never-mutated empty anchor set: the Endless default path. */
const NO_ANCHORS: ReadonlySet<CellIndex> = new Set();

/** The un-anchored cell indices, in order — the only cells a shuffle may move. */
function freeCells(count: number, anchors: ReadonlySet<CellIndex>): number[] {
  const free: number[] = [];
  for (let i = 0; i < count; i++) {
    if (!anchors.has(i)) {
      free.push(i);
    }
  }
  return free;
}

/**
 * Fisher-Yates over the un-anchored positions only (`free`): a weight pins both
 * itself and the dot beneath it, so an anchored cell keeps its colour. With
 * `free` = every cell (no anchors) this draws the same rng sequence and makes the
 * same swaps as a plain full-board shuffle — byte-identical to the pre-anchor path.
 */
function shuffled(
  colors: readonly Color[],
  rngState: number,
  free: readonly number[],
): { colors: Color[]; rngState: number } {
  const next = [...colors];
  let state = rngState;
  for (let k = free.length - 1; k > 0; k--) {
    const step = nextInt(state, k + 1);
    state = step.state;
    const a = free[k];
    const b = free[step.value];
    const swap = next[a];
    next[a] = next[b];
    next[b] = swap;
  }
  return { colors: next, rngState: state };
}

/**
 * Deals a fresh colour for every un-anchored cell while an anchored cell keeps
 * the colour it already held (the weight pins it). With no anchors this deals
 * for every cell in order — byte-identical to the pre-anchor fallback.
 */
function dealt(
  board: Board,
  colors: number,
  rngState: number,
  anchors: ReadonlySet<CellIndex>,
): { colors: Color[]; rngState: number } {
  const next: Color[] = [];
  let state = rngState;
  for (let i = 0; i < board.length; i++) {
    if (anchors.has(i)) {
      next.push(board[i]);
      continue;
    }
    const step = nextInt(state, colors);
    state = step.state;
    next.push(step.value);
  }
  return { colors: next, rngState: state };
}

/**
 * Rearranges the dots already on the board until a legal chain exists,
 * preserving the colour balance the player worked into it.
 *
 * `moves` lets the render layer slide dots to their new cells instead of
 * teleporting them, so a shuffle reads as a rearrangement rather than a wipe.
 * Each move pairs a source cell with a destination that now holds the colour
 * that used to sit there; since a permutation has many valid pairings, the
 * pairing chosen is the greedy one that keeps as many dots in place as
 * possible.
 *
 * `anchors` are weights fixed in place: they do not scatter (only the colours
 * beneath the un-anchored cells permute), and the accepted board must have a
 * legal move that routes AROUND them — so legality is gated by the anchor-aware
 * `hasLegalMove`. An empty set (the Endless default) reproduces the old shuffle
 * byte-for-byte.
 */
export function shuffleBoard(
  board: Board,
  config: GameConfig,
  rngState: number,
  anchors: ReadonlySet<CellIndex> = NO_ANCHORS,
): { board: Color[]; moves: CellMove[]; rngState: number } {
  const { rows, cols, minChain } = config;
  let state = rngState;
  let next: Color[] = [...board];
  const free = freeCells(board.length, anchors);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const result = shuffled(board, state, free);
    state = result.rngState;
    next = result.colors;
    if (hasLegalMove(next, rows, cols, minChain, anchors)) {
      return { board: next, moves: pairMoves(board, next), rngState: state };
    }
  }

  // Fallback: deal fresh dots if no permutation of the input is legal.
  // PRECEDENCE: legality is unconditional; permutation/colour-count is best-effort.
  // The permutation property (colour-faithful rearrangement) holds on all paths
  // reachable in practice; this fallback deliberately breaks it to guarantee legality.
  // Unreachable for any config where colors * minChain <= rows * cols, which every
  // config this codebase constructs satisfies (e.g., 3 * 3 = 9 <= 36 for 6×6 board).
  // By pigeonhole, some colour always holds >= ceil(cells / colours) dots (12 on 6×6
  // with 3 colours), easily arranged into a legal component. If the fallback loop
  // exhausts MAX_ATTEMPTS, the last deal is returned: full, valid, but not provably
  // legal (in practice this is a defensive net that practice cannot reach).
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const result = dealt(board, config.colors, state, anchors);
    state = result.rngState;
    next = result.colors;
    if (hasLegalMove(next, rows, cols, minChain, anchors)) {
      break;
    }
  }
  return { board: next, moves: pairMoves(board, next), rngState: state };
}

/**
 * Pairs each destination cell whose colour changed with a source cell that
 * held that colour and is not staying put. Cells whose colour is unchanged
 * emit no move, so untouched dots do not animate.
 */
function pairMoves(before: Board, after: readonly Color[]): CellMove[] {
  const available = new Map<Color, number[]>();
  for (let cell = 0; cell < before.length; cell++) {
    if (before[cell] === after[cell]) {
      continue;
    }
    const bucket = available.get(before[cell]);
    if (bucket === undefined) {
      available.set(before[cell], [cell]);
    } else {
      bucket.push(cell);
    }
  }

  const moves: CellMove[] = [];
  for (let cell = 0; cell < after.length; cell++) {
    if (before[cell] === after[cell]) {
      continue;
    }
    const bucket = available.get(after[cell]);
    const from = bucket?.pop();
    if (from !== undefined) {
      moves.push({ from, to: cell });
    }
  }
  return moves;
}
