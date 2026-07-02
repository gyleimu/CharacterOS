"use client";

import { useMemo } from "react";
import { buildFactorTrace } from "./semanticData";
import type {
  FactorTrace,
  SelectedTarget,
  SemanticBehavior,
  SemanticBelief,
  SemanticFactor,
  SemanticMemory,
  SemanticMindData,
  SemanticNeed,
  ViewMode,
} from "./semanticTypes";
import type { CameraView } from "./types";

export interface BreadcrumbItem {
  label: string;
  target: SelectedTarget | null;
}

export interface TargetPreview {
  title: string;
  subtitle: string;
  typeLabel: string;
  actionHint: string;
  color: string;
}

export interface SelectedSemanticContext {
  viewMode: ViewMode;
  selectedTarget: SelectedTarget | null;
  selectedFactor: SemanticFactor | null;
  selectedMemory: SemanticMemory | null;
  selectedBelief: SemanticBelief | null;
  selectedNeed: SemanticNeed | null;
  selectedBehavior: SemanticBehavior | null;
  activeTrace: FactorTrace | null;
  breadcrumb: BreadcrumbItem[];
  cameraView: CameraView;
  highlightedNodeIds: Set<string>;
  title: string;
  typeLabel: string;
  explanation: string;
}

function findFactor(data: SemanticMindData, target: SelectedTarget | null): SemanticFactor | null {
  if (!target) return null;
  if (target.parentFactorId) return data.factors.find((f) => f.id === target.parentFactorId) ?? null;
  if (target.type === "factor") return data.factors.find((f) => f.id === target.id) ?? null;
  if (target.type === "memory") {
    const memory = data.memories.find((m) => m.id === target.id);
    return memory ? data.factors.find((f) => f.id === memory.factorId) ?? null : null;
  }
  if (target.type === "belief") {
    const belief = data.beliefs.find((b) => b.id === target.id);
    return belief ? data.factors.find((f) => f.id === belief.factorId) ?? null : null;
  }
  if (target.type === "need") {
    const need = data.needs.find((n) => n.id === target.id);
    return need ? data.factors.find((f) => f.id === need.factorId) ?? null : null;
  }
  if (target.type === "behavior") {
    const behavior = data.behaviors.find((b) => b.id === target.id);
    const factorId = behavior?.sourceFactorIds[0];
    return factorId ? data.factors.find((f) => f.id === factorId) ?? null : null;
  }
  return null;
}

function domainPosition(
  base: [number, number, number],
  zone: "memory" | "belief" | "need" | "behavior",
  index: number,
  total: number,
): [number, number, number] {
  const row = index - (total - 1) / 2;
  const offsets: Record<typeof zone, [number, number, number]> = {
    memory: [-2.8, row * 0.55, -0.45 - index * 0.08],
    belief: [2.0, 0.78 + row * 0.44, -0.35],
    need: [2.65, -0.1 + row * 0.44, 0.18],
    behavior: [3.25, -0.92 + row * 0.42, 0.55 + index * 0.06],
  };
  const offset = offsets[zone];
  return [base[0] + offset[0], base[1] + offset[1], base[2] + offset[2]];
}

function domainTargetPosition(
  factor: SemanticFactor,
  type: "memory" | "belief" | "need" | "behavior",
  id: string,
): [number, number, number] {
  const ids =
    type === "memory" ? factor.memoryIds :
    type === "belief" ? factor.beliefIds :
    type === "need" ? factor.needIds :
    factor.behaviorIds;
  const index = Math.max(0, ids.indexOf(id));
  const total = Math.max(ids.length || 1, index + 1);
  return domainPosition(factor.position, type, index, total);
}

function findTargetObjects(data: SemanticMindData, target: SelectedTarget | null) {
  return {
    memory: target?.type === "memory" ? data.memories.find((m) => m.id === target.id) ?? null : null,
    belief: target?.type === "belief" ? data.beliefs.find((b) => b.id === target.id) ?? null : null,
    need: target?.type === "need" ? data.needs.find((n) => n.id === target.id) ?? null : null,
    behavior: target?.type === "behavior" ? data.behaviors.find((b) => b.id === target.id) ?? null : null,
  };
}

function breadcrumbFor(
  data: SemanticMindData,
  viewMode: ViewMode,
  target: SelectedTarget | null,
  factor: SemanticFactor | null,
  objects: ReturnType<typeof findTargetObjects>,
): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [{ label: "Mindscape", target: null }];
  if (viewMode === "overview" || !target) return items;

  if (target.type === "core") {
    items.push({ label: data.character.name, target });
    return items;
  }

  if (factor) items.push({ label: `Factor Domain: ${factor.zhName}`, target: { type: "factor", id: factor.id } });
  if (objects.memory) items.push({ label: objects.memory.summary, target });
  if (objects.belief) items.push({ label: objects.belief.text, target });
  if (objects.need) items.push({ label: objects.need.zhName, target });
  if (objects.behavior) items.push({ label: objects.behavior.zhName, target });
  return items;
}

