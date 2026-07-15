import { describe, expect, it } from "vitest";
import { buildGoldenEvent, GOLDEN_BASELINES } from "../../src/core/calibration/goldenTrajectoryFixtures";
import {
  CURRENT_MODEL_PARAMETER_SET_VERSION,
  LEGACY_MODEL_PARAMETER_SET_VERSION,
  createModelParameterVariant,
  flattenNumericParameters,
  getCurrentModelParameterSet,
  getModelParameterSet,
  hasModelParameterSet,
  listModelParameterDescriptors,
  listModelParameterSets,
  validateModelParameterSet,
  type ModelParameterSet,
} from "../../src/core/parameters/modelParameterRegistry";
import {
  CharacterPhysicsEngine,
  createCharacterPhysicsState,
} from "../../src/core/physics/physicsEngine";
import {
  deserializeCharacterPhysicsState,
  serializeCharacterPhysicsState,
  type SerializedCharacterPhysicsState,
} from "../../src/core/physics/serialization";

describe("model parameter registry", () => {
  it("exposes a current governed parameter set", () => {
    const current = getCurrentModelParameterSet();
    expect(current.version).toBe(CURRENT_MODEL_PARAMETER_SET_VERSION);
    expect(current.status).toBe("current");
    expect(current.fingerprint).toMatch(/^model-parameters_/);
  });

  it("keeps a frozen legacy replay parameter set", () => {
    expect(hasModelParameterSet(LEGACY_MODEL_PARAMETER_SET_VERSION)).toBe(true);
    expect(getModelParameterSet(LEGACY_MODEL_PARAMETER_SET_VERSION).status).toBe("legacy");
  });

  it("validates every registered set", () => {
    expect(listModelParameterSets().every((set) => validateModelParameterSet(set).valid)).toBe(true);
  });

  it("governs every numeric leaf with metadata", () => {
    const current = getCurrentModelParameterSet();
    expect(Object.keys(flattenNumericParameters(current))).toHaveLength(listModelParameterDescriptors().length);
  });

  it("deep-freezes registered values", () => {
    const current = getCurrentModelParameterSet();
    const descriptors = listModelParameterDescriptors();
    expect(Object.isFrozen(current)).toBe(true);
    expect(Object.isFrozen(current.temporal)).toBe(true);
    expect(Object.isFrozen(current.boundary.stressWeightByCategory)).toBe(true);
    expect(Object.isFrozen(descriptors)).toBe(true);
    expect(descriptors.every((item) => (
      Object.isFrozen(item) && Object.isFrozen(item.dependencies)
    ))).toBe(true);
  });

  it("builds deterministic sensitivity variants", () => {
    const input = {
      version: "test-variant",
      changeReason: "test deterministic variant",
      overrides: { temporal: { personalityVelocityHalfLifeDays: 15.4 } },
    } as const;
    expect(createModelParameterVariant(input)).toEqual(createModelParameterVariant(input));
  });

  it("does not mutate the base when creating a variant", () => {
    const base = getCurrentModelParameterSet();
    const before = JSON.stringify(base);
    const variant = createModelParameterVariant({
      base,
      version: "test-memory-variant",
      changeReason: "test memory override",
      overrides: { memory: { recencyFloor: 0.2, recencyDynamicWeight: 0.8 } },
    });
    expect(variant.memory.recencyFloor).toBe(0.2);
    expect(JSON.stringify(base)).toBe(before);
  });

  it("rejects out-of-range values", () => {
    const base = getCurrentModelParameterSet();
    const invalid = {
      ...base,
      temporal: { ...base.temporal, minimumDensityScale: 2 },
    } as ModelParameterSet;
    const result = validateModelParameterSet(invalid);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path === "temporal.minimumDensityScale")).toBe(true);
  });

  it("fails closed when a sensitivity variant is invalid", () => {
    expect(() => createModelParameterVariant({
      version: "invalid-variant",
      changeReason: "exercise variant validation",
      overrides: { temporal: { minimumDensityScale: 2 } },
    })).toThrow(/Invalid model parameter variant/);
  });

  it("detects fingerprint drift", () => {
    const base = getCurrentModelParameterSet();
    const invalid = { ...base, fingerprint: "wrong" } as ModelParameterSet;
    expect(validateModelParameterSet(invalid).issues.some((issue) => issue.path === "fingerprint")).toBe(true);
  });

  it("requires memory gravity weights to sum to one", () => {
    const base = getCurrentModelParameterSet();
    const invalid = {
      ...base,
      memory: { ...base.memory, recencyFloor: 0.2, recencyDynamicWeight: 0.7 },
    } as ModelParameterSet;
    expect(validateModelParameterSet(invalid).issues.some((issue) => issue.path === "memory")).toBe(true);
  });

  it("stamps new states with the current parameter version", () => {
    expect(createCharacterPhysicsState().parameterSetVersion).toBe(CURRENT_MODEL_PARAMETER_SET_VERSION);
  });

  it("records the parameter version and fingerprint in event trace", () => {
    const state = GOLDEN_BASELINES[0]!.createState();
    const step = new CharacterPhysicsEngine().processEvent(state, buildGoldenEvent("support", 0));
    expect(step.temporalSemantics.parameterSetVersion).toBe(CURRENT_MODEL_PARAMETER_SET_VERSION);
    expect(step.temporalSemantics.parameterSetFingerprint).toBe(getCurrentModelParameterSet().fingerprint);
  });

  it("rejects an engine/state parameter mismatch", () => {
    const variant = createModelParameterVariant({
      version: "mismatch-variant",
      changeReason: "test mismatch guard",
      overrides: { personality: { standardLearningBase: 0.6 } },
    });
    const state = createCharacterPhysicsState();
    expect(() => new CharacterPhysicsEngine({ parameterSet: variant }).processEvent(
      state,
      buildGoldenEvent("failure", 0),
    )).toThrow(/does not match engine set/);
  });

  it("preserves the parameter version through serialization", () => {
    const state = createCharacterPhysicsState();
    const restored = deserializeCharacterPhysicsState(serializeCharacterPhysicsState(state));
    expect(restored.parameterSetVersion).toBe(CURRENT_MODEL_PARAMETER_SET_VERSION);
  });

  it("migrates pre-registry serialized state to the frozen legacy set", () => {
    const serialized = serializeCharacterPhysicsState(createCharacterPhysicsState());
    const { parameterSetVersion: _ignored, ...legacy } = serialized;
    const restored = deserializeCharacterPhysicsState(legacy as SerializedCharacterPhysicsState);
    expect(restored.parameterSetVersion).toBe(LEGACY_MODEL_PARAMETER_SET_VERSION);
  });

  it("fails closed for an unknown parameter version", () => {
    expect(() => getModelParameterSet("missing-model-version")).toThrow(/Unknown model parameter set/);
  });
});
