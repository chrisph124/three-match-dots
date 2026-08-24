import { DEFAULT_CONFIG } from '../config';
import type { Constraint, LevelScript } from '../level/level-script';
import { parseLevelScript } from '../level/level-script';
import { biomeFor } from './biome-rotation';
import { bossFor } from './boss';
import { bottomAnchoredCages } from './cage-layout';
import {
  EPISODE_1_LAST,
  VOYAGE_COLS,
  VOYAGE_ROWS,
  cageLayersForIndex,
  episodeOf,
  seedForIndex,
} from './voyage-config';

/**
 * The curated Episode-1 teaching ramp (levels 1–10). Where a hand-tuned beat
 * matters, these override the pure generator — but each is still emitted as a
 * validated `LevelScript`. The order teaches: link → longer link → sweep →
 * caged dot → cage + clear → timed → tightened moves → mistakes → pre-boss →
 * "The Caged Core" (level 10, delegated to the boss pool).
 *
 * Curated beats are variety-exempt: the goal here is a legible teaching order,
 * not maximal signature distance from generated neighbours. Pure TS (no RN/Skia).
 */

type CuratedSpec = {
  readonly suffix: string;
  readonly colors: number;
  readonly constraint: Constraint;
  readonly objectives: LevelScript['objectives'];
  readonly cages: number;
  /**
   * Per-cage layer overrides, by cage index. Omitted entries fall back to the
   * `cageLayersForIndex` band (teach = 1 in Episode 1). Used to author the seeded
   * 2-layer teaching cage on level 5 directly, without bending the band authority.
   */
  readonly cageLayers?: readonly number[];
  readonly designIntent: string;
};

const MOVES = (budget: number): Constraint => ({ type: 'moves', budget });

/** The curated specs for levels 1–9 (level 10 comes from the boss pool). */
const CURATED: Readonly<Record<number, CuratedSpec>> = {
  1: {
    suffix: 'first-links',
    colors: 3,
    constraint: MOVES(25),
    objectives: [{ type: 'clearColor', color: 0, count: 8 }],
    cages: 0,
    designIntent: 'teach/link',
  },
  2: {
    suffix: 'longer-links',
    colors: 3,
    constraint: MOVES(24),
    objectives: [{ type: 'clearColor', color: 1, count: 10 }],
    cages: 0,
    designIntent: 'teach/link-longer',
  },
  3: {
    suffix: 'sweeps',
    colors: 4,
    constraint: MOVES(24),
    objectives: [{ type: 'clearColor', color: 0, count: 12 }],
    cages: 0,
    designIntent: 'teach/sweep',
  },
  4: {
    suffix: 'caged-dot',
    colors: 3,
    constraint: MOVES(22),
    objectives: [{ type: 'freeCaged' }],
    cages: 1,
    designIntent: 'teach/caged-dot',
  },
  5: {
    suffix: 'cage-and-clear',
    colors: 4,
    constraint: MOVES(22),
    objectives: [{ type: 'clearColor', color: 0, count: 10 }, { type: 'freeCaged' }],
    cages: 2,
    // Seed ONE 2-layer teaching cage BEFORE the L10 boss (Validation S1) so the
    // layered mechanic — and the Phase-6 teaching popup — is met on a low-stakes
    // mid level, not at the Caged Core. The second cage falls back to teach = 1.
    // Tunable on-device for pacing; keep L4 as the earlier 1-layer instant-pop.
    cageLayers: [2],
    designIntent: 'teach/caged-and-clear',
  },
  6: {
    suffix: 'against-the-clock',
    colors: 4,
    constraint: { type: 'timed', startMs: 60000, mistakePenaltyMs: 2000, clearBonusMs: 500 },
    objectives: [{ type: 'clearColor', color: 2, count: 12 }],
    cages: 0,
    designIntent: 'teach/timed',
  },
  7: {
    suffix: 'tighter-moves',
    colors: 4,
    constraint: MOVES(16),
    objectives: [{ type: 'clearColor', color: 0, count: 12 }],
    cages: 0,
    designIntent: 'teach/tighten',
  },
  8: {
    suffix: 'no-mistakes',
    colors: 4,
    constraint: { type: 'mistakes', cap: 5 },
    objectives: [{ type: 'clearColor', color: 1, count: 10 }],
    cages: 0,
    designIntent: 'teach/mistakes',
  },
  9: {
    suffix: 'pre-boss',
    colors: 5,
    constraint: MOVES(18),
    objectives: [{ type: 'clearColor', color: 0, count: 12 }, { type: 'freeCaged' }],
    cages: 3,
    designIntent: 'teach/pre-boss',
  },
};

/** Builds one curated level from its spec. */
function curated(index: number, spec: CuratedSpec, paletteSize: number): LevelScript {
  const biome = biomeFor(index);
  // Cages take the band depth for this index (teach = 1 in Episode 1), with any
  // authored per-cage override applied on top — the seeded 2-layer teach cage.
  const bandLayers = cageLayersForIndex(index);
  const layerCounts = Array.from(
    { length: spec.cages },
    (_, k) => spec.cageLayers?.[k] ?? bandLayers,
  );
  return parseLevelScript(
    {
      schemaVersion: 2,
      id: `voyage-${String(index).padStart(4, '0')}-${spec.suffix}`,
      order: index,
      board: {
        cols: VOYAGE_COLS,
        rows: VOYAGE_ROWS,
        colors: spec.colors,
        minChain: DEFAULT_CONFIG.minChain,
      },
      seed: seedForIndex(index),
      mode: 'voyage',
      constraint: spec.constraint,
      voyage: { index, episode: episodeOf(index), isBoss: false },
      theme: {
        biome: biome.biome,
        variant: biome.variant,
        particle: biome.particle,
        trim: biome.trim,
        parallaxSeed: seedForIndex(index),
        boss: false,
      },
      objectives: spec.objectives,
      obstacles: bottomAnchoredCages(spec.cages, layerCounts, VOYAGE_COLS, VOYAGE_ROWS),
      designIntent: spec.designIntent,
    },
    paletteSize,
  );
}

/** True for a level index inside the curated Episode-1 ramp. */
export function isEpisodeOne(index: number): boolean {
  return index >= 1 && index <= EPISODE_1_LAST;
}

/** The curated Episode-1 level for an index in `1..10` (10 is the Caged Core). */
export function episodeOneLevel(index: number, paletteSize: number): LevelScript {
  if (index === EPISODE_1_LAST) {
    return bossFor(index, paletteSize);
  }
  const spec = CURATED[index];
  if (spec === undefined) {
    throw new Error(
      `episodeOneLevel: index ${index} is outside the curated 1..${EPISODE_1_LAST} ramp`,
    );
  }
  return curated(index, spec, paletteSize);
}
