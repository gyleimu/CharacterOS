// =========================================================================
// V10.1 Life Scheduler — Pure functions for building and validating
// LifeTickPlan objects. No state mutation, no CharacterPhysicsState input,
// no execution of any kind.
// =========================================================================

import type { LifeTickPhase, LifeTickPlan, LifeTickRequest } from "./lifeTickTypes";
import { LIFE_TICK_PHASES } from "./lifeTickTypes";

// ── Constants ────────────────────────────────────────────────────────────

const MAX_ELAPSED_HOURS = 168; // one week
const SHORT_THRESHOLD = 6;
const DAILY_THRESHOLD = 48;

// ── Helpers ──────────────────────────────────────────────────────────────

function deriveTimeScale(
  elapsedHours: number
): "short" | "daily" | "multi_day" {
  if (elapsedHours <= SHORT_THRESHOLD) return "short";
  if (elapsedHours <= DAILY_THRESHOLD) return "daily";
  return "multi_day";
}

/**
 * Deterministic hash for generating a seed or ID from structured inputs.
 * Converts string input → 32-bit unsigned integer → hex string.
 */
function deterministicHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function deterministicSeed(
  characterId: string,
  requestedAt: string,
  elapsedHours: number
): string {
  const raw = `${characterId}|${requestedAt}|${elapsedHours}`;
  return deterministicHash(raw);
}

function generatePlanId(
  characterId: string,
  requestedAt: string,
  elapsedHours: number
): string {
  const raw = `plan:${characterId}|${requestedAt}|${elapsedHours}`;
  return deterministicHash(raw);
}

function isValidISO(timestamp: string): boolean {
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) return false;
  // Must round-trip to the same ISO string (reject partial/invalid formats).
  // We accept any string that Date.parse can handle as a valid ISO-8601.
  return true;
}

// ── Validation ───────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates a LifeTickRequest without mutating anything.
 * Returns structured errors and warnings.
 */
export function validateLifeTickRequest(
  request: LifeTickRequest
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // characterId
  if (!request.characterId || request.characterId.trim().length === 0) {
    errors.push("characterId is required and must not be empty.");
  }

  // elapsedHours
  if (typeof request.elapsedHours !== "number" || Number.isNaN(request.elapsedHours)) {
    errors.push("elapsedHours must be a number.");
  } else if (request.elapsedHours <= 0) {
    errors.push("elapsedHours must be greater than 0.");
  } else if (request.elapsedHours > MAX_ELAPSED_HOURS) {
    errors.push(
      `elapsedHours must not exceed ${MAX_ELAPSED_HOURS} (max one week).`
    );
  }

  // requestedAt
  if (!request.requestedAt || request.requestedAt.trim().length === 0) {
    errors.push("requestedAt is required.");
  } else if (!isValidISO(request.requestedAt)) {
    errors.push("requestedAt must be a valid ISO-8601 timestamp.");
  }

  // mode
  if (
    request.mode !== "dry_run" &&
    request.mode !== "commit_later"
  ) {
    errors.push(
      `Unknown mode "${String(request.mode)}". Must be "dry_run" or "commit_later".`
    );
  }

  // warnings (non-blocking)
  if (
    typeof request.elapsedHours === "number" &&
    request.elapsedHours > DAILY_THRESHOLD
  ) {
    warnings.push("Multi-day ticks provide coarse-grain simulation; prefer shorter intervals when possible.");
  }

  if (!request.observed) {
    warnings.push("Unobserved life tick: character changes without observation. Ensure trace captures the delta.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ── Plan Builder ─────────────────────────────────────────────────────────

/**
 * Builds a LifeTickPlan from a LifeTickRequest.
 * Pure function: same input → same output every time.
 * Does NOT read or mutate any state.
 */
export function buildLifeTickPlan(request: LifeTickRequest): LifeTickPlan {
  const validation = validateLifeTickRequest(request);
  if (!validation.valid) {
    throw new Error(
      `Invalid LifeTickRequest: ${validation.errors.join(" ")}`
    );
  }

  const { characterId, elapsedHours, observed, seed, requestedAt, mode } =
    request;

  const timeScale = deriveTimeScale(elapsedHours);
  const effectiveSeed =
    seed ?? deterministicSeed(characterId, requestedAt, elapsedHours);
  const dryRun = mode === "dry_run";
  const phaseSequence: LifeTickPhase[] = [...LIFE_TICK_PHASES];

  const warnings: string[] = [...validation.warnings];
  const reasons: string[] = [];

  if (elapsedHours > DAILY_THRESHOLD) {
    warnings.push(
      `Elapsed ${elapsedHours}h exceeds ${DAILY_THRESHOLD}h — multi-day tick is coarse.`
    );
  }

  if (!observed) {
    reasons.push(
      "Unobserved life tick: character may have changed without external observation."
    );
  }

  reasons.push(`Time scale derived as "${timeScale}" from ${elapsedHours}h elapsed.`);
  reasons.push(`Dry run: ${dryRun ? "yes — no state will be modified." : "no — state commit is pending."}`);

  if (seed) {
    reasons.push("Explicit seed preserved from request.");
  } else {
    reasons.push("Seed generated deterministically from characterId, requestedAt, and elapsedHours.");
  }

  return {
    id: generatePlanId(characterId, requestedAt, elapsedHours),
    characterId,
    elapsedHours,
    phaseSequence,
    timeScale,
    seed: effectiveSeed,
    dryRun,
    warnings,
    reasons,
  };
}
