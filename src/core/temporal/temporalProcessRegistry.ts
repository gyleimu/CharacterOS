/**
 * V4.1 TemporalProcessRegistry — read-only process registry.
 *
 * In V4.1, the registry holds metadata-only TemporalProcess entries.
 * It does NOT execute any processes. It does NOT replace runContinuousTick.
 *
 * V4.2+ will allow registering V3 function wrappers as executable processes.
 */

import type { TemporalProcess } from "./temporalProcess";
import { V3_TICK_PHASES } from "./v3TickPhaseMetadata";

/**
 * A registry of TemporalProcess metadata entries.
 *
 * Processes are stored in insertion order. The default registry is
 * pre-populated with the 17 V3 tick phases as metadata-only entries.
 */
export class TemporalProcessRegistry {
  private readonly processes = new Map<string, TemporalProcess>();

  constructor(initial?: readonly TemporalProcess[]) {
    if (initial) {
      for (const process of initial) {
        this.register(process);
      }
    }
  }

  /** Register a process. Rejects duplicate ids. */
  register(process: TemporalProcess): void {
    if (this.processes.has(process.id)) {
      throw new Error(`TemporalProcessRegistry: duplicate process id "${process.id}"`);
    }
    this.processes.set(process.id, Object.freeze({ ...process }));
  }

  /** List all registered processes in insertion order. */
  list(): readonly TemporalProcess[] {
    return [...this.processes.values()];
  }

  /** Get a process by id. */
  get(id: string): TemporalProcess | undefined {
    return this.processes.get(id);
  }

  /** Number of registered processes. */
  get size(): number {
    return this.processes.size;
  }

  /** List process ids in insertion order. */
  ids(): string[] {
    return [...this.processes.keys()];
  }
}

/**
 * Default registry pre-populated with V3 tick phase metadata.
 * This is the starting point for V4.2+ adapter development.
 */
export const v3TickPhaseRegistry = new TemporalProcessRegistry(V3_TICK_PHASES);
