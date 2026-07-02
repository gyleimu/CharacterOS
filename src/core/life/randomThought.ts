// =========================================================================
// V10.6 Random Thought System — The small ripples of consciousness.
// Random thoughts are NOT stories, dialogues, or LLM outputs. They are
// brief unbidden mental events: a memory echo, a worry, a desire shadow,
// a sensory fragment, a question, an image, an urge, or nothing at all.
// Pure functions only. No state mutation. No narrative generation.
// =========================================================================

import { createSeededRandom, type SeededRandom } from "./seededRandom";
import type { DreamFragment } from "./dream";
import type {
  BoredomExpansionState,
  InspirationSeedCandidate,
} from "./boredomInspiration";
import type { EnergyFatigueState } from "./energyFatigue";
import type { SleepWakeState } from "./sleepWake";
import type { CharacterPhysicsState } from "../physics/physicsEngine";

// ── RandomThoughtKind ─────────────────────────────────────────────────────

export const RANDOM_THOUGHT_KINDS = [
  "memory_echo",
  "worry",
  "desire_shadow",
  "sensory_fragment",
  "self_talk",
  "question",
  "image",
  "urge",
  "nothing",
] as const;

export type RandomThoughtKind = (typeof RANDOM_THOUGHT_KINDS)[number];

// ── RandomThoughtSource ───────────────────────────────────────────────────

export interface RandomThoughtSource {
  id: string;
  kind:
    | "memory"
    | "dream_fragment"
    | "need"
    | "belief"
    | "boredom"
    | "inspiration_seed"
    | "stress"
    | "loneliness"
    | "fatigue";
  label: string;
  /** [0,1] */
  weight: number;
  /** [0,1] */
  emotionalCharge: number;
  reason: string;
}

// ── RandomThoughtContext ──────────────────────────────────────────────────

export interface RandomThoughtContext {
  seed: string;
  /** [0,1] */
  boredom: number;
  /** [0,1] */
  daydreamingTendency: number;
  /** [0,1] */
  restlessness: number;
  /** [0,1] */
  stressLoad: number;
  /** [0,1] */
  loneliness: number;
  /** [0,1] */
  fatigue: number;
  /** [0,1] */
  curiosity: number;
  /** [0,1] — how much sleep residue is present (higher after waking). */
  sleepResidue: number;
}

// ── RandomThought ────────────────────────────────────────────────────────

export interface RandomThought {
  id: string;
  kind: RandomThoughtKind;
  /** [0,1] — how strongly this thought presents itself. */
  intensity: number;
  /** [0,1] — how clear/coherent it is. */
  clarity: number;
  /** IDs of contributing sources. */
  sourceIds: string[];
  /** Short phrase — NOT a story, NOT dialogue. Max ~8 words. */
  phrase: string;
  /** [0,1] — likelihood this thought could lead to action. */
  actionPotential: number;
  /** true = a thought was generated. false = conditions too weak. */
  generated: boolean;
}

// ── RandomThoughtTrace ───────────────────────────────────────────────────

export interface RandomThoughtTrace {
  context: RandomThoughtContext;
  sources: RandomThoughtSource[];
  thought: RandomThought;
  warnings: string[];
  reasons: string[];
}

// ── Constants ────────────────────────────────────────────────────────────

const MAX_SOURCES_DEFAULT = 6;

// ── Helpers ──────────────────────────────────────────────────────────────

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ── Source Selection ─────────────────────────────────────────────────────

export interface RandomThoughtSourceInput {
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
  dreamFragment?: DreamFragment | null;
  inspirationSeeds?: InspirationSeedCandidate[];
  boredomState?: BoredomExpansionState;
  limit?: number;
}

