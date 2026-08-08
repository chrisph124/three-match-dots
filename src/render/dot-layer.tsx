import { Circle } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import type { BoardAnimation } from '../effects/use-board-animation';
import { STAGGER_SPAN } from '../effects/use-board-animation';
import type { Board } from '../core/types';
import { centerX, centerY, type BoardLayout } from './geometry';
import { colorFor, DOT_RADIUS_RATIO } from './palette';

/** How much a dot swells while its colour is armed for a sweep. */
const HIGHLIGHT_SCALE = 1.12;

type DotProps = {
  readonly cell: number;
  readonly colorId: number;
  readonly layout: BoardLayout;
  readonly anim: BoardAnimation;
};

function Dot({ cell, colorId, layout, anim }: DotProps) {
  const cx = useDerivedValue(
    () => centerX(cell, layout) + anim.offsetX.value[cell] * (1 - anim.moveT.value),
  );
  const cy = useDerivedValue(
    () => centerY(cell, layout) + anim.offsetY.value[cell] * (1 - anim.moveT.value),
  );
  const radius = useDerivedValue(() => {
    const base =
      DOT_RADIUS_RATIO * layout.cellSize * (anim.highlight.value === colorId ? HIGHLIGHT_SCALE : 1);
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
