# V10.0 Continuous Life Design Charter

**Date:** 2026-06-24  
**Status:** Design Charter — Implementation begins V10.1  
**Phase:** V10.0 — Continuous Life Design Charter

---

## 1. What V10 Is

V10 is the transition of CharacterOS from an **event-driven state transformation system** into a **single-character internal life simulation**.

### Core Proposition

> Characters should continue changing even when nobody is watching.

Prior to V10, CharacterOS characters only change when:
- An external event is processed (`processEvent`)
- A continuous tick is explicitly called (`runContinuousTick`)
- An editor patch is applied (`POST /editor/apply`)

V10 introduces the concept that a character has an **internal life** — a set of ongoing, slow, quiet processes that continue whether or not anyone is observing them.

### V10 in One Sentence

**Single-character internal life simulation, explicitly invoked, fully traced, never autonomous.**

---

## 2. What V10 Is NOT

This is the most important section of the charter. V10 must be bounded as clearly as V9 was.

| V10 is NOT | Why |
|---|---|
| AGI | No reasoning, no planning, no goal-directed behavior beyond existing personality dynamics |
| A multi-character system | Single character only. No NPCs, no social networks, no relationship graphs |
| A world simulation | No environment, no physics, no spatial model, no resource economy |
| A chatbot | No conversation generation, no dialogue, no user interaction loop |
| An autonomous agent loop | No background daemon, no scheduled tasks, no hidden mutation |
| A story generator | No plot, no narrative arc, no dramatic structure |
| A complex task agent | No tool use, no planning, no problem-solving |
| An LLM-powered system | No LLM calls for life tick, thoughts, dreams, or inspiration |
| Uncontrolled random mutation | All changes must be bounded, explained, and traceable |

### The Boundary

V10 simulates **what happens inside a person** during unobserved time — not what they DO in the world.

- ✅ Recovering from stress while alone
- ✅ Forgetting old memories gradually
- ✅ Becoming bored and daydreaming
- ✅ Having a random thought surface
- ✅ Feeling fatigue accumulate
- ✅ Sleeping and dreaming
- ✅ Getting a flash of inspiration
- ✅ Wanting something but not acting on it
- ✅ Healing slowly from past wounds
- ✅ Changing quietly over days and weeks

- ❌ Sending a message to someone
- ❌ Going to a place
- ❌ Starting a project
- ❌ Having a conversation
- ❌ Making a life decision
- ❌ Changing jobs, relationships, or identity
- ❌ Affecting any other character

---

## 3. Why V10 Is the Major Milestone

### The Progression

```
V3 Physics Core    → How does a character respond to one event?
V4 Homeostasis     → How does a character recover over time?
V5 Decomposition   → Can we observe internal subprocesses?
V6 Benchmark       → Can we measure character behavior?
V7 MindGraph       → Can we see character structure?
V8 Graph Export    → Can we share character structure?
V9 Editor          → Can we modify a character safely?
V10 Continuous Life → Can a character LIVE?
```

V3–V9 built the infrastructure. V10 asks the fundamental question:

**Does this system produce a character that feels alive, even when idle?**

### The Shift

| Dimension | V3–V9 | V10 |
|---|---|---|
| Time model | Discrete ticks + events | Continuous lived time |
| Change trigger | External (event, edit, manual tick) | Internal (fatigue, boredom, drift, sleep) |
| Observability | Trace after action | Trace after PASSAGE of time |
| Primary metaphor | Physics engine | Living organism |
| User role | Operator / Editor | Observer / Companion |

---

## 4. V10 and Existing Systems (V3–V9)

V10 does NOT replace any existing system. It builds ON TOP of them.

### Relationship Map

```
V3 Physics Core          → Provides state transformation primitives
                              ↑ V10 uses for internal event processing
                              
V4 Temporal Homeostasis  → Provides time-based regulation processes
                              ↑ V10 extends with sleep, fatigue, energy
                              
V5 Process Decomposition → Provides subprocess observability
                              ↑ V10 adds life tick subprocesses
                              
V6 Benchmark             → Provides regression measurement
                              ↑ V10 adds unobserved-time benchmarks
                              
V7 MindGraph             → Provides structure projection
                              ↑ V10 projects internal life onto graph
                              
V8 Graph Export          → Provides visibility
                              ↑ V10 exports life traces
                              
V9 Editor               → Provides controlled intervention
                              ↑ V10 coexists: edits happen IN a living character
                              
V10 Continuous Life     → Provides unobserved internal evolution
```

