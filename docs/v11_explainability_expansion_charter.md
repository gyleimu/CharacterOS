# V11 Explainability Expansion Charter

**Date:** 2026-06-24
**Phase:** V11.0 — Design Charter (No Implementation)
**Status:** ✓ Complete — Roadmap Defined

---

## 1. Executive Summary

V11 expands CharacterOS from "state can be inspected" to "state changes can be explained."

V10 established continuous internal life. A character can now live through hours of simulated time — energy depleting, sleep pressure rising, dreams forming, boredom expanding, thoughts drifting, action tendencies surfacing. But the system cannot yet answer the most important debugging question:

> **Why did this happen?**

V11 builds the explainability layer that answers that question — deterministically, trace-backed, without LLM, without narrative prose, without subjective psychology claims.

This is a **developer-oriented** explainability system. It is not a chatbot explaining itself to a user. It is not therapy language. It is not a narrator describing a character's inner world. It is a transparent causal map from input signals to output events.

---

## 2. Why V11 Now

V10 added 7 continuous life subsystems. Each one reads multiple signals and produces structured output. The chain is:

```
CharacterPhysicsState
  → energy/fatigue projection
    → sleep/wake projection
      → dream fragment
    → boredom expansion → inspiration seeds
      → random thought
        → self-action candidates
```

Without explainability, debugging this chain requires reading raw state diffs and trace objects. With explainability, every subsystem can produce a structured explanation of *which signals dominated, which were suppressed, and why the output took the shape it did.*

V11 must come **before** long-horizon simulation (V13) and runtime behavior (V14) because:

- Multi-tick chains amplify small signal effects — without explanations, debugging divergences is impractical
- Persistence decisions (V10.9) already track what was applied/skipped — but not *why* those domains were skipped
- API exposure (V12) should serve explanations alongside results — not just raw projections

---

## 3. Existing Foundation (V9.6)

### What exists

| Module | Purpose |
|---|---|
| `explanationTypes.ts` | `ExplanationScope`, `ExplanationTrace`, `ExplanationReason`, `ExplanationFact`, `DecisionTrace` |
| `patchExplanation.ts` | Explains parameter adjustment patches |
| `stateTransitionExplanation.ts` | Explains state transitions |

### Existing scopes (10)

```
patch | decision | memory_activation | cluster_influence |
belief_evolution | need_change | desire_change |
behavior_bias | state_transition | integrity_policy
```

### What the existing foundation does NOT explain

| V10 Domain | Gap |
|---|---|
| Dream fragment generation | Source selection rationale, tone causation, symbol extraction |
| Boredom expansion | Why boredom/restlessness/daydreaming/exploration/irritability changed |
| Inspiration seeds | Why a seed appeared, which signals dominated probability |
| Random thought generation | Why a specific kind was selected, source→kind mapping |
| Self-action candidates | Why a candidate scored high/low, why it was suppressed |
| Life tick dry-run | Phase-level causation chain — which earlier phase fed which later output |
| Persistence decisions | Why a domain was applied vs skipped, schema-level explanations |

### Existing foundation issues found during audit

| Issue | Severity | Fix in V11 |
|---|---|---|
| `createTraceId()` uses `Date.now()` + `Math.random()` | Medium | V11.x — seed-based deterministic ID generation |
| `ExplanationScope` missing life scopes | Required | V11.1 — add 7 new life scopes |
| No signal dominance/suppression model | Gap | V11.1 — add `ExplanationSignal` type |
| No confidence model for life events | Gap | V11.1 — extend confidence to life domains |

---

## 4. Explanation Scopes

### New V11 life scopes (7)

```typescript
type LifeExplanationScope =
  | "energy_fatigue"        // Why energy/fatigue/sleepPressure changed
  | "sleep_wake"             // Why sleep phase transitioned
  | "dream_fragment"         // Why this dream formed (tone, clarity, symbols)
  | "boredom_expansion"      // Why boredom/restlessness/etc. changed
  | "inspiration_seed"       // Why this seed candidate appeared
  | "random_thought"         // Why this thought kind/phrase was generated
  | "self_action_candidate"  // Why this candidate scored as it did
  | "life_tick"              // Aggregate: why the full tick produced these outputs
  | "life_persistence"       // Why changes were applied or skipped
```

### Scope Mapping: Signal → Explanation

