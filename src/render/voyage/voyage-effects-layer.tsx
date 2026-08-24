// The overlay that draws the pooled juice from `voyage-effects.ts`. One
// Animated.View per pool slot — each is its OWN component, so its `useAnimated
// Style` hook runs once (never in a loop → rules-of-hooks holds). Every slot's
// style is a pure function of the shared clock and its per-slot start/duration,
// so an idle slot (start far in the past) renders invisible and costs nothing.
//
// Draws in the board's pixel space (origin 0,0), so the layer must be mounted
// as a sibling of `BoardCanvas` inside the same board-sized view. `pointerEvents
// none` guarantees it never intercepts a drag.

import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { RIPPLE_POOL, SPARK_POOL, type VoyageEffects } from './voyage-effects';

type LayerProps = {
  readonly fx: VoyageEffects;
  readonly width: number;
  readonly height: number;
};

const SPARK_SIZE = 8;

/** Clamped 0..1 progress of a pool slot from the shared clock. */
function progress(clock: number, start: number, dur: number): number {
  'worklet';
  return Math.min(Math.max((clock - start) / dur, 0), 1);
}

function Spark({ fx, index }: { fx: VoyageEffects; index: number }) {
  const style = useAnimatedStyle(() => {
    const p = progress(fx.clock.value, fx.sparkStart.value[index], fx.sparkDur.value[index]);
    const r = fx.sparkDist.value[index] * p;
    const ang = fx.sparkAng.value[index];
    return {
      opacity: 1 - p,
      backgroundColor: fx.sparkColor.value[index],
      transform: [
        { translateX: fx.sparkOx.value[index] + Math.cos(ang) * r - SPARK_SIZE / 2 },
        { translateY: fx.sparkOy.value[index] + Math.sin(ang) * r - SPARK_SIZE / 2 },
        { scale: Math.max(0.001, 1 - p * 0.6) },
      ],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.spark, style]} />;
}

function Ripple({ fx, index }: { fx: VoyageEffects; index: number }) {
  const style = useAnimatedStyle(() => {
    const p = progress(fx.clock.value, fx.rippleStart.value[index], fx.rippleDur.value[index]);
    const radius = fx.rippleMax.value[index] * p;
    return {
      width: radius * 2,
      height: radius * 2,
      borderRadius: radius,
      opacity: (1 - p) * 0.8,
      borderColor: fx.rippleColor.value[index],
      transform: [
        { translateX: fx.rippleCx.value[index] - radius },
        { translateY: fx.rippleCy.value[index] - radius },
      ],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.ripple, style]} />;
}

/** The full pooled-juice overlay. Fixed child count (pool sizes), so React never
 *  mounts/unmounts a slot at runtime — only the shared values change. */
export function VoyageEffectsLayer({ fx, width, height }: LayerProps) {
  return (
    <View pointerEvents="none" style={[styles.overlay, { width, height }]}>
      {Array.from({ length: RIPPLE_POOL }, (_, i) => (
        <Ripple key={`r${i}`} fx={fx} index={i} />
      ))}
      {Array.from({ length: SPARK_POOL }, (_, i) => (
        <Spark key={`s${i}`} fx={fx} index={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', left: 0, top: 0 },
  spark: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: SPARK_SIZE,
    height: SPARK_SIZE,
    borderRadius: SPARK_SIZE / 2,
  },
  ripple: { position: 'absolute', left: 0, top: 0, borderWidth: 2 },
});
