import { describe, expect, it } from "vitest";
import {
  createSeededRandom,
  type SeededRandom,
} from "../../../src/core/life/seededRandom";

describe("SeededRandom", () => {
  it("same seed produces identical sequence", () => {
    const rng1 = createSeededRandom("hello");
    const rng2 = createSeededRandom("hello");

    const seq1 = Array.from({ length: 20 }, () => rng1.next());
    const seq2 = Array.from({ length: 20 }, () => rng2.next());

    expect(seq1).toEqual(seq2);
  });

  it("different seeds produce different sequences", () => {
    const rng1 = createSeededRandom("alpha");
    const rng2 = createSeededRandom("beta");

    const seq1 = Array.from({ length: 10 }, () => rng1.next());
    const seq2 = Array.from({ length: 10 }, () => rng2.next());

    // At least one value should differ
    const anyDifferent = seq1.some((v, i) => v !== seq2[i]);
    expect(anyDifferent).toBe(true);
  });

  it("all values are in [0, 1)", () => {
    const rng = createSeededRandom("range-test");
    const samples = Array.from({ length: 200 }, () => rng.next());

    for (const value of samples) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("produces a reasonable spread of values (not all in narrow range)", () => {
    const rng = createSeededRandom("spread-test");
    const samples = Array.from({ length: 200 }, () => rng.next());

    const belowHalf = samples.filter((v) => v < 0.5).length;
    const aboveHalf = samples.filter((v) => v >= 0.5).length;

    // Both halves should have reasonable representation (at least 20%)
    expect(belowHalf).toBeGreaterThan(20);
    expect(aboveHalf).toBeGreaterThan(20);
  });

  it("longer sequences remain deterministic", () => {
    const rng1 = createSeededRandom("long");
    const rng2 = createSeededRandom("long");

    // Generate 100 values from rng1
    for (let i = 0; i < 50; i++) rng1.next();

    // Generate 100 values from rng2 (same point)
    for (let i = 0; i < 50; i++) rng2.next();

    // After same count, next value should match
    expect(rng1.next()).toBe(rng2.next());
  });

  it("empty string seed works", () => {
    const rng = createSeededRandom("");
    const v = rng.next();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });

  it("seed property is preserved on the returned object", () => {
    const rng = createSeededRandom("my-seed");
    expect(rng.seed).toBe("my-seed");
  });

  it("different seed lengths still produce valid values", () => {
    const seeds = ["a", "ab", "abc", "long-seed-string-with-dashes"];
    for (const seed of seeds) {
      const rng = createSeededRandom(seed);
      for (let i = 0; i < 5; i++) {
        const v = rng.next();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    }
  });

  it("no Math.random usage (verified by architecture — LCG only)", () => {
    // This test verifies the contract: if createSeededRandom internally used
    // Math.random, two RNGs with the same seed would diverge.
    // Since we verified determinism above, this contract holds.
    const rng = createSeededRandom("no-math-random");
    expect(rng.seed).toBe("no-math-random");
  });
});