function cameraFor(
  viewMode: ViewMode,
  target: SelectedTarget | null,
  factor: SemanticFactor | null,
  objects: ReturnType<typeof findTargetObjects>,
  resetKey: number,
): CameraView {
  if (viewMode === "overview" || !target) return { mode: "overview", resetKey };
  if (target.type === "core") return { mode: "core", resetKey };
  if ((target.type === "factor" || viewMode === "factorDomain") && factor && target.type === "factor") {
    return { mode: "factor", factorId: factor.id, resetKey };
  }
  if (objects.memory) {
    const position = factor ? domainTargetPosition(factor, "memory", objects.memory.id) : objects.memory.offset;
    return {
      mode: "target",
      targetType: "memory",
      targetId: objects.memory.id,
      position,
      parentFactorId: objects.memory.factorId,
      resetKey,
    };
  }
  if (objects.belief) {
    const position = factor ? domainTargetPosition(factor, "belief", objects.belief.id) : objects.belief.position;
    return {
      mode: "target",
      targetType: "belief",
      targetId: objects.belief.id,
      position,
      parentFactorId: objects.belief.factorId,
      resetKey,
    };
  }
  if (objects.need) {
    const position = factor ? domainTargetPosition(factor, "need", objects.need.id) : objects.need.position;
    return {
      mode: "target",
      targetType: "need",
      targetId: objects.need.id,
      position,
      parentFactorId: objects.need.factorId,
      resetKey,
    };
  }
  if (objects.behavior) {
    const position = factor ? domainTargetPosition(factor, "behavior", objects.behavior.id) : objects.behavior.position;
    return {
      mode: "target",
      targetType: "behavior",
      targetId: objects.behavior.id,
      position,
      parentFactorId: factor?.id ?? objects.behavior.sourceFactorIds[0],
      resetKey,
    };
  }
  return factor ? { mode: "factor", factorId: factor.id, resetKey } : { mode: "overview", resetKey };
}

function highlightedIds(
  factor: SemanticFactor | null,
  objects: ReturnType<typeof findTargetObjects>,
): Set<string> {
  const ids = new Set<string>();
  if (!factor) return ids;
  ids.add(factor.id);
  factor.memoryIds.forEach((id) => ids.add(id));
  factor.beliefIds.forEach((id) => ids.add(id));
  factor.needIds.forEach((id) => ids.add(id));
  factor.behaviorIds.forEach((id) => ids.add(id));
  if (objects.memory) ids.add(objects.memory.id);
  if (objects.belief) ids.add(objects.belief.id);
  if (objects.need) ids.add(objects.need.id);
  if (objects.behavior) ids.add(objects.behavior.id);
  return ids;
}

export function getSemanticTargetPreview(
  data: SemanticMindData,
  target: SelectedTarget | null,
): TargetPreview | null {
  if (!target) return null;
  if (target.type === "core") {
    return {
      title: data.character.name,
      subtitle: data.character.currentState,
      typeLabel: "人格核心",
      actionHint: "单击观察，双击进入核心",
      color: data.character.color,
    };
  }
  const factor = findFactor(data, target);
  const objects = findTargetObjects(data, target);
  if (target.type === "factor" && factor) {
    return {
      title: `${factor.name} / ${factor.zhName}`,
      subtitle: factor.description,
      typeLabel: "影响因子",
      actionHint: "单击观察，双击进入因子星域",
      color: factor.color,
    };
  }
  if (objects.memory) {
    return {
      title: objects.memory.summary,
      subtitle: `${objects.memory.timestamp} · ${objects.memory.emotion}`,
      typeLabel: "记忆碎片",
      actionHint: "单击观察，双击进入记忆",
      color: objects.memory.color,
    };
  }
  if (objects.belief) {
    return {
      title: objects.belief.text,
      subtitle: `强度 ${Math.round(objects.belief.strength * 100)}%`,
      typeLabel: "信念",
      actionHint: "单击观察",
      color: objects.belief.color,
    };
  }
  if (objects.need) {
    return {
      title: objects.need.zhName,
      subtitle: `紧迫度 ${Math.round(objects.need.urgency * 100)}%`,
      typeLabel: "需求",
      actionHint: "单击观察",
      color: objects.need.color,
    };
  }
  if (objects.behavior) {
    return {
      title: objects.behavior.zhName,
      subtitle: objects.behavior.reason,
      typeLabel: "行为预测",
      actionHint: "单击观察，双击进入行为预测",
      color: objects.behavior.color,
    };
  }
  return null;
}

export function useSelectedSemanticContext(
  data: SemanticMindData,
  viewMode: ViewMode,
  selectedTarget: SelectedTarget | null,
  resetKey: number,
): SelectedSemanticContext {
  return useMemo(() => {
    const factor = findFactor(data, selectedTarget);
    const objects = findTargetObjects(data, selectedTarget);
    const activeTrace = factor ? buildFactorTrace(factor, data.behaviors) : null;
    const breadcrumb = breadcrumbFor(data, viewMode, selectedTarget, factor, objects);
    const cameraView = cameraFor(viewMode, selectedTarget, factor, objects, resetKey);
    const highlightedNodeIds = highlightedIds(factor, objects);

    const preview = getSemanticTargetPreview(data, selectedTarget);
    return {
      viewMode,
      selectedTarget,
      selectedFactor: factor,
      selectedMemory: objects.memory,
      selectedBelief: objects.belief,
      selectedNeed: objects.need,
      selectedBehavior: objects.behavior,
      activeTrace,
      breadcrumb,
      cameraView,
      highlightedNodeIds,
      title: preview?.title ?? data.character.name,
      typeLabel: preview?.typeLabel ?? "全局总览",
      explanation: preview?.subtitle ?? data.character.summary,
    };
  }, [data, viewMode, selectedTarget, resetKey]);
}
