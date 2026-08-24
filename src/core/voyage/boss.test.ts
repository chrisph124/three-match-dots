import { describe, expect, it } from 'vitest';
import { newGame } from '../game';
import { cagedCellIndices, levelToConfig } from '../level/level-script';
import { bossFor, cagedCore } from './boss';

const PALETTE = 5;

describe('bossFor', () => {
  it('tags every boss level as a boss in both the envelope and the theme', () => {
    for (const index of [10, 20, 30]) {
      const boss = bossFor(index, PALETTE);
      expect(boss.voyage?.isBoss).toBe(true);
      expect(boss.theme?.boss).toBe(true);
      expect(boss.order).toBe(index);
      expect(boss.mode).toBe('voyage');
    }
  });

  it('is deterministic', () => {
    expect(bossFor(20, PALETTE)).toEqual(bossFor(20, PALETTE));
    expect(cagedCore(10, PALETTE)).toEqual(cagedCore(10, PALETTE));
  });

  it('routes level 10 to the curated Caged Core', () => {
    expect(bossFor(10, PALETTE)).toEqual(cagedCore(10, PALETTE));
  });

  it('past level 10 emits a generic colour-rush boss', () => {
    const boss = bossFor(20, PALETTE);
    expect(boss.id).toContain('color-rush');
    expect(boss.constraint?.type).toBe('moves');
    expect(boss.objectives.some((o) => o.type === 'clearColor')).toBe(true);
  });
});

describe('cagedCore (level 10)', () => {
  const level = cagedCore(10, PALETTE);

  it('is a freeCaged fight over 8 bottom-anchored cages', () => {
    expect(level.obstacles).toHaveLength(8);
    // Bottom-anchored: 8 cages fill the floor row (6) then the row above (2).
    const rows = level.obstacles.map((o) => o.cell.row);
    expect(Math.min(...rows)).toBe(4); // never higher than the two floor rows
    expect(Math.max(...rows)).toBe(5); // includes the very bottom row
    expect(level.objectives).toEqual([{ type: 'freeCaged' }]);
  });

  it('deals a board whose caged cells span ≥2 colours (a multi-phase fight)', () => {
    const game = newGame(levelToConfig(level), level.seed ?? 0);
    const cageColors = new Set(cagedCellIndices(level).map((cell) => game.board[cell]));
    expect(cageColors.size).toBeGreaterThanOrEqual(2);
  });
});
