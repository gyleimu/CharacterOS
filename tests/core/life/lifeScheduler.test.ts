import { describe, expect, it } from "vitest";
import {
  buildLifeTickPlan,
  validateLifeTickRequest,
  type ValidationResult,
} from "../../../src/core/life/lifeScheduler";
import { LIFE_TICK_PHASES } from "../../../src/core/life/lifeTickTypes";
import type { LifeTickRequest, LifeTickPlan } from "../../../src/core/life/lifeTickTypes";

// ── Helpers ────────────────────────────────────────────────────────────

function validRequest(
  overrides: Partial<LifeTickRequest> = {}
): LifeTickRequest {
  return {
    characterId: "char-test",
    elapsedHours: 4,
    observed: true,
    requestedAt: "2026-06-24T12:00:00.000Z",
    mode: "dry_run",
    ...overrides,
  };
}

// ── Validation ─────────────────────────────────────────────────────────

describe("validateLifeTickRequest", () => {
  it("returns valid=true for a well-formed request", () => {
    const result = validateLifeTickRequest(validRequest());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects missing characterId", () => {
    const result = validateLifeTickRequest(
      validRequest({ characterId: "" })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("characterId"))).toBe(true);
  });

  it("rejects elapsedHours <= 0", () => {
    const r1 = validateLifeTickRequest(validRequest({ elapsedHours: 0 }));
    expect(r1.valid).toBe(false);

    const r2 = validateLifeTickRequest(validRequest({ elapsedHours: -1 }));
    expect(r2.valid).toBe(false);
  });

  it("rejects elapsedHours > 168", () => {
    const result = validateLifeTickRequest(
      validRequest({ elapsedHours: 200 })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("168"))).toBe(true);
  });

  it("rejects invalid requestedAt", () => {
    const result = validateLifeTickRequest(
      validRequest({ requestedAt: "not-a-date" })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("requestedAt"))).toBe(true);
  });

  it("rejects empty requestedAt", () => {
    const result = validateLifeTickRequest(
      validRequest({ requestedAt: "" })
    );
    expect(result.valid).toBe(false);
  });

  it("rejects unknown mode", () => {
    const result = validateLifeTickRequest(
      // @ts-expect-error — testing runtime validation of unknown mode
      validRequest({ mode: "auto_commit" })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("mode"))).toBe(true);
  });

  it("warns for elapsedHours > 48 (multi-day)", () => {
    const result = validateLifeTickRequest(
      validRequest({ elapsedHours: 72 })
    );
    // 72 is valid (<= 168), but should warn about coarse simulation
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.toLowerCase().includes("coarse"))).toBe(true);
  });

  it("warns for unobserved ticks", () => {
    const result = validateLifeTickRequest(
      validRequest({ observed: false })
    );
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.toLowerCase().includes("unobserved"))).toBe(true);
  });
});

// ── Plan Building ──────────────────────────────────────────────────────