### What V10 Extends

| Existing System | V10 Extension |
|---|---|
| `runContinuousTick` (17-phase) | `runLifeTick` — a new entry point that wraps or extends the existing tick with life-specific phases |
| `BoredomState` / `updateBoredomForTick` | Expanded boredom: triggers internal events (thoughts, daydreams, restlessness actions) |
| `HomeostasisState` / `applyHomeostasis` | Extended with energy/fatigue model |
| `MetaState` (13 fields) | Life rhythm fields: `sleepTendency`, `fatigueSensitivity`, `ruminationTendency` |
| `BiologicalNature` (12 fields, static) | Potentially dynamic: slowly evolving nature over very long timescales |
| `InspirationSpark` (from boredom) | Expanded to `InternalEvent` system: thoughts, memories, inspirations, dreams |
| `ContinuousTickTrace` | `LifeTickTrace` — enriched with life-specific phase data |
| V9.6 `ExplanationTrace` | Life tick explanations: why this thought, why this dream, why this fatigue |

---

## 5. Core Concepts

### 5.1 Life Tick

A **Life Tick** is one slice of lived time for a single character.

**Distinction from Continuous Tick:**

| | Continuous Tick (V3–V5) | Life Tick (V10) |
|---|---|---|
| Primary purpose | Simulate N days of decay/recovery | Simulate one slice of lived experience |
| Time scale | Hours to years | Minutes to days |
| Focus | State maintenance | Internal experience |
| Output | Technical trace | Life experience trace |
| Invocation | Explicit API call | Explicit API call (same pattern) |

**Life Tick may include:**
- Passive recovery (existing homeostasis)
- Fatigue accumulation (new)
- Attention drift (new)
- Boredom growth (existing, expanded)
- Dream fragments (new — if asleep)
- Random thought generation (new)
- Inspiration chance (existing, expanded)
- Self-action candidates (new — candidates only, not execution)
- Memory resurfacing (new)
- Emotional settling (new)
- Quiet personality drift (new)

### 5.2 Observed vs Unobserved Time

CharacterOS must distinguish two modes of time:

| | Observed Time | Unobserved Time |
|---|---|---|
| Trigger | User event, edit, or explicit view | Life tick invoked explicitly |
| Character state | User sees current state | System computes internal changes |
| Output | API response with full state | Life tick trace with deltas |
| Invocation | User action | User or system invokes `runLifeTick` |

**Key principle:** Unobserved time is NOT a background process. It is explicitly invoked — just like continuous tick. The invocation could come from:
- A user clicking "Advance 3 days"
- An API call `POST /api/characters/[id]/life/tick`
- A scheduler that the USER controls (not the system)

The system never advances time on its own. The user is always the initiator.

### 5.3 Internal Events

Internal events are things that happen INSIDE the character, generated by the system, without external input.

**Initial catalog (V10.1–V10.9):**

| Internal Event | Trigger Condition | Output |
|---|---|---|
| `dream_fragment` | Sleep phase + memory salience | Fragment content, emotional tone, memory references |
| `random_thought` | Boredom + attention drift + time elapsed | Thought content, category, intensity |
| `memory_resurfacing` | Emotional state match + recency decay | Memory ID, trigger reason, emotional charge |
| `boredom_spike` | Low stimulation + high novelty need | Intensity, duration, exploration drive |
| `inspiration_flash` | Boredom creativePressure + curiosity | Type (reflection/exploration/creative/small_action), intensity |
| `fatigue_crash` | Energy depletion + sleep debt | Fatigue level, sleep urge, cognitive impairment |
| `loneliness_wave` | Low attachment satisfaction + time alone | Intensity, duration, social urge |
| `emotional_settling` | Time since last emotional event | Emotion decay, integration, scar formation |
| `quiet_realization` | Belief strength change + memory integration | Realization content, affected beliefs |

**Key constraint:** Internal events are DATA, not actions. They describe what happened inside the character, not what the character DOES.

### 5.4 Self-Generated Action Candidates

The character may generate action candidates — things it COULD do.

**BUT:**

