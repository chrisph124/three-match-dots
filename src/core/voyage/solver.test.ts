import { describe, expect, it } from 'vitest';
import { parseLevelScript, type LevelScript } from '../level/level-script';
import { resolveChain } from '../resolve/resolve-chain';
import { enumerateMoves } from './enumerate-moves';
import { generateVoyageLevel } from './generate-level';
import { SOLVER_MS_PER_MOVE } from './voyage-config';
import { newVoyage } from './voyage-state';
import { solve } from './solver';

const PALETTE = 5;

/** The board seed a level ships with (every generated level carries one). */
const seedOf = (level: LevelScript): number => level.seed ?? 0;

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
