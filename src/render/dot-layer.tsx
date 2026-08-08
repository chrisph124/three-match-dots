import { Circle } from '@shopify/react-native-skia';
import type { Board } from '../core/types';
import { centerX, centerY, type BoardLayout } from './geometry';
import { colorFor, DOT_RADIUS_RATIO } from './palette';

type DotLayerProps = {
  readonly board: Board;
  readonly layout: BoardLayout;
};

/**
 * Colours come from React props rather than a shared value: the board only
 * changes once per commit, so a re-render is cheaper and far simpler than
 * animating colour on the UI thread.
 */
export function DotLayer({ board, layout }: DotLayerProps) {
  return (
    <>
      {board.map((colorId, cell) => (
        <Circle
          key={cell}
          cx={centerX(cell, layout)}
          cy={centerY(cell, layout)}
          r={DOT_RADIUS_RATIO * layout.cellSize}
          color={colorFor(colorId)}
        />
      ))}
    </>
  );
}
