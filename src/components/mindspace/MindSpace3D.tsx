/**
 * MindSpace3D V6 — semantic psychological universe.
 *
 * Layers:
 * 1. DeepSpaceField
 * 2. ParticleNebula
 * 3. ConnectionStreams
 * 4. PersonalityCore
 * 5. FactorClouds
 * 6. MentalNodes (belief/need/behavior — only in Factor Domain)
 * 7. FactorLabels
 * 8. CameraRig
 */

"use client";

import { useMemo, useState, useCallback, type FC } from "react";
import { Canvas } from "@react-three/fiber";
import { DeepSpaceField } from "./DeepSpaceField";
import { ParticleNebula } from "./ParticleNebula";
import { ForegroundParticles } from "./ForegroundParticles";
import { ConnectionStreams } from "./ConnectionStreams";
import { PersonalityCore } from "./PersonalityCore";
import { FactorClouds } from "./FactorClouds";
import { FactorLabel } from "./FactorLabel";
import { MentalNodes } from "./MentalNodes";
import { CameraRig } from "./CameraRig";
import type { SemanticMindData, ViewMode } from "./semanticTypes";
import type { CameraView, FactorCloudHandle } from "./types";

type HoverPhase = "over" | "out";

interface Props {
  data: SemanticMindData;
  viewMode: ViewMode;
  selectedFactorId: string | null;
  hoveredFactorId: string | null;
  hoveredNodeId: string | null;
  selectedNodeId: string | null;
  selectedNodeType: string | null;
  onFactorClick: (id: string) => void;
  onFactorDoubleClick: (id: string) => void;
  onFactorHover: (id: string, phase: HoverPhase) => void;
  onNodeClick: (type: string, id: string) => void;
  onNodeDoubleClick: (type: string, id: string) => void;
  onNodeHover: (type: string, id: string, phase: HoverPhase) => void;
  onScenePointerMissed: () => void;
  onCameraPos: (pos: {x:number;y:number;z:number}) => void;
  cameraView: CameraView;
}

// Convert SemanticFactor[] to the shape FactorClouds expects
function toCloud(f: SemanticMindData["factors"][number], dominantFactorIds: string[], selectedFactorId: string | null) {
  const dominant = dominantFactorIds.includes(f.id);
  const selected = selectedFactorId === f.id;
  const activationBoost = 1 + f.activation * 0.18;
  const dominantBoost = dominant ? 1.34 : 1;
  const selectedBoost = selected ? 1.34 : 1;
  return {
    id: f.id, labelZh: f.zhName, labelEn: f.name, layer: f.layer,
    color: f.color, accentColor: f.accentColor,
    position: f.position,
    haloSpread: f.haloSpread * (dominant ? 1.08 : 1) * (selected ? 1.18 : 1),
    coreRadius: f.coreRadius * (dominant ? 1.12 : 1) * (selected ? 1.12 : 1),
    coreParticleCount: Math.round(f.coreParticleCount * activationBoost * dominantBoost * selectedBoost),
    haloParticleCount: Math.round(f.haloParticleCount * activationBoost * dominantBoost * selectedBoost),
    value: f.strength, strength: f.strength, activation: f.activation,
    decay: f.decay, distanceFromCore: f.distance,
    description: f.description, lowAnchor: f.lowAnchor, highAnchor: f.highAnchor,
    influenceTags: f.influenceTags, impactSummary: f.explanation,
    relatedMemories: f.memoryIds, events: [],
  };
}

function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) % 997;
  return hash / 997;
}

function stableStreamMidPoint(f: SemanticMindData["factors"][number]): [number, number, number] {
  const s = hashSeed(f.id);
  const wobbleA = (s - 0.5) * 1.2;
  const wobbleB = (hashSeed(`${f.id}:z`) - 0.5) * 1.2;
  return [
    f.position[0] * 0.5 + wobbleA,
    f.position[1] * 0.5 + 0.5 + (hashSeed(`${f.id}:y`) - 0.5) * 0.8,
    f.position[2] * 0.5 + wobbleB,
  ];
}

