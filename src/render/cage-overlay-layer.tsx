// A sibling overlay that draws the caged dots: a folded-paper cage frame plus a
// remaining-layer indicator over each caged cell, in BOTH Journey and Voyage.
// Same layering discipline as `VoyageEffectsLayer` — absolute over the board,
// `pointerEvents="none"`, one animated sub-component per caged cell reading the
// shared geometry — so it never perturbs the gesture hit-test on the canvas
// below. The frame is a SQUARE over the round dot and its pips are squares, so a
// cage reads as "different from a normal dot" by SHAPE, not colour alone
// (creative-bible §2.4). It tracks its dot through a gravity fall by reading the
// same board-animation offsets the dot layer does, and rattles + drops a pip the
// moment a layer is chipped (the `chipped` clear-event channel), so a chip-only
// commit — which clears nothing — still gives visible feedback.

import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import type { CellIndex, ClearedCell } from '../core/types';
import type { BoardAnimation } from '../effects/use-board-animation';
import { centerX, centerY, type BoardLayout } from './geometry';

/** The subset of Voyage/Journey clear events this layer reads (never builds).
 *  `chipped` carries the multi-layer cages hit but not freed this commit. */
type CageClearEvent = {
  readonly seq: number;
  readonly chipped?: readonly ClearedCell[];
};

type LayerProps = {
  readonly caged: ReadonlyMap<CellIndex, number>;
  readonly event: CageClearEvent | null;
  readonly layout: BoardLayout;
  readonly anim: BoardAnimation;
  readonly reduceMotion: boolean;
};

/** Cage frame as a fraction of the cell — larger than the dot, inside the cell. */
const FRAME_RATIO = 0.82;
/** Above this many layers, pips would crowd the cell — show a numeric badge. */
const MAX_PIPS = 3;
const RATTLE_MS = 180;
const RATTLE_PX = 3;
/** Fraction of the fall timeline before the drop-bounce overshoot begins. */
const B_START = 0.72;

/** Drop-bounce envelope, mirrored from the dot layer so a caged dot's frame
 *  overshoots in lockstep with the dot it sits on. */
function bounceEnv(t: number): number {
  'worklet';
  if (t <= B_START || t >= 1) {
    return 0;
  }
  return Math.sin(((t - B_START) / (1 - B_START)) * Math.PI);
}

/** Kicks off one rattle. A module-level writer so the `.value` write never sits
 *  lexically in a component body (React-Compiler immutability rule). */
function playChip(rattle: SharedValue<number>): void {
  rattle.value = 0;
  rattle.value = withTiming(1, { duration: RATTLE_MS });
}

/** Pips (one per remaining layer) up to `MAX_PIPS`, then a numeric badge. Shape,
 *  not colour, carries the count — square pips read against the round dot. */
function LayerIndicator({ layers }: { layers: number }) {
  if (layers > MAX_PIPS) {
    return (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{layers}</Text>
      </View>
    );
  }
  return (
    <View style={styles.pips}>
      {Array.from({ length: layers }, (_, i) => (
        <View key={i} style={styles.pip} />
      ))}
    </View>
  );
}

function Cage({
  index,
  layers,
  layout,
  anim,
  event,
  reduceMotion,
}: {
  readonly index: CellIndex;
  readonly layers: number;
  readonly layout: BoardLayout;
  readonly anim: BoardAnimation;
  readonly event: CageClearEvent | null;
  readonly reduceMotion: boolean;
}) {
  const size = layout.cellSize * FRAME_RATIO;
  const rattle = useSharedValue(1); // settled: the shake term is 0 at 1

  // Rattle this cage when the latest clear chipped it. Fires on the OLD index
  // (the event carries pre-gravity indices, and `caged` has not remapped yet
  // during the clear window), so the shake lands on the cell the player hit.
  const lastSeq = useRef(0);
  useEffect(() => {
    if (!event || event.seq === lastSeq.current) {
      return;
    }
    lastSeq.current = event.seq;
    if (reduceMotion) {
      return;
    }
    if (event.chipped?.some((c) => c.index === index)) {
      playChip(rattle);
    }
  }, [event, index, rattle, reduceMotion]);

  const style = useAnimatedStyle(() => {
    // Follow the dot through a gravity fall with the exact term the dot layer
    // uses: offset * (1 - moveT), plus the fixed-px drop bounce. These hooks
    // drive playClear + playMove only (never the merge relay), so no merge term.
    const shiftX = anim.offsetX.value[index] * (1 - anim.moveT.value);
    const shiftY = anim.offsetY.value[index];
    const fallY =
      shiftY * (1 - anim.moveT.value) +
      (shiftY !== 0 ? anim.bounce.value * bounceEnv(anim.moveT.value) : 0);
    const cx = centerX(index, layout) + shiftX;
    const cy = centerY(index, layout) + fallY;
    const p = rattle.value;
    const shake = Math.sin(p * Math.PI * 4) * RATTLE_PX * (1 - p);
    return {
      transform: [{ translateX: cx - size / 2 + shake }, { translateY: cy - size / 2 }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.frame, { width: size, height: size }, style]}
    >
      <LayerIndicator layers={layers} />
    </Animated.View>
  );
}

/**
 * The full cage overlay. A pure function of `caged` (what to draw + where + how
 * many pips) plus the transient `event` (which cage to rattle this frame). One
 * `<Cage>` per live caged cell, keyed by its cell index; a freed cage drops out
 * of the map, so its frame unmounts as its dot pops via the existing clear anim.
 */
export function CageOverlayLayer({ caged, event, layout, anim, reduceMotion }: LayerProps) {
  const width = layout.cellSize * layout.cols;
  const height = layout.cellSize * layout.rows;
  return (
    <View pointerEvents="none" style={[styles.overlay, { width, height }]}>
      {[...caged.entries()].map(([index, layers]) => (
        <Cage
          key={index}
          index={index}
          layers={layers}
          layout={layout}
          anim={anim}
          event={event}
          reduceMotion={reduceMotion}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', left: 0, top: 0 },
  frame: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderWidth: 2.5,
    borderColor: '#d9c7a3', // muted kraft paper-pigment (creative-bible §2.4)
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 3,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  pips: { flexDirection: 'row', gap: 3 },
  pip: { width: 6, height: 6, borderRadius: 1, backgroundColor: '#8a7a5c' },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 4,
    backgroundColor: '#8a7a5c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#fbf3e0' },
});
