// =========================================================================
// V10.9 Life Tick Persistence Boundary — Explicit, conservative write-back.
// Dry-run is observation. Commit is consent.
// No life projection writes into character state unless the caller
// explicitly asks for it. Self-action candidates are NEVER executed.
// =========================================================================

import type { CharacterPhysicsState } from "../physics/physicsEngine";
import type { MemoryNode } from "../memory/memoryNode";
import { neutralCoordinate, type PersonalityCoordinate } from "../personality/coordinate";
import type { LifeTickDryRunResult } from "./lifeTickRunner";
import type {
  GeneratedSelfActionCandidate,
} from "./selfActionCandidate";

// ── Commit Options ────────────────────────────────────────────────────────

export interface LifeTickCommitOptions {
  /** Allow energy/fatigue state writeback (requires schema support). */
  allowEnergyFatigue?: boolean;
  /** Allow sleep/wake state writeback (requires schema support). */
  allowSleepWake?: boolean;
  /** Allow boredom expansion state writeback (requires schema support). */
  allowBoredomExpansion?: boolean;
  /** Write dream fragments as internal memory seeds. Default: false. */
  allowDreamMemorySeed?: boolean;
  /** Write inspiration seeds as internal memory seeds. Default: false. */
  allowInspirationSeed?: boolean;
  /** Write random thought as internal memory seed. Default: false. */
  allowRandomThoughtMemorySeed?: boolean;
  /** Write self-action candidate traces as memory seeds. Default: false. */
  allowSelfActionCandidateMemorySeed?: boolean;
  /** Max generated memories to add (prevents unbounded growth). Default: 3. */
  maxGeneratedMemories?: number;
  /** Human-readable reason for this commit (included in change records). */
  reason?: string;
}

// ── Commit Change ─────────────────────────────────────────────────────────

export interface LifeTickCommitChange {
  /** Dot-separated path describing what changed. */
  path: string;
  /** Value before the change (for audit). */
  from: unknown;
  /** Value after the change (for audit). */
  to: unknown;
  /** Human-readable explanation. */
  reason: string;
}

// ── Commit Result ─────────────────────────────────────────────────────────

export interface LifeTickCommitResult {
  /** true if at least one change was actually applied. */
  applied: boolean;
  /** Cloned state with applied changes (input state never mutated). */
  state: CharacterPhysicsState;
  /** Changes that were actually written. */
  changes: LifeTickCommitChange[];
  /** Changes that were skipped (not allowed or unsupported). */
  skipped: LifeTickCommitChange[];
  /** Warnings about skipped or unsupported operations. */
  warnings: string[];
  /** Human-readable summary of what happened. */
  reasons: string[];
}

// ── Constants ─────────────────────────────────────────────────────────────

const DEFAULT_MAX_MEMORIES = 3;

// ── Helpers ────────────────────────────────────────────────────────────────

function cloneState(state: CharacterPhysicsState): CharacterPhysicsState {
  // Deep-enough clone: copy arrays, keep shared references for immutable objects
  return {
    ...state,
    memories: [...state.memories],
    beliefStates: [...state.beliefStates],
    proceduralRoutines: [...state.proceduralRoutines],
    clusters: new Map(state.clusters),
    particles: [...state.particles],
    boundary: { ...state.boundary },
    metaState: { ...state.metaState },
    rewardState: { ...state.rewardState },
    homeostasisState: { ...state.homeostasisState },
    boredomState: { ...state.boredomState },
    biologicalNature: { ...state.biologicalNature },
    coordinate: { ...state.coordinate, values: { ...state.coordinate.values } },
    velocity: { ...state.velocity, values: { ...state.velocity.values } },
    personality: { ...state.personality },
  };
}

function makeMemorySeed(params: {
  id: string;
  content: string;
  importance?: number;
  emotion?: string;
}): MemoryNode {
  return {
    id: params.id,
    content: params.content,
    vector: neutralCoordinate(),
    importance: params.importance ?? 0.15,
    emotion: params.emotion ?? "neutral",
    recency: 1,
    repetitionCount: 1,
    beliefEffect: "",
    timeStamp: new Date().toISOString(),
  };
}

