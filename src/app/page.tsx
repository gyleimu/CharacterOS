/**
 * CharacterOS — MindSpace3D Page V6
 *
 * Semantic MindSpace with clear viewMode state machine:
 *   overview → factorDomain
 */

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { MindSpace3D } from "@/components/mindspace/MindSpace3D";
import { Inspector } from "@/components/mindspace/Inspector";
import { DebugOverlay } from "@/components/mindspace/DebugOverlay";
import { MindSpaceBreadcrumb } from "@/components/mindspace/MindSpaceBreadcrumb";
import { MindSpaceControls } from "@/components/mindspace/MindSpaceControls";
import { HoverPreview } from "@/components/mindspace/HoverPreview";
import { MindSpaceEntryTransition } from "@/components/mindspace/MindSpaceEntryTransition";
import { FactorDomainPanel } from "@/components/mindspace/FactorDomainPanel";
import { useMindSpaceNavigation } from "@/components/mindspace/useMindSpaceNavigation";
import {
  getSemanticTargetPreview,
  useSelectedSemanticContext,
  type BreadcrumbItem,
} from "@/components/mindspace/useSelectedSemanticContext";
import { buildSemanticMindData } from "@/components/mindspace/semanticData";
import type { SemanticMindData, SelectedTarget } from "@/components/mindspace/semanticTypes";

// ═══════════════════════════════════════════════════════════════════════════

type HoverPhase = "over" | "out";

function normalizeIncomingFactorId(value: string | null): string {
  if (!value) return "";
  return value.replace(/^mindscape-/, "").replace(/^impact-/, "");
}

