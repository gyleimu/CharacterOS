/**
 * V10.38 Canvas Command Painter — pure validation, sorting, and summary
 * utilities for GalaxyCanvasRenderCommand lists.
 *
 * Does NOT import CanvasRenderingContext2D or any browser API.
 * The actual Canvas 2D drawing code lives in previews/mind-galaxy-preview.js.
 */

import type { GalaxyCanvasRenderCommand } from "./mindGalaxyCanvasRenderer";

// ═══════════════════════════════════════════════════════════════════════════
// Command Kind Constants (for validation)
// ═══════════════════════════════════════════════════════════════════════════

const VALID_COMMAND_KINDS = new Set([
  "background",
  "circle",
  "line",
  "text",
  "glow",
  "driftVector",
]);

// ═══════════════════════════════════════════════════════════════════════════
// Sort
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sort commands by zIndex (ascending). Stable: equal zIndex preserves
 * original insertion order (Array.prototype.sort is stable in ES2019+).
 *
 * Pure function. Does not mutate input.
 */
export function sortGalaxyCanvasCommandsForPaint(
  commands: readonly GalaxyCanvasRenderCommand[]
): GalaxyCanvasRenderCommand[] {
  return [...commands].sort((a, b) => a.zIndex - b.zIndex);
}

// ═══════════════════════════════════════════════════════════════════════════
// Validation
// ═══════════════════════════════════════════════════════════════════════════

export interface GalaxyCanvasValidationResult {
  valid: boolean;
  totalCommands: number;
  invalidCommands: number;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a list of render commands. Checks for:
 * - Unknown command kinds
 * - Missing required fields per kind
 * - Out-of-range values (negative radius, opacity outside [0,1])
 *
 * Pure function. Does not mutate input.
 */
export function validateGalaxyCanvasCommands(
  commands: readonly GalaxyCanvasRenderCommand[]
): GalaxyCanvasValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let invalidCommands = 0;

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    const index = i;

    // Check basic shape
    if (!cmd || typeof cmd !== "object") {
      errors.push(`Command at index ${index} is not an object.`);
      invalidCommands++;
      continue;
    }

    const rec = cmd as unknown as Record<string, unknown>;
    const kind = rec.kind as string | undefined;

    if (!kind || !VALID_COMMAND_KINDS.has(kind)) {
      errors.push(`Command at index ${index} has unknown or missing kind: "${String(kind)}".`);
      invalidCommands++;
      continue;
    }

    if (typeof rec.zIndex !== "number") {
      errors.push(`Command at index ${index} (${kind}) missing zIndex.`);
      invalidCommands++;
      continue;
    }

    // Per-kind validation via record access
    switch (kind) {
      case "background":
        if (typeof rec.width !== "number" || (rec.width as number) <= 0) {
          errors.push(`Background at index ${index}: invalid width ${rec.width}.`);
          invalidCommands++;
        }
        if (typeof rec.height !== "number" || (rec.height as number) <= 0) {
          errors.push(`Background at index ${index}: invalid height ${rec.height}.`);
          invalidCommands++;
        }
        break;

      case "circle":
        if (typeof rec.radius !== "number" || (rec.radius as number) < 0) {
          errors.push(`Circle at index ${index}: invalid radius ${rec.radius}.`);
          invalidCommands++;
        }
        if (typeof rec.opacity === "number" && ((rec.opacity as number) < 0 || (rec.opacity as number) > 1)) {
          warnings.push(`Circle at index ${index}: opacity ${rec.opacity} outside [0,1].`);
        }
        break;

      case "line":
        if (typeof rec.strokeWidth !== "number" || (rec.strokeWidth as number) < 0) {
          errors.push(`Line at index ${index}: invalid strokeWidth ${rec.strokeWidth}.`);
          invalidCommands++;
        }
        break;

      case "text":
        if (typeof rec.fontSize !== "number" || (rec.fontSize as number) <= 0) {
          errors.push(`Text at index ${index}: invalid fontSize ${rec.fontSize}.`);
          invalidCommands++;
        }
        break;

      case "glow":
        if (typeof rec.radius !== "number" || (rec.radius as number) < 0) {
          errors.push(`Glow at index ${index}: invalid radius ${rec.radius}.`);
          invalidCommands++;
        }
        break;

      case "driftVector":
        if (typeof rec.opacity === "number" && ((rec.opacity as number) < 0 || (rec.opacity as number) > 1)) {
          warnings.push(`DriftVector at index ${index}: opacity ${rec.opacity} outside [0,1].`);
        }
        break;
    }
  }

  return {
    valid: invalidCommands === 0 && errors.length === 0,
    totalCommands: commands.length,
    invalidCommands,
    errors,
    warnings,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════════

export interface GalaxyCanvasPaintSummary {
  totalCommands: number;
  byKind: Record<string, number>;
  zIndexMin: number;
  zIndexMax: number;
  backgroundCount: number;
  nodeCount: number;
  edgeCount: number;
  labelCount: number;
  driftCount: number;
  glowCount: number;
}

/**
 * Summarize a paint plan from a command list.
 *
 * Pure function. Does not mutate input.
 */
export function summarizePaintPlan(
  commands: readonly GalaxyCanvasRenderCommand[]
): GalaxyCanvasPaintSummary {
  const byKind: Record<string, number> = {};
  let zIndexMin = Number.MAX_SAFE_INTEGER;
  let zIndexMax = Number.MIN_SAFE_INTEGER;
  let backgroundCount = 0;
  let nodeCount = 0;
  let edgeCount = 0;
  let labelCount = 0;
  let driftCount = 0;
  let glowCount = 0;

  for (const cmd of commands) {
    byKind[cmd.kind] = (byKind[cmd.kind] ?? 0) + 1;
    if (cmd.zIndex < zIndexMin) zIndexMin = cmd.zIndex;
    if (cmd.zIndex > zIndexMax) zIndexMax = cmd.zIndex;

    switch (cmd.kind) {
      case "background":
        backgroundCount++;
        break;
      case "circle":
        nodeCount++;
        break;
      case "line":
        edgeCount++;
        break;
      case "text":
        labelCount++;
        break;
      case "driftVector":
        driftCount++;
        break;
      case "glow":
        glowCount++;
        break;
    }
  }

  return {
    totalCommands: commands.length,
    byKind,
    zIndexMin: commands.length > 0 ? zIndexMin : 0,
    zIndexMax: commands.length > 0 ? zIndexMax : 0,
    backgroundCount,
    nodeCount,
    edgeCount,
    labelCount,
    driftCount,
    glowCount,
  };
}
