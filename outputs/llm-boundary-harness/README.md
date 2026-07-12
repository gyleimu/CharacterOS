# CharacterOS LLM Boundary Harness

Offline audit artifact for the language realization boundary.

## Open

Open `index.html` directly. No server, API key, network, or real LLM is required.

## Pipeline

`AgentReplyPlan -> Safe Prompt -> Mock Provider -> Output Validation -> Grounding Check -> Reply or Deterministic Fallback`

## Safety Boundary

- Mock provider only
- No network
- No CharacterPhysicsState access
- No mutation or writeback authority
- Diagnosis and unsupported claims are blocked
- Every delivered reply is validated and grounded again

This is simulation output, not medical or psychological diagnosis.
