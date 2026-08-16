import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { hasLegalMove } from '../deadlock';
import { newGame } from '../game';
import { DOT_COLORS } from '../../render/palette';
import { cagedCellIndices, levelToConfig, parseLevelScript } from './level-script';

/**
 * Fixture guard for the one shipped Journey level. It loads the real
 * `assets/levels/japan-01.json` and validates it exactly as the route will —
 * against the live render palette length — then proves the fixed seed still
 * deals the board this level was authored around. If someone edits the seed,
 * palette, or cage layout, these assertions break instead of the level silently
 * turning unwinnable on device.
 *
 * A single fixed seed proves THIS board is legal at start (a winnability proxy);
 * a statistical N-seed solvability checker is deliberately deferred.
 */

const RAW = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../../assets/levels/japan-01.json', import.meta.url)),
    'utf8',
  ),
) as unknown;

const PALETTE = DOT_COLORS.length;

describe('japan-01 fixture', () => {
  it('parses and validates against the live palette', () => {
    expect(() => parseLevelScript(RAW, PALETTE)).not.toThrow();
  });

  it('cages the three intended cells (row 3, cols 2-4)', () => {
    const level = parseLevelScript(RAW, PALETTE);
    expect(cagedCellIndices(level)).toEqual([20, 21, 22]);
  });

  it('deals the authored cage colors under its fixed seed', () => {
    const level = parseLevelScript(RAW, PALETTE);
    const seed = level.seed;
    expect(seed).toBeDefined();
    const board = newGame(levelToConfig(level), seed as number).board;
    // Locked to seed 20260816 — changing the seed must fail here, not on device.
    expect(cagedCellIndices(level).map((cell) => board[cell])).toEqual([3, 2, 0]);
  });

  it('opens on a legal, non-deadlocked board with the objective color present', () => {
    const level = parseLevelScript(RAW, PALETTE);
    const config = levelToConfig(level);
    const board = newGame(config, level.seed as number).board;
    expect(hasLegalMove(board, config.rows, config.cols, config.minChain)).toBe(true);
    expect(board.includes(0)).toBe(true); // clearColor objective targets color 0
  });

  it('is rejected if it asks for more colors than the palette can draw', () => {
    const tooMany = { ...(RAW as Record<string, unknown>) };
    tooMany.board = { ...(tooMany.board as Record<string, unknown>), colors: PALETTE + 1 };
    expect(() => parseLevelScript(tooMany, PALETTE)).toThrow();
  });
});
