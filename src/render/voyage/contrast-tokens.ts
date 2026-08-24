// Shadow-box contrast tokens — pure arithmetic, no RN/Skia imports (the
// `geometry.ts` purity rule) so Vitest can assert the contrast floor.
//
// The Voyage diorama fills the screen with a warm biome, but every dot is drawn
// on an opaque dark inset card (the "shadow box"). The card's fill is fixed at a
// low luminance so EVERY palette hue keeps its WCAG 3:1 contrast floor against
// it — the biome behind the card never touches a dot, so dot legibility is a
// property of this one token, not of whichever biome is on screen.

/**
 * The opaque inset-card fill. Luminance L ≈ 0.017 (well under the 0.058 ceiling
 * the design fixes), so the darkest palette hue (blue #4f8cff at L ≈ 0.276)
 * still clears ~4.5:1 — comfortably above the 3:1 floor with margin for the
 * boss contrast bump. `contrast-tokens.test.ts` guards both the ceiling and the
 * all-hues floor.
 */
export const PANEL_BASE = '#23212b';

/** The card's hairline edge — a hair lighter than the fill so the box reads as
 *  a raised inset against the biome without lifting luminance near a dot. */
export const PANEL_EDGE = '#31303c';

/** Luminance ceiling the panel fill must stay at or below (a documented token
 *  contract the test asserts, not just a comment). */
export const PANEL_LUMINANCE_CEILING = 0.058;

/** The WCAG contrast floor every dot hue must clear against the panel fill. */
export const DOT_CONTRAST_FLOOR = 3;

/** sRGB 8-bit hex → three 0..1 channels. Accepts `#rgb` and `#rrggbb`. */
export function hexChannels(hex: string): readonly [number, number, number] {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return [r, g, b];
}

/** sRGB companding → linear-light, per the WCAG 2.x definition. */
export function srgbToLinear(channel: number): number {
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance (WCAG 2.x) of an sRGB hex. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexChannels(hex);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** WCAG contrast ratio between two sRGB hexes (1..21, order-independent). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}