- V10.1–V10.7: Candidates are **generated but not executed**
- Candidates are **explicitly labeled as unevaluated**
- The system never autonomously executes an action
- Action execution (if ever) requires a separate, explicit API call
- Candidates serve as **suggestions for authors**, not automated behavior

**Candidate types (draft):**

```
withdraw          — reduce social exposure
seek_comfort      — pursue familiar/comforting stimuli
explore           — seek novelty
rest              — sleep or reduce activity
ruminate          — revisit memories/beliefs
create            — generate something
reach_out         — initiate social contact (external — blocked in V10)
avoid             — evade a trigger
confront          — face a fear/challenge
```

**V10.0 position:** Define the candidate type. Do NOT implement execution. V10.8 will implement generation only.

### 5.5 Life Rhythm

Every character has a **life rhythm** — a set of traits that govern how they experience unobserved time.

These are NOT new top-level state fields. They are derived from existing systems or added as sub-fields of `MetaState` / `BiologicalNature`.

| Rhythm Trait | Source | Meaning |
|---|---|---|
| `sleepTendency` | MetaState + fatigue | How easily the character falls asleep |
| `fatigueSensitivity` | BiologicalNature + boundary | How quickly fatigue accumulates |
| `boredomTolerance` | MetaState.curiosity + rewardState | How much stimulation the character needs |
| `socialEnergy` | Personality.extroversion + boundary | How much social energy the character has |
| `ruminationTendency` | MetaState.emotionalSensitivity + neuroticism | How much the character revisits past events |
| `inspirationTendency` | BiologicalNature.imagination + boredomState | How likely the character is to have inspirations |
| `avoidanceTendency` | Personality.neuroticism + fear | How likely the character is to avoid rather than approach |

**Life rhythm is not scheduled.** It is computed each life tick based on current state. A character's rhythm changes as their state changes.

### 5.6 Energy / Fatigue

Energy and fatigue are new concepts for V10. They do not currently exist in CharacterOS.

**Energy model (draft):**

```
Energy is a derived value, not a stored field.
Computed each life tick from:
  - boundary.integrity (current resilience)
  - boundary.stressLoad (current burden)
  - rewardState.dopamineLevel (motivation energy)
  - homeostasisState.stabilitySetPoint (baseline stability)
  - MetaState.resilience (recovery capacity)

Fatigue accumulates when:
  - boundary.stressLoad is high
  - sleep debt exists
  - recovery has been insufficient
  - emotional events are recent and unprocessed

Fatigue decays when:
  - character sleeps
  - recovery time passes
  - stress load decreases
```

**Energy is NOT a resource to spend.** It is an **explanatory variable** — it explains why the character feels tired, why they want to sleep, why they can't focus, why their self-control is reduced.

### 5.7 Sleep / Dream

Sleep is a **phase of life**, not an action.

**Sleep entry:**
- Triggered when: fatigue > sleepTendency threshold AND time-of-day appropriate
- Sleep is a **state** the character enters, not an action they take
- During sleep: different internal processes run

**During sleep:**
- Fatigue decays (rapidly)
- Boundary recovers (enhanced rate)
- Emotional settling accelerates
- Memory consolidation occurs
- Dream fragments are generated

**Dream fragments:**
- Generated from: recent memories, emotional residues, belief tensions
- Content: images, emotions, memory fragments, symbolic content
- NOT: coherent narratives, prophecies, problem solutions
- Purpose: internal noise that reflects state, not plot device

**Sleep exit:**
- Triggered when: fatigue drops below threshold OR sufficient time elapsed
- Waking state: refreshed energy, potentially residual dream emotions

### 5.8 Boredom / Inspiration

V10 expands the existing `BoredomState` and `InspirationSpark` system.

**Current (V4.7):**
- `BoredomState`: boredomLevel, stimulationNeed, daydreamingTendency, creativePressure, restlessness
- `InspirationSpark`: type (reflection/exploration/creative_image/small_action), intensity, description
- Generated by `maybeCreateInspiration` inside `updateBoredomForTick`

**V10 expansion:**
- Boredom can trigger `random_thought` internal events (not just inspirations)
- Boredom interacts with `loneliness_wave` when attachment needs are unmet
- Boredom-generated restlessness can produce `selfActionCandidates`
- Inspiration can reference specific belief tensions or memory patterns

