/**
 * V5.5 Reward Recovery SubProcess Instrumentation
 *
 * Pure builder that produces a RewardRecoverySubProcessTrace from
 * pre-recovery and post-recovery reward state snapshots. Does NOT
 * mutate reward state or change any recovery behavior.
 *
 * D10-AWARE: Phase 3 reward recovery is intermediate. Phase 4
 * homeostasis may further modify reward state via regulatedRewardState.
 * The subprocess trace records the Phase 3 recovery operation, not
 * the final tick reward state. Callers should consult
 * homeostasisResult.trace.regulatedRewardState for the final value.
 *
 * Instrumentation only — V3 Phase 3 shape is preserved.
 */

import type { RewardState } from "../../reward/rewardSystem";
import type { RewardRecoverySubProcessTrace } from "../subProcessTrace";

export interface BuildRewardRecoverySubProcessTraceParams {
  /** Reward state before recovery (Phase 1 snapshot). */
  readonly rewardBefore: RewardState;
  /** Reward state after Phase 3 recovery (recoverRewardBaseline result, pre-homeostasis). */
  readonly rewardAfter: RewardState;
}

/**
 * Build a RewardRecoverySubProcessTrace from before/after reward state snapshots.
 *
 * Pure function — does not read or write CharacterPhysicsState.
 * Does not mutate the input objects. Does not perform recovery.
 *
 * D10 note: rewardAfter here is the Phase 3 intermediate result of
 * recoverRewardBaseline(). Phase 4 homeostasis may produce a different
 * final reward state via regulatedRewardState. This trace records the
 * recovery operation itself, not the tick's final reward state.
 *
 * V5.5: This is additive instrumentation. The recovery itself is still
 * performed inline in runContinuousTick Phase 3.
 */
export function buildRewardRecoverySubProcessTrace(
  params: BuildRewardRecoverySubProcessTraceParams
): RewardRecoverySubProcessTrace {
  const { rewardBefore, rewardAfter } = params;

  const reasons: string[] = [
    "Reward state recovers toward baseline with elapsed time.",
    "D10 note: Phase 4 homeostasis may further regulate reward state via regulatedRewardState — this trace records Phase 3 intermediate recovery only."
  ];

  return {
    id: "decay_and_recovery.reward_recovery",
    kind: "reward_recovery",
    label: "Reward Baseline Recovery",
    reads: ["rewardState"],
    writes: ["rewardState"],
    changedStates: ["rewardState"],
    reasons,
    metrics: {
      dopamineBefore: rewardBefore.dopamineLevel,
      dopamineAfter: rewardAfter.dopamineLevel,
      thresholdBefore: rewardBefore.dopamineThreshold,
      thresholdAfter: rewardAfter.dopamineThreshold,
      cravingBefore: rewardBefore.craving,
      cravingAfter: rewardAfter.craving
    }
  };
}
