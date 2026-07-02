"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SelectedTarget, ViewMode } from "./semanticTypes";

type HoverPhase = "over" | "out";

interface NavigationSnapshot {
  viewMode: ViewMode;
  selectedTarget: SelectedTarget | null;
}

function sameTarget(a: SelectedTarget | null, b: SelectedTarget | null): boolean {
  return a?.type === b?.type && a?.id === b?.id;
}

function viewModeForTarget(target: SelectedTarget | null): ViewMode {
  if (!target) return "overview";
  if (target.type === "core") return "focusCore";
  return "factorDomain";
}

function factorTargetFromSnapshot(snapshot: NavigationSnapshot): SelectedTarget | null {
  const target = snapshot.selectedTarget;
  if (!target) return null;
  if (target.type === "factor") return target;
  return target.parentFactorId ? { type: "factor", id: target.parentFactorId } : null;
}

export function useMindSpaceNavigation() {
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget | null>(null);
  const [hoveredTarget, setHoveredTarget] = useState<SelectedTarget | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const historyRef = useRef<NavigationSnapshot[]>([]);
  const currentRef = useRef<NavigationSnapshot>({ viewMode: "overview", selectedTarget: null });

  useEffect(() => {
    currentRef.current = { viewMode, selectedTarget };
  }, [viewMode, selectedTarget]);

  const pushCurrent = useCallback(() => {
    const current = currentRef.current;
    const last = historyRef.current[historyRef.current.length - 1];
    if (last?.viewMode === current.viewMode && sameTarget(last.selectedTarget, current.selectedTarget)) return;
    historyRef.current.push(current);
    if (historyRef.current.length > 12) historyRef.current.shift();
  }, []);

  const applySnapshot = useCallback((snapshot: NavigationSnapshot) => {
    setViewMode(snapshot.viewMode);
    setSelectedTarget(snapshot.selectedTarget);
    setHoveredTarget(null);
  }, []);

  const enterTarget = useCallback((target: SelectedTarget, options?: { replace?: boolean; mode?: ViewMode }) => {
    const nextViewMode = options?.mode ?? viewModeForTarget(target);
    const current = currentRef.current;
    if (current.viewMode === nextViewMode && sameTarget(current.selectedTarget, target)) return;
    if (!options?.replace) pushCurrent();
    setSelectedTarget(target);
    setViewMode(nextViewMode);
    setHoveredTarget(null);
  }, [pushCurrent]);

  const enterFactorDomain = useCallback((factorId: string, options?: { replace?: boolean }) => {
    const target: SelectedTarget = { type: "factor", id: factorId };
    const current = currentRef.current;
    if (current.viewMode === "factorDomain" && sameTarget(current.selectedTarget, target)) return;

    if (!options?.replace) {
      const returnSnapshot: NavigationSnapshot = { viewMode: "overview", selectedTarget: target };
      const last = historyRef.current[historyRef.current.length - 1];
      if (!(last?.viewMode === returnSnapshot.viewMode && sameTarget(last.selectedTarget, returnSnapshot.selectedTarget))) {
        historyRef.current.push(returnSnapshot);
        if (historyRef.current.length > 12) historyRef.current.shift();
      }
    }

    setSelectedTarget(target);
    setViewMode("factorDomain");
    setHoveredTarget(null);
  }, []);

  const enterOverview = useCallback((options?: { replace?: boolean }) => {
    const current = currentRef.current;
    if (current.viewMode === "overview" && !current.selectedTarget) {
      setHoveredTarget(null);
      return;
    }
    if (!options?.replace) pushCurrent();
    historyRef.current = [];
    setViewMode("overview");
    setSelectedTarget(null);
    setHoveredTarget(null);
  }, [pushCurrent]);

  const goBack = useCallback(() => {
    const current = currentRef.current;
    if (current.viewMode === "overview" && !current.selectedTarget && historyRef.current.length === 0) {
      setHoveredTarget(null);
      return;
    }
    if (current.viewMode === "factorDomain") {
      const overviewFactor = factorTargetFromSnapshot(current)
        ?? [...historyRef.current].reverse().map(factorTargetFromSnapshot).find(Boolean)
        ?? null;
      historyRef.current = [];
      applySnapshot({ viewMode: "overview", selectedTarget: overviewFactor });
      return;
    }
    const previous = historyRef.current.pop();
    if (previous) {
      applySnapshot(previous);
      return;
    }
    if (current.viewMode !== "overview" || current.selectedTarget) {
      applySnapshot({ viewMode: "overview", selectedTarget: null });
    }
  }, [applySnapshot]);

  const hoverTarget = useCallback((target: SelectedTarget, phase: HoverPhase) => {
    setHoveredTarget((current) => {
      if (phase === "over") return sameTarget(current, target) ? current : target;
      return sameTarget(current, target) ? null : current;
    });
  }, []);

  const clearHover = useCallback(() => setHoveredTarget(null), []);
  const resetView = useCallback(() => setResetKey((key) => key + 1), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") goBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goBack]);

  return {
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
  };
}
