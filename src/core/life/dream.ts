// =========================================================================
// V10.4 Dream Fragment System — Psychological residue during sleep.
// Dreams are NOT narrative generation. They are fragments of memory,
// unmet need, stress, and belief tension surfacing during sleep.
// Pure functions only. No LLM. No state mutation. No story writing.
// =========================================================================

import { createSeededRandom, type SeededRandom } from "./seededRandom";
import type { SleepWakePhase, SleepWakeState } from "./sleepWake";
import type { EnergyFatigueState } from "./energyFatigue";
import type { CharacterPhysicsState } from "../physics/physicsEngine";

// ── DreamTone ──────────────────────────────────────────────────────────────

export const DREAM_TONES = [
  "calm",
  "anxious",
  "lonely",
  "warm",
  "fragmented",
  "unclear",
  "hopeful",
  "threatening",
] as const;

export type DreamTone = (typeof DREAM_TONES)[number];

// ── DreamSource ────────────────────────────────────────────────────────────

export interface DreamSource {
  id: string;
  kind: "memory" | "belief" | "need" | "cluster";
  label: string;
  /** [0,1] — relative influence on dream content. */
  weight: number;
  /** [0,1] — emotional intensity carried into the dream. */
  emotionalCharge: number;
  reason: string;
}

// ── DreamContext ───────────────────────────────────────────────────────────

export interface DreamContext {
  sleepPhase: SleepWakePhase;
  /** [0,1] */
  sleepQuality: number;
  /** [0,1] */
  stressLoad: number;
  /** [0,1] */
  fatigue: number;
  /** [0,1] — inverted from lonelinessTolerance: higher = lonelier. */
  loneliness: number;
  /** Number of active memories available. */
  activeMemoryCount: number;
  /** Required — deterministic seed for tone/variation. */
  seed: string;
}

// ── DreamFragment ──────────────────────────────────────────────────────────

export interface DreamFragment {
  id: string;
  tone: DreamTone;
  /** [0,1] — emotional intensity of the dream. */
  intensity: number;
  /** [0,1] — how coherent the dream is. */
  clarity: number;
  /** IDs of DreamSources that contributed. */
  sourceIds: string[];
  /** Short symbolic elements appearing in the dream. */
  symbols: string[];
  /** Brief fragment description — NOT a story. Max ~8 words. */
  description: string;
  /** true = a fragment was generated. false = conditions insufficient. */
  generated: boolean;
}

// ── DreamTrace ─────────────────────────────────────────────────────────────

