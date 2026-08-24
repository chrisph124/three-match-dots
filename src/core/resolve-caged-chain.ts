import { protectedOf } from './obstacles/caged-dot';
import { resolveChain } from './resolve/resolve-chain';
import type { CellIndex, Chain, GameState, Resolution } from './types';

/**
 * The ONE shared bridge between a caged overlay and the cage-blind colour core:
 * it derives the protected cells from the overlay (`protectedOf` = every cage
 * with ≥ 2 layers) and hands them to `resolveChain`. A multi-layer cage in the
 * chain links, counts, and classifies on the FULL chain but resists removal —
 * it chips instead of popping — while a 1-layer cage (not protected) pops as it
 * always has.
 *
 * Both mode hooks (Journey, Voyage) call this; keeping it a single module — not
 * two mode-named copies — is what stops the fold contract from drifting. If a
 * mode ever needs bespoke pre-processing, inline `protectedOf` at that one
 * call-site rather than forking this file.
 *
 * Returns the same `Resolution | null` as `resolveChain`; `null` still means an
 * illegal chain (a mistake), so callers penalize exactly as before.
 */
export function resolveCagedChain(
  game: GameState,
  chain: Chain,
  caged: ReadonlyMap<CellIndex, number>,
): Resolution | null {
  return resolveChain(game, chain, protectedOf(caged));
}