| Scope | Inputs to explain | Dominant signal | Suppressed signal | Output |
|---|---|---|---|---|
| `energy_fatigue` | stressLoad, selfControl, resilience, elapsedHours, isResting | fatigue/sleepPressure delta direction | recovery blocked by stress | delta values |
| `sleep_wake` | sleepPressure, fatigue, circadianDrive, energy, stressLoad | sleep readiness components | stress suppressing quality | phase transition |
| `dream_fragment` | sleepPhase, sleepQuality, stress, fatigue, loneliness, memory sources | tone determinants | why no dream (awake/no sources) | fragment or null |
| `boredom_expansion` | stimulation, socialContact, energy, fatigue, curiosity, stress | boredom growth drivers | fatigue suppression | 5-dimension delta |
| `inspiration_seed` | daydreaming, explorationPressure, curiosity, dreamFragment, memoryCount | seed type rationale | irritability penalty | candidate list |
| `random_thought` | boredom, daydreaming, stress, loneliness, fatigue, curiosity, sources | kind selection weights | low pressure → nothing | thought or nothing |
| `self_action_candidate` | all projected states, random thought, inspiration seeds | strength contributors | friction sources, sleep suppression | ranked candidates |
| `life_tick` | all phase traces | phase chain causation | skipped phases | full trace |
| `life_persistence` | dry-run result, commit options, schema shape | applied change rationale | schema gap explanation | changes + skipped |

---

## 5. Explanation Contract

### Proposed shared type

```typescript
interface LifeExplanationTrace {
  id: string;
  scope: LifeExplanationScope;
  /** ID of the target event being explained (dream ID, thought ID, etc.) */
  targetId?: string;
  /** One-sentence summary of what happened and why. */
  summary: string;
  /** Ordered reasons — most important first. */
  reasons: ExplanationReason[];
  /** All facts referenced. */
  facts: ExplanationFact[];
  /** Signals that most strongly influenced the output. */
  dominantSignals: ExplanationSignal[];
  /** Signals present but overridden or dampened. */
  suppressedSignals: ExplanationSignal[];
  /** IDs of upstream traces this explanation depends on. */
  sourceTraceIds: string[];
  /** [0,1] — how confident the system is in this explanation. */
  confidence: number;
  /** Standalone warnings. */
  warnings: string[];
  /** ISO timestamp. */
  createdAt: string;
}

interface ExplanationSignal {
  /** Signal name (e.g. "stressLoad", "fatigue", "sleepPressure"). */
  name: string;
  /** [0,1] — normalized strength of this signal's influence. */
  strength: number;
  /** What this signal contributed to. */
  contributedTo: string;
  /** Was this signal dominant or suppressed? */
  role: "dominant" | "suppressed" | "neutral";
}
```

### Contract principles

1. **Every explanation must cite trace facts** — no free-floating reasons
2. **Confidence must be computable** — not subjective; derived from signal strength and source count
3. **"Unknown" is a valid answer** — if signal pressure is too low, say so
4. **"Not enough signal" is valid** — better than fabricating causation
5. **Dominant + suppressed signals must both be listed** — transparency over completeness

---

## 6. Explanation Style Guide

### Explanations should be:

| Quality | Example |
|---|---|
| **Deterministic** | Same inputs → same explanation text |
| **Short** | One sentence per reason; 2–4 reasons per scope |
| **Developer-readable** | References field names, values, thresholds |
| **Trace-backed** | Every reason cites a fact from the subsystem trace |
| **Non-anthropomorphic** | "Sleep pressure exceeded 0.7" not "the character felt exhausted" |
| **Allowed to say "unknown"** | "Insufficient signal to determine dominant driver" |
| **Allowed to say "not enough signal"** | "No sources available — fragment not generated" |

### Explanations should NOT be:

| Anti-pattern | Why |
|---|---|
| Poetic narration | Not a story; not a narrator |
| Therapy language | No "processing emotions" or "inner child" |
| LLM-written prose | Must be template-based, deterministic |
| Moral judgment | No "good/bad decision" framing |
| Fabricated causal certainty | If signal delta is 0.001, don't claim it was decisive |

### Template example (dream fragment)

```
Summary:
  "Dream fragment generated: tone='anxious', clarity=0.35.
   Dominant driver: stressLoad (0.82). Suppressed: sleepQuality (0.25)."

Reasons:
  1. "stressLoad=0.82 strongly weighted anxious (+0.29) and threatening (+0.25) tones."
  2. "sleepQuality=0.25 reduced clarity by 0.15 and penalized calm/warm tones."
  3. "5 sources selected — top source 'memory: rain on window' (weight=0.72)."
  4. "fatigue=0.55 contributed to fragmented/unclear tone weighting."

Dominant signals:  [stressLoad: 0.82, topSourceWeight: 0.72]
Suppressed signals: [sleepQuality: 0.25, calm tone weight: 0.02]
Confidence: 0.78
```

