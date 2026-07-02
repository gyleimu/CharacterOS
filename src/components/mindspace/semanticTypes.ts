/**
 * semanticTypes.ts — CharacterOS Semantic MindSpace Data Model
 *
 * Every visual element in the 3D scene maps to a real psychological object.
 * No decorative particles. No fake data.
 *
 * Structure:
 *   Character → Factors → Memories / Beliefs / Needs → Behaviors
 *
 * ViewMode controls which layers are visible.
 */

// ═══════════════════════════════════════════════════════════════════════════
// View Mode & Selection
// ═══════════════════════════════════════════════════════════════════════════

export type ViewMode =
  | "overview"
  | "factorDomain"
  | "focusCore"
  | "focusFactor"
  | "focusMemory"
  | "behaviorPreview";

export interface SelectedTarget {
  type: "core" | "factor" | "memory" | "belief" | "need" | "behavior";
  id: string;
  /** Optional: parent factor ID for context */
  parentFactorId?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Character Core
// ═══════════════════════════════════════════════════════════════════════════

export interface SemanticCharacter {
  id: string;
  name: string;
  currentState: string;
  emotionalTone: string;
  dominantFactorIds: string[];
  summary: string;
  /** 3D position */
  position: [number, number, number];
  particleCount: number;
  color: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Impact Factor
// ═══════════════════════════════════════════════════════════════════════════

export type FactorLayer = "inner" | "middle" | "outer";

export interface SemanticFactor {
  id: string;
  name: string;
  zhName: string;
  layer: FactorLayer;
  strength: number;       // 0-1
  activation: number;      // 0-1
  decay: number;           // 0-1
  distance: number;        // from core
  disturbance: number;     // 0-1, how unstable
  color: string;
  accentColor: string;
  description: string;
  lowAnchor: string;
  highAnchor: string;
  explanation: string;     // 自然语言解释
  /** 3D position */
  position: [number, number, number];
  /** Particle config */
  coreParticleCount: number;
  haloParticleCount: number;
  coreRadius: number;
  haloSpread: number;
  /** Related object IDs */
  memoryIds: string[];
  beliefIds: string[];
  needIds: string[];
  behaviorIds: string[];
  /** Labels for inspector */
  influenceTags: string[];
  /** Trace steps */
  traceEvent: string;
  traceBelief: string;
  traceNeed: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Memory
// ═══════════════════════════════════════════════════════════════════════════

export interface SemanticMemory {
  id: string;
  summary: string;
  emotion: string;
  valence: number;       // -1 to 1
  factorId: string;
  activation: number;    // 0-1
  timestamp: string;     // ISO or age description
  /** 3D position (relative to factor center) */
  offset: [number, number, number];
  color: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Belief
// ═══════════════════════════════════════════════════════════════════════════

export interface SemanticBelief {
  id: string;
  text: string;
  strength: number;      // 0-1
  sourceMemoryIds: string[];
  factorId: string;
  /** 3D position */
  position: [number, number, number];
  color: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Need
// ═══════════════════════════════════════════════════════════════════════════

export interface SemanticNeed {
  id: string;
  name: string;
  zhName: string;
  deficiency: number;    // 0-1
  urgency: number;       // 0-1
  factorId: string;
  /** 3D position */
  position: [number, number, number];
  color: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Behavior
// ═══════════════════════════════════════════════════════════════════════════

export interface SemanticBehavior {
  id: string;
  name: string;
  zhName: string;
  probability: number;   // 0-1
  reason: string;
  sourceFactorIds: string[];
  /** 3D position */
  position: [number, number, number];
  color: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Unified Mind Data
// ═══════════════════════════════════════════════════════════════════════════

export interface SemanticMindData {
  character: SemanticCharacter;
  factors: SemanticFactor[];
  memories: SemanticMemory[];
  beliefs: SemanticBelief[];
  needs: SemanticNeed[];
  behaviors: SemanticBehavior[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Activation Trace Step
// ═══════════════════════════════════════════════════════════════════════════

export interface TraceStep {
  key: string;
  label: string;
  detail: string;
  targetId?: string | undefined;
  targetType?: string | undefined;
}

export interface FactorTrace {
  factorId: string;
  steps: TraceStep[];
}
