import type { CellIndex, CellMove, Resolution } from '../types';

/**
 * A caged dot is an ordinary dot wearing a LAYERED cage: it links, clears, and
 * falls under gravity like any other cell. The cage is a Journey/Voyage-layer
 * overlay — a Map of board index → layers remaining (≥ 1) — never a new colour
 * in the `Board`, so the tested colour core (`resolve/**`, `hot/**`) stays
 * untouched. A cage sheds one layer per same-colour clear that includes it; the
 * dot only pops (frees) when its LAST layer breaks. A 1-layer cage pops on its
 * first clear — the classic behaviour.
 */

/** One caged cell as authored: its board index and its layer depth (≥ 1). */
export type CagedCell = { readonly index: CellIndex; readonly layers: number };

/** Builds the initial caged overlay from a level's caged cells (index → layers). */
export function buildCaged(cells: readonly CagedCell[]): Map<CellIndex, number> {
  return new Map(cells.map((cell) => [cell.index, cell.layers]));
}

/**
 * The cells to hand `resolveChain` as protected: every cage with ≥ 2 layers
 * remaining. A 1-layer cage is deliberately NOT protected — the next clear must
 * pop it. Protecting a cell that would not clear is a no-op (the core filters
 * against the collected set), so this can be passed on every commit with no
 * special-casing; an all-1-layer board yields an empty set ⇒ the byte-identical
 * classic resolve path.
 */
export function protectedOf(caged: ReadonlyMap<CellIndex, number>): ReadonlySet<CellIndex> {
  const protectedCells = new Set<CellIndex>();
  for (const [index, layers] of caged) {
    if (layers >= 2) {
      protectedCells.add(index);
    }
  }
  return protectedCells;
}

/**
 * The pure freeing rule over plain index iterables — no `Resolution` allocation
 * needed, so the solver's alloc-free heuristic (Phase 4) shares this EXACT rule
 * with the runtime fold: one rule, two callers, no drift (the level-83
 * divergence lesson). For each caged cell:
 *  - in `clearedIndices` (a 1-layer cage that popped) → removed (freed).
 *  - in `protectedIndices` (a multi-layer cage that was hit) → decremented by 1,
 *    floored at 1 so a 2→1 cage stays in the Map (the next hit pops it).
 *  - untouched → unchanged.
 * Returns a new Map; never mutates the input.
 */
export function chipLayersInner(
  caged: ReadonlyMap<CellIndex, number>,
  clearedIndices: Iterable<CellIndex>,
  protectedIndices: Iterable<CellIndex>,
): Map<CellIndex, number> {
  const cleared = new Set<CellIndex>(clearedIndices);
  const hit = new Set<CellIndex>(protectedIndices);
  const next = new Map<CellIndex, number>();
  for (const [index, layers] of caged) {
    if (cleared.has(index)) {
      continue; // last layer popped → freed
    }
    if (hit.has(index)) {
      next.set(index, Math.max(1, layers - 1)); // one layer shed, never below 1
      continue;
    }
    next.set(index, layers); // untouched
  }
  return next;
}

/**
 * Thin adapter over `chipLayersInner` for the state folds: a cleared caged cell
 * is a freed cage; a caged cell echoed in `protectedHits` is chipped one layer.
 * Returns a new Map; never mutates the input.
 */
export function chipLayers(
  caged: ReadonlyMap<CellIndex, number>,
  resolution: Resolution,
): Map<CellIndex, number> {
  return chipLayersInner(
    caged,
    resolution.cleared.map((cell) => cell.index),
    (resolution.protectedHits ?? []).map((cell) => cell.index),
  );
}

/**
 * Translates every surviving caged cell through a `from → to` move map, carrying
 * its layer value.
 *
 * The same `CellMove[]` shape is emitted by gravity (`Resolution.falls`) and by
 * the deadlock reshuffle (`shuffleBoard(...).moves`), so this one helper covers
 * both — do not write two (Decision A).
 *
 * Contract — default to identity: a cell absent from the move list stays put.
 * `applyGravity` emits a fall only when `from !== to`, and `shuffle`'s
 * `pairMoves` skips colour-unchanged cells, so a stationary caged cell never
 * appears in `moves` and must be kept at its index, not dropped. Hence
 * `map.get(idx) ?? idx`, preserving the layer value at the new key.
 */
export function remapMoves(
  caged: ReadonlyMap<CellIndex, number>,
  moves: readonly CellMove[],
): Map<CellIndex, number> {
  const map = new Map<CellIndex, CellIndex>();
  for (const move of moves) {
    map.set(move.from, move.to);
  }
  const next = new Map<CellIndex, number>();
  for (const [index, layers] of caged) {
    next.set(map.get(index) ?? index, layers);
  }
  return next;
}
