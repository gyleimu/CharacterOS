"use client";

import { useMemo, useState } from "react";
import { DebugOverlay } from "@/components/mindspace/DebugOverlay";
import { FactorDomainPanel } from "@/components/mindspace/FactorDomainPanel";
import { HoverPreview } from "@/components/mindspace/HoverPreview";
import { Inspector } from "@/components/mindspace/Inspector";
import { MindSpace3D } from "@/components/mindspace/MindSpace3D";
import { MindSpaceBreadcrumb } from "@/components/mindspace/MindSpaceBreadcrumb";
import { MindSpaceControls } from "@/components/mindspace/MindSpaceControls";
import { buildSemanticMindData } from "@/components/mindspace/semanticData";
import type { SelectedTarget } from "@/components/mindspace/semanticTypes";
import {
  getSemanticTargetPreview,
  useSelectedSemanticContext,
} from "@/components/mindspace/useSelectedSemanticContext";
import { useMindSpaceNavigation } from "@/components/mindspace/useMindSpaceNavigation";

export default function MindspacePage() {
  const data = useMemo(() => buildSemanticMindData(), []);
  const navigation = useMindSpaceNavigation();
  const [cameraPos, setCameraPos] = useState({ x: 0, y: 0, z: 0 });

  const semantic = useSelectedSemanticContext(
    data,
    navigation.viewMode,
    navigation.selectedTarget,
    navigation.resetKey,
  );

  const hoveredFactorId =
    navigation.hoveredTarget?.type === "factor" ? navigation.hoveredTarget.id : null;
  const hoveredNodeId =
    navigation.hoveredTarget &&
    navigation.hoveredTarget.type !== "factor" &&
    navigation.hoveredTarget.type !== "core"
      ? navigation.hoveredTarget.id
      : null;
  const selectedFactorId =
    navigation.selectedTarget?.type === "factor"
      ? navigation.selectedTarget.id
      : navigation.selectedTarget?.parentFactorId ?? semantic.selectedFactor?.id ?? null;
  const selectedNodeId =
    navigation.selectedTarget &&
    navigation.selectedTarget.type !== "factor" &&
    navigation.selectedTarget.type !== "core"
      ? navigation.selectedTarget.id
      : null;
  const selectedNodeType =
    navigation.selectedTarget &&
    navigation.selectedTarget.type !== "factor" &&
    navigation.selectedTarget.type !== "core"
      ? navigation.selectedTarget.type
      : null;

  const hoverPreview = getSemanticTargetPreview(data, navigation.hoveredTarget);
  const selectedTargetLabel = navigation.selectedTarget
    ? `${navigation.selectedTarget.type}:${navigation.selectedTarget.id}`
    : null;

  function selectTarget(target: SelectedTarget) {
    navigation.enterTarget(target);
  }

  function focusTarget(target: SelectedTarget) {
    if (target.type === "factor") {
      navigation.enterFactorDomain(target.id);
      return;
    }
    navigation.enterTarget(target);
  }

  return (
    <main className="mindspace-page" aria-label="CharacterOS MindSpace 3D">
      <MindSpace3D
        data={data}
        viewMode={navigation.viewMode}
        selectedFactorId={selectedFactorId}
        hoveredFactorId={hoveredFactorId}
        hoveredNodeId={hoveredNodeId}
        selectedNodeId={selectedNodeId}
        selectedNodeType={selectedNodeType}
        onFactorClick={(id) => selectTarget({ type: "factor", id })}
        onFactorDoubleClick={(id) => navigation.enterFactorDomain(id)}
        onFactorHover={(id, phase) => navigation.hoverTarget({ type: "factor", id }, phase)}
        onNodeClick={(type, id) => selectTarget({ type: type as SelectedTarget["type"], id })}
        onNodeDoubleClick={(type, id) => focusTarget({ type: type as SelectedTarget["type"], id })}
        onNodeHover={(type, id, phase) =>
          navigation.hoverTarget({ type: type as SelectedTarget["type"], id }, phase)
        }
        onScenePointerMissed={navigation.clearHover}
        onCameraPos={setCameraPos}
        cameraView={semantic.cameraView}
      />

      <div className="mindspace-top-note">
        <strong>CharacterOS MindSpace 3D</strong>
        <span>实验性三维观察器 · 双击进入第三层 · 只读</span>
      </div>

      <MindSpaceBreadcrumb
        items={semantic.breadcrumb}
        onNavigate={(item) => {
          if (!item.target) {
            navigation.enterOverview();
            return;
          }
          navigation.enterTarget(item.target, { replace: true });
        }}
      />

      <MindSpaceControls
        viewMode={navigation.viewMode}
        onResetView={navigation.resetView}
        onOverview={() => navigation.enterOverview()}
      />

      <Inspector
        data={data}
        viewMode={navigation.viewMode}
        selectedTarget={navigation.selectedTarget}
        activeTrace={semantic.activeTrace}
        onBack={navigation.goBack}
        onTraceClick={(type, id) => selectTarget({ type: type as SelectedTarget["type"], id })}
        onEnterFactorDomain={navigation.enterFactorDomain}
      />

      {navigation.viewMode === "factorDomain" && semantic.selectedFactor && (
        <FactorDomainPanel
          data={data}
          factor={semantic.selectedFactor}
          selectedTarget={navigation.selectedTarget}
          onSelectTarget={selectTarget}
          onOpenTarget={focusTarget}
        />
      )}

      <HoverPreview preview={hoverPreview} />
      <DebugOverlay
        viewMode={navigation.viewMode}
        hoveredFactorId={hoveredFactorId}
        hoveredNodeId={hoveredNodeId}
        selectedTarget={selectedTargetLabel}
        cameraPos={cameraPos}
        clouds={data.factors}
      />
    </main>
  );
}
