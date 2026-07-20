# CharacterOS Hackathon Demo — Alex Evolution

This is an independent, local Hackathon surface for a 2–3 minute video. The browser calls `demo/server.ts`; that server keeps one ephemeral state in memory and directly invokes existing CharacterOS core modules. It never uses the repository's persistent state repositories or persistent Next.js write routes.

## Why this lives in `demo/`

The repository already contains a Next.js MindSpace 3D observer, an offline Explorer artifact, and persistent physics routes. This small page stays separate so it can use a disposable in-memory state without exposing a presentation surface to durable writes.

The local adapter calls the actual core sequence:

```text
parseExperienceEvent()
→ CharacterPhysicsEngine.processEvent()
→ MemoryNode / ImpactCluster / bounded coordinate drift
→ deriveCharacterState()
→ returned memory, coordinate, and decision DTO
```

The UI adds a read-only explanation layer on top of those returned DTOs: exact coordinate values, directional trend/meaning, the core impact score band, and an in-memory experience timeline. It never changes, scales, or replaces a core result.

## Start the demo

From the repository root:

```powershell
npx tsx demo/server.ts
```

Then open [http://localhost:4174](http://localhost:4174). Press `Ctrl+C` in that terminal to stop the local server.

No API key, database, or login is required. `tsx` is already included in this repository's development dependencies. To use another free port, set `CHARACTEROS_DEMO_PORT` before running the command.

## Video run of show (about 2 minutes)

1. **0:00–0:20 — Establish Alex.** Show the Character Card: Alex starts as a fresh, neutral in-memory CharacterOS state, with no processed experiences.
2. **0:20–0:35 — Introduce the event.** Read the prefilled event: “Alex's best friend betrayed him.”
3. **0:35–0:55 — Show choice and agency.** Use an **Example Experience** button to fill the field, or change the text yourself; neither action processes the event automatically.
4. **0:55–1:30 — Trigger and explain.** Click **Process Event**. The local adapter calls the real parser and physics engine, then the chain animates from event through memory, impact, and personality coordinate. Point out the exact per-coordinate deltas, the trend/meaning text, and the core-derived impact level.
5. **1:30–1:55 — Connect it to behavior.** Read the Before/After behavior cards. Emphasize that the presentation describes a causal path rather than a chatbot reply.
6. **1:55–2:10 — Close safely.** Show the “Demo boundary” note: this page is presentation-only; CharacterOS’s real engine and tests remain unchanged.

For a clean recording, use a 16:9 browser window around 1440 × 900, wait until the success panel settles, and use **Reset demo** to record another take.

## Scope boundary

- The server state is in memory only; stopping it resets Alex.
- The browser makes only same-origin calls to the local demo adapter.
- `demo/server.ts` imports CharacterOS core modules but does not modify them.
- The public Next.js `/physics/simulate` route is intentionally not used because its current repository path writes a state update.
- The parser is deterministic and rule-based by default. English keyword coverage is intentionally limited to the core's existing tag-normalization map; unmatched text may be classified as `general` and produce a small impact.
