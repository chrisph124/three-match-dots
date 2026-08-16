import type { CellIndex, CellMove, Resolution } from '../types';

/**
 * A caged dot is an ordinary dot wearing a cage: it links, clears, and falls
 * under gravity like any other cell. The cage is a Journey-layer overlay — a
 * set of board indices — never a new colour in the `Board`, so the tested
 * colour core (`resolve/**`, `hot/**`) stays untouched.
 */

/** Builds the initial caged overlay from a level's obstacle cell indices. */
export function buildCaged(cells: readonly CellIndex[]): Set<CellIndex> {
  return new Set(cells);
}

/**
 * Removes every caged cell that was cleared this resolution — a cleared cage
 * is a freed cage. Returns a new set; the input is not mutated.
 */
export function freeCleared(caged: ReadonlySet<CellIndex>, resolution: Resolution): Set<CellIndex> {
  const clearedIndices = new Set<CellIndex>(resolution.cleared.map((cell) => cell.index));
  const next = new Set<CellIndex>();
  for (const index of caged) {
    if (!clearedIndices.has(index)) {
      next.add(index);
    }
  }
  return next;
}

/**
 * Translates every surviving caged index through a `from → to` move map.
 *
 * The same `CellMove[]` shape is emitted by gravity (`Resolution.falls`) and by
 * the deadlock reshuffle (`shuffleBoard(...).moves`), so this one helper covers
 * both — do not write two (Decision A).
 *
 * Contract — default to identity: a cell absent from the move list stays put.
 * `applyGravity` emits a fall only when `from !== to`, and `shuffle`'s
 * `pairMoves` skips colour-unchanged cells, so a stationary caged cell never
 * appears in `moves` and must be kept, not dropped. Hence `map.get(idx) ?? idx`.
 */
export function remapMoves(
  caged: ReadonlySet<CellIndex>,
  moves: readonly CellMove[],
): Set<CellIndex> {
  const map = new Map<CellIndex, CellIndex>();
  for (const move of moves) {
    map.set(move.from, move.to);
  }
  const next = new Set<CellIndex>();
  for (const index of caged) {
    next.add(map.get(index) ?? index);
  }
  return next;
}
