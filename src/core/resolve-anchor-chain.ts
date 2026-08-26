import { removeAdjacent } from './obstacles/anchor';
import { protectedOf } from './obstacles/caged-dot';
import { resolveChain } from './resolve/resolve-chain';
import type { CellIndex, Chain, GameState, Resolution } from './types';

/**
 * The ONE shared bridge that composes BOTH obstacle overlays over the
 * overlay-blind colour core, sibling to `resolve-caged-chain.ts`:
 *  - caged dots become `protectedCells` (via `protectedOf`) — a multi-layer cage
 *    in the chain chips instead of popping;
 *  - anchors become the resolve seam — `skipCollect` keeps an anchor cell out of a
 *    same-colour sweep, and `expandCleared` empties every anchor that a cleared
 *    cell is 8-way adjacent to, in the SAME pass, using the one shared
 *    `removeAdjacent` rule (the same rule the solver models — no drift).
 *
 * A cell can never be both caged and anchored (the level schema dedups obstacles
 * by cell), so `protectedCells` and the anchor set are disjoint; the two channels
 * echo back independently on `Resolution.protectedHits` / `expandedCleared`.
 *
 * Both meta hooks (Journey, Voyage) and the solver call this. Returns the same
 * `Resolution | null` as `resolveChain`; `null` still means an illegal chain.
 */
export function resolveAnchorChain(
  game: GameState,
  chain: Chain,
  caged: ReadonlyMap<CellIndex, number>,
  anchors: ReadonlySet<CellIndex>,
): Resolution | null {
  return resolveChain(game, chain, protectedOf(caged), {
    skipCollect: anchors,
    expandCleared: (cleared) =>
      removeAdjacent(
        anchors,
        cleared.map((cell) => cell.index),
        game.config.cols,
      ).removed,
  });
}
