/**
 * Standalone local adapter for the Hackathon demo.
 *
 * It owns an in-memory CharacterPhysicsState only. It imports and invokes the
 * repository's real parser, engine, memory creation, state drift, and derived
 * decision modules; it deliberately does not use persistence repositories or
 * the persistent Next.js physics routes.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { parseExperienceEvent } from "../src/core/event/eventParser";
import { knownEnglishTags } from "../src/core/event/tagNormalization";
import { createCharacterPhysicsState, CharacterPhysicsEngine } from "../src/core/physics/physicsEngine";
import { deriveCharacterState } from "../src/core/state/derivedCharacterState";

const frontendRoot = resolve("demo", "frontend");
const port = Number(process.env.CHARACTEROS_DEMO_PORT ?? 4174);
const engine = new CharacterPhysicsEngine();
const knownTags = knownEnglishTags();
let eventIndex = 0;
let state = createDemoState();

function createDemoState() {
  return createCharacterPhysicsState({
    identity: {
      id: "alex-hackathon-demo",
      name: "Alex",
      description: "A local, ephemeral CharacterOS Hackathon demonstration profile.",
      tags: ["hackathon-demo", "single-character"],
    },
  });
}

function nextLogicalTime(): string {
  const hour = eventIndex * 24;
  eventIndex += 1;
  return new Date(Date.UTC(2030, 0, 1, hour)).toISOString();
}

function extractKnownTags(description: string): string[] {
  const normalizedDescription = description.toLowerCase();
  return knownTags.filter((tag) => normalizedDescription.includes(tag));
}

function coordinateSummary(source = state) {
  return {
    trust: source.coordinate.values.trust,
    fear: source.coordinate.values.fear,
    control: source.coordinate.values.control,
  };
}

function memorySummary(source = state) {
  return source.memories.slice(-6).map((memory) => ({
    id: memory.id,
    content: memory.content,
    category: memory.clusterId?.replace(/^cluster_/, "") ?? "general",
    emotion: memory.emotion,
    beliefEffect: memory.beliefEffect,
  }));
}

function stateSummary(source = state) {
  const derived = deriveCharacterState(source);
  return {
    memoryCount: source.memories.length,
    coordinate: coordinateSummary(source),
    boundary: {
      phase: source.boundary.phase,
      stressLoad: source.boundary.stressLoad,
    },
    memories: memorySummary(source),
    decision: {
      mostLikelyAction: derived.decision.mostLikelyAction,
      emotionalReaction: derived.decision.emotionalReaction,
      rationale: derived.decision.rationale,
      confidence: derived.decision.confidence,
    },
  };
}

function json(response: import("node:http").ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const source = Buffer.concat(chunks).toString("utf8");
  return source ? JSON.parse(source) : {};
}

function isDescriptionPayload(value: unknown): value is { description: string } {
  return Boolean(
    value &&
    typeof value === "object" &&
    "description" in value &&
    typeof (value as { description?: unknown }).description === "string" &&
    (value as { description: string }).description.trim(),
  );
}

function contentType(path: string): string {
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".png": "image/png",
  }[extname(path)] ?? "application/octet-stream";
}

const server = createServer(async (request, response) => {
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  try {
    if (method === "GET" && url.pathname === "/api/state") {
      json(response, 200, stateSummary());
      return;
    }
    if (method === "POST" && url.pathname === "/api/reset") {
      eventIndex = 0;
      state = createDemoState();
      json(response, 200, stateSummary());
      return;
    }
    if (method === "POST" && url.pathname === "/api/evolve") {
      const body = await readJson(request);
      if (!isDescriptionPayload(body)) {
        json(response, 400, { error: "description is required" });
        return;
      }
      const description = body.description.trim();
      const parsed = parseExperienceEvent({
        description,
        tags: extractKnownTags(description),
        categoryHint: "auto",
        occurredAt: nextLogicalTime(),
      });
      const before = stateSummary();
      const decisionBefore = before.decision;
      const step = engine.processEvent(state, parsed);
      const after = stateSummary();
      json(response, 200, {
        parsed: {
          category: parsed.category,
          emotion: parsed.emotion,
          intensity: parsed.intensity,
          importance: parsed.importance,
          tags: parsed.tags,
          parser: parsed.parser,
        },
        memory: {
          id: step.memoryNode.id,
          content: step.memoryNode.content,
          importance: step.memoryNode.importance,
          emotion: step.memoryNode.emotion,
          beliefEffect: step.memoryNode.beliefEffect,
          clusterId: step.memoryNode.clusterId,
        },
        impact: {
          score: step.impactScore.value,
          clusterMass: step.cluster.mass,
          clusterStability: step.cluster.stability,
          boundaryPhase: step.boundaryImpact.after.phase,
        },
        before,
        after,
        decisionBefore,
        decisionAfter: after.decision,
      });
      return;
    }

    if (method !== "GET") {
      json(response, 405, { error: "method not allowed" });
      return;
    }
    const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
    const target = resolve(frontendRoot, `.${requestedPath}`);
    if (!target.startsWith(`${frontendRoot}${sep}`) && target !== resolve(frontendRoot, "index.html")) {
      json(response, 403, { error: "forbidden" });
      return;
    }
    const file = await readFile(target);
    response.writeHead(200, { "content-type": contentType(target) });
    response.end(file);
  } catch (error) {
    json(response, 500, { error: error instanceof Error ? error.message : "unknown local demo error" });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`CharacterOS Hackathon demo: http://127.0.0.1:${port}`);
});
