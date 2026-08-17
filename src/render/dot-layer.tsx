import { Circle } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import type { BoardAnimation } from '../effects/use-board-animation';
import { MERGE_STAGGER, STAGGER_SPAN } from '../effects/use-board-animation';
import type { Board } from '../core/types';
import { centerX, centerY, type BoardLayout } from './geometry';
import { colorFor, DOT_RADIUS_RATIO } from './palette';

/** How much a dot swells while its colour is armed for a sweep. */
const HIGHLIGHT_SCALE = 1.12;

/**
 * Shared merge-lerp core for both axes, so the stagger/easing formula lives in
 * exactly one place and `cx`/`cy` can never drift apart. Returns `base`
 * untouched when the cell is not merging (`rank < 0`) or is the anchor/terminal
 * (`target < 0`); otherwise eases the dot from `base` toward `targetCenter`,
 * staggered by `rank`.
 */
function mergeAxis(
  base: number,
  targetCenter: number,
  rank: number,
  target: number,
  mergeT: number,
  mergeSpan: number,
): number {
  'worklet';
  if (rank < 0 || target < 0) {
    return base;
  }
  const start = (rank / mergeSpan) * MERGE_STAGGER;
  const local = Math.min(Math.max((mergeT - start) / (1 - MERGE_STAGGER), 0), 1);
  return base + (targetCenter - base) * local;
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
      anim.mergeT.value,
      anim.mergeSpan.value,
    );
  });
  const cy = useDerivedValue(() => {
    const base = centerY(cell, layout) + anim.offsetY.value[cell] * (1 - anim.moveT.value);
    const target = anim.mergeTarget.value[cell];
    return mergeAxis(
      base,
      centerY(target, layout),
      anim.mergeRank.value[cell],
      target,
      anim.mergeT.value,
      anim.mergeSpan.value,
    );
  });
  const radius = useDerivedValue(() => {
    // `-1` is also `EMPTY` in the `Color` domain (src/core/types.ts), so the
    // idle "no highlight armed" sentinel must not be allowed to match a hole.
    const highlighted = anim.highlight.value >= 0 && anim.highlight.value === colorId;
    const base = DOT_RADIUS_RATIO * layout.cellSize * (highlighted ? HIGHLIGHT_SCALE : 1);
    const rank = anim.clearRank.value[cell];
    if (rank < 0) {
      return base;
    }
    const start = (rank / anim.clearSpan.value) * STAGGER_SPAN;
    const local = (anim.clearT.value - start) / (1 - STAGGER_SPAN);
    return base * (1 - Math.min(Math.max(local, 0), 1));
  });

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
 * animating colour on the UI thread. Positions and size come from shared
 * values, because those change every frame.
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
