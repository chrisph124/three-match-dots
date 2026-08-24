import { describe, expect, it } from 'vitest';
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
