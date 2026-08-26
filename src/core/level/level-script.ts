import { z } from 'zod';
import { DEFAULT_CONFIG } from '../config';
import type { CellIndex, GameConfig } from '../types';

/**
 * A level, decoded and validated from its JSON. One file = one level. The shape
 * follows `docs/level-script-schema.md`; this module is the loader that doc
 * describes. It stays in pure `src/core/**` (no RN/Skia imports) so Vitest can
 * test it and a future web build can reuse it.
 *
 * The palette length is INJECTED into `parseLevelScript` rather than imported
 * from `src/render/palette.ts`: the core must not depend on the render layer, so
 * the caller (the meta/route layer, which owns the palette) passes its length.
 *
 * Versioning: `schemaVersion` accepts `1` (the shipped Journey/Endless contract),
 * `2` (adds the `voyage` mode, the pluggable `constraint` union, and the optional
 * `voyage`/`theme` blocks) OR `3` (the anchor/weight obstacle round). Every older
 * level parses unchanged under a newer version; only voyage levels require
 * `schemaVersion: 2`. The `anchor` obstacle + `clearAnchors` objective are
 * additive and un-gated (accepted at any version), so `3` is a documentation
 * marker rather than a behavioural gate.
 */

/** Board footprint ceiling — a sanity bound, not a gameplay limit. */
const MAX_DIM = 12;

const cellSchema = z.object({
  col: z.number().int().nonnegative(),
  row: z.number().int().nonnegative(),
});

/**
 * Objective enum: `clearColor` (clear N dots of a color), `freeCaged` (free every
 * caged dot) and `clearAnchors` (remove every anchor). An authored `count` on
 * `freeCaged`/`clearAnchors` is accepted but stripped — the runtime target is the
 * actual cage/anchor count (see journey-state), so a redundant authored value
 * can't drift from it.
 */
const objectiveSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('clearColor'),
    color: z.number().int().nonnegative(),
    count: z.number().int().positive(),
  }),
  z.object({
    type: z.literal('freeCaged'),
  }),
  z.object({
    type: z.literal('clearAnchors'),
  }),
]);

/**
 * Obstacle enum, a discriminated union placed positionally (no authored color):
 * - `cagedDot`: `layers` is the number of same-colour clears (including the caged
 *   dot) needed to break the cage. Optional and backward-compatible — absent ⇒
 *   treated as `1` (a single-clear pop, today's behaviour). Bounded `[1,5]` so a
 *   fat-fingered authored value can't create an unwinnable, un-solver-checked
 *   cage; 5 is a generous ceiling above the boss band's 3.
 * - `anchor`: a single-hit paper weight — unlinkable, falls with gravity, removed
 *   by any 8-way-adjacent same-colour clear. No `layers`/`color` field (weight-N
 *   is the cage's identity; 8-way any-colour is the anchor's).
 *
 * Both variants are additive and un-gated (any `schemaVersion`), matching the
 * `layers` "so no schemaVersion bump" precedent above.
 */
const cagedDotSchema = z.object({
  type: z.literal('cagedDot'),
  cell: cellSchema,
  layers: z.number().int().min(1).max(5).optional(),
});
const anchorSchema = z.object({
  type: z.literal('anchor'),
  cell: cellSchema,
});
const obstacleSchema = z.discriminatedUnion('type', [cagedDotSchema, anchorSchema]);

const timerSchema = z.object({
  startMs: z.number().int().positive(),
  mistakePenaltyMs: z.number().int().nonnegative(),
  clearBonusMs: z.number().int().nonnegative().default(0),
});

/**
 * The v2 constraint union — the fail-state a `voyage` level plays under. One of:
 * - `moves`: a fixed move budget (a committed resolution spends 1).
 * - `timed`: a countdown; field shapes are byte-identical to `timerSchema`, so
 *   the timed path reuses Journey's countdown math verbatim (see `constraintOf`).
 * - `mistakes`: a cap on invalid attempts.
 * Discriminated on `type` so a malformed variant fails fast at parse.
 */
const constraintSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('moves'), budget: z.number().int().positive() }),
  z.object({
    type: z.literal('timed'),
    startMs: z.number().int().positive(),
    mistakePenaltyMs: z.number().int().nonnegative(),
    clearBonusMs: z.number().int().nonnegative().default(0),
  }),
  z.object({ type: z.literal('mistakes'), cap: z.number().int().positive() }),
]);

/** The v2 voyage envelope: where a generated level sits in the ladder. */
const voyageMetaSchema = z.object({
  index: z.number().int().min(1),
  episode: z.number().int().min(1),
  isBoss: z.boolean(),
});

/**
 * The v2 theme block — additive render metadata consumed by the diorama layer
 * (Phase 6). Unknown biome/variant ids are a RENDER-time fallback concern, not a
 * parse error, so `biome`/`variant`/`particle`/`trim` are free strings; the
 * schema keeps content data-driven.
 */
