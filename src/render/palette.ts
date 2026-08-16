/** Index-aligned with the colour ids the core deals: 0 = R, 1 = G, 2 = B. */
export const DOT_COLORS = ['#ff4d5e', '#3ddc84', '#4f8cff'] as const;

export const SCREEN_BACKGROUND = '#0f1117';
export const TEXT_COLOR = '#e8eaf0';
export const LINK_COLOR = '#e8eaf0';

/** Dot radius as a fraction of the cell, leaving a visible gap between dots. */
export const DOT_RADIUS_RATIO = 0.34;

export function colorFor(colorId: number): string {
  'worklet';
  return DOT_COLORS[colorId] ?? DOT_COLORS[0];
}

/** Blends a `#rrggbb` colour toward white by `amount` (0..1). */
export function lighten(hex: string, amount: number): string {
  'worklet';
  const channel = (offset: number): number => {
    const value = parseInt(hex.slice(offset, offset + 2), 16);
    return Math.round(value + (255 - value) * amount);
  };
  const toHex = (value: number): string => value.toString(16).padStart(2, '0');
  return `#${toHex(channel(1))}${toHex(channel(3))}${toHex(channel(5))}`;
}
