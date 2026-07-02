# Mind Galaxy Static Artifact

## What is this?

This is a self-contained, offline snapshot of a CharacterOS Mind Galaxy view.
It visualizes the personality structure of character **"lin_fan"** as a
zoomable nebula-like galaxy.

**It is an observation instrument, not a product.**

## How to open

Open `index.html` in any modern desktop browser (Chrome, Firefox, Edge, Safari).
No server required. No internet connection needed.

## What's included

| File | Purpose |
|------|---------|
| index.html | Self-contained viewer with embedded data |
| mind-galaxy-preview.js | Canvas 2D rendering engine |
| mind-galaxy-real-data.json | Raw preview data (standalone JSON) |
| manifest.json | Metadata and integrity summary |
| README.md | This file |

## What is NOT included

- No CharacterPhysicsState raw dump
- No full memory contents
- No personality coordinate internals
- No cluster Map entries
- No procedural routines payload
- No write/edit/save capability
- No API endpoints
- No server dependency
- No WebGL / Three.js / 3D

## How to use

- **Scroll** to zoom in/out
- **Drag** to pan
- **Click L0-L4** to jump to zoom levels
- **Pause** to freeze drift animation
- **Motion** to toggle reduced motion
- **Drift** to switch subtle/visible drift mode
- **Real/Fixture** to toggle data source
- **Debug** to inspect scale, visible counts, time sampling, and snapshot summaries
- **Freeze Time / Step** to inspect deterministic drift frames without changing state
- **Presets** to jump between Outer Nebula, Memory Field, and Drift Inspect views

## How to regenerate

```bash
npx tsx scripts/export-mind-galaxy-static-artifact.ts
```

This requires a CharacterOS development environment.

## Current limitations

- Desktop-first (mouse wheel + drag)
- Canvas 2D only (no WebGL)
- Static snapshot — does not update with character state changes
- Single character only
- 40 nodes, 48 edges

## Version

Artifact v10.50.0
Data contract v10.47.0
