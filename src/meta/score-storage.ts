import { createMMKV } from 'react-native-mmkv';

const SCORE_KEY = 'score';

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
