import type { Constraint, LevelScript } from '../level/level-script';
import { cagedCells, parseLevelScript } from '../level/level-script';
import { nextInt } from '../rng';
import { ARCHETYPE_POOL, type ObjectiveKind } from './archetypes';
import { biomeFor } from './biome-rotation';
import { bossFor } from './boss';
import { bottomAnchoredCages } from './cage-layout';
import { budget, spend } from './difficulty-budget';
import { curve } from './difficulty-curve';
import { episodeOneLevel, isEpisodeOne } from './episode-1';
import { signatureOf, similarity, type Signature } from './level-signature';
import { calibrateConstraint } from './solver';
import {
  MISTAKES_CAP,
  SOLVER_BOSS_SLACK,
  SOLVER_SAMPLES,
  SOLVER_SLACK,
  TIMED_CLEAR_BONUS_MS,
  TIMED_MISTAKE_PENALTY_MS,
  TIMED_START_MS,
  VARIETY_MAX_RETRIES,
  VARIETY_SIMILARITY_MAX,
  VARIETY_WINDOW,
  VOYAGE_COLS,
  VOYAGE_ROWS,
  cageLayersForIndex,
  clearCountFor,
  episodeOf,
  isBossIndex,
  mixSeed,
  moveBudgetForTighten,
  seedForIndex,
  type BoardLimits,
} from './voyage-config';

/**
 * The Voyage generation engine: a level index in, a validated `LevelScript` out.
 * Deterministic — `(index, paletteSize)` fully determines the level. Orchestrates
 * curve → budget → archetype → spend → constraint → objectives → seed → assemble
 * → `parseLevelScript`, with a bounded variety re-roll that keeps a sliding
 * window of neighbours signature-distinct. Curated Episode-1 levels and bosses
 * are produced by their own modules and are variety-exempt.
 *
 * Pure TS (no RN/Skia). Winnability is NOT decided by the candidate budgets —
 * Phase 4 emits a candidate move/time budget, then `generateOne` runs the Phase 5
 * solver as a post-step to overwrite it with a play-calibrated one. Calibration
 * only changes budget magnitudes, never the constraint *kind*, so the variety
 * signature (which keys on kind, not budget) is unaffected and the window is
 * identical whether measured before or after calibration.
 */

/** A candidate constraint for the chosen kind (budgets are solver-retuned later). */
function buildConstraint(kind: Constraint['type'], movesTighten: number): Constraint {
  if (kind === 'timed') {
    return {
      type: 'timed',
      startMs: TIMED_START_MS,
      mistakePenaltyMs: TIMED_MISTAKE_PENALTY_MS,
      clearBonusMs: TIMED_CLEAR_BONUS_MS,
    };
  }
  if (kind === 'mistakes') {
    return { type: 'mistakes', cap: MISTAKES_CAP };
  }
  return { type: 'moves', budget: moveBudgetForTighten(movesTighten) };
}

/** Builds the objective list for an archetype's template. */
function buildObjectives(
  kind: ObjectiveKind,
  colors: number,
  D: number,
  rngState: number,
): LevelScript['objectives'] {
  if (kind === 'caged') {
    return [{ type: 'freeCaged' }];
  }
  const count = clearCountFor(D);
  const first = nextInt(rngState, colors);
  if (kind === 'colorAndCaged') {
    return [{ type: 'clearColor', color: first.value, count }, { type: 'freeCaged' }];
  }
  if (kind === 'twoColors') {
    // Pick a distinct second colour: offset 1..colors-1 from the first (mod colors).
    const second = nextInt(first.state, colors - 1);
    const color2 = (first.value + 1 + second.value) % colors;
    return [
      { type: 'clearColor', color: first.value, count },
      { type: 'clearColor', color: color2, count },
    ];
  }
  return [{ type: 'clearColor', color: first.value, count }];
}

/** Assembles one candidate level for an index at a given re-roll attempt. */
function buildGenerated(index: number, paletteSize: number, attempt: number): LevelScript {
  const D = budget(curve(index));
  const archetype = ARCHETYPE_POOL[(seedForIndex(index) + attempt) % ARCHETYPE_POOL.length];
  // Cap colours per archetype, never above the real palette. This keeps the
  // colour axis of the signature varying once difficulty plateaus — otherwise an
  // uncapped spend pins every late level to the full palette and variety dies.
  const colorCap = Math.min(paletteSize, archetype.colorCap);
  const limits: BoardLimits = { paletteSize: colorCap, rows: VOYAGE_ROWS, cols: VOYAGE_COLS };
  const spendSeed = mixSeed(seedForIndex(index), attempt);
  const { dials, rngState } = spend(D, archetype.profile, spendSeed, limits);

  const constraintPick = nextInt(rngState, archetype.constraints.length);
  const constraint = buildConstraint(
    archetype.constraints[constraintPick.value],
    dials.movesTighten,
  );

  const needsCages = archetype.objective === 'caged' || archetype.objective === 'colorAndCaged';
  const obstacleCount = needsCages ? Math.max(1, dials.obstacleCount) : dials.obstacleCount;
  const objectives = buildObjectives(archetype.objective, dials.colors, D, constraintPick.state);
  // Every cage on this generated (non-curated, non-boss) index takes the same
  // band depth — mid past Episode 1 — from the single band authority.
  const cageLayers = cageLayersForIndex(index);
  const layerCounts = Array.from({ length: obstacleCount }, () => cageLayers);

  const biome = biomeFor(index);
  return parseLevelScript(
    {
      schemaVersion: 2,
      id: `voyage-${String(index).padStart(4, '0')}-${archetype.key}`,
      order: index,
      board: {
        cols: VOYAGE_COLS,
        rows: VOYAGE_ROWS,
        colors: dials.colors,
        minChain: dials.minChain,
      },
      seed: mixSeed(spendSeed, 0x5eed),
      mode: 'voyage',
      constraint,
      voyage: { index, episode: episodeOf(index), isBoss: false },
      theme: {
        biome: biome.biome,
        variant: biome.variant,
        particle: biome.particle,
        trim: biome.trim,
        parallaxSeed: seedForIndex(index),
        boss: false,
      },
      objectives,
      obstacles: bottomAnchoredCages(obstacleCount, layerCounts, VOYAGE_COLS, VOYAGE_ROWS),
      designIntent: `voyage/${archetype.key}`,
    },
    paletteSize,
  );
}

