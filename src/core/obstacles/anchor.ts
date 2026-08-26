import { areAdjacent } from '../hot/adjacency';
import type { CellIndex, CellMove } from '../types';

/**
 * An anchor is a paper "weight" pinned to a board cell. Unlike a caged dot, it is
 * NOT an ordinary dot in disguise: it is never linkable and never clears by being
 * chained. It is a Journey/Voyage-layer overlay — a Set of board indices — never a
 * new colour in the `Board`, so the tested colour core (`resolve/**`, `hot/**`)
 * stays untouched (the cagedDot discipline). An anchor is SINGLE-HIT: one
 * same-colour clear that is 8-way adjacent to it removes it outright (no layers,
 * no HP — weight-N is the cage's identity). The freed cell then empties, falls,
 * and refills in the same resolution.
 */

/** Builds the initial anchor overlay from a level's anchor cells. */
export function buildAnchors(cells: readonly CellIndex[]): Set<CellIndex> {
  return new Set(cells);
}

/**
 * The pure removal rule over plain index iterables — the ONE rule shared by the
 * runtime fold (via the resolve bridge) AND the solver heuristic: one rule, two
 * callers, so the two can never disagree about which weight a clear removes.
 *
 * An anchor is removed iff at least one cleared index is 8-way adjacent to it.
 * Adjacency is delegated to `areAdjacent` (`hot/adjacency.ts`) — the single
 * adjacency authority the chain rules already use — so diagonals and the row-edge
 * wrap are handled once, never re-derived here. An anchor cell is itself never
 * cleared (it is unlinkable), and `areAdjacent(a, a)` is false, so the rule reads
 * as "an adjacent clear removes it", not "clearing the cell removes it".
 *
 * Returns a partition (`removed` / `survivors`); never mutates the input.
 */
export function removeAdjacent(
  anchors: ReadonlySet<CellIndex>,
  clearedIndices: Iterable<CellIndex>,
  cols: number,
): { removed: CellIndex[]; survivors: Set<CellIndex> } {
  const cleared = [...clearedIndices];
  const removed: CellIndex[] = [];
  const survivors = new Set<CellIndex>();
  for (const anchor of anchors) {
    if (cleared.some((index) => areAdjacent(index, anchor, cols))) {
      removed.push(anchor);
    } else {
      survivors.add(anchor);
    }
  }
  return { removed, survivors };
}

/**
 * Removes an already-decided set of cells from the overlay — the echo-consuming
 * sibling of `removeAdjacent`. A resolution's seam already computed which weights
 * an adjacent clear removed and echoed them on `Resolution.expandedCleared`; the
 * state fold passes that echo here rather than re-running adjacency, so the
 * runtime and the solver can never disagree about a removal. An absent or empty
 * echo returns a faithful copy. Returns a new Set; never mutates the input.
 */
export function dropAnchors(
  anchors: ReadonlySet<CellIndex>,
  removed: readonly CellIndex[] | undefined,
): Set<CellIndex> {
  if (removed === undefined || removed.length === 0) {
    return new Set(anchors);
  }
  const removedSet = new Set(removed);
  const next = new Set<CellIndex>();
  for (const index of anchors) {
    if (!removedSet.has(index)) {
      next.add(index);
    }
  }
  return next;
}

/**
 * Translates every surviving anchor through a `from → to` move map. Mirrors
 * `remapMoves` (`caged-dot.ts`) but over a `Set` (an anchor carries no layer
 * value).
 *
 * The same `CellMove[]` shape is emitted by gravity (`Resolution.falls`) and by
 * the deadlock reshuffle (`shuffleBoard(...).moves`), so this one helper covers
 * both. Default to identity: a cell absent from the move list stays put
 * (`map.get(idx) ?? idx`) — gravity emits a fall only when `from !== to`, so a
 * stationary anchor never appears in `moves` and must be kept, not dropped.
 * Returns a new Set; never mutates the input.
 */
export function remapAnchors(
  anchors: ReadonlySet<CellIndex>,
  moves: readonly CellMove[],
): Set<CellIndex> {
  const map = new Map<CellIndex, CellIndex>();
  for (const move of moves) {
    map.set(move.from, move.to);
  }
  const next = new Set<CellIndex>();
  for (const index of anchors) {
    next.add(map.get(index) ?? index);
  }
  return next;
}

/**
 * A 0/1 mask indexed by cell (`1` where anchored), for the worklet input layer
 * to suppress linking over an anchored cell without importing this module (a
 * worklet cannot reach a Set). Plain data, no RN. Pure — a fresh array of length
 * `cellCount`.
 */
export function toMask(anchors: ReadonlySet<CellIndex>, cellCount: number): number[] {
  const mask = new Array<number>(cellCount).fill(0);
  for (const index of anchors) {
    if (index >= 0 && index < cellCount) {
      mask[index] = 1;
    }
  }
  return mask;
}
