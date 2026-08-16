import { z } from 'zod';
import { DEFAULT_CONFIG } from '../config';
import type { CellIndex, GameConfig } from '../types';

/**
 * A Journey city, decoded and validated from its JSON file. One file = one city.
 * The shape follows `docs/level-script-schema.md` (the LOCKED v0 contract); this
 * module is the loader that doc describes. It stays in pure `src/core/**` (no
 * RN/Skia imports) so Vitest can test it and a future web build can reuse it.
 *
 * The palette length is INJECTED into `parseLevelScript` rather than imported
 * from `src/render/palette.ts`: the core must not depend on the render layer, so
 * the caller (the meta/route layer, which owns the palette) passes its length.
 */

/** Board footprint ceiling — a sanity bound, not a gameplay limit. */
const MAX_DIM = 12;

const cellSchema = z.object({
  col: z.number().int().nonnegative(),
  row: z.number().int().nonnegative(),
});

/**
 * v0 objective enum: `clearColor` (clear N dots of a color) and `freeCaged`
 * (free every caged dot). An authored `count` on `freeCaged` is accepted but
 * stripped — the runtime target is the actual cage count (see journey-state),
 * so a redundant authored value can't drift from it.
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
]);

/** v0 obstacle enum: `cagedDot` only, placed positionally (no authored color). */
const obstacleSchema = z.object({
  type: z.literal('cagedDot'),
  cell: cellSchema,
});

const timerSchema = z.object({
  startMs: z.number().int().positive(),
  mistakePenaltyMs: z.number().int().nonnegative(),
  clearBonusMs: z.number().int().nonnegative().default(0),
});

const boardSchema = z.object({
  cols: z.number().int().min(2).max(MAX_DIM),
  rows: z.number().int().min(2).max(MAX_DIM),
  // Upper bound (<= render palette length) is enforced in parseLevelScript,
  // where the injected palette size is known.
  colors: z.number().int().min(2),
  // Capped at 4: deadlock.ts#hasLegalMove is only sound for minChain 3-4; above
  // 4 it can report a legal move that doesn't exist, which soft-locks a timed
  // Journey board. Defaults to DEFAULT_CONFIG.minChain (3) when omitted.
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

const levelSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  chapter: z.object({ country: z.string().min(1), order: z.number().int().positive() }),
  city: z.object({ name: z.string().min(1), isCapital: z.boolean() }),
  order: z.number().int().positive(),
  board: boardSchema,
  seed: z.number().int().nonnegative().optional(),
  mode: z.enum(['journey', 'endless']),
  timer: timerSchema.optional(),
  objectives: z.array(objectiveSchema),
  obstacles: z.array(obstacleSchema).default([]),
  rewards: z
    .object({
      stars: z.object({
        twoStarSecondsLeft: z.number().int().nonnegative(),
        threeStarSecondsLeft: z.number().int().nonnegative(),
      }),
    })
    .optional(),
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

/**
 * Decodes and fail-fast-validates one level JSON. `paletteSize` is the render
 * palette length (`DOT_COLORS.length`), passed by the caller so the core stays
 * render-free. Throws (ZodError) on any violation: a timed Journey level that
 * turns out unwinnable mid-play is strictly worse than Endless's no-fail design,
 * so every winnability hazard is rejected here, never at play.
 */
export function parseLevelScript(input: unknown, paletteSize: number): LevelScript {
  return levelSchema
    .superRefine((level, ctx) => {
      const { cols, rows, colors, minChain } = level.board;

      if (colors > paletteSize) {
        ctx.addIssue({
          code: 'custom',
          path: ['board', 'colors'],
          message: `board.colors ${colors} exceeds the render palette length ${paletteSize}`,
        });
      }

      // Pigeonhole guard: shuffle.ts's deadlock-reshuffle guarantee assumes some
      // color can always fill a legal minChain-group. Violate it and a Journey
      // board can wedge unsolvable — fatal under a countdown.
      if (colors * minChain > rows * cols) {
        ctx.addIssue({
          code: 'custom',
          path: ['board'],
          message: `board-legality violated: colors * minChain (${colors * minChain}) > rows * cols (${rows * cols})`,
        });
      }

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

      level.objectives.forEach((objective, index) => {
        if (objective.type === 'clearColor' && objective.color >= colors) {
          ctx.addIssue({
            code: 'custom',
            path: ['objectives', index, 'color'],
            message: `objective color ${objective.color} is outside 0..${colors - 1}`,
          });
        }
      });

      // A freeCaged objective whose level has no cages is complete the instant
      // it opens (its target is the cage count — see objectives.ts). Reject it
      // at parse so a level can't ship a trivially-won objective.
      const wantsFreeCaged = level.objectives.some((objective) => objective.type === 'freeCaged');
      if (wantsFreeCaged && level.obstacles.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['objectives'],
          message: 'a freeCaged objective requires at least one cagedDot obstacle',
        });
      }

      if (level.mode === 'journey') {
        if (level.timer === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['timer'],
            message: 'a journey level requires a timer',
          });
        }
        if (level.objectives.length === 0) {
          ctx.addIssue({
            code: 'custom',
            path: ['objectives'],
            message: 'a journey level requires at least one objective',
          });
        }
      }
    })
    .parse(input);
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

/** Flattens the level's caged cells to row-major board indices (`row * cols + col`). */
export function cagedCellIndices(level: LevelScript): CellIndex[] {
  // v0 obstacle enum is `cagedDot` only, so every obstacle is a cage. When the
  // enum grows (a schemaVersion bump), filter by `type === 'cagedDot'` here.
  const { cols } = level.board;
  return level.obstacles.map((obstacle) => obstacle.cell.row * cols + obstacle.cell.col);
}