export function selectRandomThoughtSources(
  input: RandomThoughtSourceInput
): RandomThoughtSource[] {
  const sources: RandomThoughtSource[] = [];
  const limit = input.limit ?? MAX_SOURCES_DEFAULT;

  // ── Memories ──────────────────────────────────────────────────────
  for (const m of input.memories) {
    const weight = clamp01(m.importance * 0.5 + m.recency * 0.5);
    sources.push({
      id: m.id,
      kind: "memory",
      label: m.content.length > 40 ? m.content.slice(0, 40) + "…" : m.content,
      weight,
      emotionalCharge: clamp01(m.importance * 0.6 + (m.emotion !== "neutral" ? 0.2 : 0)),
      reason: `Memory (importance=${m.importance.toFixed(2)}, recency=${m.recency.toFixed(2)})`,
    });
  }

  // ── Beliefs ───────────────────────────────────────────────────────
  for (const b of input.beliefs) {
    sources.push({
      id: b.id,
      kind: "belief",
      label: b.content.length > 40 ? b.content.slice(0, 40) + "…" : b.content,
      weight: clamp01(b.strength * 0.5),
      emotionalCharge: clamp01(b.strength * 0.4),
      reason: `Belief (strength=${b.strength.toFixed(2)})`,
    });
  }

  // ── Needs ─────────────────────────────────────────────────────────
  for (const n of input.needs) {
    sources.push({
      id: n.id,
      kind: "need",
      label: n.name.length > 40 ? n.name.slice(0, 40) + "…" : n.name,
      weight: clamp01(n.intensity),
      emotionalCharge: clamp01(n.intensity),
      reason: `Need "${n.name}" (intensity=${n.intensity.toFixed(2)})`,
    });
  }

  // ── Dream Fragment ────────────────────────────────────────────────
  if (input.dreamFragment && input.dreamFragment.generated) {
    sources.push({
      id: input.dreamFragment.id,
      kind: "dream_fragment",
      label: input.dreamFragment.description,
      weight: clamp01(input.dreamFragment.intensity * 0.4 + input.dreamFragment.clarity * 0.3),
      emotionalCharge: clamp01(input.dreamFragment.intensity),
      reason: `Dream residue: "${input.dreamFragment.description}" (tone=${input.dreamFragment.tone})`,
    });
  }

  // ── Inspiration Seeds ─────────────────────────────────────────────
  if (input.inspirationSeeds) {
    for (const seed of input.inspirationSeeds) {
      sources.push({
        id: seed.id,
        kind: "inspiration_seed",
        label: seed.trigger,
        weight: clamp01(seed.probability * 0.5),
        emotionalCharge: clamp01(seed.probability * 0.6),
        reason: `Inspiration seed "${seed.type}" (prob=${seed.probability.toFixed(2)})`,
      });
    }
  }

  // ── Boredom State ─────────────────────────────────────────────────
  if (input.boredomState) {
    const bs = input.boredomState;
    if (bs.boredom > 0.3 || bs.daydreamingTendency > 0.3) {
      const weight = clamp01(bs.boredom * 0.4 + bs.daydreamingTendency * 0.3);
      sources.push({
        id: "source-boredom",
        kind: "boredom",
        label: `Boredom (${bs.boredom.toFixed(2)}), daydreaming (${bs.daydreamingTendency.toFixed(2)})`,
        weight,
        emotionalCharge: clamp01(bs.boredom * 0.3 + bs.restlessness * 0.2),
        reason: `Boredom state contributing to mind-wandering.`,
      });
    }
  }

  // Sort by weight descending, take top N
  sources.sort((a, b) => b.weight - a.weight);
  return sources.slice(0, limit);
}

// ── Thought Generation ───────────────────────────────────────────────────

// Phrase templates by kind — short, non-narrative, non-dialogue
const PHRASE_TEMPLATES: Record<RandomThoughtKind, string[]> = {
  memory_echo: [
    "that time when {mem}",
    "remember {mem}?",
    "{mem} again",
    "like that day {mem}",
  ],
  worry: [
    "what if {w}?",
    "why didn't {w}?",
    "maybe {w}",
    "{w} might happen",
  ],
  desire_shadow: [
    "wish I could {d}",
    "wanting {d} again",
    "maybe {d}",
    "if only {d}",
    "still wanting {d}",
  ],
  sensory_fragment: [
    "{s}",
    "{s} again",
    "sound of {s}",
    "smell of {s}",
    "{s} in the air",
  ],
  self_talk: [
    "I should {st}",
    "why am I {st}?",
    "maybe I'll {st}",
    "I need to {st}",
  ],
  question: [
    "what if {q}?",
    "why does {q}?",
    "how would {q}?",
    "when did {q}?",
  ],
  image: [
    "{img}",
    "{img} light",
    "{img} fading",
    "{img} again",
  ],
  urge: [
    "want to {u}",
    "should {u}",
    "maybe {u} later",
    "feel like {u}",
  ],
  nothing: [
    "nothing in particular",
    "blank",
    "a pause",
    "just silence",
    "nothing",
  ],
};

