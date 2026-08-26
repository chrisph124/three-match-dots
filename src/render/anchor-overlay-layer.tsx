// A sibling overlay that draws the anchor weights: one paper-weight silhouette
// over each anchored cell, in BOTH Journey and Voyage. Same layering discipline
// as `CageOverlayLayer` — absolute over the board, `pointerEvents="none"`, one
// animated sub-component per cell reading the shared geometry — so it never
// perturbs the gesture hit-test on the canvas below.
//
// A weight reads as "different from a normal dot" by SHAPE, not colour: it is a
// FILLED, beveled block with a handle (a squat mass, lit from the top-left per
// creative-bible §2.1) — the opaque body SUPPRESSES the underlying cell colour,
// which is irrelevant to the player (§2.4). That fill is the visible contrast
// with the cage's HOLLOW square frame, so the two obstacles never read alike.
// It follows its cell through a gravity fall by reading the SAME board-animation
// offsets the dot layer does, so a fallen weight slides in lockstep with the dot
// beneath it.
//
// A weight is SINGLE-HIT: it has no layers and no chip state, so — unlike the
// cage — there is no `event` channel to react to and no reduce-motion-gated
// rattle. Removal is a plain unmount: when an 8-way-adjacent clear drops a cell
// out of the `anchors` set the weight's frame simply disappears, and the freed
// cell's fall/refill is already drawn by the normal dot layer. The gravity-follow
// transform is unconditional, exactly as the cage frame's is.
//
// Palette: reuses the cage's kraft-paper pigments — it introduces no new palette
// entry (`DOT_COLORS` is frozen; those hues are the dot identity, not chrome).

import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import type { CellIndex } from '../core/types';
import type { BoardAnimation } from '../effects/use-board-animation';
import { centerX, centerY, type BoardLayout } from './geometry';

type LayerProps = {
  readonly anchors: ReadonlySet<CellIndex>;
  readonly layout: BoardLayout;
  readonly anim: BoardAnimation;
};

/** Slot as a fraction of the cell — the box the weight silhouette is centred in
 *  (matches the cage frame, so both obstacles sit on the same footprint). */
const SLOT_RATIO = 0.82;
/** Weight parts as fractions of the slot: a squat body under a small arch handle.
 *  The body is wider than the dot's diameter (0.68·cell) so its fill covers it. */
const BODY_W = 0.86;
const BODY_H = 0.58;
const HANDLE_W = 0.42;
const HANDLE_H = 0.3;
/** The handle tucks slightly into the body top so the arch legs meet the mass. */
const HANDLE_OVERLAP = 0.03;
/** Fraction of the fall timeline before the drop-bounce overshoot begins. */
const B_START = 0.72;

/** Drop-bounce envelope, mirrored from the dot layer so a weight's frame
 *  overshoots in lockstep with the dot it sits on. A sibling overlay keeps its
 *  own copy rather than cross-importing the cage layer's private helper. */
function bounceEnv(t: number): number {
  'worklet';
  if (t <= B_START || t >= 1) {
    return 0;
  }
  return Math.sin(((t - B_START) / (1 - B_START)) * Math.PI);
}

function Weight({
  index,
  layout,
  anim,
}: {
  readonly index: CellIndex;
  readonly layout: BoardLayout;
  readonly anim: BoardAnimation;
}) {
  const size = layout.cellSize * SLOT_RATIO;

  const style = useAnimatedStyle(() => {
    // Follow the dot through a gravity fall with the exact term the dot layer
    // uses: offset * (1 - moveT), plus the fixed-px drop bounce.
    const shiftX = anim.offsetX.value[index] * (1 - anim.moveT.value);
    const shiftY = anim.offsetY.value[index];
    const fallY =
      shiftY * (1 - anim.moveT.value) +
      (shiftY !== 0 ? anim.bounce.value * bounceEnv(anim.moveT.value) : 0);
    const cx = centerX(index, layout) + shiftX;
    const cy = centerY(index, layout) + fallY;
    return {
      transform: [{ translateX: cx - size / 2 }, { translateY: cy - size / 2 }],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.slot, { width: size, height: size }, style]}>
      <View
        style={[
          styles.handle,
          { width: size * HANDLE_W, height: size * HANDLE_H, marginBottom: -size * HANDLE_OVERLAP },
        ]}
      />
      <View style={[styles.body, { width: size * BODY_W, height: size * BODY_H }]} />
    </Animated.View>
  );
}

/**
 * The full anchor overlay. A pure function of `anchors` (which cells hold a
 * weight + where to draw it). One `<Weight>` per anchored cell, keyed by its cell
 * index; a removed weight drops out of the set, so its frame unmounts.
 */
export function AnchorOverlayLayer({ anchors, layout, anim }: LayerProps) {
  const width = layout.cellSize * layout.cols;
  const height = layout.cellSize * layout.rows;
  return (
    <View pointerEvents="none" style={[styles.overlay, { width, height }]}>
      {[...anchors].map((index) => (
        <Weight key={index} index={index} layout={layout} anim={anim} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', left: 0, top: 0 },
  slot: {
    position: 'absolute',
    left: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Open-bottom arch: the weight's carry handle, in the darker kraft pigment.
  handle: {
    borderWidth: 3,
    borderColor: '#8a7a5c',
    borderBottomWidth: 0,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
  },
  // Squat filled block, beveled for a top-left light source (creative-bible
  // §2.1): lighter top/left edges, darker bottom/right, shadow cast down-right.
  body: {
    borderRadius: 5,
    backgroundColor: '#d9c7a3',
    borderWidth: 2,
    borderTopColor: '#fbf3e0',
    borderLeftColor: '#fbf3e0',
    borderBottomColor: '#8a7a5c',
    borderRightColor: '#8a7a5c',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 3,
    shadowOffset: { width: 1.5, height: 2.5 },
    elevation: 3,
  },
});
