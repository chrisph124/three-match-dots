import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../config';
import { cagedCellIndices, constraintOf, levelToConfig, parseLevelScript } from './level-script';

const PALETTE = 6;

/** A fresh, fully-valid level object each call, so per-test mutations don't leak. */
function valid(): Record<string, unknown> {
  return structuredClone({
    schemaVersion: 1,
    id: 'japan-01-kyoto',
    chapter: { country: 'Japan', order: 1 },
    city: { name: 'Kyoto', isCapital: false },
    order: 1,
    board: { cols: 6, rows: 6, colors: 5, minChain: 3 },
    seed: 20260806,
    mode: 'journey',
    timer: { startMs: 60000, mistakePenaltyMs: 2000, clearBonusMs: 0 },
    objectives: [
      { type: 'clearColor', color: 0, count: 20 },
      { type: 'freeCaged', count: 3 },
    ],
    obstacles: [
      { type: 'cagedDot', cell: { col: 2, row: 3 } },
      { type: 'cagedDot', cell: { col: 3, row: 3 } },
      { type: 'cagedDot', cell: { col: 4, row: 3 } },
    ],
    rewards: { stars: { twoStarSecondsLeft: 15, threeStarSecondsLeft: 30 } },
    unlock: { requiresLevelId: null, requiresStars: 0 },
    designIntent: 'Intro the caged-dot obstacle.',
  });
}

describe('parseLevelScript — valid', () => {
  it('parses a fully-specified level', () => {
    const level = parseLevelScript(valid(), PALETTE);
    expect(level.board.colors).toBe(5);
    expect(level.seed).toBe(20260806);
    expect(level.timer?.startMs).toBe(60000);
    expect(level.objectives).toHaveLength(2);
    expect(level.obstacles).toHaveLength(3);
  });

  it('defaults board.minChain to 3 when omitted', () => {
    const input = valid();
    delete (input.board as Record<string, unknown>).minChain;
    expect(parseLevelScript(input, PALETTE).board.minChain).toBe(3);
  });

  it('defaults obstacles to an empty array when omitted', () => {
    const input = valid();
    delete input.obstacles;
    // Drop the freeCaged objective too: with no obstacles it would trip the
    // "freeCaged requires a cage" rule, which is a separate concern from the
    // obstacles default this test isolates.
    input.objectives = [{ type: 'clearColor', color: 0, count: 20 }];
    expect(parseLevelScript(input, PALETTE).obstacles).toEqual([]);
  });

  it('leaves seed undefined when omitted (session seed used later)', () => {
    const input = valid();
    delete input.seed;
    expect(parseLevelScript(input, PALETTE).seed).toBeUndefined();
  });

  it('accepts spawnWeights of any length (reserved, no length rule)', () => {
    const input = valid();
    (input.board as Record<string, unknown>).spawnWeights = [1, 2]; // != colors (5)
    expect(() => parseLevelScript(input, PALETTE)).not.toThrow();
  });

  it('accepts a level with rewards/unlock/designIntent omitted', () => {
    const input = valid();
    delete input.rewards;
    delete input.unlock;
    delete input.designIntent;
    expect(() => parseLevelScript(input, PALETTE)).not.toThrow();
  });
});

describe('levelToConfig', () => {
  it('maps board fields, filling per-config defaults for the omitted dials', () => {
    const config = levelToConfig(parseLevelScript(valid(), PALETTE));
    expect(config).toEqual({
      rows: 6,
      cols: 6,
      colors: 5,
      minChain: 3,
      lineLength: DEFAULT_CONFIG.lineLength,
      baseScore: DEFAULT_CONFIG.baseScore,
      sweepMultiplier: DEFAULT_CONFIG.sweepMultiplier,
    });
  });

  it('carries authored dials through when present', () => {
    const input = valid();
    Object.assign(input.board as Record<string, unknown>, {
      lineLength: 4,
      baseScore: 20,
      sweepMultiplier: 2,
    });
    const config = levelToConfig(parseLevelScript(input, PALETTE));
    expect(config.lineLength).toBe(4);
    expect(config.baseScore).toBe(20);
    expect(config.sweepMultiplier).toBe(2);
  });
});

describe('cagedCellIndices', () => {
  it('flattens cagedDot cells to row-major indices (row * cols + col)', () => {
    const level = parseLevelScript(valid(), PALETTE);
    expect(cagedCellIndices(level)).toEqual([20, 21, 22]); // row 3 * 6 + {2,3,4}
  });
});

