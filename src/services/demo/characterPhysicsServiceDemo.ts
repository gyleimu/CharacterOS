import { InMemoryCharacterPhysicsService } from "../characterPhysicsService";
import type { ExperienceEvent } from "../../core/event/event";
import { coordinateToRecord } from "../../core/personality/coordinate";

const service = new InMemoryCharacterPhysicsService();

const event: ExperienceEvent = {
  id: "service_event_1",
  description: "王雪三天没有回复林凡的消息。",
  tags: ["王雪", "失联", "等待", "亲密关系"],
  intensity: 0.8,
  importance: 0.8,
  relationshipWeight: 0.9,
  expectationGap: 0.8,
  personalitySensitivity: 0.9
};

const result = service.processEvent("lin_fan", event);
const state = service.getState("lin_fan");

console.log("Character Physics Service Demo");
console.log({
  memoryId: result.memoryNode.id,
  category: result.particle.category,
  clusterMass: result.cluster.mass,
  memories: state.memories.length,
  coordinate: coordinateToRecord(state.coordinate)
});
