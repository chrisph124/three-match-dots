// The thin RN boundary over the pure progress codec. Everything provable lives
// in voyage-progress-codec.ts; this file only touches MMKV (v4 `createMMKV()`
// factory per project rules) and derives the linear-unlock view the ribbon needs.
// Local-only, no network — matches the "no backend in v1" decision.

import { createMMKV } from 'react-native-mmkv';
import {
  decodeBase64,
  encodeBase64,
  EPISODE_SIZE,
  packEpisode,
  unpackEpisode,
} from './voyage-progress-codec';

const storage = createMMKV();

/** Per-episode key: a long ladder stays a handful of small keys, not thousands. */
function episodeKey(episode: number): string {
  return `voyage.progress.ep${episode}`;
}

/** 1-based ladder index → its episode (1-based) and slot within that episode. */
export function locateLevel(index: number): { episode: number; slot: number } {
  const zero = index - 1;
  return { episode: Math.floor(zero / EPISODE_SIZE) + 1, slot: zero % EPISODE_SIZE };
}

/** The 10 star values (0..3) stored for one episode; fresh = all zero. */
export function loadEpisode(episode: number): number[] {
  const encoded = storage.getString(episodeKey(episode));
  return unpackEpisode(encoded ? decodeBase64(encoded) : null);
}

/**
 * Record a level result. Writes the WHOLE episode field in one atomic MMKV set
 * (never a per-level partial write) so an interrupted write can't corrupt a
 * neighbour. Stars only ever ratchet up — replaying a level can't lose a medal.
 */
export function recordLevelResult(index: number, stars: number): void {
  const { episode, slot } = locateLevel(index);
  const current = loadEpisode(episode);
  const next = [...current];
  next[slot] = Math.max(current[slot], stars);
  storage.set(episodeKey(episode), encodeBase64(packEpisode(next)));
}

export type LevelProgress = {
  readonly index: number;
  readonly stars: number;
  readonly cleared: boolean;
  readonly unlocked: boolean;
};

/**
 * The ribbon's read model for levels 1..maxIndex: stars, cleared, and DERIVED
 * unlock (level 1 is always open; level N opens once N-1 is cleared). Reads only
 * the few episode keys the range spans — never materializes per-level storage.
 */
export function loadLadderProgress(maxIndex: number): LevelProgress[] {
  const episodesNeeded = Math.max(1, Math.ceil(maxIndex / EPISODE_SIZE));
  const stars: number[] = [];
  for (let ep = 1; ep <= episodesNeeded; ep += 1) {
    stars.push(...loadEpisode(ep));
  }
  const out: LevelProgress[] = [];
  for (let index = 1; index <= maxIndex; index += 1) {
    const s = stars[index - 1] ?? 0;
    const cleared = s >= 1;
    const prevCleared = index === 1 || (stars[index - 2] ?? 0) >= 1;
    // A level opens when its predecessor is cleared — OR when it is itself already
    // cleared, so an out-of-order clear (e.g. a deep link past the frontier) can
    // never present a cleared level as locked-and-unreplayable.
    out.push({ index, stars: s, cleared, unlocked: prevCleared || cleared });
  }
  return out;
}
