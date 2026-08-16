import { Path, Skia } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import type { BoardAnimation } from '../effects/use-board-animation';
import { centerX, centerY, type BoardLayout } from './geometry';
import { colorFor, lighten, LINK_COLOR } from './palette';

type LinkPathProps = {
  readonly chain: SharedValue<number[]>;
  readonly finger: SharedValue<{ x: number; y: number }>;
  readonly linkColor: SharedValue<number>;
  readonly layout: BoardLayout;
  readonly anim: BoardAnimation;
};

/** Stroke width as a fraction of the cell. */
const STROKE_RATIO = 0.13;

/** How much brighter the stroke gets while a sweep is armed. */
const HIGHLIGHT_LIGHTEN = 0.35;

export function LinkPath({ chain, finger, linkColor, layout, anim }: LinkPathProps) {
  const path = useDerivedValue(() => {
    const built = Skia.Path.Make();
    const cells = chain.value;
    if (cells.length === 0) {
      return built;
    }
    built.moveTo(centerX(cells[0], layout), centerY(cells[0], layout));
    for (let i = 1; i < cells.length; i++) {
      built.lineTo(centerX(cells[i], layout), centerY(cells[i], layout));
    }
    if (finger.value.x >= 0) {
      built.lineTo(finger.value.x, finger.value.y);
    }
    return built;
  });

  const stroke = useDerivedValue(() => {
    if (linkColor.value < 0) {
      return LINK_COLOR;
    }
    const base = colorFor(linkColor.value);
    // `-1` is also `EMPTY` in the `Color` domain (src/core/types.ts), so the
    // idle "no highlight armed" sentinel must not be allowed to match a
    // colour id — mirrors the guard in dot-layer.tsx.
    const armed = anim.highlight.value >= 0 && anim.highlight.value === linkColor.value;
    return armed ? lighten(base, HIGHLIGHT_LIGHTEN) : base;
  });

  return (
    <Path
      path={path}
      color={stroke}
      style="stroke"
      strokeWidth={STROKE_RATIO * layout.cellSize}
      strokeCap="round"
      strokeJoin="round"
    />
  );
}
