import { describe, expect, it } from 'vitest';
import { cagedCells } from '../level/level-script';
import { episodeOneLevel, isEpisodeOne } from './episode-1';

const PALETTE = 5;

describe('isEpisodeOne', () => {
  it('covers exactly levels 1..10', () => {
    expect(isEpisodeOne(1)).toBe(true);
    expect(isEpisodeOne(10)).toBe(true);
    expect(isEpisodeOne(11)).toBe(false);
    expect(isEpisodeOne(0)).toBe(false);
  });
});

describe('episodeOneLevel', () => {
  it('emits a valid voyage level for every curated index', () => {
    for (let index = 1; index <= 10; index += 1) {
      const level = episodeOneLevel(index, PALETTE);
      expect(level.mode).toBe('voyage');
      expect(level.order).toBe(index);
      expect(level.schemaVersion).toBe(2);
    }
  });

  it('is deterministic', () => {
    expect(episodeOneLevel(5, PALETTE)).toEqual(episodeOneLevel(5, PALETTE));
  });

  it('follows the designed teaching order: link → sweep → caged → timed → tighten → mistakes → boss', () => {
    const levels = Array.from({ length: 10 }, (_, i) => episodeOneLevel(i + 1, PALETTE));

    // 1–3: pure link/sweep practice under a move budget, no obstacles yet.
    for (const early of levels.slice(0, 3)) {
      expect(early.constraint?.type).toBe('moves');
      expect(early.obstacles).toHaveLength(0);
    }

    // The caged dot is introduced at level 4 — the first cage and first freeCaged.
    expect(levels[3].obstacles.length).toBeGreaterThanOrEqual(1);
    expect(levels[3].objectives.some((o) => o.type === 'freeCaged')).toBe(true);
    expect(levels.slice(0, 3).every((l) => l.obstacles.length === 0)).toBe(true);

    // New constraint kinds arrive on schedule.
    expect(levels[5].constraint?.type).toBe('timed'); // level 6
    expect(levels[7].constraint?.type).toBe('mistakes'); // level 8

    // Moves tighten across the ramp: level 7 is stricter than level 1.
    const budgetAt = (i: number) => {
      const c = levels[i].constraint;
      return c?.type === 'moves' ? c.budget : Number.POSITIVE_INFINITY;
    };
    expect(budgetAt(6)).toBeLessThan(budgetAt(0));

    // Level 10 is the boss.
    expect(levels[9].voyage?.isBoss).toBe(true);
  });
});

describe('episode-1 cage layers (Validation S1)', () => {
  it('keeps level 4 a 1-layer instant-pop cage (no layers field)', () => {
    const level = episodeOneLevel(4, PALETTE);
    expect(level.obstacles).toHaveLength(1);
    expect(level.obstacles.every((o) => o.type === 'cagedDot' && o.layers === undefined)).toBe(
      true,
    );
    expect(cagedCells(level).every((c) => c.layers === 1)).toBe(true);
  });

  it('seeds a 2-layer teaching cage on the pre-boss level 5', () => {
    const level = episodeOneLevel(5, PALETTE);
    const layers = cagedCells(level).map((c) => c.layers);
    expect(layers).toContain(2); // at least one multi-layer teaching cage
    expect(Math.max(...layers)).toBe(2); // never above the mid band before the boss
  });

  it('keeps level 9 cages 1-layer (teach band, no authored override)', () => {
    const level = episodeOneLevel(9, PALETTE);
    expect(cagedCells(level).every((c) => c.layers === 1)).toBe(true);
  });
});
