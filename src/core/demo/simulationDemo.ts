import { linFanInitialCoordinate, coordinateToRecord, bigFiveFromCoordinate } from "../personality/coordinate";
import { createCharacterPhysicsState } from "../physics/physicsEngine";
import { runEventSequence } from "../simulation/runner";
import type { ExperienceEvent } from "../event/event";

const coordinate = linFanInitialCoordinate();
const state = createCharacterPhysicsState({
  coordinate,
  personality: bigFiveFromCoordinate(coordinate),
  learningRate: 0.03
});

const events: ExperienceEvent[] = [
  {
    id: "abandonment_1",
    description: "王雪三天没有回复消息。",
    tags: ["王雪", "失联", "等待", "亲密关系"],
    intensity: 0.75,
    importance: 0.8,
    relationshipWeight: 0.9,
    expectationGap: 0.8,
    personalitySensitivity: 0.9
  },
  {
    id: "abandonment_2",
    description: "王雪答应见面后临时消失。",
    tags: ["王雪", "失联", "等待", "亲密关系"],
    intensity: 0.7,
    importance: 0.75,
    relationshipWeight: 0.9,
    expectationGap: 0.85,
    personalitySensitivity: 0.9
  },
  {
    id: "abandonment_3",
    description: "林凡再次在深夜等待王雪的解释。",
    tags: ["王雪", "等待", "被抛弃", "夜晚"],
    intensity: 0.78,
    importance: 0.82,
    relationshipWeight: 0.95,
    expectationGap: 0.82,
    personalitySensitivity: 0.9
  }
];

const result = runEventSequence({ state, events, daysPerStep: 7 });

console.log("Character Physics TypeScript Simulation Demo");
console.log("\nInitial Coordinate:");
console.log(coordinateToRecord(coordinate));

for (const snapshot of result.snapshots) {
  console.log("\nStep:");
  console.log({
    step: snapshot.step,
    eventId: snapshot.eventId,
    memoryId: snapshot.memoryId,
    category: snapshot.category,
    impactScore: snapshot.impactScore,
    clusterMass: snapshot.clusterMass,
    clusterStability: snapshot.clusterStability,
    clusterAge: snapshot.clusterAge,
    boundaryPhase: snapshot.boundaryImpact.after.phase,
    driftMultiplier: snapshot.boundaryImpact.driftMultiplier,
    forceTrust: snapshot.force.trust,
    forceFear: snapshot.force.fear,
    velocityTrust: snapshot.velocity.trust,
    velocityFear: snapshot.velocity.fear,
    trust: snapshot.coordinate.trust,
    fear: snapshot.coordinate.fear
  });
}

console.log("\nFinal Coordinate:");
console.log(coordinateToRecord(result.finalState.coordinate));
