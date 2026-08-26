import { describe, expect, it } from 'vitest';
import type { ObjectiveProgress } from '../journey/objectives';
import { parseLevelScript, type LevelScript } from '../level/level-script';
import { protectedOf } from '../obstacles/caged-dot';
import { resolveAnchorChain } from '../resolve-anchor-chain';
import { resolveChain } from '../resolve/resolve-chain';
import { parseBoard } from '../test-support/board-fixture';
import type { CellIndex, GameConfig } from '../types';
import { enumerateMoves } from './enumerate-moves';
import { generateVoyageLevel } from './generate-level';
import { SOLVER_MS_PER_MOVE } from './voyage-config';
import { newVoyage } from './voyage-state';
import { anchorMoveEffect, cageMoveEffect, objectiveGain, solve } from './solver';

const PALETTE = 5;

const CONFIG_4X4: GameConfig = {
  rows: 4,
  cols: 4,
  colors: 3,
  minChain: 3,
  lineLength: 5,
  baseScore: 10,
  sweepMultiplier: 3,
};

/** The board seed a level ships with (every generated level carries one). */
const seedOf = (level: LevelScript): number => level.seed ?? 0;

/** A hand-built 6×6 clearAnchors level with three bottom-row weights. */
const anchorLevel = (seed: number): LevelScript =>
  parseLevelScript(
    {
      schemaVersion: 2,
      id: 'voyage-test-anchors',
      order: 1,
      board: { cols: 6, rows: 6, colors: 3, minChain: 3 },
      seed,
      mode: 'voyage',
      constraint: { type: 'moves', budget: 60 },
      voyage: { index: 1, episode: 1, isBoss: false },
      theme: {
        biome: 'harbor',
        variant: 'dawn',
        particle: 'spray',
        trim: 'brass',
        parallaxSeed: 1,
        boss: false,
      },
      objectives: [{ type: 'clearAnchors' }],
      obstacles: [
        { type: 'anchor', cell: { col: 1, row: 5 } },
        { type: 'anchor', cell: { col: 3, row: 5 } },
        { type: 'anchor', cell: { col: 5, row: 5 } },
      ],
    },
    PALETTE,
  );

describe('solve', () => {
  it('wins a solvable generated level within its calibrated budget', () => {
    const level = generateVoyageLevel(15, PALETTE);
    const result = solve(level, seedOf(level));

    expect(result.won).toBe(true);
    expect(result.movesUsed).toBeGreaterThan(0);
    expect(result.mistakes).toBe(0);
  });

  it('reports msUsed as movesUsed × the per-move model', () => {
    const level = generateVoyageLevel(23, PALETTE);
    const result = solve(level, seedOf(level));
    expect(result.msUsed).toBe(result.movesUsed * SOLVER_MS_PER_MOVE);
  });

  it('is deterministic for a fixed level and seed', () => {
    const level = generateVoyageLevel(42, PALETTE);
    expect(solve(level, seedOf(level))).toEqual(solve(level, seedOf(level)));
  });

  it('loses a level whose objective is unreachable within the budget', () => {
    // A one-move budget can never clear 30 dots of a colour: a guaranteed loss.
    const base = generateVoyageLevel(12, PALETTE);
    const impossible = parseLevelScript(
      {
        ...base,
        constraint: { type: 'moves', budget: 1 },
        objectives: [{ type: 'clearColor', color: 0, count: 30 }],
        obstacles: [],
      },
      PALETTE,
    );
    expect(solve(impossible, seedOf(impossible)).won).toBe(false);
  });

  it('loses a timed level that runs out before the first move commits', () => {
    // startMs below one modeled move: the pre-move tick zeroes the clock.
    const base = generateVoyageLevel(18, PALETTE);
    const outOfTime = parseLevelScript(
      {
        ...base,
        constraint: { type: 'timed', startMs: 1000, mistakePenaltyMs: 2000, clearBonusMs: 0 },
      },
      PALETTE,
    );
    const result = solve(outOfTime, seedOf(outOfTime));
    expect(result.won).toBe(false);
    expect(result.movesUsed).toBe(0);
  });
});