---

## 7. Module Roadmap

### V11.1 — Life Explanation Types & Helpers

**Goal:** Extend `ExplanationScope` with life scopes. Add `ExplanationSignal` type. Add deterministic ID generation. Add `LifeExplanationTrace` type.

**Deliverables:**
- Extend `src/core/explainability/explanationTypes.ts`
- Add `src/core/explainability/lifeExplanationHelpers.ts`
- `tests/core/explainability/lifeExplanationTypes.test.ts`

**No changes to V10 mechanics.**

---

### V11.2 — Dream Explanation

**Goal:** Explain dream fragment generation.

**What it explains:**
- Why a dream was or was not generated (sleep phase, source availability)
- Why this tone was selected (stress → anxious, loneliness → lonely, etc.)
- Why clarity is at this level (sleepQuality +, stress/fatigue −)
- Why these symbols appeared (source label extraction)
- Which sources dominated the dream content

---

### V11.3 — Boredom & Inspiration Explanation

**Goal:** Explain boredom expansion delta and inspiration seed generation.

**What it explains:**
- Why boredom increased/decreased (stimulation deficit, social deficit, energy gate, fatigue suppression)
- Why restlessness changed (boredom × energy link)
- Why daydreaming changed (optimal boredom range, sleep quality, stress block)
- Why exploration pressure changed (boredom × curiosity)
- Why irritability changed (boredom × fatigue/stress)
- Why each inspiration seed appeared (daydreaming → creative, exploration → reframing, dream → residue)
- Why seed probabilities are low (irritability penalty, low signal strength)

---

### V11.4 — Random Thought Explanation

**Goal:** Explain random thought generation.

**What it explains:**
- Why generation pressure is high/low (boredom, daydreaming, restlessness, sources)
- Why this kind was selected (stress → worry, loneliness → desire_shadow, memory source → memory_echo)
- Why clarity is at this level (curiosity/daydreaming +, fatigue/stress −)
- Why this phrase was generated (template selection, source word extraction)
- Why action potential is at this level (kind-dependent heuristic)
- Why "nothing" was generated (low pressure or no sources)

---

### V11.5 — Self-Action Candidate Explanation

**Goal:** Explain candidate scoring and suppression.

**What it explains:**
- Why this candidate has this strength (per-type signal contributors)
- Why friction is high (sleep phase, fatigue, self-control)
- Why this candidate was suppressed (score below threshold, sleep phase)
- Why the top candidate is ranked first (comparative score breakdown)
- Why certain candidate types didn't appear (no relevant signals)

---

### V11.6 — Life Tick Explanation

**Goal:** Aggregate all phase explanations into one trace-level explanation.

**What it explains:**
- The full causal chain: phase A output → phase B input
- Which phases had the largest effect on the final projected state
- Where signal propagation broke (e.g., dream not generated → no dream residue in inspiration)
- Warnings propagated from subsystems

---

### V11.7 — Persistence Explanation

**Goal:** Explain commit decisions.

**What it explains:**
- Why a change was applied (option enabled + source data present)
- Why a change was skipped (option disabled, or schema field missing)
- Why energy/sleep/boredom cannot be persisted (schema gap)
- Why `maxGeneratedMemories` capped certain seeds
- Why self-action candidates were stored as trace seeds, not executed

---

### V11.8 — Explainability QA & Governance

**Goal:** Audit the complete V11 explainability system.

**Checks:**
- Every explanation is deterministic (same inputs → same text)
- Zero LLM usage
- Zero prose/narrative generation
- All explanation facts trace back to subsystem trace data
- Confidence scores are computable from signal strengths
- "Unknown" and "not enough signal" appear where appropriate
- No explanation overclaims causality
- Template text does not drift from subsystem logic

---

## 8. Integration Boundaries

### V11 MUST NOT:

| Prohibited | Reason |
|---|---|
| Change V10 mechanics | Explanations observe; they do not influence |
| Change scoring outputs | Same numbers, now with reasons |
| Change persistence policy | Same applied/skipped, now explained |
| Add UI | Future concern |
| Add API | V12 concern |
| Generate narrative prose | Template-based only |
| Execute behavior | Explainability is passive |
| Use LLM | Deterministic templates only |

### V11 reads from:

