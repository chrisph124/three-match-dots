// Pure, Vitest-tested progress codec for Voyage. A near-infinite ladder must not
// become thousands of MMKV keys, so progress is packed per EPISODE (10 levels)
// into one small versioned byte string: 1 version byte + a 20-bit field (2 bits
// per level). The MMKV wrapper (voyage-progress-storage.ts) is the only RN part;
// all packing/unpacking lives here where it can be proven.
//
// Per-level value (2 bits): 0 = not cleared, 1/2/3 = stars earned. "Unlocked" is
// DERIVED (linear unlock: level N is reachable once N-1 is cleared), never
// stored — so 2 bits is enough and the field can't disagree with itself.

/** Levels packed into one episode key. */
export const EPISODE_SIZE = 10;

/** Format version. Bumping it makes every old key read as "all not cleared"
 *  (forward-compatible) rather than corrupting — see `unpackEpisode`. */
export const CODEC_VERSION = 1;

const MAX_STARS = 3;
const BYTES = 4; // [version, b0, b1, b2] — 1 header + 3 data bytes hold 20 bits.

function clampStars(value: number): number {
  return Math.min(MAX_STARS, Math.max(0, Math.trunc(value)));
}

/** Ten per-level star values (0..3) → a 4-byte versioned buffer. Input shorter
 *  than an episode is zero-filled; longer is truncated to `EPISODE_SIZE`. */
export function packEpisode(results: readonly number[]): Uint8Array {
  let field = 0;
  for (let i = 0; i < EPISODE_SIZE; i += 1) {
    const stars = clampStars(results[i] ?? 0);
    field |= stars << (2 * i);
  }
  const bytes = new Uint8Array(BYTES);
  bytes[0] = CODEC_VERSION;
  bytes[1] = field & 0xff;
  bytes[2] = (field >> 8) & 0xff;
  bytes[3] = (field >> 16) & 0x0f;
  return bytes;
}

/** Inverse of `packEpisode`. A missing/short buffer or an unknown version reads
 *  as a fresh episode (all zeros) — the forward-compatible migration path. */
export function unpackEpisode(bytes: Uint8Array | null | undefined): number[] {
  const fresh = new Array<number>(EPISODE_SIZE).fill(0);
  if (!bytes || bytes.length < BYTES || bytes[0] !== CODEC_VERSION) {
    return fresh;
  }
  const field = bytes[1] | (bytes[2] << 8) | (bytes[3] << 16);
  for (let i = 0; i < EPISODE_SIZE; i += 1) {
    fresh[i] = (field >> (2 * i)) & 0b11;
  }
  return fresh;
}

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Base64-encode a byte buffer without relying on Buffer/btoa (Hermes-safe). */
export function encodeBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (b0 << 16) | (b1 << 8) | b2;
    out += B64_ALPHABET[(triple >> 18) & 0x3f];
    out += B64_ALPHABET[(triple >> 12) & 0x3f];
    out += i + 1 < bytes.length ? B64_ALPHABET[(triple >> 6) & 0x3f] : '=';
    out += i + 2 < bytes.length ? B64_ALPHABET[triple & 0x3f] : '=';
  }
  return out;
}

/** Inverse of `encodeBase64`. Ignores padding and any stray non-alphabet char. */
export function decodeBase64(input: string): Uint8Array {
  const clean = input.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let outIndex = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = B64_ALPHABET.indexOf(clean[i]);
    const c1 = B64_ALPHABET.indexOf(clean[i + 1]);
    const c2 = i + 2 < clean.length ? B64_ALPHABET.indexOf(clean[i + 2]) : -1;
    const c3 = i + 3 < clean.length ? B64_ALPHABET.indexOf(clean[i + 3]) : -1;
    const triple = (c0 << 18) | (c1 << 12) | (Math.max(c2, 0) << 6) | Math.max(c3, 0);
    if (outIndex < out.length) out[outIndex++] = (triple >> 16) & 0xff;
    if (c2 >= 0 && outIndex < out.length) out[outIndex++] = (triple >> 8) & 0xff;
    if (c3 >= 0 && outIndex < out.length) out[outIndex++] = triple & 0xff;
  }
  return out.subarray(0, outIndex);
}
