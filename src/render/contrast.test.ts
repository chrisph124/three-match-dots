import { describe, expect, it } from 'vitest';
import { DOT_COLORS, SCREEN_BACKGROUND, TEXT_COLOR } from './palette';

/**
 * Figure-ground guardrail for the flat-colour dots. Endless and Journey both draw
 * the SAME solid discs directly on `SCREEN_BACKGROUND` (no panel, no backdrop), and
 * the frozen dot hues only clear WCAG contrast on a DARK ground. Colours live
 * outside the Vitest boundary (`palette.ts` is hand-edited render data), so a
 * careless re-hex of a dot or of the background would otherwise ship a low-contrast
 * board with zero failure. This pure-data test is the tripwire: it re-derives the
 * ratios from the actual exported hex on every run.
 *
 * WCAG 2.x relative luminance + contrast ratio, sRGB. No Skia/RN imports — pure
 * arithmetic over the exported colour strings, so it runs under Vitest.
 */
function srgbToLinear(channel: number): number {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** The three Endless dot hues — the only ids Endless renders. */
const ENDLESS_DOTS = DOT_COLORS.slice(0, 3);

describe('dot legibility on the dark board ground', () => {
  it.each(ENDLESS_DOTS)('dot %s clears 3:1 against the background', (dot) => {
    expect(contrastRatio(dot, SCREEN_BACKGROUND)).toBeGreaterThanOrEqual(3);
  });
});

describe('HUD text legibility on the dark board ground', () => {
  // Score and the Back label sit on `SCREEN_BACKGROUND`; the light body text must
  // clear the AA 4.5:1 threshold so a future re-hex cannot silently break it.
  it('text clears 4.5:1 against the background', () => {
    expect(contrastRatio(TEXT_COLOR, SCREEN_BACKGROUND)).toBeGreaterThanOrEqual(4.5);
  });
});
