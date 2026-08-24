// A memoised handle on the Voyage ladder for the render/route layer. The pure
// generator (`generateVoyageLevel`) rebuilds the whole prefix on every call —
// O(index) with a per-level solver calibration — so tapping level N would
// regenerate 1..N each time. This caches ONE forward pass so both the map route
// (progress) and the game route (the level itself) share it and every navigation
// is an O(1) lookup.
//
// Meta layer (not core): it imports the pure core generator but adds the
// process-lifetime cache the UI needs. Deterministic in `(length, paletteSize)`,
// so the cache is keyed by paletteSize and rebuilt only if that ever changes.

import type { LevelScript } from '../core/level/level-script';
import { generateLadder } from '../core/voyage/generate-level';

/**
 * The vertical-slice ladder length. The generator supports thousands; the slice
 * bounds the one-time generation cost (and the boss cadence stays every 10th, so
 * this is 6 bosses). Raise once on-device generation time is measured.
 */
export const SLICE_LADDER_LENGTH = 60;

let cached: { readonly paletteSize: number; readonly levels: readonly LevelScript[] } | null = null;

/** The full slice ladder, generated once per process (per paletteSize). */
export function voyageLadder(paletteSize: number): readonly LevelScript[] {
  if (cached === null || cached.paletteSize !== paletteSize) {
    cached = { paletteSize, levels: generateLadder(SLICE_LADDER_LENGTH, paletteSize) };
  }
  return cached.levels;
}

/** The level at a 1-based ladder index, or `undefined` past the slice end. */
export function voyageLevelAt(index: number, paletteSize: number): LevelScript | undefined {
  return voyageLadder(paletteSize)[index - 1];
}