/** The highest similarity between a signature and any window neighbour (0 if empty). */
function worstSimilarity(signature: Signature, window: readonly Signature[]): number {
  let worst = 0;
  for (const other of window) {
    const score = similarity(signature, other);
    if (score > worst) {
      worst = score;
    }
  }
  return worst;
}

/** A generated (non-curated, non-boss) level, variety-checked against the window. */
function generateVaried(
  index: number,
  paletteSize: number,
  window: readonly Signature[],
): LevelScript {
  let best = buildGenerated(index, paletteSize, 0);
  let bestWorst = worstSimilarity(signatureOf(best), window);
  if (bestWorst <= VARIETY_SIMILARITY_MAX) {
    return best;
  }
  for (let attempt = 1; attempt < VARIETY_MAX_RETRIES; attempt += 1) {
    const candidate = buildGenerated(index, paletteSize, attempt);
    const worst = worstSimilarity(signatureOf(candidate), window);
    if (worst <= VARIETY_SIMILARITY_MAX) {
      return candidate;
    }
    if (worst < bestWorst) {
      best = candidate;
      bestWorst = worst;
    }
  }
  // No candidate cleared the window (a narrow palette can force this); accept the
  // least-similar one rather than silently capping variety to nothing.
  return best;
}

/**
 * Replaces a level's candidate budget with one calibrated from real solver play,
 * then re-validates. `slack` widens for bosses (`SOLVER_BOSS_SLACK`) to hit the
 * softer boss feel. Only the constraint changes; the board, seed, and objectives
 * are untouched, so the calibrated level plays the exact deal the player will get.
 */
function calibrateLevel(level: LevelScript, paletteSize: number, slack: number): LevelScript {
  const constraint = calibrateConstraint(level, SOLVER_SAMPLES, slack);
  return parseLevelScript({ ...level, constraint }, paletteSize);
}

/** Whether any cage on the level needs more than one hit to break. */
function hasMultiLayerCage(level: LevelScript): boolean {
  return cagedCells(level).some((cage) => cage.layers >= 2);
}

/**
 * Produces the level for a single index, given the current variety window, with
 * its budget calibrated by the solver. Curated Episode-1 teaching levels (1..9)
 * keep their hand-authored budgets — EXCEPT when one seeds a multi-layer cage
 * (L5's 2-layer teaching cage), which needs the extra moves a deeper cage costs,
 * so it routes through the solver like a generated level. Bosses (including the
 * level-10 Caged Core) and every generated level are always solver-calibrated.
 */
function generateOne(
  index: number,
  paletteSize: number,
  window: readonly Signature[],
): LevelScript {
  if (isEpisodeOne(index)) {
    const level = episodeOneLevel(index, paletteSize);
    if (isBossIndex(index)) {
      return calibrateLevel(level, paletteSize, SOLVER_BOSS_SLACK);
    }
    return hasMultiLayerCage(level) ? calibrateLevel(level, paletteSize, SOLVER_SLACK) : level;
  }
  if (isBossIndex(index)) {
    return calibrateLevel(bossFor(index, paletteSize), paletteSize, SOLVER_BOSS_SLACK);
  }
  return calibrateLevel(generateVaried(index, paletteSize, window), paletteSize, SOLVER_SLACK);
}

/**
 * Generates the ladder `1..count` in one forward pass, carrying the variety
 * window. Only generated (non-curated, non-boss) signatures enter the window, so
 * curated/boss beats never constrain a neighbour's variety. This is the primary
 * entry point; prefer it over calling `generateVoyageLevel` in a loop.
 */
export function generateLadder(count: number, paletteSize: number): LevelScript[] {
  const levels: LevelScript[] = [];
  const window: Signature[] = [];
  for (let index = 1; index <= count; index += 1) {
    const level = generateOne(index, paletteSize, window);
    levels.push(level);
    if (!isEpisodeOne(index) && !isBossIndex(index)) {
      window.push(signatureOf(level));
      if (window.length > VARIETY_WINDOW) {
        window.shift();
      }
    }
  }
  return levels;
}

/**
 * The level at `index` (1-based). Deterministic in `(index, paletteSize)`. Built
 * by generating the ladder up to `index` so the variety window is identical to
 * what a full ladder pass would produce.
 */
export function generateVoyageLevel(index: number, paletteSize: number): LevelScript {
  return generateLadder(index, paletteSize)[index - 1];
}
