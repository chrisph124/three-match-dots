import { describe, expect, it } from 'vitest';
import {
  CODEC_VERSION,
  decodeBase64,
  encodeBase64,
  EPISODE_SIZE,
  packEpisode,
  unpackEpisode,
} from './voyage-progress-codec';

describe('voyage progress codec', () => {
  it('round-trips a full episode of star values', () => {
    const results = [0, 1, 2, 3, 0, 3, 1, 2, 3, 0];
    expect(unpackEpisode(packEpisode(results))).toEqual(results);
  });

  it('holds the boundary levels (index 0 and EPISODE_SIZE-1) independently', () => {
    const results = new Array<number>(EPISODE_SIZE).fill(0);
    results[0] = 3;
    results[EPISODE_SIZE - 1] = 3;
    const back = unpackEpisode(packEpisode(results));
    expect(back[0]).toBe(3);
    expect(back[EPISODE_SIZE - 1]).toBe(3);
    expect(back.slice(1, EPISODE_SIZE - 1).every((v) => v === 0)).toBe(true);
  });

  it('zero-fills a short input and truncates an over-long one', () => {
    expect(unpackEpisode(packEpisode([2]))[0]).toBe(2);
    expect(unpackEpisode(packEpisode([2]))[1]).toBe(0);
    const tooMany = new Array<number>(EPISODE_SIZE + 5).fill(1);
    expect(unpackEpisode(packEpisode(tooMany))).toHaveLength(EPISODE_SIZE);
  });

  it('clamps out-of-range star values into 0..3', () => {
    const back = unpackEpisode(packEpisode([9, -4, 3, 2, 1, 0, 0, 0, 0, 0]));
    expect(back[0]).toBe(3); // 9 clamps down
    expect(back[1]).toBe(0); // -4 clamps up
  });

  it('reads an unknown version as a fresh (all-zero) episode', () => {
    const packed = packEpisode([3, 3, 3, 3, 3, 3, 3, 3, 3, 3]);
    packed[0] = CODEC_VERSION + 7; // simulate a future format
    expect(unpackEpisode(packed)).toEqual(new Array<number>(EPISODE_SIZE).fill(0));
  });

  it('reads a missing or truncated buffer as a fresh episode', () => {
    expect(unpackEpisode(null)).toEqual(new Array<number>(EPISODE_SIZE).fill(0));
    expect(unpackEpisode(new Uint8Array([CODEC_VERSION, 0]))).toEqual(
      new Array<number>(EPISODE_SIZE).fill(0),
    );
  });

  it('base64 round-trips the packed buffer', () => {
    const packed = packEpisode([1, 2, 3, 0, 1, 2, 3, 0, 1, 2]);
    const restored = decodeBase64(encodeBase64(packed));
    expect(Array.from(restored)).toEqual(Array.from(packed));
    expect(unpackEpisode(restored)).toEqual([1, 2, 3, 0, 1, 2, 3, 0, 1, 2]);
  });
});