// Words that can fill template slots of each kind
const FILLER_WORDS: Record<string, string[]> = {
  mem: ["the rain", "that voice", "her face", "the window", "that night", "the door", "those words", "that feeling"],
  w: ["she left", "they won't come", "it breaks", "he forgot", "it never ends", "something goes wrong", "nobody calls"],
  d: ["sleep", "leave", "stay quiet", "disappear", "say something", "go home", "eat", "stop thinking"],
  st: ["rest", "stop worrying", "call back", "try again", "write it down", "let go", "wake up", "stay calm"],
  q: ["the rain stops", "people leave", "time passes", "she said that", "things happen this way", "the door opened"],
  img: ["gray sky", "fog", "windows", "empty chair", "door ajar", "phone screen", "half-light", "shadow",
  ],
  u: ["walk", "check the phone", "turn off the light", "close my eyes", "say something", "get up", "drink water", "move"],
  s: ["rain", "traffic", "footsteps", "humming", "clock ticking", "wind", "keyboard clicking", "distant voices"],
};

function pickDeterministic<T>(items: T[], rng: SeededRandom): T {
  return items[Math.floor(rng.next() * items.length)]!;
}

function extractSourceWords(sources: RandomThoughtSource[]): string[] {
  const words: string[] = [];
  for (const s of sources) {
    const parts = s.label
      .toLowerCase()
      .replace(/[.,;:!?()"']/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && w.length <= 15);
    words.push(...parts);
  }
  return [...new Set(words)];
}

/**
 * Generate a random thought from context and sources.
 * Pure, deterministic, no LLM, no story.
 */
export function generateRandomThought(
  context: RandomThoughtContext,
  sources: RandomThoughtSource[]
): RandomThoughtTrace {
  const warnings: string[] = [];
  const reasons: string[] = [];
  const rng = createSeededRandom(context.seed);

  // ── Generation Pressure ────────────────────────────────────────────
  const generationPressure = clamp01(
    context.boredom * 0.25 +
    context.daydreamingTendency * 0.3 +
    context.restlessness * 0.15 +
    context.fatigue * 0.1 +
    (sources.length > 0 ? 0.15 : 0) +
    context.loneliness * 0.05
  );

  // ── Low pressure → "nothing" ──────────────────────────────────────
  if (generationPressure < 0.15 || sources.length === 0) {
    reasons.push(
      `Low generation pressure (${generationPressure.toFixed(2)}) — thought is "nothing".`
    );
    const thought: RandomThought = {
      id: `rt-${context.seed.slice(0, 8)}`,
      kind: "nothing",
      intensity: 0.05,
      clarity: 1,
      sourceIds: [],
      phrase: pickDeterministic(PHRASE_TEMPLATES.nothing, rng),
      actionPotential: 0,
      generated: true,
    };
    return {
      context: { ...context },
      sources,
      thought,
      warnings,
      reasons,
    };
  }

  reasons.push(
    `Generation pressure=${generationPressure.toFixed(2)} — thought can form.`
  );

  // ── Determine kind ────────────────────────────────────────────────
  const kind = selectThoughtKind(context, sources, rng);
  reasons.push(`Thought kind selected: "${kind}".`);

  // ── Intensity ─────────────────────────────────────────────────────
  const avgEmotionalCharge =
    sources.length > 0
      ? sources.reduce((s, src) => s + src.emotionalCharge, 0) / sources.length
      : 0;
  const intensity = clamp01(
    avgEmotionalCharge * 0.35 +
    context.stressLoad * 0.2 +
    context.loneliness * 0.15 +
    context.boredom * 0.15 +
    generationPressure * 0.15
  );

  // ── Clarity ───────────────────────────────────────────────────────
  const clarity = clamp01(
    context.curiosity * 0.2 +
    context.daydreamingTendency * 0.25 +
    0.3 -
    context.fatigue * 0.3 -
    context.stressLoad * 0.2
  );

  // ── Action Potential ──────────────────────────────────────────────
  let actionPotential: number;
  switch (kind) {
    case "urge":
      actionPotential = clamp01(0.4 + context.boredom * 0.3 + context.restlessness * 0.3);
      break;
    case "desire_shadow":
      actionPotential = clamp01(0.3 + intensity * 0.4);
      break;
    case "question":
      actionPotential = clamp01(0.2 + context.curiosity * 0.3);
      break;
    case "self_talk":
      actionPotential = clamp01(0.15 + context.restlessness * 0.2);
      break;
    case "worry":
      actionPotential = clamp01(0.1 + context.stressLoad * 0.25);
      break;
    case "memory_echo":
      actionPotential = clamp01(0.08 + intensity * 0.1);
      break;
    case "image":
    case "sensory_fragment":
      actionPotential = clamp01(0.05);
      break;
    case "nothing":
      actionPotential = 0;
      break;
    default:
      actionPotential = 0.05;
  }

  // ── Build phrase ──────────────────────────────────────────────────
  const sourceWords = extractSourceWords(sources);
  const phrase = buildPhrase(kind, sourceWords, rng, sources);

  // ── Warnings ──────────────────────────────────────────────────────
  if (context.fatigue > 0.8) {
    warnings.push("High fatigue — thoughts may be fragmented or unclear.");
  }
  if (context.boredom > 0.7) {
    warnings.push("High boredom — mind is actively seeking stimulation.");
  }

  const thought: RandomThought = {
    id: `rt-${context.seed.slice(0, 8)}`,
    kind,
    intensity: round4(intensity),
    clarity: round4(clarity),
    sourceIds: sources.map((s) => s.id),
    phrase,
    actionPotential: round4(actionPotential),
    generated: true,
  };

  reasons.push(
    `Intensity=${intensity.toFixed(2)}, clarity=${clarity.toFixed(2)}, actionPotential=${actionPotential.toFixed(2)}.`
  );

  return {
    context: { ...context },
    sources: sources.map((s) => ({ ...s })),
    thought,
    warnings,
    reasons,
  };
}

// ── Kind Selection ───────────────────────────────────────────────────────

function selectThoughtKind(
  context: RandomThoughtContext,
  sources: RandomThoughtSource[],
  rng: SeededRandom
): RandomThoughtKind {
  const weights: Record<RandomThoughtKind, number> = {
    memory_echo: 0.1,
    worry: 0.05,
    desire_shadow: 0.05,
    sensory_fragment: 0.1,
    self_talk: 0.1,
    question: 0.1,
    image: 0.1,
    urge: 0.05,
    nothing: 0.05,
  };

  // ── Context modifiers ─────────────────────────────────────────────
  if (context.stressLoad > 0.4) {
    weights.worry += context.stressLoad * 0.35;
    weights.self_talk += context.stressLoad * 0.1;
    weights.nothing -= context.stressLoad * 0.05;
  }

  if (context.loneliness > 0.4) {
    weights.desire_shadow += context.loneliness * 0.35;
    weights.self_talk += context.loneliness * 0.15;
    weights.memory_echo += context.loneliness * 0.1;
  }

  if (context.boredom > 0.4 || context.daydreamingTendency > 0.4) {
    weights.image += (context.boredom + context.daydreamingTendency) * 0.15;
    weights.question += (context.boredom + context.daydreamingTendency) * 0.1;
    weights.self_talk += context.daydreamingTendency * 0.1;
  }

  if (context.curiosity > 0.5) {
    weights.question += context.curiosity * 0.25;
    weights.image += context.curiosity * 0.1;
  }

  if (context.fatigue > 0.6) {
    weights.sensory_fragment += context.fatigue * 0.25;
    weights.nothing += context.fatigue * 0.15;
    weights.question -= context.fatigue * 0.1;
    weights.worry -= context.fatigue * 0.05;
  }

  // ── Source-driven modifiers ───────────────────────────────────────
  const sourceKinds = new Set(sources.map((s) => s.kind));

  if (sourceKinds.has("memory")) {
    weights.memory_echo += 0.2;
  }
  if (sourceKinds.has("dream_fragment")) {
    weights.image += 0.2;
    weights.sensory_fragment += 0.15;
  }
  if (sourceKinds.has("need")) {
    weights.urge += 0.2;
    weights.desire_shadow += 0.15;
  }
  if (sourceKinds.has("inspiration_seed")) {
    weights.question += 0.15;
    weights.image += 0.1;
  }
  if (sourceKinds.has("stress")) {
    weights.worry += 0.15;
  }
  if (sourceKinds.has("loneliness")) {
    weights.desire_shadow += 0.1;
  }

  // Clamp all to non-negative
  for (const key of RANDOM_THOUGHT_KINDS) {
    weights[key] = Math.max(0, weights[key]);
  }

  // Deterministic weighted selection
  const totalWeight = Object.values(weights).reduce((s, w) => s + w, 0);
  if (totalWeight <= 0) return "nothing";

  let roll = rng.next() * totalWeight;
  for (const kind of RANDOM_THOUGHT_KINDS) {
    roll -= weights[kind];
    if (roll <= 0) return kind;
  }

  return "nothing";
}

// ── Phrase Builder ───────────────────────────────────────────────────────

function buildPhrase(
  kind: RandomThoughtKind,
  sourceWords: string[],
  rng: SeededRandom,
  sources: RandomThoughtSource[]
): string {
  const templates = PHRASE_TEMPLATES[kind];
  if (!templates || templates.length === 0) return "nothing";

  const template = pickDeterministic(templates, rng);

  // Extract source labels for fillers
  const labels = sources.map((s) => s.label).filter(Boolean);

  // Fill template slots
  const result = template.replace(/\{(\w+)\}/g, (_match, slot: string) => {
    // Try to use a source word
    const words = sourceWords.length > 0 ? sourceWords : labels;
    if (words.length > 0) {
      return pickDeterministic(words, rng);
    }
    // Fall back to pre-defined fillers
    const fillers = FILLER_WORDS[slot] ?? ["something"];
    return pickDeterministic(fillers, rng);
  });

  return result;
}

// ── Context Helper ───────────────────────────────────────────────────────

/**
 * Build a RandomThoughtContext from character state.
 * Read-only — no state is ever modified.
 */
export function buildRandomThoughtContextFromCharacter(input: {
  state: CharacterPhysicsState;
  boredomState: BoredomExpansionState;
  energyFatigue: EnergyFatigueState;
  sleepWake: SleepWakeState;
  seed: string;
}): RandomThoughtContext {
  const { state, boredomState, energyFatigue, sleepWake, seed } = input;

  const lonelinessTolerance = clamp01(state.metaState.lonelinessTolerance);
  const loneliness = clamp01(1 - lonelinessTolerance);

  // sleepResidue: higher after recent sleep (still drowsy/waking phase)
  const sleepResidue = clamp01(
    sleepWake.phase === "waking" || sleepWake.phase === "drowsy"
      ? 0.6 + sleepWake.sleepQuality * 0.3
      : sleepWake.hoursAsleep > 0
        ? 0.3
        : sleepWake.hoursSinceSleep < 2
          ? 0.4
          : 0.1
  );

  return {
    seed,
    boredom: clamp01(boredomState.boredom),
    daydreamingTendency: clamp01(boredomState.daydreamingTendency),
    restlessness: clamp01(boredomState.restlessness),
    stressLoad: clamp01(state.boundary.stressLoad),
    loneliness,
    fatigue: clamp01(energyFatigue.fatigue),
    curiosity: clamp01(state.metaState.curiosity),
    sleepResidue,
  };
}