describe('parseLevelScript — fail-fast rejections', () => {
  // Returns the parse as a thunk (never called here) so each test asserts
  // `.toThrow()` in its own body — the assertion stays visible to the linter
  // instead of hiding one call-level down in a shared helper.
  const parsingMutated =
    (mutate: (input: Record<string, unknown>) => void, palette = PALETTE) =>
    () => {
      const input = valid();
      mutate(input);
      return parseLevelScript(input, palette);
    };

  it('rejects an unknown schemaVersion', () => {
    // 1 and 2 are the only known versions; 3 is not understood.
    expect(
      parsingMutated((i) => {
        i.schemaVersion = 3;
      }),
    ).toThrow();
  });

  it('rejects colors beyond the injected palette length', () => {
    expect(
      parsingMutated((i) => {
        (i.board as Record<string, unknown>).colors = 7; // > 6
      }),
    ).toThrow();
  });

  it('rejects a level whose colors fit the schema but not the caller palette', () => {
    // colors 5 is legal against a 6-hue palette but not against a 3-hue one.
    expect(parsingMutated(() => {}, 3)).toThrow();
  });

  it('rejects a board that violates colors * minChain <= rows * cols', () => {
    expect(
      parsingMutated((i) => {
        i.board = { cols: 3, rows: 3, colors: 4, minChain: 3 }; // 12 > 9
        i.objectives = [{ type: 'clearColor', color: 0, count: 2 }];
        i.obstacles = [];
      }),
    ).toThrow();
  });

  it('rejects minChain below 2', () => {
    expect(
      parsingMutated((i) => {
        (i.board as Record<string, unknown>).minChain = 1;
      }),
    ).toThrow();
  });

  it('rejects minChain above 4 (hasLegalMove is only sound for 3-4)', () => {
    expect(
      parsingMutated((i) => {
        (i.board as Record<string, unknown>).minChain = 5;
      }),
    ).toThrow();
  });

  it('rejects an obstacle cell outside the board', () => {
    expect(
      parsingMutated((i) => {
        i.obstacles = [{ type: 'cagedDot', cell: { col: 6, row: 0 } }]; // col 6 on a 6-wide board
      }),
    ).toThrow();
  });

  it('rejects two obstacles on the same cell', () => {
    expect(
      parsingMutated((i) => {
        i.obstacles = [
          { type: 'cagedDot', cell: { col: 1, row: 1 } },
          { type: 'cagedDot', cell: { col: 1, row: 1 } },
        ];
      }),
    ).toThrow();
  });

  it('rejects an objective color outside 0..colors-1', () => {
    expect(
      parsingMutated((i) => {
        i.objectives = [{ type: 'clearColor', color: 5, count: 3 }]; // colors is 5 -> valid 0..4
      }),
    ).toThrow();
  });

  it('rejects an empty objectives list for a journey level', () => {
    expect(
      parsingMutated((i) => {
        i.objectives = [];
      }),
    ).toThrow();
  });

  it('rejects a freeCaged objective when the level has no cages', () => {
    expect(
      parsingMutated((i) => {
        i.objectives = [{ type: 'freeCaged' }];
        i.obstacles = [];
      }),
    ).toThrow();
  });

  it('rejects an unknown objective type', () => {
    expect(
      parsingMutated((i) => {
        i.objectives = [{ type: 'scoreTarget', target: 100 }];
      }),
    ).toThrow();
  });

  it('rejects an unknown obstacle type', () => {
    expect(
      parsingMutated((i) => {
        i.obstacles = [{ type: 'anchor', cell: { col: 1, row: 1 } }];
      }),
    ).toThrow();
  });

  it('rejects a journey level with no timer', () => {
    expect(
      parsingMutated((i) => {
        delete i.timer;
      }),
    ).toThrow();
  });

  it('rejects a non-positive timer.startMs', () => {
    expect(
      parsingMutated((i) => {
        (i.timer as Record<string, unknown>).startMs = 0;
      }),
    ).toThrow();
  });
});

/** A fresh, fully-valid schemaVersion-2 voyage level each call. */
function validVoyage(): Record<string, unknown> {
  return structuredClone({
    schemaVersion: 2,
    id: 'voyage-010-caged-core',
    order: 10,
    board: { cols: 6, rows: 6, colors: 3, minChain: 3 },
    seed: 424242,
    mode: 'voyage',
    constraint: { type: 'moves', budget: 25 },
    voyage: { index: 10, episode: 1, isBoss: true },
    theme: {
      biome: 'harbor',
      variant: 'dusk',
      particle: 'embers',
      trim: 'brass',
      parallaxSeed: 7,
      boss: true,
    },
    objectives: [{ type: 'freeCaged' }],
    obstacles: [
      { type: 'cagedDot', cell: { col: 2, row: 5 } },
      { type: 'cagedDot', cell: { col: 3, row: 5 } },
    ],
    rewards: { stars: { twoStarMovesLeft: 5, threeStarMovesLeft: 10 } },
  });
}

