import { linFanInitialCoordinate, coordinateToRecord, bigFiveFromCoordinate } from "../personality/coordinate";
import { CharacterPhysicsEngine, createCharacterPhysicsState } from "../physics/physicsEngine";
import type { ExperienceEvent } from "../event/event";

const coordinate = linFanInitialCoordinate();
const state = createCharacterPhysicsState({
  coordinate,
  personality: bigFiveFromCoordinate(coordinate),
  learningRate: 0.03
});

const event: ExperienceEvent = {
  id: "event_wangxue_no_reply",
  description: "王雪已经三天没有回复林凡的消息，今天深夜突然出现在他家门口。",
  tags: ["王雪", "失联", "等待", "亲密关系", "夜晚"],
  intensity: 0.82,
  importance: 0.86,
  relationshipWeight: 0.95,
  expectationGap: 0.78,
  personalitySensitivity: 0.9
};

const result = new CharacterPhysicsEngine().processEvent(state, event);

console.log("Character Physics TypeScript Demo");
console.log("\nInitial Coordinate:");
console.log(coordinateToRecord(coordinate));
console.log("\nImpact:");
console.log(result.impactScore);
console.log("\nEmotion:");
console.log(result.emotion);
console.log("\nImpact Particle:");
console.log({
  category: result.particle.category,
  delta: coordinateToRecord(result.particle.vector.delta),
  rationale: result.particle.vector.rationale
});
console.log("\nMemory Node:");
console.log({
  id: result.memoryNode.id,
  importance: result.memoryNode.importance,
  emotion: result.memoryNode.emotion,
  repetitionCount: result.memoryNode.repetitionCount,
  clusterId: result.memoryNode.clusterId,
  beliefEffect: result.memoryNode.beliefEffect
});
console.log("\nImpact Cluster:");
console.log({
  id: result.cluster.id,
  mass: result.cluster.mass,
  density: result.cluster.density,
  stability: result.cluster.stability,
  centerCoordinate: coordinateToRecord(result.cluster.centerCoordinate)
});
console.log("\nCoordinate Drift:");
console.log({
  before: coordinateToRecord(result.coordinateDrift.before),
  force: coordinateToRecord(result.coordinateDrift.totalForce),
  after: coordinateToRecord(result.coordinateDrift.after)
});
console.log("\nGalaxy Step Trace:");
console.log({
  totalForce: coordinateToRecord(result.galaxyStep.totalForce),
  previousVelocity: coordinateToRecord(result.galaxyStep.drift.previousVelocity),
  nextVelocity: coordinateToRecord(result.galaxyStep.drift.nextVelocity),
  clusterMetrics: result.galaxyStep.clusterMetrics.map((item) => ({
    clusterId: item.clusterId,
    category: item.category,
    mass: item.metrics.mass,
    density: item.metrics.density,
    stability: item.metrics.stability,
    variance: item.metrics.variance
  }))
});
console.log("\nBoundary Impact:");
console.log({
  incomingStress: result.boundaryImpact.incomingStress,
  overflowAmount: result.boundaryImpact.overflowAmount,
  driftMultiplier: result.boundaryImpact.driftMultiplier,
  phase: result.boundaryImpact.after.phase
});
