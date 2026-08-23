import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, ENDLESS_CONFIG } from './config';

describe('ENDLESS_CONFIG (dark-launch)', () => {
  it('is byte-identical to DEFAULT_CONFIG until the gated flip', () => {
    // The heat economy ships dark: Endless must behave exactly like the shipped
    // game until a separate, on-device-verified flip commit turns the dials on.
    // This guard fails loudly if that flip lands prematurely.
    expect(ENDLESS_CONFIG).toEqual(DEFAULT_CONFIG);
  });

  it('leaves every combo-heat dial off so resolveChain stays inert', () => {
    for (const config of [DEFAULT_CONFIG, ENDLESS_CONFIG]) {
      expect(config.heatCap).toBeUndefined();
      expect(config.heatStep).toBeUndefined();
      expect(config.sweepExclusionWeight).toBeUndefined();
    }
  });
});
