import { Circle } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import type { BoardAnimation } from '../effects/use-board-animation';
import { STAGGER_SPAN } from '../effects/use-board-animation';
import type { Board } from '../core/types';
import { centerX, centerY, type BoardLayout } from './geometry';
import { colorFor, DOT_RADIUS_RATIO } from './palette';

/** How much a dot swells while its colour is armed for a sweep. */
const HIGHLIGHT_SCALE = 1.12;

/** Fraction of a merge hop a dot spends at full radius before it shrinks to 0. */
const FADE_HOLD = 0.65;

/** Fraction of the fall timeline before the drop-bounce overshoot begins. */
const B_START = 0.72;

function clamp01(t: number): number {
  'worklet';
  return Math.min(Math.max(t, 0), 1);
}

/** Smooth in-out easing for a merge hop (smoothstep). */
function ease(t: number): number {
  'worklet';
  return t * t * (3 - 2 * t);
}

/**
 * Drop-bounce envelope: 0 until the dot is nearly home (`B_START`), then a
 * single soft overshoot that returns to 0 exactly at `t = 1`. `cy` scales this
 * by a fixed px amplitude, so the overshoot never grows with fall distance and
 * a settling dot cannot dip into a neighbour's cell.
 */
function bounceEnv(t: number): number {
  'worklet';
  if (t <= B_START || t >= 1) {
    return 0;
  }
  return Math.sin(((t - B_START) / (1 - B_START)) * Math.PI);
}

/**
 * Shared merge-relay lerp core for both axes, so the onset/easing formula lives
 * in exactly one place and `cx`/`cy` can never drift apart. Returns `base`
 * untouched when the cell is not merging (`rank < 0`) or is the anchor/terminal
 * (`target < 0`); otherwise eases the dot from `base` toward `targetCenter` over
 * a single `mergeTravel` window that opens at `rank * mergeStep`.
 */
function mergeAxis(
  base: number,
  targetCenter: number,
  rank: number,
  target: number,
  mergeStep: number,
  mergeTravel: number,
  mergeT: number,
): number {
  'worklet';
  if (rank < 0 || target < 0) {
    return base;
  }
  const onset = rank * mergeStep;
  const local = clamp01((mergeT - onset) / mergeTravel);
  return base + (targetCenter - base) * ease(local);
}

type DotProps = {
  readonly cell: number;
  readonly colorId: number;
  readonly layout: BoardLayout;
  readonly anim: BoardAnimation;
};

function Dot({ cell, colorId, layout, anim }: DotProps) {
  const cx = useDerivedValue(() => {
    const base = centerX(cell, layout) + anim.offsetX.value[cell] * (1 - anim.moveT.value);
    const target = anim.mergeTarget.value[cell];
    return mergeAxis(
      base,
      centerX(target, layout),
      anim.mergeRank.value[cell],
      target,
      anim.mergeStep.value,
      anim.mergeTravel.value,
      anim.mergeT.value,
    );
  });
  const cy = useDerivedValue(() => {
    // The bounce term is a fixed px overshoot decoupled from the fall distance
    // (`shift`), folded into the fall base. It rides ONLY on cells that actually
    // moved this batch (`shift !== 0`); a stationary dot elsewhere on the board
    // must not hop when a distant column drops. During a merge relay `moveT` is
    // 1, so both the fall and bounce terms are 0 and only the relay lerp moves
    // the dot; the two never overlap in time.
    const shift = anim.offsetY.value[cell];
    const base =
      centerY(cell, layout) +
      shift * (1 - anim.moveT.value) +
      (shift !== 0 ? anim.bounce.value * bounceEnv(anim.moveT.value) : 0);
    const target = anim.mergeTarget.value[cell];
    return mergeAxis(
      base,
      centerY(target, layout),
      anim.mergeRank.value[cell],
      target,
      anim.mergeStep.value,
      anim.mergeTravel.value,
      anim.mergeT.value,
    );
  });
  const radius = useDerivedValue(() => {
    // `-1` is also `EMPTY` in the `Color` domain (src/core/types.ts), so the
    // idle "no highlight armed" sentinel must not be allowed to match a hole.
    const highlighted = anim.highlight.value >= 0 && anim.highlight.value === colorId;
    const base = DOT_RADIUS_RATIO * layout.cellSize * (highlighted ? HIGHLIGHT_SCALE : 1);
    // Default path: the merge relay folds the pop into each hop — a dot rides at
    // full radius through `FADE_HOLD` of its own hop, then shrinks to 0 over the
    // tail. Terminal + swept extras share rank `len-1`, so they fade on the
    // finale beat. Mutually exclusive with the `clearRank` (Reduce Motion) branch.
    const mrank = anim.mergeRank.value[cell];
    if (mrank >= 0) {
      const onset = mrank * anim.mergeStep.value;
      const local = clamp01((anim.mergeT.value - onset) / anim.mergeTravel.value);
      const fade = clamp01((local - FADE_HOLD) / (1 - FADE_HOLD));
      return base * (1 - fade);
    }
    const rank = anim.clearRank.value[cell];
    if (rank < 0) {
      return base;
    }
    const start = (rank / anim.clearSpan.value) * STAGGER_SPAN;
    const local = (anim.clearT.value - start) / (1 - STAGGER_SPAN);
    return base * (1 - Math.min(Math.max(local, 0), 1));
  });

  // Dead-flat disc: one solid frozen-hue fill, no shading/gloss/ring. The shared
  // `cx`/`cy`/`radius` values drive it directly, so merge-fade (radius -> 0),
  // drop-bounce (cy overshoot) and sweep highlight (radius * 1.12) all compose on
  // the plain circle. A faded/cleared dot lands at `r = 0` and renders nothing.
  return <Circle cx={cx} cy={cy} r={radius} color={colorFor(colorId)} />;
}

type DotLayerProps = {
  readonly board: Board;
  readonly layout: BoardLayout;
  readonly anim: BoardAnimation;
};

/**
 * Colours come from React props rather than a shared value: the board only
 * changes once per commit, so a re-render is cheaper and far simpler than
 * animating them on the UI thread. Positions and size come from shared values,
 * because those change every frame.
 *
 * Endless and Journey draw the SAME dead-flat disc: identity is colour alone. The
 * frozen hues clear WCAG contrast on the dark ground both modes now sit on (the
 * opaque panel for Endless, `SCREEN_BACKGROUND` for Journey).
 */
export function DotLayer({ board, layout, anim }: DotLayerProps) {
  return (
    <>
      {board.map((colorId, cell) => (
        <Dot key={cell} cell={cell} colorId={colorId} layout={layout} anim={anim} />
      ))}
    </>
  );
}
