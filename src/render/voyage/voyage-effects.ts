// Pooled Voyage juice — shard bursts, sweep ripples, a seal-thud — built on the
// shipped effect-layer discipline (`use-board-animation.ts`): FIXED pools held
// as ONE shared value per field (never a loop of `useSharedValue`, which would
// break rules-of-hooks), a single UI-thread clock advancing every frame, and
// module-level fire mutators (no `.value` writes in a component body, per the
// React-Compiler rule). Rendering lives in `voyage-effects-layer.tsx`. Tone
// stays restrained per the LOCKED creative bible — small shards, one ripple.

import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';

/** Fixed pools sized to the busiest moment (a big sweep) — never grown per event. */
export const SPARK_POOL = 18;
export const RIPPLE_POOL = 4;

/** Idle sentinel: a start time so far in the past that progress reads as 1 (faded). */
const IDLE_START = -1e9;

export type VoyageEffects = {
  /** Monotonic UI-thread clock (ms since first frame), advanced by a frame callback. */
  readonly clock: SharedValue<number>;
  readonly sparkStart: SharedValue<number[]>;
  readonly sparkDur: SharedValue<number[]>;
  readonly sparkOx: SharedValue<number[]>;
  readonly sparkOy: SharedValue<number[]>;
  readonly sparkAng: SharedValue<number[]>;
  readonly sparkDist: SharedValue<number[]>;
  readonly sparkColor: SharedValue<string[]>;
  readonly rippleStart: SharedValue<number[]>;
  readonly rippleDur: SharedValue<number[]>;
  readonly rippleCx: SharedValue<number[]>;
  readonly rippleCy: SharedValue<number[]>;
  readonly rippleMax: SharedValue<number[]>;
  readonly rippleColor: SharedValue<string[]>;
  readonly sparkCursor: { current: number };
  readonly rippleCursor: { current: number };
};

/** Reads the OS reduce-motion flag and tracks changes, so every effect can pick
 *  its calm variant. Defaults to false until the async read resolves. */
export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (alive) setReduced(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

/** Build the fixed effect pools + the frame clock. A constant number of hook
 *  calls (no loop), so rules-of-hooks holds. Slots start idle. */
export function useVoyageEffects(): VoyageEffects {
  const clock = useSharedValue(0);
  const sparkStart = useSharedValue<number[]>(new Array(SPARK_POOL).fill(IDLE_START));
  const sparkDur = useSharedValue<number[]>(new Array(SPARK_POOL).fill(1));
  const sparkOx = useSharedValue<number[]>(new Array(SPARK_POOL).fill(0));
  const sparkOy = useSharedValue<number[]>(new Array(SPARK_POOL).fill(0));
  const sparkAng = useSharedValue<number[]>(new Array(SPARK_POOL).fill(0));
  const sparkDist = useSharedValue<number[]>(new Array(SPARK_POOL).fill(0));
  const sparkColor = useSharedValue<string[]>(new Array(SPARK_POOL).fill('#ffffff'));
  const rippleStart = useSharedValue<number[]>(new Array(RIPPLE_POOL).fill(IDLE_START));
  const rippleDur = useSharedValue<number[]>(new Array(RIPPLE_POOL).fill(1));
  const rippleCx = useSharedValue<number[]>(new Array(RIPPLE_POOL).fill(0));
  const rippleCy = useSharedValue<number[]>(new Array(RIPPLE_POOL).fill(0));
  const rippleMax = useSharedValue<number[]>(new Array(RIPPLE_POOL).fill(0));
  const rippleColor = useSharedValue<string[]>(new Array(RIPPLE_POOL).fill('#ffffff'));

  useFrameCallback((info) => {
    clock.value = info.timeSinceFirstFrame;
  });

  const sparkCursor = useRef(0);
  const rippleCursor = useRef(0);
  // Stable identity: every field above is a hook-owned ref/shared value that never
  // changes identity, so an empty-dep memo lets downstream effects and the pooled
  // Spark/Ripple children skip re-running on unrelated renders (the same reason
  // `useChainState`/`useBoardAnimation` memoise their bundles).
  return useMemo(
    () => ({
      clock,
      sparkStart,
      sparkDur,
      sparkOx,
      sparkOy,
      sparkAng,
      sparkDist,
      sparkColor,
      rippleStart,
      rippleDur,
      rippleCx,
      rippleCy,
      rippleMax,
      rippleColor,
      sparkCursor,
      rippleCursor,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- all fields are stable hook identities; bundle built once
    [],
  );
}

/** Replace one element of a shared array (per-event, not per-frame). Mirrors the
 *  `clearRank.value = [...]` array-swap the shipped effect layer already does. */
function setAt<T>(sv: SharedValue<T[]>, index: number, value: T): void {
  const next = [...sv.value];
  next[index] = value;
  sv.value = next;
}

/** Dot-pop shards: a small radial burst from (x,y) in the dot's colour. Reduced
 *  motion keeps the flash but drops the travel (sparks fade in place). */
export function fireShards(
  fx: VoyageEffects,
  x: number,
  y: number,
  color: string,
  reduced: boolean,
): void {
  const count = reduced ? 4 : 8;
  const now = fx.clock.value;
  for (let k = 0; k < count; k += 1) {
    const slot = (fx.sparkCursor.current + k) % SPARK_POOL;
    setAt(fx.sparkOx, slot, x);
    setAt(fx.sparkOy, slot, y);
    setAt(fx.sparkColor, slot, color);
    setAt(fx.sparkAng, slot, (k / count) * Math.PI * 2);
    setAt(fx.sparkDist, slot, reduced ? 0 : 22);
    setAt(fx.sparkDur, slot, reduced ? 200 : 460);
    setAt(fx.sparkStart, slot, now);
  }
  fx.sparkCursor.current = (fx.sparkCursor.current + count) % SPARK_POOL;
}

function fireRing(
  fx: VoyageEffects,
  x: number,
  y: number,
  rMax: number,
  color: string,
  dur: number,
): void {
  const slot = fx.rippleCursor.current % RIPPLE_POOL;
  fx.rippleCursor.current += 1;
  setAt(fx.rippleCx, slot, x);
  setAt(fx.rippleCy, slot, y);
  setAt(fx.rippleMax, slot, rMax);
  setAt(fx.rippleColor, slot, color);
  setAt(fx.rippleDur, slot, dur);
  setAt(fx.rippleStart, slot, fx.clock.value);
}

/** Sweep ripple: a single expanding ring when a loop/line sweeps a colour. */
export function fireRipple(
  fx: VoyageEffects,
  x: number,
  y: number,
  color: string,
  reduced: boolean,
): void {
  fireRing(fx, x, y, reduced ? 40 : 92, color, reduced ? 260 : 520);
}

/** Seal thud: a pale, heavier ring when a cage frees — reuses the ripple pool. */
export function fireSealThud(fx: VoyageEffects, x: number, y: number, reduced: boolean): void {
  fireRing(fx, x, y, reduced ? 30 : 60, 'rgba(255, 235, 200, 0.92)', reduced ? 220 : 380);
}