### 5.9 Random Thoughts

A random thought is an internal event without external trigger.

**Properties:**
- Generated probabilistically based on: boredom, attention drift, time elapsed, emotional state
- Content drawn from: recent memories, active beliefs, personality galaxy tension zones
- Intensity: low (background noise) to moderate (intrusive)
- NOT: coherent plans, decisions, or creative outputs

**Purpose:** Make the character feel like someone who has an inner monologue — not a strategic reasoner.

**Example random thoughts (not LLM-generated, template-based):**
- "Suddenly remembered [memory.tag]"
- "Felt a brief pang of [emotion]"
- "Wondered about [belief.subject]"
- "Noticed feeling [body state]"
- "Had an image of [cluster.category]"

### 5.10 Quiet Personality Drift

Over long periods of unobserved time, personality values drift very slowly.

**Drift model (draft):**
- Drift rate: ~0.001–0.005 per month (very slow)
- Direction: toward homeostasis setpoints, or toward attractor states from personality galaxy
- NOT: random walk, large shifts, or event-driven changes
- Purpose: reflect that people change slowly over time, even without major events

**Constraint:** Drift must be bounded. Personality cannot drift outside [0, 1]. Drift must be traceable and explainable.

---

## 6. Continuous Life Trace

Every life tick must produce a trace. Without trace, continuous life becomes a black box.

### LifeTickTrace (draft type)

```typescript
interface LifeTickTrace {
  // Identity
  tickId: string;
  characterId: string;
  
  // Time
  elapsedHours: number;
  tickPhase: "awake" | "falling_asleep" | "sleeping" | "waking" | "active" | "idle";
  
  // Energy & Fatigue
  energyBefore: number;
  energyAfter: number;
  fatigueBefore: number;
  fatigueAfter: number;
  
  // Mood snapshot (derived)
  moodBefore: {
    valence: number;      // positive/negative
    arousal: number;      // high/low energy
    stability: number;    // volatile/stable
  };
  moodAfter: {
    valence: number;
    arousal: number;
    stability: number;
  };
  
  // Generated internal events
  generatedInternalEvents: InternalEvent[];
  
  // Self-action candidates (not executed)
  selfActionCandidates: SelfActionCandidate[];
  
  // State changes (deltas only)
  stateChanges: LifeTickStateChange[];
  
  // Explanation
  explanation: ExplanationTrace | null;
  
  // Metadata
  createdAt: string;
  seedUsed: number;
}
```

### InternalEvent (draft type)

```typescript
interface InternalEvent {
  id: string;
  type: "dream_fragment" | "random_thought" | "memory_resurfacing" 
      | "boredom_spike" | "inspiration_flash" | "fatigue_crash"
      | "loneliness_wave" | "emotional_settling" | "quiet_realization";
  intensity: number;           // 0–1
  timestamp: string;
  content: InternalEventContent;
  triggeredBy: string[];       // state paths or conditions that triggered this
  affectedState: string[];     // state paths affected
}

interface InternalEventContent {
  summary: string;             // One-line description
  category?: string;           // Sub-category
  references?: {
    memoryIds?: string[];
    beliefIds?: string[];
    clusterIds?: string[];
  };
  emotionalTone?: {
    valence: number;
    arousal: number;
  };
}
```

### SelfActionCandidate (draft type)

```typescript
interface SelfActionCandidate {
  id: string;
  type: "withdraw" | "seek_comfort" | "explore" | "rest" 
      | "ruminate" | "create" | "reach_out" | "avoid" | "confront";
  intensity: number;           // 0–1
  reason: string;              // Why this candidate was generated
  sourceState: string[];       // State paths that influenced this candidate
  evaluated: false;            // Always false in V10 — never executed
}
```

### LifeRhythmProfile (draft type)

```typescript
interface LifeRhythmProfile {
  sleepTendency: number;         // 0–1
  fatigueSensitivity: number;    // 0–1
  boredomTolerance: number;      // 0–1
  socialEnergy: number;          // 0–1
  ruminationTendency: number;    // 0–1
  inspirationTendency: number;   // 0–1
  avoidanceTendency: number;     // 0–1
  computedAt: string;            // ISO timestamp of computation
}
```

---

## 7. Explainability in V10

V10 must be explainable from day one. The V9.6 explainability foundation provides the framework.

