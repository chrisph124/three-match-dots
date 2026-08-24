import { describe, expect, it } from 'vitest';
import { DOT_COLORS } from '../palette';
import {
  contrastRatio,
  DOT_CONTRAST_FLOOR,
  PANEL_BASE,
  PANEL_LUMINANCE_CEILING,
  relativeLuminance,
} from './contrast-tokens';

// The shadow-box guard: the diorama is only safe if the inset card the board
// sits on is dark enough that EVERY palette hue — not just the original three —
// clears the WCAG 3:1 floor against it. Extending the palette (Phase 6) without
// this all-hues assertion is exactly how a new muddy hue would ship unseen.
describe('shadow-box contrast tokens', () => {
  it('PANEL_BASE stays at or below the luminance ceiling', () => {
    expect(relativeLuminance(PANEL_BASE)).toBeLessThanOrEqual(PANEL_LUMINANCE_CEILING);
  });

  it('every dot hue clears the 3:1 floor against the panel', () => {
    for (const hue of DOT_COLORS) {
      expect(contrastRatio(hue, PANEL_BASE)).toBeGreaterThanOrEqual(DOT_CONTRAST_FLOOR);
    }
  });

  it('covers the full extended palette (all six hues), not just Endless', () => {
    // If the palette grows again, this pins that the floor check above iterated
    // the whole set — a 3-hue regression here would mean the loop silently
    // stopped guarding the new colours.
    expect(DOT_COLORS.length).toBeGreaterThanOrEqual(6);
  });
});