const themeSchema = z.object({
  biome: z.string().min(1),
  variant: z.string().min(1),
  particle: z.string().min(1),
  trim: z.string().min(1),
  parallaxSeed: z.number().int(),
  boss: z.boolean(),
});

const boardSchema = z.object({
  cols: z.number().int().min(2).max(MAX_DIM),
  rows: z.number().int().min(2).max(MAX_DIM),
  // Upper bound (<= render palette length) is enforced in parseLevelScript,
  // where the injected palette size is known.
  colors: z.number().int().min(2),
  // Capped at 4: a design/scope ceiling (the hardest legal difficulty dial), not
  // a correctness limit — deadlock.ts#hasLegalMove is a same-colour simple-path
  // search, sound at every minChain. [2,4] is the validated, tested envelope.
  // Defaults to DEFAULT_CONFIG.minChain (3) when omitted.
  minChain: z.number().int().min(2).max(4).default(DEFAULT_CONFIG.minChain),
  lineLength: z
    .number()
    .int()
    .min(2)
    .max(MAX_DIM * MAX_DIM)
    .optional(),
  baseScore: z.number().int().nonnegative().max(1_000_000).optional(),
  sweepMultiplier: z.number().positive().max(1000).optional(),
  // Reserved for a future weighted-refill feature; not consumed by anything
  // today, so deliberately no `length === colors` rule (see schema doc).
  spawnWeights: z.array(z.number().nonnegative()).optional(),
});

/**
 * Star thresholds, expressed in the metric of the level's constraint: seconds
 * left (timed/journey), moves left (moves), or mistakes left (mistakes). The
 * shape present must match the constraint metric — the superRefine enforces it.
 * The seconds shape is unchanged from v1 so authored Journey levels stay valid.
 */
const secondsStarsSchema = z.object({
  twoStarSecondsLeft: z.number().int().nonnegative(),
  threeStarSecondsLeft: z.number().int().nonnegative(),
});
const movesStarsSchema = z.object({
  twoStarMovesLeft: z.number().int().nonnegative(),
  threeStarMovesLeft: z.number().int().nonnegative(),
});
const mistakesStarsSchema = z.object({
  twoStarMistakesLeft: z.number().int().nonnegative(),
  threeStarMistakesLeft: z.number().int().nonnegative(),
});
const rewardsSchema = z.object({
  stars: z.union([secondsStarsSchema, movesStarsSchema, mistakesStarsSchema]),
});

const levelSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  id: z.string().min(1),
  // Journey-only framing; a voyage level omits both (it locates itself via the
  // `voyage` envelope). Optional so v2 generated levels need not fake a chapter.
  chapter: z.object({ country: z.string().min(1), order: z.number().int().positive() }).optional(),
  city: z.object({ name: z.string().min(1), isCapital: z.boolean() }).optional(),
  order: z.number().int().positive(),
  board: boardSchema,
  seed: z.number().int().nonnegative().optional(),
  mode: z.enum(['journey', 'endless', 'voyage']),
  timer: timerSchema.optional(),
  constraint: constraintSchema.optional(),
  voyage: voyageMetaSchema.optional(),
  theme: themeSchema.optional(),
  objectives: z.array(objectiveSchema),
  obstacles: z.array(obstacleSchema).default([]),
  rewards: rewardsSchema.optional(),
  unlock: z
    .object({
      requiresLevelId: z.string().min(1).nullable(),
      requiresStars: z.number().int().nonnegative(),
    })
    .optional(),
  designIntent: z.string().optional(),
});

export type LevelScript = z.infer<typeof levelSchema>;
export type Obstacle = z.infer<typeof obstacleSchema>;
export type CagedDotObstacle = z.infer<typeof cagedDotSchema>;
export type AnchorObstacle = z.infer<typeof anchorSchema>;
export type Constraint = z.infer<typeof constraintSchema>;
export type VoyageMeta = z.infer<typeof voyageMetaSchema>;
export type Theme = z.infer<typeof themeSchema>;

/** Maps a constraint kind to the star metric its `rewards.stars` must use. */
const METRIC_OF_CONSTRAINT = {
  moves: 'moves',
  timed: 'seconds',
  mistakes: 'mistakes',
} as const;

/**
 * Reads which metric a `rewards.stars` object carries, by key presence. The parse
 * pipeline only ever feeds it a schema-validated (union) shape, so the `'unknown'`
 * default is defensive — it keeps an unrecognised shape from silently matching a
 * real metric. Exported so the classifier (every arm, the default included) is
 * unit-testable directly, not only incidentally through whichever levels a
 * calibration ladder happens to validate.
 */