describe('enumerateMoves ↔ resolveChain invariant', () => {
  it('every enumerated move is committable and its kind matches the resolution', () => {
    const level = generateVoyageLevel(31, PALETTE);
    const vstate = newVoyage(level, seedOf(level));
    const moves = enumerateMoves(vstate.game.board, vstate.game.config);

    expect(moves.length).toBeGreaterThan(0);
    for (const move of moves) {
      const resolution = resolveChain(vstate.game, move.chain);
      expect(resolution).not.toBeNull();
      expect(resolution?.kind).toBe(move.kind);
    }
  });
});

describe('cageMoveEffect — the solver ↔ runtime shared freeing rule', () => {
  it('excludes a protected (multi-layer) cage from pops and credits it as one chip', () => {
    // A 2-layer cage at index 3 sits in the touched set: it chips (stays), the
    // other two cells pop. Mirrors the runtime chip/pop split — one freeing rule.
    const { pops, layersFreed } = cageMoveEffect(new Map([[3, 2]]), [1, 2, 3]);
    expect(pops).toEqual([1, 2]);
    expect(layersFreed).toBe(1);
  });

  it('pops a 1-layer cage and counts its final free as one layer', () => {
    // A 1-layer cage is never protected, so it clears with the rest and frees.
    const { pops, layersFreed } = cageMoveEffect(new Map([[3, 1]]), [1, 2, 3]);
    expect(pops).toEqual([1, 2, 3]);
    expect(layersFreed).toBe(1);
  });

  it('is the identity fast-path when nothing is caged (byte-identical classic play)', () => {
    const { pops, layersFreed } = cageMoveEffect(new Map(), [4, 5, 6]);
    expect(pops).toEqual([4, 5, 6]);
    expect(layersFreed).toBe(0);
  });

  it('credits exactly (layersBefore − layersAfter) for a 3-layer cage chip', () => {
    // 3 → 2 on this hit: one unit now, three units summed over the cage's life.
    const { layersFreed } = cageMoveEffect(new Map([[3, 3]]), [1, 2, 3]);
    expect(layersFreed).toBe(1);
  });
});

describe('objectiveGain', () => {
  const clearRed: ObjectiveProgress = {
    objective: { type: 'clearColor', color: 0, count: 5 },
    current: 0,
    target: 5,
    done: false,
  };
  const freeAll: ObjectiveProgress = {
    objective: { type: 'freeCaged' },
    current: 0,
    target: 1,
    done: false,
  };
  const clearAnchors: ObjectiveProgress = {
    objective: { type: 'clearAnchors' },
    current: 0,
    target: 3,
    done: false,
  };

  it('freeCaged returns the layers freed this move — one unit per chip', () => {
    expect(objectiveGain(freeAll, 0, [1, 2], 1)).toBe(1);
    expect(objectiveGain(freeAll, 0, [1, 2], 2)).toBe(2);
  });

  it('clearColor counts only actual pops, never a chipped cage (matches foldObjectives)', () => {
    // pops already excludes the protected cage, so a chip contributes 0 here.
    expect(objectiveGain(clearRed, 0, [1, 2], 1)).toBe(2);
  });

  it('clearColor ignores a move of a different colour', () => {
    expect(objectiveGain(clearRed, 1, [1, 2, 3], 0)).toBe(0);
  });

  it('clearColor clamps to the remaining target', () => {
    expect(objectiveGain({ ...clearRed, current: 4 }, 0, [1, 2, 3], 0)).toBe(1);
  });

  it('clearAnchors counts the weights removed this move, any colour', () => {
    // The gain is the anchorsRemoved arg, independent of moveColor and pops.
    expect(objectiveGain(clearAnchors, 0, [1, 2], 0, 2)).toBe(2);
    expect(objectiveGain(clearAnchors, 1, [], 0, 1)).toBe(1);
  });

  it('clearAnchors clamps to the remaining target', () => {
    expect(objectiveGain({ ...clearAnchors, current: 2 }, 0, [], 0, 3)).toBe(1);
  });
});