function uniqueMemoryId(state: CharacterPhysicsState, baseId: string): string {
  const existing = new Set(state.memories.map((memory) => memory.id));
  if (!existing.has(baseId)) return baseId;
  let suffix = 2;
  while (existing.has(`${baseId}-${suffix}`)) suffix++;
  return `${baseId}-${suffix}`;
}

// ── Commit Function ───────────────────────────────────────────────────────

/**
 * Commit projected life changes to a CharacterPhysicsState clone.
 *
 * Conservative defaults:
 *   - Energy/fatigue, sleep/wake, boredom expansion writeback → SKIPPED
 *     (no dedicated life fields on CharacterPhysicsState yet)
 *   - Memory seeds → SKIPPED unless explicitly enabled
 *   - Self-action candidates → NEVER executed, NEVER persisted as actions
 *
 * Input state is NEVER mutated. A cloned state is returned.
 */
export function commitLifeTickProjection(
  state: CharacterPhysicsState,
  dryRun: LifeTickDryRunResult,
  options?: LifeTickCommitOptions
): LifeTickCommitResult {
  const warnings: string[] = [];
  const reasons: string[] = [];
  const changes: LifeTickCommitChange[] = [];
  const skipped: LifeTickCommitChange[] = [];
  const reasonPrefix = options?.reason ? `[${options.reason}] ` : "";
  const maxMemories = options?.maxGeneratedMemories ?? DEFAULT_MAX_MEMORIES;

  // ── Validate dry-run result ─────────────────────────────────────────
  if (!dryRun || dryRun.version !== "v10.8") {
    warnings.push("Invalid or missing dry-run result.");
    return {
      applied: false,
      state: cloneState(state),
      changes: [],
      skipped: [],
      warnings,
      reasons: ["Commit rejected: invalid dry-run result."],
    };
  }

  if (dryRun.applied !== false) {
    warnings.push("Dry-run result has applied=true — expected false for projection.");
  }

  const projected = dryRun.projectedLifeState;
  if (!projected) {
    warnings.push("Dry-run result has no projectedLifeState.");
    return {
      applied: false,
      state: cloneState(state),
      changes: [],
      skipped: [],
      warnings,
      reasons: ["Commit rejected: no projected life state in dry-run result."],
    };
  }

  // Clone the input state — we never mutate the original
  const cloned = cloneState(state);
  let memoryCount = 0;

  // ── Energy / Fatigue ────────────────────────────────────────────────
  // CharacterPhysicsState has no dedicated life field for this.
  // Until a schema migration adds it, this is skipped.
  if (options?.allowEnergyFatigue) {
    skipped.push({
      path: "lifeState.energyFatigue",
      from: null,
      to: projected.energyFatigue,
      reason: `${reasonPrefix}Energy/fatigue writeback requested but no compatible field exists on CharacterPhysicsState. Skipped until schema migration.`,
    });
    warnings.push(
      "Energy/fatigue writeback is enabled but CharacterPhysicsState has no lifeState field. Skipped."
    );
  } else {
    skipped.push({
      path: "lifeState.energyFatigue",
      from: null,
      to: projected.energyFatigue,
      reason: `${reasonPrefix}Energy/fatigue writeback not enabled (default: false).`,
    });
  }

  // ── Sleep / Wake ────────────────────────────────────────────────────
  if (options?.allowSleepWake) {
    skipped.push({
      path: "lifeState.sleepWake",
      from: null,
      to: projected.sleepWake,
      reason: `${reasonPrefix}Sleep/wake writeback requested but no compatible field exists on CharacterPhysicsState. Skipped until schema migration.`,
    });
    warnings.push(
      "Sleep/wake writeback is enabled but CharacterPhysicsState has no lifeState field. Skipped."
    );
  } else {
    skipped.push({
      path: "lifeState.sleepWake",
      from: null,
      to: projected.sleepWake,
      reason: `${reasonPrefix}Sleep/wake writeback not enabled (default: false).`,
    });
  }

  // ── Boredom Expansion ───────────────────────────────────────────────
  if (options?.allowBoredomExpansion) {
    skipped.push({
      path: "lifeState.boredomExpansion",
      from: null,
      to: projected.boredomExpansion,
      reason: `${reasonPrefix}Boredom expansion writeback requested but no compatible field exists on CharacterPhysicsState. Skipped until schema migration.`,
    });
    warnings.push(
      "Boredom expansion writeback is enabled but CharacterPhysicsState has no lifeState field. Skipped."
    );
  } else {
    skipped.push({
      path: "lifeState.boredomExpansion",
      from: null,
      to: projected.boredomExpansion,
      reason: `${reasonPrefix}Boredom expansion writeback not enabled (default: false).`,
    });
  }

  // ── Dream Memory Seeds ──────────────────────────────────────────────
  if (options?.allowDreamMemorySeed && projected.dreamFragments.length > 0) {
    for (const fragment of projected.dreamFragments) {
      if (memoryCount >= maxMemories) {
        skipped.push({
          path: "memories[].dreamFragment",
          from: null,
          to: fragment.description,
          reason: `${reasonPrefix}Max generated memories (${maxMemories}) reached. Dream fragment skipped.`,
        });
        continue;
      }
      const seed = makeMemorySeed({
        id: uniqueMemoryId(cloned, `life-dream-${fragment.id}`),
        content: `Dream residue: ${fragment.description} (tone: ${fragment.tone})`,
        importance: fragment.intensity * 0.2,
        emotion: dreamToneToEmotion(fragment.tone),
      });
      cloned.memories.push(seed);
      changes.push({
        path: `memories[${cloned.memories.length - 1}]`,
        from: null,
        to: seed.content,
        reason: `${reasonPrefix}Dream fragment "${fragment.description}" persisted as internal memory seed.`,
      });
      memoryCount++;
    }
    reasons.push(`${memoryCount} dream memory seed(s) added.`);
  } else if (!options?.allowDreamMemorySeed && projected.dreamFragments.length > 0) {
    skipped.push({
      path: "memories[].dreamFragment",
      from: null,
      to: `${projected.dreamFragments.length} fragment(s)`,
      reason: `${reasonPrefix}Dream memory seeds not enabled (allowDreamMemorySeed=false).`,
    });
  }

  // ── Inspiration Seed Memory Seeds ───────────────────────────────────
  if (options?.allowInspirationSeed && projected.inspirationSeeds.length > 0) {
    for (const seed of projected.inspirationSeeds) {
      if (memoryCount >= maxMemories) break;
      const memSeed = makeMemorySeed({
        id: uniqueMemoryId(cloned, `life-insp-${seed.id}`),
        content: `Inspiration seed: ${seed.trigger} (type: ${seed.type})`,
        importance: seed.probability * 0.15,
        emotion: "neutral",
      });
      cloned.memories.push(memSeed);
      changes.push({
        path: `memories[${cloned.memories.length - 1}]`,
        from: null,
        to: memSeed.content,
        reason: `${reasonPrefix}Inspiration seed "${seed.type}" persisted as internal memory seed.`,
      });
      memoryCount++;
    }
    if (memoryCount > 0) {
      reasons.push(`${Math.min(projected.inspirationSeeds.length, maxMemories - memoryCount + projected.inspirationSeeds.length)} inspiration memory seed(s) added.`);
    }
  } else if (!options?.allowInspirationSeed && projected.inspirationSeeds.length > 0) {
    skipped.push({
      path: "memories[].inspirationSeed",
      from: null,
      to: `${projected.inspirationSeeds.length} seed(s)`,
      reason: `${reasonPrefix}Inspiration seed writeback not enabled (allowInspirationSeed=false).`,
    });
  }

  // ── Random Thought Memory Seeds ─────────────────────────────────────
  if (
    options?.allowRandomThoughtMemorySeed &&
    projected.randomThought &&
    projected.randomThought.kind !== "nothing"
  ) {
    if (memoryCount < maxMemories) {
      const rt = projected.randomThought;
      const seed = makeMemorySeed({
        id: uniqueMemoryId(cloned, `life-rt-${rt.id}`),
        content: `Thought: "${rt.phrase}" (kind: ${rt.kind})`,
        importance: rt.intensity * 0.12,
        emotion: thoughtKindToEmotion(rt.kind),
      });
      cloned.memories.push(seed);
      changes.push({
        path: `memories[${cloned.memories.length - 1}]`,
        from: null,
        to: seed.content,
        reason: `${reasonPrefix}Random thought "${rt.phrase}" persisted as internal memory seed.`,
      });
      memoryCount++;
      reasons.push("Random thought memory seed added.");
    }
  } else if (
    !options?.allowRandomThoughtMemorySeed &&
    projected.randomThought &&
    projected.randomThought.kind !== "nothing"
  ) {
    skipped.push({
      path: "memories[].randomThought",
      from: null,
      to: projected.randomThought.phrase,
      reason: `${reasonPrefix}Random thought writeback not enabled (allowRandomThoughtMemorySeed=false).`,
    });
  }

  // ── Self-Action Candidate Memory Seeds ──────────────────────────────
  // Candidates are NEVER executed. They can only be stored as trace seeds.
  if (
    options?.allowSelfActionCandidateMemorySeed &&
    projected.selfActionCandidates.length > 0
  ) {
    const top = projected.selfActionCandidates[0];
    if (top && memoryCount < maxMemories) {
      const seed = makeMemorySeed({
        id: uniqueMemoryId(cloned, `life-sac-${top.id}`),
        content: `Action tendency: ${top.type} (score: ${top.score.toFixed(2)}, strength: ${top.strength.toFixed(2)})`,
        importance: top.score * 0.1,
        emotion: "neutral",
      });
      cloned.memories.push(seed);
      changes.push({
        path: `memories[${cloned.memories.length - 1}]`,
        from: null,
        to: seed.content,
        reason: `${reasonPrefix}Top self-action candidate "${top.type}" persisted as trace seed (NOT executed).`,
      });
      memoryCount++;
      reasons.push("Self-action candidate trace seed added (NOT executed).");
    }
  } else if (
    !options?.allowSelfActionCandidateMemorySeed &&
    projected.selfActionCandidates.length > 0
  ) {
    skipped.push({
      path: "memories[].selfActionCandidate",
      from: null,
      to: `${projected.selfActionCandidates.length} candidate(s)`,
      reason: `${reasonPrefix}Self-action candidate writeback not enabled (allowSelfActionCandidateMemorySeed=false). Candidates are never executed.`,
    });
  }

  // ── Self-action candidates are NEVER executed ───────────────────────
  // This is a hard invariant, regardless of any options.
  for (const c of projected.selfActionCandidates) {
    if (c.evaluated !== false || c.executed !== false) {
      warnings.push(
        `Self-action candidate "${c.type}" has evaluated=${c.evaluated}, executed=${c.executed} — this violates V10 invariants.`
      );
    }
  }

  // ── Assemble result ─────────────────────────────────────────────────
  const anyApplied = changes.length > 0;

  if (anyApplied) {
    reasons.unshift(
      `${changes.length} change(s) applied, ${skipped.length} change(s) skipped.`
    );
  } else {
    reasons.unshift(
      `No changes applied. ${skipped.length} change(s) skipped. Life state fields require schema migration.`
    );
  }

  return {
    applied: anyApplied,
    state: cloned,
    changes,
    skipped,
    warnings,
    reasons,
  };
}

// ── Tone/Kind → Emotion Mapping ────────────────────────────────────────────

function dreamToneToEmotion(tone: string): string {
  switch (tone) {
    case "anxious":
    case "threatening":
      return "fear";
    case "lonely":
      return "sadness";
    case "warm":
    case "hopeful":
      return "joy";
    case "calm":
      return "neutral";
    case "fragmented":
    case "unclear":
    default:
      return "neutral";
  }
}

function thoughtKindToEmotion(kind: string): string {
  switch (kind) {
    case "worry":
      return "fear";
    case "desire_shadow":
      return "sadness";
    case "memory_echo":
      return "neutral";
    case "image":
      return "neutral";
    case "self_talk":
      return "neutral";
    case "question":
      return "neutral";
    case "urge":
      return "neutral";
    case "sensory_fragment":
      return "neutral";
    default:
      return "neutral";
  }
}