### Why Explainability Matters for Continuous Life

| Question | Explanation Scope |
|---|---|
| Why did this thought appear? | `random_thought` internal event |
| Why did this memory resurface? | `memory_resurfacing` internal event |
| Why did fatigue increase? | `fatigue_crash` internal event |
| Why was sleep entered? | `state_transition` to sleep phase |
| Why did boredom increase exploration? | `boredom_spike` + `behavior_bias` |
| Why did no action happen? | Empty `selfActionCandidates` array |
| Why did personality drift in this direction? | `state_transition` with drift factors |

### Integration with V9.6

V10 explanation traces use the same `ExplanationTrace` type from V9.6. New scopes:
- `"life_tick"` — overall life tick explanation (new, add to `ExplanationScope`)
- Existing scopes reused: `"state_transition"`, `"memory_activation"`, `"belief_evolution"`, `"behavior_bias"`

Each `InternalEvent` carries a mini-explanation: why this event, at this intensity, at this time.

---

## 8. Randomness & Determinism

All randomness in V10 must be **seeded and reproducible**.

### Seed Policy

- Every `runLifeTick` accepts an optional `seed: number`
- If no seed is provided, one is derived from `characterId + timestamp`
- All probabilistic decisions use the seed
- Same seed + same state → same life tick output

### What Can Be Random

- Which internal events fire (random thoughts, dream fragments)
- Content selection from memory/belief pools
- Intensity jitter on events
- Timing of event triggers within a tick

### What Must NOT Be Random

- State mutations (clamped, bounded, deterministic given events)
- Explanation content (template-based, deterministic given inputs)
- Trace structure (always the same shape)

---

## 10. V10 Phased Roadmap

### Phase Map

```
V10.0  Continuous Life Design Charter          ← THIS DOCUMENT
V10.1  Life Tick Types & Scheduler Model       ← Types, entry point, LifeTickRequest/Result
V10.2  Energy / Fatigue System                  ← Derived energy model, fatigue accumulation
V10.3  Sleep-Wake Cycle                         ← Sleep phase detection, sleep state, recovery
V10.4  Dream System Design                      ← Dream fragment generation, memory consolidation
V10.5  Boredom Expansion                        ← Expanded internal event generation
V10.6  Inspiration System                       ← Enhanced inspiration with belief/memory references
V10.7  Random Thought System                    ← Template-based thought generation
V10.8  Self-generated Action Candidates         ← Candidate generation only, no execution
V10.9  Continuous Life Trace                    ← Complete LifeTickTrace, explanation integration
V10.10 Continuous Living Stable Candidate       ← Full QA, benchmarks, 0 flaky, documentation
```

### Phase Dependencies

```
V10.0 ──┬── V10.1 ──┬── V10.2 ── V10.3 ── V10.4
         │           │
         │           ├── V10.5 ── V10.6
         │           │
         │           └── V10.7
         │
         └── V10.8 ── V10.9 ── V10.10
```

V10.2 (Energy/Fatigue) and V10.5 (Boredom) can proceed in parallel after V10.1.
V10.3 (Sleep) depends on V10.2 (Energy).
V10.4 (Dream) depends on V10.3 (Sleep).
V10.8 (Action Candidates) can start after V10.1 (scheduler model).
V10.9 (Life Trace) integrates all prior phases.
V10.10 is the stabilization gate.

### Each Phase Includes

1. Type definitions
2. Core functions (pure, deterministic)
3. Tests (unit + integration)
4. Explainability integration
5. Documentation update

---

## 11. API Surface (Future)

### Proposed Routes (V10.1+)

```
POST /api/characters/[characterId]/life/tick
  Request:  { hoursElapsed: number, seed?: number }
  Response: LifeTickTrace
  
GET  /api/characters/[characterId]/life/rhythm
  Response: LifeRhythmProfile
  
GET  /api/characters/[characterId]/life/state
  Response: Current energy, fatigue, sleep state, mood snapshot
```

### Explicit Non-API

```
NO POST /api/characters/[characterId]/life/execute-action
NO POST /api/characters/[characterId]/life/auto
NO GET  /api/characters/[characterId]/life/stream
NO background scheduling endpoints
NO daemon control endpoints
```

---

## 12. Benchmark Direction (V10.10+)

