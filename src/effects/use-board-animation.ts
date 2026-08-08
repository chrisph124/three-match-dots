import { runOnJS, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import type { ClearedCell } from '../core/types';

export const CLEAR_MS = 200;
export const FALL_MS = 220;
export const SHUFFLE_MS = 260;

/** Fraction of the clear timeline spent staggering starts, not shrinking. */
export const STAGGER_SPAN = 0.5;

export type BoardAnimation = {
  /** Per-cell pixel offset a dot is drawn at when moveT is 0. */
  readonly offsetX: SharedValue<number[]>;
  readonly offsetY: SharedValue<number[]>;
  /** 0 = dots at their start offsets, 1 = settled. */
  readonly moveT: SharedValue<number>;
  /** Per-cell stagger rank while clearing; -1 means the dot is not clearing. */
  readonly clearRank: SharedValue<number[]>;
  /** How many ranks the current clear spans; never 0. */
  readonly clearSpan: SharedValue<number>;
  /** 0 -> 1 across the whole clear, stagger included. */
  readonly clearT: SharedValue<number>;
  /** Colour id to emphasise while a sweep is armed; -1 means none. */
  readonly highlight: SharedValue<number>;
};

export function useBoardAnimation(cellCount: number): BoardAnimation {
  return {
    offsetX: useSharedValue<number[]>(new Array(cellCount).fill(0)),
    offsetY: useSharedValue<number[]>(new Array(cellCount).fill(0)),
    moveT: useSharedValue(1),
    clearRank: useSharedValue<number[]>(new Array(cellCount).fill(-1)),
    clearSpan: useSharedValue(1),
    clearT: useSharedValue(0),
    highlight: useSharedValue(-1),
  };
}

/**
 * Shrinks the cleared dots away, staggered along the order `Resolution`
 * guarantees: chain cells in drag order, then sweep cells row-major.
 */
export function playClear(
  anim: BoardAnimation,
  cleared: readonly ClearedCell[],
  onDone: () => void,
): void {
  const ranks = new Array<number>(anim.clearRank.value.length).fill(-1);
  cleared.forEach((cell, rank) => {
    ranks[cell.index] = rank;
  });
  anim.clearRank.value = ranks;
  anim.clearSpan.value = Math.max(cleared.length, 1);
  anim.clearT.value = 0;
  anim.clearT.value = withTiming(1, { duration: CLEAR_MS }, (finished) => {
    'worklet';
    if (finished === true) {
      runOnJS(onDone)();
    }
  });
}

/** Clears the pop state so every dot draws at full size again. */
export function resetClear(anim: BoardAnimation): void {
  anim.clearRank.value = new Array<number>(anim.clearRank.value.length).fill(-1);
  anim.clearSpan.value = 1;
  anim.clearT.value = 0;
}

/**
 * Places every dot at its start offset, then slides them all home together.
 * Offsets are set before moveT so a dot never renders at its destination for
 * a frame first.
 */
export function playMove(
  anim: BoardAnimation,
  offsetX: number[],
  offsetY: number[],
  duration: number,
  onDone: () => void,
): void {
  anim.offsetX.value = offsetX;
  anim.offsetY.value = offsetY;
  anim.moveT.value = 0;
  anim.moveT.value = withTiming(1, { duration }, (finished) => {
    'worklet';
    if (finished === true) {
      runOnJS(onDone)();
    }
  });
}
