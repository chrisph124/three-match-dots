// Data-driven biome table for the Voyage diorama. A biome is a bundle of tokens
// — a ridge geometry plus a time-of-day recolor ramp — NOT bespoke art, so
// biomes 3–5 are a data addition, never a code change. Ships 2 (the slice set).
//
// Pure data + a mapping function; no RN/Skia imports so it stays cheap to reason
// about. `themeToScene` maps the level's `theme` block to concrete draw params
// and falls back safely on an unknown biome/variant id (never throws).

import type { Theme } from '../../core/level/level-script';

/** A vertical sky gradient stop (offset 0 = top of screen, 1 = horizon/bottom). */
export type SkyStop = { readonly color: string; readonly offset: number };

/** One back-to-front silhouette layer. The backdrop turns this into a ridge
 *  Path; keeping it plain numbers means the geometry is deterministic per seed. */
export type SilhouetteBand = {
  readonly color: string;
  /** Ridge midline as a fraction of screen height (0 top … 1 bottom). */
  readonly baseline: number;
  /** Ridge jitter amplitude as a fraction of screen height. */
  readonly amplitude: number;
  /** How many ridge control points span the width (more = busier skyline). */
  readonly ridgePoints: number;
  /** Per-band phase so stacked layers don't share a silhouette. */
  readonly seedOffset: number;
};

export type ParticleKind = 'none' | 'pollen' | 'sand' | 'snow' | 'embers';

/** Concrete, ready-to-draw scene the backdrop Canvas consumes. */
export type SceneParams = {
  readonly sky: readonly SkyStop[];
  readonly bands: readonly SilhouetteBand[];
  readonly trim: string;
  readonly particle: ParticleKind;
  readonly parallaxSeed: number;
  readonly boss: boolean;
  /** Boss scene-shift: 0 = untouched, 1 = fully desaturated. */
  readonly desaturate: number;
  /** Vignette overlay strength, 0..1. */
  readonly vignette: number;
};

type VariantPalette = {
  readonly sky: readonly [string, string];
  readonly bands: readonly string[];
  readonly trim: string;
  readonly particle: ParticleKind;
};

type BiomeDef = {
  readonly geometry: readonly SilhouetteBand[];
  readonly variants: Record<string, VariantPalette>;
};

const VARIANT_FALLBACK = 'day';

// Ridge geometries: back layer sits high + calm, front layer low + jagged, so
// parallax reads as depth. Colours come from the variant ramp, not here.
const MEADOW_GEOMETRY: readonly SilhouetteBand[] = [
  { color: '', baseline: 0.52, amplitude: 0.05, ridgePoints: 5, seedOffset: 0 },
  { color: '', baseline: 0.66, amplitude: 0.08, ridgePoints: 7, seedOffset: 37 },
  { color: '', baseline: 0.8, amplitude: 0.11, ridgePoints: 9, seedOffset: 91 },
];

const DUNE_GEOMETRY: readonly SilhouetteBand[] = [
  { color: '', baseline: 0.58, amplitude: 0.04, ridgePoints: 3, seedOffset: 13 },
  { color: '', baseline: 0.72, amplitude: 0.07, ridgePoints: 4, seedOffset: 59 },
  { color: '', baseline: 0.86, amplitude: 0.09, ridgePoints: 5, seedOffset: 113 },
];

const BIOMES: Record<string, BiomeDef> = {
  meadow: {
    geometry: MEADOW_GEOMETRY,
    variants: {
      dawn: {
        sky: ['#f6c19a', '#8fb08f'],
        bands: ['#6f8f6a', '#4f7150', '#33523a'],
        trim: '#ffd9a0',
        particle: 'pollen',
      },
      day: {
        sky: ['#9fd0f0', '#bfe0a8'],
        bands: ['#7fae74', '#5a8a58', '#3d6a41'],
        trim: '#eaf7c8',
        particle: 'pollen',
      },
      dusk: {
        sky: ['#e79a86', '#6d6f9c'],
        bands: ['#5f6f74', '#465468', '#2f3a52'],
        trim: '#ffcf9c',
        particle: 'pollen',
      },
      night: {
        sky: ['#243a63', '#14203c'],
        bands: ['#2c3c50', '#1f2c40', '#141d30'],
        trim: '#8fb4ff',
        particle: 'none',
      },
    },
  },
  dune: {
    geometry: DUNE_GEOMETRY,
    variants: {
      dawn: {
        sky: ['#f7cf9e', '#d99a72'],
        bands: ['#c79a68', '#a97b4f', '#835a38'],
        trim: '#ffe6b0',
        particle: 'sand',
      },
      day: {
        sky: ['#bfe3f2', '#e8c98f'],
        bands: ['#d8b072', '#bd9256', '#96703c'],
        trim: '#fff0cc',
        particle: 'sand',
      },
      dusk: {
        sky: ['#f0a06e', '#7a5a86'],
        bands: ['#a5764e', '#7f5a44', '#573c39'],
        trim: '#ffbe86',
        particle: 'sand',
      },
      night: {
        sky: ['#2c2f5a', '#171634'],
        bands: ['#3a3654', '#2a2742', '#1b1930'],
        trim: '#c9a6ff',
        particle: 'embers',
      },
    },
  },
};

// A neutral, always-legal scene for an unknown biome id — never a crash.
const FALLBACK_BIOME: BiomeDef = BIOMES.meadow;

function resolveBiome(id: string): BiomeDef {
  return BIOMES[id] ?? FALLBACK_BIOME;
}

function resolveVariant(biome: BiomeDef, id: string): VariantPalette {
  return biome.variants[id] ?? biome.variants[VARIANT_FALLBACK];
}

/**
 * The one entry point the render layer calls. Maps a level's `theme` block to a
 * concrete `SceneParams`. An absent theme (e.g. a hand-authored level) or an
 * unknown biome/variant id resolves to the neutral fallback — the diorama always
 * renders something legal behind the board.
 */
export function themeToScene(theme: Theme | undefined): SceneParams {
  const biomeId = theme?.biome ?? 'meadow';
  const variantId = theme?.variant ?? VARIANT_FALLBACK;
  const boss = theme?.boss ?? false;

  const biome = resolveBiome(biomeId);
  const palette = resolveVariant(biome, variantId);

  const bands = biome.geometry.map((band, i) => ({
    ...band,
    color: palette.bands[Math.min(i, palette.bands.length - 1)],
  }));

  return {
    sky: [
      { color: palette.sky[0], offset: 0 },
      { color: palette.sky[1], offset: 1 },
    ],
    bands,
    trim: palette.trim,
    // A boss stills the air: no drifting particles under the heavier scene.
    particle: boss ? 'none' : palette.particle,
    parallaxSeed: theme?.parallaxSeed ?? 0,
    boss,
    desaturate: boss ? 0.55 : 0,
    vignette: boss ? 0.5 : 0.18,
  };
}
