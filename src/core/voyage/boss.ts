import { DEFAULT_CONFIG } from '../config';
import { newGame } from '../game';
import { parseLevelScript, type LevelScript, type Theme } from '../level/level-script';
import { nextInt } from '../rng';
import type { GameConfig } from '../types';
import { biomeFor } from './biome-rotation';
import { bottomAnchoredCages } from './cage-layout';
import { budget, spend } from './difficulty-budget';
import { curve } from './difficulty-curve';
import {
  EPISODE_1_LAST,
  PROFILES,
  VOYAGE_COLS,
  VOYAGE_ROWS,
  clearCountFor,
  episodeOf,
  moveBudgetForTighten,
  seedForIndex,
  type BoardLimits,
} from './voyage-config';

/**
 * The boss pool. Bosses land on every 10th index, are exempt from the variety
 * rule, and are tagged `voyage.isBoss` + `theme.boss`. Level 10 is the curated
 * "The Caged Core"; later bosses are a generic colour-rush escalation. Every
 * boss is re-validated through `parseLevelScript`. Pure TS (no RN/Skia).
 *
 * Boss budgets here are candidates — Phase 5's solver is the winnability
 * authority and overwrites them.
 */

const CAGED_CORE_CAGES = 8;
const CAGED_CORE_COLORS = 4;
const CAGED_CORE_MOVE_BUDGET = 28;
/** Bounded search for a caged-core deal whose cage cells span ≥2 colours. */
const SEED_SEARCH_LIMIT = 256;

/** Zero-padded, stable level id. */
function voyageId(index: number, suffix: string): string {
  return `voyage-${String(index).padStart(4, '0')}-${suffix}`;
}

/** The boss theme tag for an index — the biome rotation, flagged as a boss. */
function bossTheme(index: number): Theme {
  const biome = biomeFor(index);
  return {
    biome: biome.biome,
    variant: biome.variant,
    particle: biome.particle,
    trim: biome.trim,
    parallaxSeed: seedForIndex(index),
    boss: true,
  };
}

/** A full engine config for a Voyage board of the given colour count. */
function boardConfig(colors: number, minChain: number): GameConfig {
  return {
    rows: VOYAGE_ROWS,
    cols: VOYAGE_COLS,
    colors,
    minChain,
    lineLength: DEFAULT_CONFIG.lineLength,
    baseScore: DEFAULT_CONFIG.baseScore,
    sweepMultiplier: DEFAULT_CONFIG.sweepMultiplier,
  };
}

/** Distinct colours dealt under the given cells for a seed. */
function colorsUnderCells(config: GameConfig, cells: readonly number[], seed: number): number {
  const { board } = newGame(config, seed);
  return new Set(cells.map((cell) => board[cell])).size;
}

/**
 * The first seed (from `base`) whose deal colours the cage cells with ≥2 hues,
 * so the Caged Core is a genuine multi-phase fight (a sweep frees one colour's
 * cages at once; slow chaining frees them region by region). With ≥2 board
 * colours an all-one-colour deal is astronomically rare, so this returns almost
 * immediately; the bounded fallback keeps it total.
 */
function findMultiColorSeed(config: GameConfig, cells: readonly number[], base: number): number {
  for (let offset = 0; offset < SEED_SEARCH_LIMIT; offset += 1) {
    const seed = (base + offset) >>> 0;
    if (colorsUnderCells(config, cells, seed) >= 2) {
      return seed;
    }
  }
  return base;
}

/** "The Caged Core" — the curated level-10 boss (8 bottom cages, ≥2 colours). */
export function cagedCore(index: number, paletteSize: number): LevelScript {
  const cages = bottomAnchoredCages(CAGED_CORE_CAGES, VOYAGE_COLS, VOYAGE_ROWS);
  const cageCells = cages.map((cage) => cage.cell.row * VOYAGE_COLS + cage.cell.col);
  const config = boardConfig(CAGED_CORE_COLORS, DEFAULT_CONFIG.minChain);
  const seed = findMultiColorSeed(config, cageCells, seedForIndex(index));
  return parseLevelScript(
    {
      schemaVersion: 2,
      id: voyageId(index, 'caged-core'),
      order: index,
      board: {
        cols: VOYAGE_COLS,
        rows: VOYAGE_ROWS,
        colors: CAGED_CORE_COLORS,
        minChain: DEFAULT_CONFIG.minChain,
      },
      seed,
      mode: 'voyage',
      constraint: { type: 'moves', budget: CAGED_CORE_MOVE_BUDGET },
      voyage: { index, episode: episodeOf(index), isBoss: true },
      theme: bossTheme(index),
      objectives: [{ type: 'freeCaged' }],
      obstacles: cages,
      designIntent: 'voyage/boss/caged-core',
    },
    paletteSize,
  );
}

/** A generic colour-rush boss for every boss index past level 10. */
function colorRushBoss(index: number, paletteSize: number): LevelScript {
  const D = budget(curve(index));
  const limits: BoardLimits = { paletteSize, rows: VOYAGE_ROWS, cols: VOYAGE_COLS };
  const { dials, rngState } = spend(D, PROFILES.colorRich, seedForIndex(index), limits);
  const pick = nextInt(rngState, dials.colors);
  return parseLevelScript(
    {
      schemaVersion: 2,
      id: voyageId(index, 'color-rush'),
      order: index,
      board: {
        cols: VOYAGE_COLS,
        rows: VOYAGE_ROWS,
        colors: dials.colors,
        minChain: dials.minChain,
      },
      seed: seedForIndex(index),
      mode: 'voyage',
      constraint: { type: 'moves', budget: moveBudgetForTighten(dials.movesTighten) },
      voyage: { index, episode: episodeOf(index), isBoss: true },
      theme: bossTheme(index),
      // A boss clears more of its target colour than an ordinary level would.
      objectives: [{ type: 'clearColor', color: pick.value, count: clearCountFor(D) + 4 }],
      obstacles: [],
      designIntent: 'voyage/boss/color-rush',
    },
    paletteSize,
  );
}

/** The boss for a boss index (`index % 10 === 0`). */
export function bossFor(index: number, paletteSize: number): LevelScript {
  if (index === EPISODE_1_LAST) {
    return cagedCore(index, paletteSize);
  }
  return colorRushBoss(index, paletteSize);
}
