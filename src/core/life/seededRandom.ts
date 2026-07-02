// =========================================================================
// V10.1 SeededRandom — Minimal deterministic RNG for Life Tick scheduling.
// Requirements: same seed → same sequence, no Math.random(), no dependencies.
// Uses a simple LCG (Linear Congruential Generator).
// =========================================================================

export interface SeededRandom {
  readonly seed: string;
  /** Returns the next pseudo-random number in [0, 1). */
  next(): number;
}

// LCG parameters (from Numerical Recipes)
const LCG_MULTIPLIER = 1664525;
const LCG_INCREMENT = 1013904223;
const LCG_MODULUS = 2 ** 32;

/**
 * Simple string → 32-bit integer hash (djb2 variant).
 * Used to convert a seed string into an initial LCG state.
 */
function hashSeed(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0; // force 32-bit int
  }
  return hash >>> 0; // ensure unsigned
}

/**
 * Creates a deterministic pseudo-random number generator from a seed string.
 * Same seed always produces the same sequence of values.
 */
export function createSeededRandom(seed: string): SeededRandom {
  let state = hashSeed(seed);

  return {
    seed,
    next(): number {
      // LCG step
      state = (LCG_MULTIPLIER * state + LCG_INCREMENT) % LCG_MODULUS;
      // Normalize to [0, 1)
      return state / LCG_MODULUS;
    },
  };
}
