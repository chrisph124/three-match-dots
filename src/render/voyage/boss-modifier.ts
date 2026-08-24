// One place that answers "what makes a boss read as a boss" — with ZERO bespoke
// art. Every signal is a recolor/overlay/HUD toggle the render layer already
// owns. Pure and RN-free: given the level's boss flags it returns the active
// signal set; the components just switch on it.

import type { LevelScript } from '../../core/level/level-script';

export type BossSignals = {
  /** Show the boss title card on entry. */
  readonly titleCard: boolean;
  /** The Phase 6 scene shift (desaturate + heavier vignette) is on. */
  readonly sceneShift: boolean;
  /** Render the color-grouped HP bar instead of the plain objective readout. */
  readonly hpBar: boolean;
  /** Bump board/HUD contrast emphasis (a subtle brighten of key text). */
  readonly contrastEmphasis: boolean;
  /** A short name for the boss archetype — the only "content" a boss carries. */
  readonly title: string;
};

const NONE: BossSignals = {
  titleCard: false,
  sceneShift: false,
  hpBar: false,
  contrastEmphasis: false,
  title: '',
};

/**
 * Derive the boss signals for a level. A boss is flagged either by the voyage
 * envelope (`voyage.isBoss`) or the theme (`theme.boss`); a non-boss returns the
 * empty set so callers render the ordinary scene/HUD. The Caged Core is the one
 * shipped archetype, so the title is fixed for the slice.
 */
export function bossSignals(level: LevelScript): BossSignals {
  const isBoss = level.voyage?.isBoss === true || level.theme?.boss === true;
  if (!isBoss) {
    return NONE;
  }
  return {
    titleCard: true,
    sceneShift: true,
    hpBar: true,
    contrastEmphasis: true,
    title: 'Caged Core',
  };
}