describe('anchorMoveEffect — the solver ↔ runtime shared removal rule', () => {
  const CFG_COLS = 4;

  it('counts every weight 8-way adjacent to a cleared cell', () => {
    // Anchor 5 is orthogonally adjacent to cleared cell 1; anchor 10 is not
    // adjacent to any of {0,1,2}, so only one weight is removed.
    expect(anchorMoveEffect(new Set([5, 10]), [0, 1, 2], CFG_COLS)).toBe(1);
  });

  it('is 0 on the empty anchor set (classic-play fast path)', () => {
    expect(anchorMoveEffect(new Set(), [0, 1, 2], CFG_COLS)).toBe(0);
  });

  it('does not count a weight no cleared cell touches', () => {
    expect(anchorMoveEffect(new Set([15]), [0, 1, 2], CFG_COLS)).toBe(0);
  });
});

describe('solver ↔ runtime anchor parity', () => {
  const CONFIG_COLS = 4;

  it("the heuristic's removal count equals the resolution's freed weights", () => {
    // Clearing the RRR chain (0,1,2) removes anchor 5 (adjacent to cell 1). The
    // solver's anchorMoveEffect, fed the resolution's actual cleared cells, must
    // reproduce the runtime's expandedCleared count — one rule, two callers.
    const board = parseBoard('RRRB/BGBG/GBGB/BGBG').board;
    const game = { config: CONFIG_4X4, board, score: 0, rngState: 0 };
    const anchors = new Set<CellIndex>([5]);
    const resolution = resolveAnchorChain(game, [0, 1, 2], new Map(), anchors);

    expect(resolution).not.toBeNull();
    expect(resolution?.expandedCleared).toEqual([5]);
    const cleared = resolution?.cleared.map((cell) => cell.index) ?? [];
    expect(anchorMoveEffect(anchors, cleared, CONFIG_COLS)).toBe(
      resolution?.expandedCleared?.length ?? 0,
    );
  });

  it('never proposes a move that links through a weight', () => {
    const level = anchorLevel(20260826);
    const vstate = newVoyage(level, seedOf(level));
    const moves = enumerateMoves(vstate.game.board, vstate.game.config, vstate.anchors);

    expect(moves.length).toBeGreaterThan(0);
    for (const move of moves) {
      for (const cell of move.chain) {
        expect(vstate.anchors.has(cell)).toBe(false);
      }
    }
  });

  it('wins a level whose only objective is clearing the weights', () => {
    const level = anchorLevel(20260826);
    expect(solve(level, seedOf(level)).won).toBe(true);
  });
});

describe('solver ↔ runtime resolve parity (multi-layer cage protection)', () => {
  it('wins a level whose only objective is freeing a 2-layer cage', () => {
    // A generous moves budget on a 6×6 deal: the solver must clear the cage's
    // colour through the caged cell TWICE (chip, then pop) to satisfy freeCaged.
    const level = parseLevelScript(
      {
        schemaVersion: 2,
        id: 'voyage-test-2layer',
        order: 1,
        board: { cols: 6, rows: 6, colors: 3, minChain: 3 },
        seed: 20260824,
        mode: 'voyage',
        constraint: { type: 'moves', budget: 40 },
        voyage: { index: 1, episode: 1, isBoss: false },
        theme: {
          biome: 'harbor',
          variant: 'dawn',
          particle: 'spray',
          trim: 'brass',
          parallaxSeed: 1,
          boss: false,
        },
        objectives: [{ type: 'freeCaged' }],
        obstacles: [{ type: 'cagedDot', cell: { col: 2, row: 5 }, layers: 2 }],
      },
      PALETTE,
    );
    expect(solve(level, seedOf(level)).won).toBe(true);
  });

  it('threads protection into its resolve call — a multi-layer caged chain chips, not pops', () => {
    // Pins the exact resolve `stepOnce` makes: resolveChain(game, chain,
    // protectedOf(caged)). The pre-Phase-4 2-arg form dropped the protected set,
    // so the cage would pop (empty protectedHits) instead of chipping — this is
    // the multi-hit contract that keeps the sweep honest (red-team F2).
    const board = parseBoard('RRRB/BGBG/GBGB/BGBG').board;
    const game = { config: CONFIG_4X4, board, score: 0, rngState: 0 };
    const caged = new Map([[1, 2]]); // 2-layer cage inside the RRR chain
    const resolution = resolveChain(game, [0, 1, 2], protectedOf(caged));
    expect(resolution?.protectedHits?.map((c) => c.index)).toEqual([1]);
    expect(resolution?.cleared.map((c) => c.index).sort((a, b) => a - b)).toEqual([0, 2]);
  });
});