| Source | What it reads |
|---|---|
| Subsystem traces | `EnergyFatigueTrace`, `SleepWakeTrace`, `DreamTrace`, etc. |
| `LifeTickTrace` | Phase traces, reasons, warnings |
| `LifeTickCommitResult` | Changes, skipped, reasons |
| `CharacterPhysicsState` | Input signals (read-only, as before) |

### V11 writes to:

| Destination | What it writes |
|---|---|
| `LifeExplanationTrace` | Structured explanation object |
| (Future) `LifeTickTrace.explanations` | Optional explanation field on trace |

---

## 9. Risk Register

| Risk | Severity | Mitigation |
|---|---|---|
| Explanations overclaim causality | High | Every reason cites a fact; confidence scores; "unknown" allowed |
| Explanations drift from real logic | High | Template text derived from actual scoring/delta code paths; tests verify |
| Too much prose hides signals | Medium | Short sentences; signal tables; developer-oriented language |
| Template text becomes misleading if mechanics change | Medium | Explanation tests coupled to subsystem tests; V11.8 audit gate |
| Future UI treats explanation as "truth" | Medium | Confidence scores; warnings field; "unknown" as valid output |
| Tests snapshot brittle exact text | Low | Test structural fields (signals, confidence, fact presence) over exact prose |
| `Date.now()`/`Math.random()` in existing ID generation | Medium | V11.1 — migrate to seeded deterministic IDs |

---

## 10. Success Criteria

V11 is successful when:

1. ✅ Every V10 life subsystem (energy, sleep, dream, boredom, inspiration, thought, candidates) has deterministic explanation coverage
2. ✅ Every explanation is trace-backed — facts cite actual trace data
3. ✅ No LLM involved — all explanations are template-generated
4. ✅ No V10 mechanics changed — explanations are read-only observers
5. ✅ Developers can trace: "this dream was anxious because stress=0.82, and these 3 memories were the top sources"
6. ✅ Persistence decisions are explainable: "energy write skipped because no lifeState field exists"
7. ✅ Tests verify explanation structure and key reason codes — not brittle exact prose
8. ✅ Confidence scores are meaningful and computable
9. ✅ "Unknown" / "not enough signal" explanations exist and are tested

---

## 11. Relationship to Future Versions

```
V10: Continuous Life (stable)         ← Internal life mechanics
V11: Explainability Expansion         ← THIS PHASE: transparent外壳
V12: Controlled Life Dry-run API      ← Expose dry-run via API
V13: Long Horizon Simulation          ← Multi-tick chains
V14: Continuous Living Runtime        ← Controlled background behavior
```

### Why V11 before V12–V14:

- **V12 API**: Serving raw projections without explanations would make the API a black box. `POST /life/dry-run` should return both projection AND explanation.
- **V13 Long Horizon**: Multi-tick chains over days/weeks require debugging. Without per-tick explanations, divergences are untraceable.
- **V14 Runtime**: Background behavior without explainability is unobservable — the system would change state with no way to audit why.

**V11 is the transparency layer that makes V12–V14 debuggable, auditable, and trustworthy.**

---

## 12. Final Statement

> CharacterOS should not only live quietly; it should be able to show *why* its quiet life changed.

V10 built the life. V11 builds the transparent外壳 around it — not a narrator, not a therapist, not a storyteller. A causal map that lets developers see:

- Which signals grew into a dream
- Which pressures shaped a thought
- Which drives pushed a candidate forward
- Which gates held a candidate back
- Which schema gaps prevented persistence

Every dream, every thought, every candidate impulse — traceable to its roots.

Not "the character felt sad so they dreamed of rain."

But: `loneliness=0.72, stressLoad=0.58, memory source "rain on window" weight=0.81 → dream tone="lonely", clarity=0.42.`

That is the V11 explainability contract.

---

## Verification

```
npm run build       ✓ (tsc --noEmit)
npm test            ✓ 110 files / 1151 tests / 0 failures / 0 flaky
npm run next:build  ✓ 22 API routes
```

**Code changes: none.** This is a design charter only.

**V11 roadmap: 8 phases defined (V11.1–V11.8). No implementation yet.**

---

## Summary

| Item | Value |
|---|---|
| File added | `docs/v11_explainability_expansion_charter.md` |
| Code changes | None |
| New explanation scopes defined | 8 (energy, sleep, dream, boredom, inspiration, thought, candidate, tick, persistence) |
| V11 phases | 8 (types → dream → boredom → thought → candidate → tick → persistence → QA) |
| Contract proposed | `LifeExplanationTrace` with signal dominance/suppression model |
| Risks identified | 7, all with mitigations |
| Next recommended version | V11.1 — Life Explanation Types & Helpers |
