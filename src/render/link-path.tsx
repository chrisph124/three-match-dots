import { Path, Skia } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { centerX, centerY, type BoardLayout } from './geometry';
import { colorFor, LINK_COLOR } from './palette';

type LinkPathProps = {
  readonly chain: SharedValue<number[]>;
  readonly finger: SharedValue<{ x: number; y: number }>;
  readonly linkColor: SharedValue<number>;
  readonly layout: BoardLayout;
};

/** Stroke width as a fraction of the cell. */
const STROKE_RATIO = 0.13;

export function LinkPath({ chain, finger, linkColor, layout }: LinkPathProps) {
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

  const stroke = useDerivedValue(() =>
    linkColor.value >= 0 ? colorFor(linkColor.value) : LINK_COLOR,
  );

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
