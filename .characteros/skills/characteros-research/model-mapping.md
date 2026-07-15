# CharacterOS Research-To-Model Mapping

## Mapping Table

| Evidence target | CharacterOS location | Required guard |
|---|---|---|
| Event appraisal | ParsedExperienceEvent / impact calibration | Confidence bounds and source evidence |
| Episodic persistence | MemoryNode / ImpactCluster | Decay, retrieval, repetition, contamination checks |
| Acute expression | Emotion, boundary, energy, transient state | Must not become durable trait directly |
| Long-term change | Personality drift, evidence accumulator, consolidation | Slow channel, saturation, recovery, uncertainty |
| Learned interpretation | Belief assimilation | Competing evidence and traceable sources |
| Motivation | NeedDeficiency / DesireState | Derived, context-sensitive, not independent truth |
| Behavior selection | Decision influence / candidate surface | Scenario relevance and structured grounding |
| Explanation | Trace and read model | Cite actual deltas; never create causes |

## Trait-State Separation

Map research claims to one of these layers before proposing code:

1. long-term trait baseline;
2. transient state expression;
3. state distribution over time;
4. context-specific profile;
5. plasticity, attractor strength, consolidation, and uncertainty.

Reject proposals that use fatigue, one event, or one emotion as an immediate permanent trait rewrite.

## Temporal Mapping

Specify:

- event occurrence time;
- elapsed-time decay or recovery;
- repetition window;
- consolidation delay;
- saturation behavior;
- out-of-order policy;
- replay identity and engine semantics version.

If the evidence does not establish a timescale, classify the timescale as an engineering heuristic and test a range.

## Decision Mapping

Do not assume every state delta affects every scenario. Define relevance between evidence channels and scenario domains. A valid proposal states which candidate scores or strategy weights should move, which should remain stable, and why.

Top-decision stability is acceptable when the underlying candidate surface changes in a grounded, proportionate way.

## Migration Path

Use this order for new scientific dynamics:

1. DTO and trace contract;
2. read-only shadow computation;
3. golden trajectories and counterfactual audit;
4. sensitivity and parameter-range analysis;
5. comparison against current behavior;
6. versioned opt-in decision integration;
7. rollback and replay verification;
8. release gate only after independent review.

Do not replace current production behavior directly from a research note.
