/**
 * Paper-craft UI tokens for the meta screens (title / HUD chrome / settings).
 *
 * ADDITIVE and RN-facing: consumed by `src/app/*.tsx` chrome only, never by a
 * worklet. The frozen `DOT_COLORS` and the board rendering in `palette.ts` are
 * NOT touched here; this module reuses the shipped dark ground (`night`) and its
 * text colour so the board and its chrome keep one source of truth.
 *
 * Direction (creative-bible §2.2, Japan v1 washi): muted "paper-pigment" tones,
 * two accents — `shu` 朱 (vermilion, the primary call-to-action + warm
 * destructive) and `ai` 藍 (indigo, secondary buttons + links). Warm washi
 * cards float over the dark `night` ground ("paper over the night world").
 */
import { SCREEN_BACKGROUND, TEXT_COLOR } from './palette';

export const ui = {
  paper: '#f2e9d8', // washi card base
  paperPressed: '#e9dcc4', // recessed / pressed paper
  paperEdge: '#d9c9a8', // folded-paper edge + hairline border
  ink: '#2b2622', // sumi ink — primary text on paper
  inkSoft: '#6d6151', // secondary text / labels on paper
  shu: '#cf5138', // vermilion 朱 — primary CTA + destructive
  shuEdge: '#b23e28', // shu button lower edge / outline
  ai: '#33526e', // indigo 藍 — secondary buttons + links
  night: SCREEN_BACKGROUND, // shipped dark board ground (reused, not redefined)
  nightInk: TEXT_COLOR, // text/links sitting directly on the night ground
  shadow: 'rgba(28, 22, 18, 0.22)', // soft paper drop-shadow
} as const;

/** Corner radii for paper cards, chips, and buttons. */
export const radius = { sm: 8, md: 14, lg: 22 } as const;

/** 4-based spacing scale. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Type scale (system font stack — no web-font dependency). */
export const fontSize = {
  title: 30,
  score: 40,
  hudScore: 30,
  body: 16,
  label: 11,
  link: 15,
} as const;

/** letterSpacing (points) for the small uppercase labels. */
export const labelTracking = 1.4;
