# TypeScript Core Migration

CharacterOS is moving toward a TypeScript-first product architecture.

The existing Python implementation remains valuable as:

- a prototype
- an algorithm experiment space
- a behavior reference
- a benchmark source

The main product direction is:

```text
TypeScript Core
↓
Next.js / React UI
↓
API Routes
↓
SQLite / PostgreSQL + Prisma
↓
LLMProvider abstraction
```

## Rule

Do not delete the Python prototype.

Do not rewrite the whole project.

Migrate gradually:

```text
Python prototype
↓
TypeScript core equivalent
↓
Tests
↓
Adapter
↓
UI/API/database integration
```

## Current TS Core

Implemented under:

```text
src/core/
```

Current modules:

```text
benchmark/
personality/
event/
emotion/
memory/
cluster/
drift/
physics/
simulation/
demo/
```

Current capabilities:

- personality coordinate space
- impact_score benchmark
- EventImpactVector
- EmotionState
- MemoryNode generation
- Memory decay
- ImpactParticle
- ImpactCluster with 9D center coordinate
- Coordinate drift from cluster gravity
- repeated-event simulation

## Commands

Install dependencies:

```bash
npm install
```

Type-check:

```bash
npm run build
```

Test:

```bash
npm test
```

Single-event demo:

```bash
npm run demo:physics
```

Repeated-event simulation:

```bash
npm run demo:simulation
```

## Next Migration Step

The first adapter layer is now available:

```text
src/services/
  characterPhysicsService.ts
```

It exposes stable application methods:

```text
processEvent(characterId, event)
simulateEvents(characterId, events)
getCharacterPhysicsState(characterId)
resetCharacter(characterId)
```

It currently uses in-memory state. Later it can persist through Prisma.

## Next Migration Step

Add a repository interface:

```text
src/db/repositories/characterPhysicsRepository.ts
```

The service now depends on the repository interface rather than on a raw Map.
The first implementation is in-memory; Prisma can replace it later.

Current files:

```text
src/db/repositories/characterPhysicsRepository.ts
src/services/characterPhysicsService.ts
```

## Next Migration Step

Add serialization helpers for `CharacterPhysicsState`.

Why:

- API responses need JSON-safe state.
- Prisma storage needs serializable state.
- Browser UI should not receive class instances or Map objects.

Target:

```text
src/core/physics/serialization.ts
```

Current status:

```text
serializeCharacterPhysicsState(state)
deserializeCharacterPhysicsState(serialized)
```

The state can now roundtrip through JSON safely.

## Next Migration Step

Define API DTOs before adding Next.js:

```text
src/appContracts/characterPhysics.ts
```

This keeps API boundaries stable before we choose route handlers, Prisma models,
or UI components.
