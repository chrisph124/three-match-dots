import { describe, expect, it } from 'vitest';
import { biomeFor } from './biome-rotation';

describe('biomeFor', () => {
  it('switches biome per episode (boss block) over the two shipped biomes', () => {
    expect(biomeFor(1).biome).toBe('harbor'); // episode 1
    expect(biomeFor(10).biome).toBe('harbor'); // still episode 1
    expect(biomeFor(11).biome).toBe('valley'); // episode 2
    expect(biomeFor(21).biome).toBe('harbor'); // episode 3 wraps back
  });

  it('cycles the time-of-day variant per level', () => {
    expect(biomeFor(1).variant).toBe('dawn');
    expect(biomeFor(2).variant).toBe('day');
    expect(biomeFor(3).variant).toBe('dusk');
    expect(biomeFor(4).variant).toBe('night');
    expect(biomeFor(5).variant).toBe('dawn'); // wraps
  });

  it('pairs each biome with its signature particle and trim', () => {
    expect(biomeFor(1)).toMatchObject({ biome: 'harbor', particle: 'spray', trim: 'brass' });
    expect(biomeFor(11)).toMatchObject({ biome: 'valley', particle: 'pollen', trim: 'wood' });
  });

  it('is deterministic', () => {
    expect(biomeFor(137)).toEqual(biomeFor(137));
  });
});