export function starsMetric(
  stars: Record<string, unknown>,
): 'seconds' | 'moves' | 'mistakes' | 'unknown' {
  if ('twoStarSecondsLeft' in stars) return 'seconds';
  if ('twoStarMovesLeft' in stars) return 'moves';
  if ('twoStarMistakesLeft' in stars) return 'mistakes';
  return 'unknown';
}

/** The metric a level's `rewards.stars` must use, or `undefined` if unconstrained. */
function expectedStarsMetric(level: LevelScript): 'seconds' | 'moves' | 'mistakes' | undefined {
  if (level.constraint) {
    return METRIC_OF_CONSTRAINT[level.constraint.type];
  }
  if (level.timer) {
    return 'seconds';
  }
  return undefined;
}

/** Rejects a colour count above the palette or a board that can wedge unsolvable. */
function checkBoardLegality(level: LevelScript, paletteSize: number, ctx: z.RefinementCtx): void {
  const { cols, rows, colors, minChain } = level.board;
  if (colors > paletteSize) {
    ctx.addIssue({
      code: 'custom',
      path: ['board', 'colors'],
      message: `board.colors ${colors} exceeds the render palette length ${paletteSize}`,
    });
  }
  // Pigeonhole guard: shuffle.ts's deadlock-reshuffle guarantee assumes some
  // color can always fill a legal minChain-group. Violate it and a board can
  // wedge unsolvable — fatal under a countdown or a move budget.
  if (colors * minChain > rows * cols) {
    ctx.addIssue({
      code: 'custom',
      path: ['board'],
      message: `board-legality violated: colors * minChain (${colors * minChain}) > rows * cols (${rows * cols})`,
    });
  }
}

/** Rejects obstacles placed off-board or stacked on the same cell. */
function checkObstacles(level: LevelScript, ctx: z.RefinementCtx): void {
  const { cols, rows } = level.board;
  const seen = new Set<number>();
  level.obstacles.forEach((obstacle, index) => {
    const { col, row } = obstacle.cell;
    if (col >= cols || row >= rows) {
      ctx.addIssue({
        code: 'custom',
        path: ['obstacles', index, 'cell'],
        message: `obstacle cell (${col}, ${row}) is outside the ${cols}x${rows} board`,
      });
    }
    const flat = row * cols + col;
    if (seen.has(flat)) {
      ctx.addIssue({
        code: 'custom',
        path: ['obstacles', index],
        message: `duplicate obstacle at cell (${col}, ${row})`,
      });
    }
    seen.add(flat);
  });
}

/** Rejects out-of-range clearColor targets and a freeCaged goal with no cages. */
function checkObjectives(level: LevelScript, ctx: z.RefinementCtx): void {
  const { colors } = level.board;
  level.objectives.forEach((objective, index) => {
    if (objective.type === 'clearColor' && objective.color >= colors) {
      ctx.addIssue({
        code: 'custom',
        path: ['objectives', index, 'color'],
        message: `objective color ${objective.color} is outside 0..${colors - 1}`,
      });
    }
  });
  // A freeCaged / clearAnchors objective whose level has no cage / anchor is
  // complete the instant it opens (its target is the cage/anchor count — see
  // objectives.ts). Reject it at parse so a level can't ship a trivially-won
  // objective. Counted by obstacle TYPE, not total: an anchor-only board must not
  // satisfy freeCaged, nor a cage-only board clearAnchors.
  const cageCount = level.obstacles.filter((obstacle) => obstacle.type === 'cagedDot').length;
  const anchorCount = level.obstacles.filter((obstacle) => obstacle.type === 'anchor').length;
  const wantsFreeCaged = level.objectives.some((objective) => objective.type === 'freeCaged');
  if (wantsFreeCaged && cageCount === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['objectives'],
      message: 'a freeCaged objective requires at least one cagedDot obstacle',
    });
  }
  const wantsClearAnchors = level.objectives.some((objective) => objective.type === 'clearAnchors');
  if (wantsClearAnchors && anchorCount === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['objectives'],
      message: 'a clearAnchors objective requires at least one anchor obstacle',
    });
  }
}

/** A Journey level requires a timer and at least one objective. */
function checkJourneyRules(level: LevelScript, ctx: z.RefinementCtx): void {
  if (level.mode !== 'journey') {
    return;
  }
  if (level.timer === undefined) {
    ctx.addIssue({ code: 'custom', path: ['timer'], message: 'a journey level requires a timer' });
  }
  if (level.objectives.length === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['objectives'],
      message: 'a journey level requires at least one objective',
    });
  }
}

/**
 * Voyage rules (v2 only): the constraint replaces the timer, and the envelope
 * locates the level in the ladder.
 */