export default function MindSpacePage() {
  const [data] = useState<SemanticMindData>(() => buildSemanticMindData());
  const [loading, setLoading] = useState(true);
  const [entryTransitionActive, setEntryTransitionActive] = useState(false);
  const [domainTransitionActive, setDomainTransitionActive] = useState(false);
  const cameraPosRef = useRef({ x: 0, y: 2.5, z: 10 });
  const queryAppliedRef = useRef(false);
  const previousViewModeRef = useRef<string>("overview");

  const navigation = useMindSpaceNavigation();
  const {
    viewMode,
    selectedTarget,
    hoveredTarget,
    resetKey,
    enterTarget,
    enterFactorDomain,
    enterOverview,
    goBack,
    hoverTarget,
    clearHover,
    resetView,
  } = navigation;
  const semanticContext = useSelectedSemanticContext(data, viewMode, selectedTarget, resetKey);
  const selectedFactorId = semanticContext.selectedFactor?.id ?? null;
  const activeTrace = semanticContext.activeTrace;

  // Simulate loading
  useEffect(() => { const t = setTimeout(() => setLoading(false), 300); return () => clearTimeout(t); }, []);

  useEffect(() => {
    if (previousViewModeRef.current === viewMode) return;
    previousViewModeRef.current = viewMode;
    setDomainTransitionActive(true);
    const timer = window.setTimeout(() => setDomainTransitionActive(false), viewMode === "factorDomain" ? 1180 : 900);
    return () => window.clearTimeout(timer);
  }, [viewMode]);

  useEffect(() => {
    if (queryAppliedRef.current) return;
    queryAppliedRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const factorId = normalizeIncomingFactorId(params.get("factor"));
    let timer: number | undefined;
    if (params.get("from") === "observatory") {
      setEntryTransitionActive(true);
      timer = window.setTimeout(() => setEntryTransitionActive(false), 900);
    }
    const factor = data.factors.find((f) => f.id === factorId);
    const defaultFactor = factor ?? data.factors.find((f) => f.id === "security");
    if (defaultFactor) enterTarget({ type: "factor", id: defaultFactor.id }, { replace: true, mode: "overview" });
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [data, enterTarget]);

  // ── Handlers ───────────────────────────────────────────────────────

  const handleFactorClick = useCallback((factorId: string) => {
    enterTarget(
      { type: "factor", id: factorId },
      { mode: viewMode === "overview" ? "overview" : "factorDomain" },
    );
  }, [enterTarget, viewMode]);

  const handleFactorDoubleClick = useCallback((factorId: string) => {
    enterFactorDomain(factorId);
  }, [enterFactorDomain]);

  const handleNodeClick = useCallback((type: string, id: string) => {
    const targetType = type as SelectedTarget["type"];
    enterTarget({
      type: targetType,
      id,
      ...(selectedFactorId && targetType !== "factor" ? { parentFactorId: selectedFactorId } : {}),
    }, { mode: "factorDomain" });
  }, [enterTarget, selectedFactorId]);

  const handleNodeDoubleClick = useCallback((type: string, id: string) => {
    const targetType = type as SelectedTarget["type"];
    enterTarget({
      type: targetType,
      id,
      ...(selectedFactorId && targetType !== "factor" ? { parentFactorId: selectedFactorId } : {}),
    }, { mode: "factorDomain" });
  }, [enterTarget, selectedFactorId]);

  const handleTraceClick = useCallback((type: string, id: string) => {
    const targetType = type as SelectedTarget["type"];
    enterTarget({
      type: targetType,
      id,
      ...(selectedFactorId && targetType !== "factor" ? { parentFactorId: selectedFactorId } : {}),
    }, { mode: "factorDomain" });
  }, [enterTarget, selectedFactorId]);

  const handleEnterFactorDomain = useCallback((factorId: string) => {
    enterFactorDomain(factorId);
  }, [enterFactorDomain]);

  const handleFactorHover = useCallback((id: string, phase: HoverPhase) => {
    hoverTarget({ type: "factor", id }, phase);
  }, [hoverTarget]);
  const handleNodeHover = useCallback((type: string, id: string, phase: HoverPhase) => {
    hoverTarget({ type: type as SelectedTarget["type"], id }, phase);
  }, [hoverTarget]);
  const handleBreadcrumbNavigate = useCallback((item: BreadcrumbItem) => {
    if (!item.target) {
      enterOverview();
      return;
    }
    enterTarget(item.target);
  }, [enterOverview, enterTarget]);
  const handleCameraPos = useCallback((pos: {x:number;y:number;z:number}) => { cameraPosRef.current = pos; }, []);

  // ── Derived ────────────────────────────────────────────────────────

  const hoveredFactorId = hoveredTarget?.type === "factor" ? hoveredTarget.id : null;
  const hoveredNodeId = hoveredTarget && hoveredTarget.type !== "factor" ? hoveredTarget.id : null;
  const hoverPreview = useMemo(
    () => getSemanticTargetPreview(data, hoveredTarget),
    [data, hoveredTarget],
  );
  const visibleLabelCount =
    viewMode === "overview"
      ? data.factors.length + 1
      : semanticContext.selectedFactor
        ? Math.min(1 + (activeTrace?.steps.length ?? 0), 7)
        : 1;
  const selectedFactorForPanel = semanticContext.selectedFactor;
  const selectedFactorNeeds = useMemo(
    () => selectedFactorForPanel ? data.needs.filter((need) => selectedFactorForPanel.needIds.includes(need.id)) : [],
    [data.needs, selectedFactorForPanel],
  );
  const selectedFactorBehaviors = useMemo(
    () => selectedFactorForPanel
      ? data.behaviors
          .filter((behavior) => behavior.sourceFactorIds.includes(selectedFactorForPanel.id) || selectedFactorForPanel.behaviorIds.includes(behavior.id))
          .sort((a, b) => b.probability - a.probability)
      : [],
    [data.behaviors, selectedFactorForPanel],
  );
  const leftPanelStatus = selectedFactorForPanel
    ? `${selectedFactorForPanel.zhName}被激活 / ${selectedFactorForPanel.traceNeed}`
    : data.character.currentState;
  const leftPanelBehavior = selectedFactorBehaviors[0]
    ? `${selectedFactorBehaviors[0].zhName} ${Math.round(selectedFactorBehaviors[0].probability * 100)}%`
    : "检查、等待、回避表达";

  // ── Render ──────────────────────────────────────────────────────────

  if (loading) return <div className="loading-overlay"><div className="pulse" /></div>;

  return (
    <>
      <MindSpace3D
        data={data}
        viewMode={viewMode}
        selectedFactorId={selectedFactorId}
        hoveredFactorId={hoveredFactorId}
        hoveredNodeId={hoveredNodeId}
        selectedNodeId={selectedTarget?.type !== "factor" && selectedTarget?.type !== "core" ? selectedTarget?.id ?? null : null}
        selectedNodeType={selectedTarget?.type !== "factor" && selectedTarget?.type !== "core" ? selectedTarget?.type ?? null : null}
        onFactorClick={handleFactorClick}
        onFactorDoubleClick={handleFactorDoubleClick}
        onFactorHover={handleFactorHover}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeHover={handleNodeHover}
        onScenePointerMissed={clearHover}
        onCameraPos={handleCameraPos}
        cameraView={semanticContext.cameraView}
      />

      <div className="vignette" />
      {domainTransitionActive && (
        <div className={`domain-transition ${viewMode === "factorDomain" ? "enter" : "exit"}`}>
          <div className="domain-transition-focus" />
          <div className="domain-transition-line" />
        </div>
      )}
      <MindSpaceEntryTransition active={entryTransitionActive} />
      <MindSpaceBreadcrumb
        items={semanticContext.breadcrumb}
        onNavigate={handleBreadcrumbNavigate}
      />
      <MindSpaceControls
        viewMode={viewMode}
        onResetView={resetView}
        onOverview={() => enterOverview()}
      />
      <HoverPreview preview={hoverPreview} />

      {/* Left panel */}
      <div className="left-panel">
        <div
          className="left-panel-card"
          style={selectedFactorForPanel ? { borderColor: `${selectedFactorForPanel.color}33`, boxShadow: `0 16px 42px rgba(0,0,0,.36), inset 0 0 24px ${selectedFactorForPanel.color}10` } : undefined}
        >
          <div style={{fontSize:9,color:"rgba(255,255,255,.25)",textTransform:"uppercase",letterSpacing:".1em",marginBottom:4}}>CharacterOS</div>
          <div className="left-panel-char-name">{data.character.name}</div>
          <div className="left-panel-status">{leftPanelStatus}</div>
          <div className="left-panel-observation-grid">
            <div>
              <span>主导因子</span>
              <strong style={{ color: selectedFactorForPanel?.color ?? "#FFD54F" }}>
                {selectedFactorForPanel ? selectedFactorForPanel.zhName : "依恋 / 安全感"}
              </strong>
            </div>
            <div>
              <span>当前情绪</span>
              <strong>{data.character.emotionalTone}</strong>
            </div>
            <div>
              <span>当前需求</span>
              <strong>{selectedFactorNeeds[0]?.zhName ?? "稳定信号"}</strong>
            </div>
            <div>
              <span>行为倾向</span>
              <strong>{leftPanelBehavior}</strong>
            </div>
          </div>
          <div className="left-panel-dominants">
            {data.character.dominantFactorIds.map((id) => {
              const f = data.factors.find((x) => x.id === id);
              if (!f) return null;
              return (
                <span
                  key={id}
                  className={`left-panel-dominant-tag ${selectedFactorId === id ? "selected" : ""}`}
                  style={{ cursor:"pointer", color: selectedFactorId === id ? f.color : undefined, borderColor: selectedFactorId === id ? `${f.color}55` : undefined }}
                  onClick={() => handleFactorClick(id)}
                >
                  {f.zhName}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right inspector */}
      <Inspector
        data={data}
        viewMode={viewMode}
        selectedTarget={selectedTarget}
        activeTrace={activeTrace}
        onBack={goBack}
        onTraceClick={handleTraceClick}
        onEnterFactorDomain={handleEnterFactorDomain}
      />

      {viewMode !== "overview" && semanticContext.selectedFactor && (
        <FactorDomainPanel
          data={data}
          factor={semanticContext.selectedFactor}
          selectedTarget={selectedTarget}
          onSelectTarget={(target) => {
            const parentFactorId = semanticContext.selectedFactor!.id;
            enterTarget({
              ...target,
              ...(target.type !== "factor" ? { parentFactorId } : {}),
            }, { mode: "factorDomain" });
          }}
        />
      )}

      {/* Bottom trace — semantic psychological chain */}
      {activeTrace && (viewMode !== "overview" || selectedFactorId) && (
        <div className="bottom-trace">
          <div className="trace-label">
            <strong>心理链路</strong>
            <span>{selectedFactorForPanel ? selectedFactorForPanel.zhName : "当前观测"}</span>
          </div>
          <div className="trace-separator" />
          {activeTrace.steps.map((step, i) => (
            <div key={step.key} style={{display:"flex",alignItems:"center"}}>
              <div
                className={`trace-step active ${
                  step.targetType && step.targetId && selectedTarget?.type === step.targetType && selectedTarget.id === step.targetId
                    ? "current"
                    : ""
                }`}
                style={{cursor:step.targetId?"pointer":"default"}}
                onClick={() => step.targetType && step.targetId && handleTraceClick(step.targetType, step.targetId)}>
                <div className="trace-step-dot lit" />
                <span className="trace-step-copy">
                  <b>{step.label}</b>
                  <em>{step.detail.length > 18 ? step.detail.slice(0,18)+"…" : step.detail}</em>
                </span>
              </div>
              {i < activeTrace.steps.length - 1 && (
                <svg width="14" height="10" style={{margin:"0 1px"}}>
                  <line x1="2" y1="5" x2="10" y2="5" stroke="rgba(255,213,79,.3)" strokeWidth="1" />
                  <line x1="8" y1="3" x2="10" y2="5" stroke="rgba(255,213,79,.3)" strokeWidth="1" />
                  <line x1="8" y1="7" x2="10" y2="5" stroke="rgba(255,213,79,.3)" strokeWidth="1" />
                </svg>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Debug */}
      <DebugOverlay
        viewMode={viewMode}
        hoveredFactorId={hoveredFactorId}
        hoveredNodeId={hoveredNodeId}
        selectedTarget={selectedTarget ? `${selectedTarget.type}:${selectedTarget.id}` : null}
        cameraPos={cameraPosRef.current}
        clouds={data.factors.map((f) => ({ id: f.id, position: f.position, events: f.memoryIds }))}
        visibleLabelCount={visibleLabelCount}
      />

      <div className="hint-text">
        拖拽旋转 · 滚轮缩放 · 单击观察 · 双击进入详情 · ESC 返回 · D 调试
      </div>
    </>
  );
}