export interface DreamTrace {
  context: DreamContext;
  sources: DreamSource[];
  fragment: DreamFragment | null;
  warnings: string[];
  reasons: string[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_SOURCES_DEFAULT = 5;

// ── Helpers ────────────────────────────────────────────────────────────────

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function deterministicHash(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0) / 4294967296; // normalize to [0, 1)
}

function pickDeterministic<T>(items: T[], rng: SeededRandom): T {
  const idx = Math.floor(rng.next() * items.length);
  return items[idx]!;
}

function shuffleDeterministic<T>(items: T[], rng: SeededRandom): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

// Simple keyword extraction from content string — split by common delimiters
// and select short words that look like potential symbols.
function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[.,;:!?()"']/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && w.length <= 15)
    .filter((w) => !stopWords.has(w));
  return [...new Set(words)];
}

const stopWords = new Set([
  "the", "and", "for", "with", "that", "this", "from", "have", "been",
  "were", "they", "their", "will", "would", "could", "should", "about",
  "which", "when", "what", "make", "like", "just", "over", "also",
  "then", "than", "into", "more", "some", "them", "other", "being",
  "does", "doing", "very", "only", "still", "after", "before",
]);

// ── Source Selection ──────────────────────────────────────────────────────

export interface SourceSelectionInput {
  memories: Array<{
    id: string;
    content: string;
    importance: number;
    recency: number;
    emotion: string;
    tags?: string[];
  }>;
  beliefs: Array<{
    id: string;
    content: string;
    strength: number;
  }>;
  needs: Array<{
    id: string;
    name: string;
    intensity: number;
  }>;
  clusters: Array<{
    id: string;
    category: string;
    mass: number;
    stability: number;
  }>;
  limit?: number;
}

/**
 * Deterministically select dream sources from character data.
 * Selection is weight-based (no randomness) — higher weight sources
 * are selected first, respecting the optional limit.
 */
export function selectDreamSources(
  input: SourceSelectionInput
): DreamSource[] {
  const sources: DreamSource[] = [];
  const limit = input.limit ?? MAX_SOURCES_DEFAULT;

  // ── Memories ──────────────────────────────────────────────────────
  for (const m of input.memories) {
    const importanceWeight = clamp01(m.importance);
    const recencyWeight = clamp01(m.recency);
    const weight = clamp01(importanceWeight * 0.6 + recencyWeight * 0.4);
    sources.push({
      id: m.id,
      kind: "memory",
      label: m.content.length > 40 ? m.content.slice(0, 40) + "…" : m.content,
      weight,
      emotionalCharge: clamp01(importanceWeight * 0.7 + recencyWeight * 0.3),
      reason: `Memory (importance=${m.importance.toFixed(2)}, recency=${m.recency.toFixed(2)}, emotion="${m.emotion}")`,
    });
  }

  // ── Beliefs ───────────────────────────────────────────────────────
  for (const b of input.beliefs) {
    const weight = clamp01(b.strength);
    sources.push({
      id: b.id,
      kind: "belief",
      label: b.content.length > 40 ? b.content.slice(0, 40) + "…" : b.content,
      weight,
      emotionalCharge: clamp01(b.strength * 0.5),
      reason: `Belief (strength=${b.strength.toFixed(2)})`,
    });
  }

  // ── Needs ─────────────────────────────────────────────────────────
  for (const n of input.needs) {
    const weight = clamp01(n.intensity);
    sources.push({
      id: n.id,
      kind: "need",
      label: n.name.length > 40 ? n.name.slice(0, 40) + "…" : n.name,
      weight,
      emotionalCharge: clamp01(n.intensity),
      reason: `Need "${n.name}" (intensity=${n.intensity.toFixed(2)})`,
    });
  }

  // ── Clusters ──────────────────────────────────────────────────────
  for (const c of input.clusters) {
    // More massive + less stable clusters are more likely to surface
    const weight = clamp01(c.mass * 0.7 + (1 - c.stability) * 0.3);
    sources.push({
      id: c.id,
      kind: "cluster",
      label: c.category.length > 40 ? c.category.slice(0, 40) + "…" : c.category,
      weight,
      emotionalCharge: clamp01(c.mass),
      reason: `Cluster "${c.category}" (mass=${c.mass.toFixed(2)}, stability=${c.stability.toFixed(2)})`,
    });
  }

  // Sort by weight descending, take top N
  sources.sort((a, b) => b.weight - a.weight);
  return sources.slice(0, limit);
}

// ── Dream Fragment Generation ──────────────────────────────────────────────

/**
 * Generate a dream fragment from context and sources.
 *
 * Rules:
 *   - No sources → fragment=null (no dream)
 *   - awake/waking → no dream (or very low chance in drowsy)
 *   - light_sleep / deep_sleep → dream possible
 *   - Tone is driven by context (stress, loneliness, quality, fatigue)
 *   - Seeded RNG used only for tie-breaking among equally applicable tones
 *   - Deterministic: same seed + same inputs → same fragment
 */
export function generateDreamFragment(
  context: DreamContext,
  sources: DreamSource[]
): DreamTrace {
  const warnings: string[] = [];
  const reasons: string[] = [];
  const rng = createSeededRandom(context.seed);

  // ── Guard: no sources ─────────────────────────────────────────────
  if (sources.length === 0) {
    reasons.push("No dream sources available — fragment not generated.");
    return {
      context: { ...context },
      sources: [],
      fragment: null,
      warnings,
      reasons,
    };
  }

  // ── Guard: sleep phase check ──────────────────────────────────────
  const phase = context.sleepPhase;
  const sleepingPhase =
    phase === "light_sleep" || phase === "deep_sleep";
  const transitionalPhase =
    phase === "drowsy" || phase === "falling_asleep";
  const wakePhase = phase === "awake" || phase === "waking";

  if (wakePhase) {
    reasons.push(
      `Sleep phase is "${phase}" — dreams do not occur while awake. Fragment not generated.`
    );
    return {
      context: { ...context },
      sources,
      fragment: null,
      warnings,
      reasons,
    };
  }

  if (transitionalPhase) {
    // Drowsy / falling asleep: low chance of dream fragment
    // Only generate if conditions are strong enough
    const chanceThreshold = 0.4;
    const dreamChance =
      context.fatigue * 0.3 +
      context.stressLoad * 0.2 +
      sources[0]!.emotionalCharge * 0.3;
    if (dreamChance < chanceThreshold) {
      reasons.push(
        `Sleep phase is "${phase}" — dream chance too low (${dreamChance.toFixed(2)} < ${chanceThreshold}).`
      );
      return {
        context: { ...context },
        sources,
        fragment: null,
        warnings,
        reasons,
      };
    }
    reasons.push(
      `Transitional phase "${phase}" — dream fragment possible (chance=${dreamChance.toFixed(2)}).`
    );
  } else if (sleepingPhase) {
    reasons.push(
      `Sleeping phase "${phase}" — dream fragment generation active.`
    );
  }

  // ── Determine tone ────────────────────────────────────────────────
  const tone = selectDreamTone(context, sources, rng);
  reasons.push(`Dream tone selected: "${tone}".`);

  // ── Intensity ─────────────────────────────────────────────────────
  const intensity = clamp01(
    sources[0]!.emotionalCharge * 0.4 +
    context.fatigue * 0.15 +
    context.stressLoad * 0.2 +
    context.loneliness * 0.15 +
    0.1 // base
  );

  // ── Clarity ───────────────────────────────────────────────────────
  const clarity = clamp01(
    context.sleepQuality * 0.6 -
    context.stressLoad * 0.25 -
    context.fatigue * 0.25 +
    0.3 // base
  );
  reasons.push(`Dream clarity=${clarity.toFixed(2)}, intensity=${intensity.toFixed(2)}.`);

  // ── Extract symbols from sources ──────────────────────────────────
  const allKeywords: string[] = [];
  for (const s of sources) {
    const keywords = extractKeywords(s.label);
    allKeywords.push(...keywords);
  }
  const uniqueKeywords = [...new Set(allKeywords)];

  // Select 2–5 symbols deterministically
  const symbolCount = Math.min(
    Math.max(2, Math.floor(3 + clarity * 3)),
    uniqueKeywords.length
  );
  const shuffled = shuffleDeterministic(uniqueKeywords, createSeededRandom(context.seed + ":symbols"));
  const symbols = shuffled.slice(0, symbolCount);

  // ── Build description ─────────────────────────────────────────────
  const description = buildDreamDescription(sources, symbols, tone, rng);
  reasons.push(`Dream description: "${description}".`);

  // ── Assemble fragment ─────────────────────────────────────────────
  const fragment: DreamFragment = {
    id: `dream-${deterministicHash(context.seed + ":id").toString(36).slice(2, 10)}`,
    tone,
    intensity: clamp01(intensity),
    clarity: clamp01(clarity),
    sourceIds: sources.map((s) => s.id),
    symbols,
    description,
    generated: true,
  };

  // ── Warnings ──────────────────────────────────────────────────────
  if (context.fatigue > 0.8) {
    warnings.push("High fatigue may produce fragmented or unclear dreams.");
  }
  if (context.stressLoad > 0.8) {
    warnings.push("High stress may produce anxious or threatening dreams.");
  }
  if (sources.length < 2) {
    warnings.push("Few dream sources — dream may feel thin.");
  }

  return {
    context: { ...context },
    sources,
    fragment,
    warnings,
    reasons,
  };
}

// ── Tone Selection ────────────────────────────────────────────────────────

function selectDreamTone(
  context: DreamContext,
  sources: DreamSource[],
  rng: SeededRandom
): DreamTone {
  // Build a weighted candidate set based on context

  // Candidate tones with base weights
  const weights: Record<DreamTone, number> = {
    calm: 0.1,
    anxious: 0.05,
    lonely: 0.05,
    warm: 0.1,
    fragmented: 0.1,
    unclear: 0.1,
    hopeful: 0.1,
    threatening: 0.05,
  };

  // ── Context modifiers ─────────────────────────────────────────────
  if (context.stressLoad > 0.5) {
    weights.anxious += context.stressLoad * 0.35;
    weights.threatening += context.stressLoad * 0.3;
    weights.fragmented += context.stressLoad * 0.15;
    weights.calm -= context.stressLoad * 0.1;
    weights.warm -= context.stressLoad * 0.1;
  }

  if (context.loneliness > 0.5) {
    weights.lonely += context.loneliness * 0.4;
    weights.warm -= context.loneliness * 0.1;
    weights.hopeful -= context.loneliness * 0.1;
  }

  if (context.sleepQuality > 0.6) {
    weights.calm += context.sleepQuality * 0.2;
    weights.warm += context.sleepQuality * 0.15;
    weights.hopeful += context.sleepQuality * 0.1;
    weights.fragmented -= context.sleepQuality * 0.1;
    weights.unclear -= context.sleepQuality * 0.1;
  }

  if (context.fatigue > 0.6) {
    weights.fragmented += context.fatigue * 0.3;
    weights.unclear += context.fatigue * 0.25;
    weights.calm -= context.fatigue * 0.1;
    weights.warm -= context.fatigue * 0.05;
  }

  // ── Source-driven tone ────────────────────────────────────────────
  // If many sources are emotionally charged, push away from calm
  const avgCharge = sources.length > 0
    ? sources.reduce((s, src) => s + src.emotionalCharge, 0) / sources.length
    : 0;
  if (avgCharge > 0.6) {
    weights.anxious += avgCharge * 0.15;
    weights.fragmented += avgCharge * 0.1;
    weights.calm -= avgCharge * 0.1;
  }

  // Clamp all weights to non-negative
  for (const key of DREAM_TONES) {
    weights[key] = Math.max(0, weights[key]);
  }

  // Normalize to probabilities
  const totalWeight = Object.values(weights).reduce((s, w) => s + w, 0);
  if (totalWeight <= 0) return "unclear"; // fallback

  // Select deterministically using seeded RNG
  let roll = rng.next() * totalWeight;
  for (const tone of DREAM_TONES) {
    roll -= weights[tone];
    if (roll <= 0) return tone;
  }

  return DREAM_TONES[DREAM_TONES.length - 1]!; // fallback
}

// ── Description Builder ────────────────────────────────────────────────────

interface DescriptionPattern {
  template: string[];
  tones: DreamTone[];
}

const DESCRIPTION_PATTERNS: DescriptionPattern[] = [
  {
    template: ["{symbol}", "{symbol}", "closed door"],
    tones: ["anxious", "lonely", "threatening"],
  },
  {
    template: ["{symbol}", "waiting", "{symbol}"],
    tones: ["lonely", "unclear", "fragmented"],
  },
  {
    template: ["{symbol}", "distant voice"],
    tones: ["lonely", "unclear", "calm"],
  },
  {
    template: ["warm light", "{symbol}"],
    tones: ["warm", "hopeful", "calm"],
  },
  {
    template: ["rain", "{symbol}", "{symbol}"],
    tones: ["calm", "lonely", "fragmented"],
  },
  {
    template: ["{symbol}", "falling", "silence"],
    tones: ["anxious", "fragmented", "threatening"],
  },
  {
    template: ["{symbol}", "fading", "fog"],
    tones: ["unclear", "fragmented", "anxious"],
  },
  {
    template: ["{symbol}", "old room"],
    tones: ["lonely", "unclear", "calm"],
  },
  {
    template: ["repeating", "{symbol}", "{symbol}"],
    tones: ["fragmented", "anxious", "unclear"],
  },
  {
    template: ["{symbol}", "morning light"],
    tones: ["hopeful", "warm", "calm"],
  },
];

function buildDreamDescription(
  sources: DreamSource[],
  symbols: string[],
  tone: DreamTone,
  rng: SeededRandom
): string {
  // Pick patterns that match this tone, or fall back to any
  const matchingPatterns = DESCRIPTION_PATTERNS.filter((p) =>
    p.tones.includes(tone)
  );
  const fallbackPatterns =
    matchingPatterns.length > 0 ? matchingPatterns : DESCRIPTION_PATTERNS;

  const pattern = pickDeterministic(fallbackPatterns, rng);

  // Fill template slots with symbols
  const parts = pattern.template.map((slot) => {
    if (slot.startsWith("{") && slot.endsWith("}") && symbols.length > 0) {
      return pickDeterministic(symbols, rng);
    }
    return slot;
  });

  return parts.join(", ");
}

// ── CharacterPhysicsState Context Helper ──────────────────────────────────

/**
 * Build a DreamContext from full character state.
 * Read-only — no state is ever modified.
 */
export function buildDreamContextFromCharacter(input: {
  state: CharacterPhysicsState;
  sleepWake: SleepWakeState;
  energyFatigue: EnergyFatigueState;
  seed: string;
}): DreamContext {
  const { state, sleepWake, energyFatigue, seed } = input;

  // Invert lonelinessTolerance: high tolerance → low loneliness
  const lonelinessTolerance = clamp01(state.metaState.lonelinessTolerance);
  const loneliness = clamp01(1 - lonelinessTolerance);

  return {
    sleepPhase: sleepWake.phase,
    sleepQuality: clamp01(sleepWake.sleepQuality),
    stressLoad: clamp01(state.boundary.stressLoad),
    fatigue: clamp01(energyFatigue.fatigue),
    loneliness,
    activeMemoryCount: state.memories.length,
    seed,
  };
}
