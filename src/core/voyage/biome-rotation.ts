import { episodeOf } from './voyage-config';

/**
 * Biome rotation over the two shipped biomes plus a time-of-day variant, so the
 * diorama ribbon (Phase 6) shows visible episodic change without new art. Pure
 * data mapping — the biome/variant/particle/trim strings are consumed by the
 * render layer, which owns the fallback for any id it doesn't recognise, so this
 * module carries no RN/Skia dependency.
 */

export type BiomeTag = {
  readonly biome: string;
  readonly variant: string;
  readonly particle: string;
  readonly trim: string;
};

/** The two shipped biomes, each with its signature particle + trim palette. */
const BIOMES: readonly Omit<BiomeTag, 'variant'>[] = [
  { biome: 'harbor', particle: 'spray', trim: 'brass' },
  { biome: 'valley', particle: 'pollen', trim: 'wood' },
];

/** Time-of-day variants cycled per level within a biome. */
const VARIANTS = ['dawn', 'day', 'dusk', 'night'] as const;

/**
 * The biome tag for a level index. The biome switches per episode (boss block),
 * the variant cycles per level, so a run reads as a journey through changing
 * light within a place and across places between episodes.
 */
export function biomeFor(index: number): BiomeTag {
  const biome = BIOMES[(episodeOf(index) - 1) % BIOMES.length];
  const variant = VARIANTS[(index - 1) % VARIANTS.length];
  return { biome: biome.biome, variant, particle: biome.particle, trim: biome.trim };
}
