export type RngStep = {
  readonly value: number;
  readonly state: number;
};

/**
 * mulberry32, with the generator state threaded explicitly rather than
 * captured in a closure. Purity is what makes refill reproducible in tests.
 */
export function next(state: number): RngStep {
  const advanced = (state + 0x6d2b79f5) | 0;
  let t = advanced;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: advanced };
}

/** Uniform integer in [0, bound). */
export function nextInt(state: number, bound: number): RngStep {
  const step = next(state);
  return { value: Math.floor(step.value * bound), state: step.state };
}