export const MindSpace3D: FC<Props> = ({
  data, viewMode, selectedFactorId, hoveredFactorId, hoveredNodeId, selectedNodeId, selectedNodeType,
  onFactorClick, onFactorDoubleClick, onFactorHover, onNodeClick, onNodeDoubleClick, onNodeHover,
  onScenePointerMissed, onCameraPos, cameraView,
}) => {
  const [cloudHandles, setCloudHandles] = useState<FactorCloudHandle[]>([]);
  const handleReady = useCallback((h: FactorCloudHandle[]) => setCloudHandles(h), []);

  const isFactorMode = viewMode !== "overview";
  const isFactorDomain = viewMode === "factorDomain";
  const clouds = useMemo(
    () => data.factors.map((factor) => toCloud(factor, data.character.dominantFactorIds, selectedFactorId)),
    [data.character.dominantFactorIds, data.factors, selectedFactorId],
  );
  const selectedFactor = useMemo(
    () => data.factors.find((f) => f.id === selectedFactorId) ?? null,
    [data.factors, selectedFactorId],
  );
  const streams = useMemo(
    () => data.factors.map((f) => ({
      factorId: f.id,
      startPoint: [0,0,0] as [number,number,number],
      endPoint: f.position,
      midPoint: stableStreamMidPoint(f),
      particleCount: 80,
      color: f.color,
    })),
    [data.factors],
  );

  return (
    <Canvas
      style={{ position: "fixed", inset: 0, background: "#06060f" }}
      camera={{ position: [0, 2.1, 7.4], fov: 56, near: 0.1, far: 150 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance", toneMapping: 2, toneMappingExposure: 1.1 }}
      dpr={[1, 1.5]}
      onPointerMissed={onScenePointerMissed}
    >
      <DeepSpaceField starCount={1500} hazeCount={320} />
      <ParticleNebula count={3200} />
      <ForegroundParticles count={620} />

      {/* Overview streams only. Factor Domain uses local causal links. */}
      {viewMode === "overview" && (
        <ConnectionStreams
          streams={streams}
          selectedFactorId={selectedFactorId}
          dominantFactorIds={data.character.dominantFactorIds}
        />
      )}

      {/* Core — dims when factor focused */}
      <PersonalityCore
        particleCount={data.character.particleCount}
        label={data.character.name}
        statusLine={data.character.currentState}
        isDimmed={isFactorMode}
      />

      {/* Factor clouds */}
      <FactorClouds
        clouds={clouds as any}
        hoveredFactorId={hoveredFactorId}
        selectedFactorId={selectedFactorId}
        domainMode={isFactorDomain}
        onFactorHover={onFactorHover}
        onFactorClick={onFactorClick}
        onFactorDoubleClick={onFactorDoubleClick}
        onCloudsReady={handleReady}
      />

      {/* Mental nodes — only in focusFactor */}
      <MentalNodes
        viewMode={viewMode}
        selectedFactorId={selectedFactorId}
        selectedFactorPosition={selectedFactor?.position ?? null}
        memories={data.memories}
        beliefs={data.beliefs}
        needs={data.needs}
        behaviors={data.behaviors}
        hoveredId={hoveredNodeId}
        selectedNodeId={selectedNodeId}
        selectedNodeType={selectedNodeType}
        onHover={onNodeHover}
        onClick={onNodeClick}
        onDoubleClick={onNodeDoubleClick}
      />

      {/* Labels */}
      {clouds.map((cloud) => {
        if (isFactorDomain && selectedFactorId && cloud.id !== selectedFactorId) return null;
        return (
        <FactorLabel
          key={cloud.id}
          cloud={cloud as any}
          isHovered={hoveredFactorId === cloud.id}
          isSelected={selectedFactorId === cloud.id}
          isDimmed={selectedFactorId !== null && selectedFactorId !== cloud.id}
        />
        );
      })}

      <CameraRig
        cameraView={cameraView}
        cloudHandles={cloudHandles}
        onCameraPos={onCameraPos}
      />
    </Canvas>
  );
};