function checkVoyageRules(level: LevelScript, ctx: z.RefinementCtx): void {
  if (level.mode !== 'voyage') {
    return;
  }
  if (level.schemaVersion !== 2) {
    ctx.addIssue({
      code: 'custom',
      path: ['schemaVersion'],
      message: 'a voyage level requires schemaVersion 2',
    });
  }
  if (level.constraint === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['constraint'],
      message: 'a voyage level requires a constraint',
    });
  }
  if (level.voyage === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['voyage'],
      message: 'a voyage level requires a voyage envelope',
    });
  }
  if (level.objectives.length === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['objectives'],
      message: 'a voyage level requires at least one objective',
    });
  }
  if (level.timer !== undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['timer'],
      message: 'a voyage level uses a constraint, not a timer',
    });
  }
}

/** `rewards.stars` must be expressed in the level's constraint metric. */
function checkRewardsMetric(level: LevelScript, ctx: z.RefinementCtx): void {
  if (!level.rewards) {
    return;
  }
  const expected = expectedStarsMetric(level);
  const present = starsMetric(level.rewards.stars);
  if (expected !== undefined && present !== expected) {
    ctx.addIssue({
      code: 'custom',
      path: ['rewards', 'stars'],
      message: `rewards.stars metric (${present}) must match the constraint metric (${expected})`,
    });
  }
}

/**
 * Decodes and fail-fast-validates one level JSON. `paletteSize` is the render
 * palette length (`DOT_COLORS.length`), passed by the caller so the core stays
 * render-free. Throws (ZodError) on any violation: a level that turns out
 * unwinnable mid-play is strictly worse than Endless's no-fail design, so every
 * winnability hazard is rejected here, never at play.
 */
export function parseLevelScript(input: unknown, paletteSize: number): LevelScript {
  return levelSchema
    .superRefine((level, ctx) => {
      checkBoardLegality(level, paletteSize, ctx);
      checkObstacles(level, ctx);
      checkObjectives(level, ctx);
      checkJourneyRules(level, ctx);
      checkVoyageRules(level, ctx);
      checkRewardsMetric(level, ctx);
    })
    .parse(input);
}

/**
 * The play constraint for a level, as one uniform shape. A v2 `constraint` is
 * returned directly; a Journey `timer` is mapped into an equivalent `timed`
 * constraint so the Voyage state machine reads one entry point. Throws if a
 * level carries neither (an Endless level has no fail-state and never reaches
 * this path).
 */
export function constraintOf(level: LevelScript): Constraint {
  if (level.constraint) {
    return level.constraint;
  }
  if (level.timer) {
    return {
      type: 'timed',
      startMs: level.timer.startMs,
      mistakePenaltyMs: level.timer.mistakePenaltyMs,
      clearBonusMs: level.timer.clearBonusMs,
    };
  }
  throw new Error(`level ${level.id} has neither a constraint nor a timer`);
}

/** Maps a level's `board` onto the engine's `GameConfig`, filling the dials the level omits. */
export function levelToConfig(level: LevelScript): GameConfig {
  const { board } = level;
  return {
    rows: board.rows,
    cols: board.cols,
    colors: board.colors,
    minChain: board.minChain,
    lineLength: board.lineLength ?? DEFAULT_CONFIG.lineLength,
    baseScore: board.baseScore ?? DEFAULT_CONFIG.baseScore,
    sweepMultiplier: board.sweepMultiplier ?? DEFAULT_CONFIG.sweepMultiplier,
  };
}

/**
 * The level's caged cells with their per-cage layer counts — the single source of
 * truth the overlay and solver seed from. `index` is row-major (`row * cols +
 * col`); `layers` defaults to `1` when the obstacle omits the field. Filtered by
 * `type === 'cagedDot'` so the anchor variant of the obstacle union is excluded.
 */
export function cagedCells(level: LevelScript): { index: CellIndex; layers: number }[] {
  const { cols } = level.board;
  return level.obstacles
    .filter((obstacle) => obstacle.type === 'cagedDot')
    .map((obstacle) => ({
      index: obstacle.cell.row * cols + obstacle.cell.col,
      layers: obstacle.layers ?? 1,
    }));
}

/**
 * Flattens the level's caged cells to row-major board indices. Reads the single
 * `cagedCells` enumeration so the row-major math never drifts between the two.
 */
export function cagedCellIndices(level: LevelScript): CellIndex[] {
  return cagedCells(level).map((c) => c.index);
}

/**
 * The level's anchor cells as row-major board indices — the single source of
 * truth the anchor overlay and solver seed from. Filtered by `type === 'anchor'`;
 * the twin of `cagedCellIndices` for the other obstacle-union variant.
 */
export function anchorCells(level: LevelScript): CellIndex[] {
  const { cols } = level.board;
  return level.obstacles
    .filter((obstacle) => obstacle.type === 'anchor')
    .map((obstacle) => obstacle.cell.row * cols + obstacle.cell.col);
}