describe("buildLifeTickPlan", () => {
  it("produces a valid plan for a well-formed request", () => {
    const plan = buildLifeTickPlan(validRequest());
    expect(plan.id).toBeTruthy();
    expect(plan.characterId).toBe("char-test");
    expect(plan.elapsedHours).toBe(4);
    expect(plan.phaseSequence).toEqual(LIFE_TICK_PHASES);
    expect(plan.timeScale).toBe("short");
    expect(plan.dryRun).toBe(true);
  });

  it("throws for invalid request", () => {
    expect(() =>
      buildLifeTickPlan(validRequest({ elapsedHours: 0 }))
    ).toThrow();
    expect(() =>
      buildLifeTickPlan(validRequest({ characterId: "" }))
    ).toThrow();
  });

  // ── timeScale derivation ──────────────────────────────────────────

  it("maps elapsedHours <= 6 to 'short'", () => {
    expect(buildLifeTickPlan(validRequest({ elapsedHours: 1 })).timeScale).toBe("short");
    expect(buildLifeTickPlan(validRequest({ elapsedHours: 6 })).timeScale).toBe("short");
  });

  it("maps 6 < elapsedHours <= 48 to 'daily'", () => {
    expect(buildLifeTickPlan(validRequest({ elapsedHours: 7 })).timeScale).toBe("daily");
    expect(buildLifeTickPlan(validRequest({ elapsedHours: 24 })).timeScale).toBe("daily");
    expect(buildLifeTickPlan(validRequest({ elapsedHours: 48 })).timeScale).toBe("daily");
  });

  it("maps elapsedHours > 48 to 'multi_day'", () => {
    expect(buildLifeTickPlan(validRequest({ elapsedHours: 49 })).timeScale).toBe("multi_day");
    expect(buildLifeTickPlan(validRequest({ elapsedHours: 168 })).timeScale).toBe("multi_day");
  });

  // ── phaseSequence ─────────────────────────────────────────────────

  it("phaseSequence always equals LIFE_TICK_PHASES", () => {
    const plans = [
      buildLifeTickPlan(validRequest({ elapsedHours: 1 })),
      buildLifeTickPlan(validRequest({ elapsedHours: 24 })),
      buildLifeTickPlan(validRequest({ elapsedHours: 100 })),
    ];
    for (const plan of plans) {
      expect(plan.phaseSequence).toEqual(LIFE_TICK_PHASES);
    }
  });

  // ── seed handling ─────────────────────────────────────────────────

  it("preserves seed when explicitly provided", () => {
    const plan = buildLifeTickPlan(
      validRequest({ seed: "explicit-seed-42" })
    );
    expect(plan.seed).toBe("explicit-seed-42");
    expect(plan.reasons.some((r) => r.includes("Explicit seed"))).toBe(true);
  });

  it("generates deterministic seed when not provided", () => {
    const plan = buildLifeTickPlan(validRequest());
    expect(plan.seed).toBeTruthy();
    expect(plan.seed.length).toBeGreaterThan(0);
    expect(plan.reasons.some((r) => r.includes("generated deterministically") || r.includes("Seed generated"))).toBe(true);
  });

  it("generated seed is deterministic for same inputs", () => {
    const req = validRequest();
    const plan1 = buildLifeTickPlan({ ...req });
    const plan2 = buildLifeTickPlan({ ...req });
    expect(plan1.seed).toBe(plan2.seed);
  });

  it("generated seed differs for different inputs", () => {
    const plan1 = buildLifeTickPlan(validRequest({ characterId: "char-a" }));
    const plan2 = buildLifeTickPlan(validRequest({ characterId: "char-b" }));
    expect(plan1.seed).not.toBe(plan2.seed);
  });

  // ── observed ──────────────────────────────────────────────────────

  it("adds reason when observed=false", () => {
    const plan = buildLifeTickPlan(validRequest({ observed: false }));
    expect(
      plan.reasons.some((r) => r.toLowerCase().includes("unobserved"))
    ).toBe(true);
  });

  // ── warnings for elapsedHours > 48 ───────────────────────────────

  it("adds warning when elapsedHours > 48", () => {
    const plan = buildLifeTickPlan(validRequest({ elapsedHours: 72 }));
    expect(
      plan.warnings.some((w) => w.includes("coarse") || w.includes("multi-day"))
    ).toBe(true);
  });

  it("no coarse warning for short ticks", () => {
    const plan = buildLifeTickPlan(validRequest({ elapsedHours: 4 }));
    const hasCoarse = plan.warnings.some(
      (w) => w.includes("coarse") || w.includes("multi-day")
    );
    expect(hasCoarse).toBe(false);
  });

  // ── mode → dryRun mapping ─────────────────────────────────────────

  it("dry_run mode sets dryRun=true", () => {
    const plan = buildLifeTickPlan(validRequest({ mode: "dry_run" }));
    expect(plan.dryRun).toBe(true);
  });

  it("commit_later mode sets dryRun=false", () => {
    const plan = buildLifeTickPlan(validRequest({ mode: "commit_later" }));
    expect(plan.dryRun).toBe(false);
  });

  // ── purity / determinism ──────────────────────────────────────────

  it("is pure: same request → identical plan", () => {
    const req = validRequest({ seed: "pure-test" });
    const plan1 = buildLifeTickPlan(req);
    const plan2 = buildLifeTickPlan(req);
    expect(plan1).toEqual(plan2);
  });

  it("is pure without explicit seed: same request → identical plan", () => {
    const req = validRequest();
    const plan1 = buildLifeTickPlan(req);
    const plan2 = buildLifeTickPlan(req);
    expect(plan1).toEqual(plan2);
  });

  it("scheduler does not mutate the input request", () => {
    const req = validRequest();
    const frozen = { ...req };
    buildLifeTickPlan(req);
    expect(req).toEqual(frozen);
  });

  // ── ID stability ──────────────────────────────────────────────────

  it("generates deterministic plan IDs", () => {
    const req = validRequest({ characterId: "char-id-test" });
    const plan1 = buildLifeTickPlan(req);
    const plan2 = buildLifeTickPlan(req);
    expect(plan1.id).toBe(plan2.id);
  });

  it("different requests produce different plan IDs", () => {
    const p1 = buildLifeTickPlan(validRequest({ characterId: "a" }));
    const p2 = buildLifeTickPlan(validRequest({ characterId: "b" }));
    expect(p1.id).not.toBe(p2.id);
  });
});
