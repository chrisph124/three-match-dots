import type { Color } from '../core/types';
import { createMMKV } from 'react-native-mmkv';

const SCORE_KEY = 'score';
// Lifetime per-color color-sweep tallies: 'sweeps.0', 'sweeps.1', … indexed by
// the core Color. Namespaced so a future settings/meta store can't collide.
const SWEEP_COUNT_PREFIX = 'sweeps.';

/**
 * The only module that touches MMKV. Keeping the storage choice behind three
 * functions means the core never learns about it and the backend stays
 * swappable.
 *
 * `react-native-mmkv` v4 rewrote its API around Nitro modules: `MMKV` is now
 * a type only, and instances come from the `createMMKV()` factory instead of
 * `new MMKV()`. `npx expo install react-native-mmkv` resolved v4.3.2, so the
 * factory form is what's actually available here.
 */
const storage = createMMKV();

export function readScore(): number {
  return storage.getNumber(SCORE_KEY) ?? 0;
}

export function writeScore(score: number): void {
  storage.set(SCORE_KEY, score);
}

export function resetScore(): void {
  storage.set(SCORE_KEY, 0);
}

/** Lifetime color-sweep tallies, one per color, 0-filled when unset. */
export function readSweepCounts(colors: number): number[] {
  const counts: number[] = [];
  for (let color = 0; color < colors; color++) {
    counts.push(storage.getNumber(SWEEP_COUNT_PREFIX + color) ?? 0);
  }
  return counts;
}

/**
 * Adds one to a single color's lifetime sweep tally. This is a RELATIVE write,
 * so its caller must fire exactly once per sweep commit — see the placement note
 * in `use-game-state.ts` `applyAndDrop`.
 */
export function incrementSweepCount(color: Color): void {
  const key = SWEEP_COUNT_PREFIX + color;
  storage.set(key, (storage.getNumber(key) ?? 0) + 1);
}

/**
 * Clears every color's lifetime sweep tally. Deliberately NOT called by
 * `resetScore` — resetting the score must leave collection history intact.
 */
export function resetSweepCounts(colors: number): void {
  for (let color = 0; color < colors; color++) {
    storage.set(SWEEP_COUNT_PREFIX + color, 0);
  }
}
