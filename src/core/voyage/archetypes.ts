import type { Constraint } from '../level/level-script';
import { PROFILES, type DifficultyProfile } from './voyage-config';

/**
 * The archetype library: data, not logic. Each entry pairs a Phase-3 dial
 * `profile` (how a difficulty budget is spent) with the allowed constraint kinds
 * and the objective template a level of this kind uses. The generator picks an
 * archetype per index (seeded), so equal-difficulty levels still feel different.
 *
 * Pure TS (no RN/Skia). The `weight` biases how often an archetype is drawn —
 * expanded into a flat pool by the generator — while a low-discrepancy index
 * spread + a re-roll rotation keep nearby levels distinct (see `generate-level`).
 */

/** The constraint kinds an archetype may play under (a subset of the union). */
export type ConstraintKind = Constraint['type'];

/**
 * The objective template a level assembles. Kept in lockstep with the signature
 * comparator's objective classes (`level-signature.ts`) so variety reads true.
 */
export type ObjectiveKind =
  'color' | 'twoColors' | 'caged' | 'colorAndCaged' | 'anchors' | 'colorAndAnchors';

export type Archetype = {
  readonly key: string;
  readonly profile: DifficultyProfile;
  readonly constraints: readonly ConstraintKind[];
  readonly objective: ObjectiveKind;
  readonly weight: number;
  /**
   * The most colours this archetype spends up to, regardless of budget. Caps
   * differ per archetype so the colour axis of the signature keeps varying once
   * difficulty plateaus (where an uncapped spend would pin every level to the
   * full palette) — the main lever that keeps late-game levels distinct.
   */
  readonly colorCap: number;
};

/**
 * The shipped archetypes. Constraint/objective pairs are deliberately spread so
 * that any two distinct archetypes differ in at least the objective and usually
 * the constraint — the two signature fields the variety window leans on hardest.
 *
 * Roadmap gap (Non-goal for this plan): deeper obstacle archetypes land
 * guardian-cage before spreading-blight; both are intentionally absent here.
 */
export const ARCHETYPES: readonly Archetype[] = [
  {
    key: 'color-sprint',
    profile: PROFILES.balanced,
    constraints: ['moves', 'mistakes'],
    objective: 'color',
    weight: 2,
    colorCap: 5,
  },
  {
    key: 'color-duo',
    profile: PROFILES.colorRich,
    constraints: ['moves', 'timed'],
    objective: 'twoColors',
    weight: 2,
    colorCap: 5,
  },
  {
    key: 'cage-break',
    profile: PROFILES.obstacleHeavy,
    constraints: ['moves', 'mistakes'],
    objective: 'caged',
    weight: 2,
    colorCap: 4,
  },
  {
    key: 'cage-and-clear',
    profile: PROFILES.obstacleHeavy,
    constraints: ['moves', 'mistakes'],
    objective: 'colorAndCaged',
    weight: 2,
    colorCap: 5,
  },
  {
    key: 'anchor-break',
    profile: PROFILES.obstacleHeavy,
    constraints: ['moves', 'mistakes'],
    objective: 'anchors',
    weight: 2,
    colorCap: 4,
  },
  {
    key: 'anchor-and-clear',
    profile: PROFILES.obstacleHeavy,
    constraints: ['moves', 'mistakes'],
    objective: 'colorAndAnchors',
    weight: 2,
    colorCap: 5,
  },
  {
    key: 'time-attack',
    profile: PROFILES.balanced,
    constraints: ['timed'],
    objective: 'color',
    weight: 2,
    colorCap: 4,
  },
  {
    key: 'precision',
    profile: PROFILES.tightMoves,
    constraints: ['mistakes', 'moves'],
    objective: 'color',
    weight: 2,
    colorCap: 3,
  },
];

/** The weight-expanded archetype pool the generator indexes into. */
export const ARCHETYPE_POOL: readonly Archetype[] = ARCHETYPES.flatMap((archetype) =>
  Array.from({ length: archetype.weight }, () => archetype),
);
