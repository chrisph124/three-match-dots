import type { Constraint, LevelScript } from '../level/level-script';

/**
 * The variety metric. A level's `Signature` is a five-field feature vector; the
 * generator keeps nearby levels distinct by requiring window neighbours to share
 * at most `VARIETY_SIMILARITY_MAX` of those fields. Every field is derived from
 * the emitted `LevelScript` alone (the archetype is not recoverable from a
 * script, so it is deliberately not a signature field) — which keeps `signatureOf`
 * usable in tests over any level, generated or curated.
 *
 * Pure TS (no RN/Skia).
 */

/** Obstacle-count buckets: none / a light cluster / a heavy cluster. */
export type ObstacleBucket = 'none' | 'few' | 'many';

/** The objective classes, mirrored from the archetype objective templates. */
export type ObjectiveClass = 'color' | 'twoColors' | 'caged' | 'colorAndCaged';

export type Signature = {
  readonly constraint: Constraint['type'];
  readonly colors: number;
  readonly minChain: number;
  readonly obstacles: ObstacleBucket;
  readonly objective: ObjectiveClass;
};

/** The number of comparable fields — the denominator of `similarity`. */
const FIELD_COUNT = 5;

/** Buckets an obstacle count: 0 → none, 1..3 → few, 4+ → many. */
function bucketObstacles(count: number): ObstacleBucket {
  if (count === 0) {
    return 'none';
  }
  return count <= 3 ? 'few' : 'many';
}

/** Classifies a level's objectives into one signature objective class. */
function classifyObjective(level: LevelScript): ObjectiveClass {
  const hasCaged = level.objectives.some((objective) => objective.type === 'freeCaged');
  const colorTargets = level.objectives.filter(
    (objective) => objective.type === 'clearColor',
  ).length;
  if (hasCaged) {
    return colorTargets > 0 ? 'colorAndCaged' : 'caged';
  }
  return colorTargets >= 2 ? 'twoColors' : 'color';
}

/** The constraint kind a level plays under, for the signature. */
function constraintKind(level: LevelScript): Constraint['type'] {
  // A voyage level always carries a constraint; fall back to timed for a
  // timer-only (Journey-shaped) level so `signatureOf` never throws on one.
  return level.constraint?.type ?? 'timed';
}

/** The signature feature vector for a level. */
export function signatureOf(level: LevelScript): Signature {
  return {
    constraint: constraintKind(level),
    colors: level.board.colors,
    minChain: level.board.minChain,
    obstacles: bucketObstacles(level.obstacles.length),
    objective: classifyObjective(level),
  };
}

/** Fraction of signature fields two levels share, in `[0, 1]`. */
export function similarity(a: Signature, b: Signature): number {
  let matches = 0;
  if (a.constraint === b.constraint) matches += 1;
  if (a.colors === b.colors) matches += 1;
  if (a.minChain === b.minChain) matches += 1;
  if (a.obstacles === b.obstacles) matches += 1;
  if (a.objective === b.objective) matches += 1;
  return matches / FIELD_COUNT;
}

/** The tally a variety scan reports over a run of signatures. */
export type VarietyReport = {
  /** Total neighbour pairs compared (each level vs. its up-to-`window` priors). */
  readonly windowPairs: number;
  /** Pairs exceeding `max` similarity — the accepted-least-similar shortfall. */
  readonly shortfall: number;
  /** The highest similarity seen; `< 1` proves no two neighbours are identical. */
  readonly worst: number;
};

/**
 * Scans a run of signatures with a sliding window and tallies how many
 * neighbour pairs exceed the `max` similarity target. This is the generator's
 * variety accounting made explicit: where a narrow signature space forces the
 * re-roll to accept the least-similar candidate, the shortfall is counted here
 * rather than silently absorbed (see the Phase-4 variety risk plan). `signatures`
 * is expected to be the generated, non-boss levels in ladder order.
 */
export function varietyReport(
  signatures: readonly Signature[],
  window: number,
  max: number,
): VarietyReport {
  let windowPairs = 0;
  let shortfall = 0;
  let worst = 0;
  for (let k = 0; k < signatures.length; k += 1) {
    for (let p = Math.max(0, k - window); p < k; p += 1) {
      const score = similarity(signatures[k], signatures[p]);
      windowPairs += 1;
      if (score > worst) {
        worst = score;
      }
      if (score > max) {
        shortfall += 1;
      }
    }
  }
  return { windowPairs, shortfall, worst };
}