describe('parseLevelScript — v2 voyage', () => {
  const parsingMutated =
    (mutate: (input: Record<string, unknown>) => void, palette = PALETTE) =>
    () => {
      const input = validVoyage();
      mutate(input);
      return parseLevelScript(input, palette);
    };

  it('parses a valid voyage level (no chapter/city required)', () => {
    const level = parseLevelScript(validVoyage(), PALETTE);
    expect(level.mode).toBe('voyage');
    expect(level.voyage?.index).toBe(10);
    expect(level.voyage?.isBoss).toBe(true);
    expect(level.chapter).toBeUndefined();
    expect(level.city).toBeUndefined();
    expect(level.theme?.biome).toBe('harbor');
  });

  it('accepts a v1-shaped journey level under schemaVersion 2 (v1 fields carry forward)', () => {
    const input = valid();
    input.schemaVersion = 2;
    expect(() => parseLevelScript(input, PALETTE)).not.toThrow();
  });

  it('accepts a v1 endless level (no timer, no objectives required)', () => {
    const input = valid();
    input.mode = 'endless';
    delete input.timer;
    input.objectives = [];
    // endless carries no time-metric constraint, so drop the seconds rewards too.
    delete input.rewards;
    expect(() => parseLevelScript(input, PALETTE)).not.toThrow();
  });

  it('rejects a voyage level at schemaVersion 1', () => {
    expect(
      parsingMutated((i) => {
        i.schemaVersion = 1;
      }),
    ).toThrow();
  });

  it('rejects a voyage level missing its constraint', () => {
    expect(
      parsingMutated((i) => {
        delete i.constraint;
      }),
    ).toThrow();
  });

  it('rejects a voyage level that also carries a timer', () => {
    expect(
      parsingMutated((i) => {
        i.timer = { startMs: 60000, mistakePenaltyMs: 2000, clearBonusMs: 0 };
      }),
    ).toThrow();
  });

  it('rejects a voyage level missing its voyage envelope', () => {
    expect(
      parsingMutated((i) => {
        delete i.voyage;
      }),
    ).toThrow();
  });

  it('rejects a voyage level with an empty objectives list', () => {
    expect(
      parsingMutated((i) => {
        i.objectives = [];
        i.obstacles = [];
      }),
    ).toThrow();
  });

  it('rejects a non-positive moves budget', () => {
    expect(
      parsingMutated((i) => {
        i.constraint = { type: 'moves', budget: 0 };
      }),
    ).toThrow();
  });

  it('rejects rewards whose metric mismatches the constraint (seconds stars on a moves level)', () => {
    expect(
      parsingMutated((i) => {
        i.rewards = { stars: { twoStarSecondsLeft: 5, threeStarSecondsLeft: 10 } };
      }),
    ).toThrow();
  });

  it('still enforces board-legality (colors * minChain <= rows * cols) for voyage', () => {
    expect(
      parsingMutated((i) => {
        i.board = { cols: 3, rows: 3, colors: 4, minChain: 3 }; // 12 > 9
        i.objectives = [{ type: 'freeCaged' }];
        i.obstacles = [{ type: 'cagedDot', cell: { col: 0, row: 2 } }];
      }),
    ).toThrow();
  });

  it('defaults a timed constraint clearBonusMs to 0 when omitted', () => {
    const level = parseLevelScript(
      {
        ...validVoyage(),
        constraint: { type: 'timed', startMs: 45000, mistakePenaltyMs: 1500 },
        rewards: { stars: { twoStarSecondsLeft: 10, threeStarSecondsLeft: 20 } },
      },
      PALETTE,
    );
    const constraint = constraintOf(level);
    expect(constraint).toEqual({
      type: 'timed',
      startMs: 45000,
      mistakePenaltyMs: 1500,
      clearBonusMs: 0,
    });
  });
});

describe('constraintOf', () => {
  it('returns a voyage level constraint directly', () => {
    expect(constraintOf(parseLevelScript(validVoyage(), PALETTE))).toEqual({
      type: 'moves',
      budget: 25,
    });
  });

  it('maps a journey timer into an equivalent timed constraint', () => {
    const level = parseLevelScript(valid(), PALETTE);
    expect(constraintOf(level)).toEqual({
      type: 'timed',
      startMs: 60000,
      mistakePenaltyMs: 2000,
      clearBonusMs: 0,
    });
  });
});
