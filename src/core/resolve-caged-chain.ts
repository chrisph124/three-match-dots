import { resolveAnchorChain } from './resolve-anchor-chain';
import type { CellIndex, Chain, GameState, Resolution } from './types';

/**
 * A shared, never-mutated empty anchor set: a caged-only resolution has no
 * anchors, so the seam skips nothing and expands nothing — byte-identical to the
 * pre-anchor `resolveChain(game, chain, protectedOf(caged))`.
 */
const NO_ANCHORS: ReadonlySet<CellIndex> = new Set();

/**
 * The ONE shared bridge between a caged overlay and the cage-blind colour core.
 * It now delegates to `resolveAnchorChain` with an empty anchor set, so cages
 * and anchors compose through a single rule instead of two mode-named copies
 * that could drift. A multi-layer cage in the chain links, counts, and
 * classifies on the FULL chain but resists removal — it chips instead of
 * popping — while a 1-layer cage (not protected) pops as it always has.
 *
 * Both mode hooks (Journey, Voyage) call this; if a mode ever needs bespoke
 * pre-processing, inline the composition at that one call-site rather than
 * forking this file.
 *
 * Returns the same `Resolution | null` as `resolveChain`; `null` still means an
 * illegal chain (a mistake), so callers penalize exactly as before.
 */
export function resolveCagedChain(
  game: GameState,
  chain: Chain,
  caged: ReadonlyMap<CellIndex, number>,
): Resolution | null {
  return resolveAnchorChain(game, chain, caged, NO_ANCHORS);
}
