/**
 * Index-aligned with the colour ids the core deals: 0 = R, 1 = G, 2 = B.
 *
 * INVARIANT — APPEND-ONLY. Indices 0-2 are what Endless renders; their hex is
 * FROZEN. Never reorder or re-hex an existing entry: this file sits outside the
 * Vitest boundary, so a reorder would silently change Endless's on-screen colours
 * with zero test failure. Only APPEND new hues at the end — Journey levels may use
 * colours 3+. New entries follow the Okabe–Ito colourblind-safe ramp and must stay
 * distinct from the red/green/blue already in use. The level parser caps a level's
 * `colors` at this array's length (see src/core/level/level-script.ts).
 *
 * NOTE: hue is the ONLY thing that distinguishes colours — dots are dead-flat
 * solid discs in both modes. The creative bible's LOCKED "identity = colour AND
 * shape/pattern, never colour alone" rule is therefore UNMET, exactly as in the
 * shipped app. This is an accepted, documented accessibility gap; never cite it
 * as satisfied in store or compliance copy. On the dark ground both modes sit on,
 * every frozen hue still clears WCAG contrast (`contrast.test.ts`).
 */
export const DOT_COLORS = [
  '#ff4d5e', // 0 R              (frozen — Endless)
  '#3ddc84', // 1 G              (frozen — Endless)
  '#4f8cff', // 2 B              (frozen — Endless)
  '#e69f00', // 3 orange         (Okabe–Ito)
  '#cc79a7', // 4 reddish purple (Okabe–Ito)
  '#f0e442', // 5 yellow         (Okabe–Ito)
] as const;

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
