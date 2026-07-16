# CharacterOS Research Method

## Question Template

Define the research target before collecting sources:

- construct: trait, transient state, memory, belief, need, emotion, boundary, recovery, or decision;
- timescale: immediate, within-day, repeated episode, longitudinal, or durable consolidation;
- context: relationship, achievement, social, fatigue, safety, or general;
- baseline differences: sensitivity, recovery, stability, plasticity, and prior evidence;
- desired output: qualitative direction, model structure, calibration range, or evaluation method;
- non-claim: what the result must not be interpreted as proving.

## Search Strategy

1. Start with systematic reviews or meta-analyses to map the field.
2. Read the primary studies that establish the mechanism, measurement, or longitudinal effect.
3. Prefer preregistered, replicated, longitudinal, intensive-longitudinal, or validated-measure evidence when available.
4. Check retractions, corrections, sample limitations, and conflicting results.
5. For software or standards, use current official documentation and the repository's pinned version.

For technical questions, rely on primary sources. Use secondary material only to discover primary sources or explain context.

## Extraction Table

For each source record:

| Field | Required content |
|---|---|
| Construct | What was actually measured |
| Design | Experimental, longitudinal, cross-sectional, meta-analysis, or simulation |
| Population | Sample and transfer limits |
| Timescale | Observation and follow-up interval |
| Effect | Direction, magnitude, uncertainty, and heterogeneity |
| Mechanism | Supported mechanism versus author interpretation |
| Relevance | Which CharacterOS channel or audit it may inform |
| Limitation | Why it may not transfer directly |

## Synthesis Rules

- Reconcile contradictory sources rather than selecting the most convenient one.
- Preserve uncertainty and heterogeneity.
- Distinguish statistical significance from practical effect size.
- Separate measurement reliability from model validity.
- Identify whether evidence supports a direction, a functional form, a timescale, or only a broad concept.

## Experiment Design

Every proposed model change should include:

- baseline and counterfactual trajectories;
- neutral and irrelevant controls;
- same event across different personalities;
- repeated positive and negative events;
- recovery and idle-time behavior;
- saturation and no-one-step-flip limits;
- decision relevance and non-relevance cases;
- deterministic replay and ordering cases;
- uncertainty and confidence outputs;
- criteria that would reject the hypothesis.

Prefer shadow mode and versioned parameters before changing production decision inputs.