V10 will need benchmarks that verify:

| Benchmark | What It Verifies |
|---|---|
| `recovery_over_unobserved_time` | Boundary/healing improves with rest |
| `sleep_reduces_fatigue` | Fatigue drops during sleep phase |
| `dream_may_resurface_memories` | Dream fragments reference recent/emotional memories |
| `boredom_increases_exploration_tendency` | Low stimulation → higher exploration drive |
| `fatigue_reduces_self_control` | High fatigue → lower selfControl in state |
| `random_thoughts_remain_bounded` | Thought count proportional to elapsed time, not unbounded |
| `no_hidden_mutation` | Life tick only changes allowed paths |
| `seed_determinism` | Same seed + same state → same trace |
| `explanation_coverage` | Every internal event has an explanation reason |
| `personality_drift_is_slow` | Drift over 1 month < 0.05 per dimension |

---

## 13. Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Life tick becomes too complex | High | Start minimal (V10.1), add one system per phase |
| Uncontrolled state mutation | High | All mutations go through explicit paths, clamped, traced |
| Randomness makes testing impossible | High | Seeded RNG, deterministic given seed+state |
| System feels like a chatbot | Medium | No LLM, no dialogue generation, template-based content only |
| Internal events overwhelm state | Medium | Event count bounded by elapsed time, max events per tick |
| Self-action candidates look like agency | Medium | Always `evaluated: false`, documented as suggestions only |
| Performance degradation | Low | Life tick is explicit, not continuous; no real-time constraints |
| Scope creep into world simulation | Low | Explicit prohibition list in charter, reviewed each phase |

---

## 14. Explicitly Prohibited

These prohibitions are binding for all V10.x phases:

```
❌ No background daemon or scheduled loop
❌ No autonomous external action execution
❌ No LLM calls for life tick, thoughts, dreams, or inspiration
❌ No multi-character interactions
❌ No world simulation or environment model
❌ No story generation or narrative construction
❌ No hidden state mutation
❌ No mutation without trace
❌ No internal event without explanation
❌ No self-action candidate execution
❌ No personality change > 0.05 per dimension per month of unobserved time
❌ No character-to-character communication
❌ No persistent world state outside the character
```

---

## 15. Success Criteria for V10.0

V10.0 is complete when:

- [x] Complete Continuous Life Design Charter exists
- [x] V10 is clearly defined as NOT AGI / NOT agent loop
- [x] Life Tick is defined as explicitly invoked
- [x] Unobserved time design is documented
- [x] Internal events catalog is drafted
- [x] Self-action candidates are defined as unevaluated only
- [x] Trace and explainability requirements are specified
- [x] V10 phased roadmap exists (V10.1–V10.10)
- [x] Explicit prohibitions are listed
- [x] V3–V9 code behavior is unchanged (zero code changes in V10.0)
- [x] `npm run build` passes
- [x] `npm test` passes (98 files / 792 tests / 0 failures / 0 flaky)
- [x] `npm run next:build` passes (22 API routes)

---

## 16. Next Step: V10.1

**V10.1 — Life Tick Types & Scheduler Model**

V10.1 will implement:
1. `LifeTickRequest` / `LifeTickResult` / `LifeTickTrace` types in `src/core/life/`
2. `LifeRhythmProfile` type and computation function
3. `EnergyState` derived computation (no stored energy field)
4. `runLifeTick()` entry point — skeleton that calls existing `runContinuousTick` and adds life-specific phases
5. `POST /api/characters/[characterId]/life/tick` route
6. Tests for the new types and the life tick skeleton
7. No new behavior yet — V10.1 is scaffolding only

---

## 17. Philosophy

V10 is the heart of CharacterOS.

V3 taught characters to respond.  
V4 taught them to recover.  
V5 taught us to observe their processes.  
V6 taught us to measure them.  
V7 taught us to see their structure.  
V8 taught us to share what we see.  
V9 taught us to touch them carefully.

V10 asks: **Do they live?**

But living is not doing.  
Living is: sleeping, waiting, forgetting, healing, being bored, thinking of nothing, remembering suddenly, wanting but not acting, changing quietly.

A person continues becoming themselves even when nobody is watching.  
So should a character.

---

**V10.0 Complete.** Design Charter. Zero code changes. Ready for V10.1.
