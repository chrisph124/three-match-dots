import { createMMKV } from 'react-native-mmkv';

/**
 * One-shot tutorial flags — local device state, no secret. Follows the same
 * `createMMKV()` factory the score/progress stores use (MMKV v4: `MMKV` is a
 * type only, instances come from the factory, never `new MMKV()`). Booleans are
 * stored as the string `'1'` (the app's MMKV boolean convention), under
 * dot-prefixed keys so they can't collide with the score / sweep / progress
 * stores.
 */
const CAGE_INTRO_KEY = 'tutorial.cageIntroSeen';
const FLAG_SET = '1';

const storage = createMMKV();

/** Whether the layered-cage teaching popup has already been dismissed for good. */
export function hasSeenCageIntro(): boolean {
  return storage.getString(CAGE_INTRO_KEY) === FLAG_SET;
}

/** Records that the player dismissed the cage popup with "don't show again". */
export function markCageIntroSeen(): void {
  storage.set(CAGE_INTRO_KEY, FLAG_SET);
}
