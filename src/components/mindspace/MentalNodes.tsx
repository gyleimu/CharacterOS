/**
 * MentalNodes — tiny glow markers only. NO LABELS on the star map.
 * Beliefs, needs, behaviors appear as small colored dots near factor clouds.
 * Full details are in the Inspector panel, not on the 3D scene.
 */

"use client";

import { useEffect, useMemo, useRef, type CSSProperties, type FC } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { SemanticMemory, SemanticBelief, SemanticNeed, SemanticBehavior, ViewMode } from "./semanticTypes";

const TINY_VERTEX = /* glsl */ `
  uniform float uSize;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = clamp(uSize * (210.0 / -mvPosition.z), 1.0, 4.2);
  }
`;

const TINY_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    float dist = length(gl_PointCoord - 0.5) * 2.0;
    float alpha = 1.0 - smoothstep(0.0, 1.0, dist);
    alpha = pow(alpha, 2.2) * uOpacity;
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

const FLOW_VERTEX = /* glsl */ `
  attribute float size;
  attribute float alpha;
  varying float vAlpha;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = clamp(size * (180.0 / -mvPosition.z), 0.5, 3.4);
    vAlpha = alpha;
  }
`;

const FLOW_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float dist = length(gl_PointCoord - 0.5) * 2.0;
    float alpha = 1.0 - smoothstep(0.0, 1.0, dist);
    alpha = pow(alpha, 2.4) * vAlpha;
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

interface MentalNodesProps {
  viewMode: ViewMode;
  selectedFactorId: string | null;
  selectedFactorPosition: [number, number, number] | null;
  memories: SemanticMemory[];
  beliefs: SemanticBelief[];
  needs: SemanticNeed[];
  behaviors: SemanticBehavior[];
  hoveredId: string | null;
  selectedNodeId: string | null;
  selectedNodeType: string | null;
  onHover: (type: string, id: string, phase: "over" | "out") => void;
  onClick: (type: string, id: string) => void;
  onDoubleClick: (type: string, id: string) => void;
}

export const MentalNodes: FC<MentalNodesProps> = ({
  viewMode, selectedFactorId, selectedFactorPosition, memories, beliefs, needs, behaviors,
  hoveredId, selectedNodeId, selectedNodeType, onHover, onClick, onDoubleClick,
}) => {
  const show = viewMode === "factorDomain" || viewMode === "focusFactor" || viewMode === "focusMemory" || viewMode === "behaviorPreview";
  if (!show || !selectedFactorId || !selectedFactorPosition) return null;

  const filteredMemories = memories.filter((m) => m.factorId === selectedFactorId).slice(0, 3);
  const filteredBeliefs = beliefs.filter((b) => b.factorId === selectedFactorId);
  const filteredNeeds = needs.filter((n) => n.factorId === selectedFactorId);
  const filteredBehaviors = behaviors.filter((b) => b.sourceFactorIds.includes(selectedFactorId));
  const factorPosition = selectedFactorPosition;

  const memoryPositions = filteredMemories.map((m, i) => ({
    ...m,
    domainPosition: domainPosition(factorPosition, "memory", i, filteredMemories.length),
  }));
  const beliefPositions = filteredBeliefs.map((b, i) => ({
    ...b,
    domainPosition: domainPosition(factorPosition, "belief", i, filteredBeliefs.length),
  }));
  const needPositions = filteredNeeds.map((n, i) => ({
    ...n,
    domainPosition: domainPosition(factorPosition, "need", i, filteredNeeds.length),
  }));
  const behaviorPositions = filteredBehaviors.map((b, i) => ({
    ...b,
    domainPosition: domainPosition(factorPosition, "behavior", i, filteredBehaviors.length),
  }));

  return (
    <group>
      {memoryPositions.map((m) => (
        <DomainLink
          key={`${m.id}-link`}
          from={m.domainPosition}
          to={factorPosition}
          color={m.color}
          opacity={0.24}
          active={!selectedNodeId || selectedNodeId === m.id}
        />
      ))}
      {beliefPositions.map((b) => (
        <DomainLink
          key={`${b.id}-link`}
          from={factorPosition}
          to={b.domainPosition}
          color={b.color}
          opacity={0.22}
          active={!selectedNodeId || selectedNodeType === "belief" || selectedNodeType === "need" || selectedNodeType === "behavior"}
        />
      ))}
      {needPositions.map((n) => (
        <DomainLink
          key={`${n.id}-link`}
          from={beliefPositions[0]?.domainPosition ?? factorPosition}
          to={n.domainPosition}
          color={n.color}
          opacity={0.2}
          active={!selectedNodeId || selectedNodeId === n.id || selectedNodeType === "behavior"}
        />
      ))}
      {behaviorPositions.map((b) => (
        <DomainLink
          key={`${b.id}-link`}
          from={needPositions[0]?.domainPosition ?? factorPosition}
          to={b.domainPosition}
          color={b.color}
          opacity={0.22}
          active={!selectedNodeId || selectedNodeId === b.id}
        />
      ))}

      {memoryPositions.map((m) => (
        <GlowDot key={m.id} position={m.domainPosition} color={m.color} size={0.09}
          label={shortLabel(m.summary)}
          kind="Memory"
          isHovered={hoveredId === m.id}
          isSelected={selectedNodeId === m.id}
          onPointerOver={() => onHover("memory", m.id, "over")}
          onPointerOut={() => onHover("memory", m.id, "out")}
          onClick={() => onClick("memory", m.id)}
          onDoubleClick={() => onDoubleClick("memory", m.id)}
        />
      ))}
      {beliefPositions.map((b) => (
        <GlowDot key={b.id} position={b.domainPosition} color={b.color} size={0.1}
          label={shortLabel(b.text)}
          kind="Belief"
          isHovered={hoveredId === b.id}
          isSelected={selectedNodeId === b.id}
          onPointerOver={() => onHover("belief", b.id, "over")}
          onPointerOut={() => onHover("belief", b.id, "out")}
          onClick={() => onClick("belief", b.id)}
          onDoubleClick={() => onDoubleClick("belief", b.id)}
        />
      ))}
      {needPositions.map((n) => (
        <GlowDot key={n.id} position={n.domainPosition} color={n.color} size={0.12}
          label={n.zhName}
          kind="Need"
          isHovered={hoveredId === n.id}
          isSelected={selectedNodeId === n.id}
          onPointerOver={() => onHover("need", n.id, "over")}
          onPointerOut={() => onHover("need", n.id, "out")}
          onClick={() => onClick("need", n.id)}
          onDoubleClick={() => onDoubleClick("need", n.id)}
        />
      ))}
      {behaviorPositions.map((b) => (
        <GlowDot key={b.id} position={b.domainPosition} color={b.color} size={0.14}
          label={`${b.zhName} ${Math.round(b.probability * 100)}%`}
          kind="Behavior"
          isHovered={hoveredId === b.id}
          isSelected={selectedNodeId === b.id}
          onPointerOver={() => onHover("behavior", b.id, "over")}
          onPointerOut={() => onHover("behavior", b.id, "out")}
          onClick={() => onClick("behavior", b.id)}
          onDoubleClick={() => onDoubleClick("behavior", b.id)}
        />
      ))}
    </group>
  );
};

function shortLabel(value: string): string {
  return value.length > 12 ? `${value.slice(0, 12)}…` : value;
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

const MAX_DOMAIN_LINK_LENGTH = 4.8;

const DomainLink: FC<{
  from: [number, number, number];
  to: [number, number, number];
  color: string;
  opacity: number;
  active: boolean;
}> = ({ from, to, color, opacity, active }) => {
  const length = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    return a.distanceTo(b);
  }, [from, to]);
  const isValid = Number.isFinite(length) && length <= MAX_DOMAIN_LINK_LENGTH;

  const geometry = useMemo(() => {
    if (!isValid) return null;
    const count = active ? 44 : 26;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    const normal = new THREE.Vector3(-dir.z, dir.y * 0.15, dir.x).normalize();
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const p = a.clone().lerp(b, t);
      const bow = Math.sin(t * Math.PI) * 0.08;
      p.addScaledVector(normal, bow);
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      sizes[i] = (active ? 0.022 : 0.016) + Math.sin(t * Math.PI) * (active ? 0.036 : 0.022);
      const flowPulse = active ? (0.55 + 0.45 * Math.sin(t * Math.PI * 3)) : 0.75;
      alphas[i] = opacity * (active ? 1.45 : 0.55) * flowPulse * (0.35 + Math.sin(t * Math.PI) * 0.65);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    g.setAttribute("alpha", new THREE.BufferAttribute(alphas, 1));
    return g;
  }, [active, from, isValid, opacity, to]);

  useEffect(() => () => {
    geometry?.dispose();
  }, [geometry]);

  useEffect(() => {
    if (!isValid) console.warn("[CharacterOS] Hidden invalid Factor Domain path", { from, to, length });
  }, [from, isValid, length, to]);

  if (!geometry) return null;

  return (
    <points geometry={geometry} raycast={() => null}>
      <shaderMaterial
        vertexShader={FLOW_VERTEX}
        fragmentShader={FLOW_FRAGMENT}
        uniforms={{ uColor: { value: new THREE.Color(color) } }}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

// Tiny semantic particle — no solid spheres on the star map.
const GlowDot: FC<{
  position: [number,number,number]; color: string; size: number;
  label: string;
  kind: string;
  isHovered: boolean;
  isSelected: boolean;
  onPointerOver: () => void; onPointerOut: () => void; onClick: () => void; onDoubleClick: () => void;
}> = ({ position, color, size, label, kind, isHovered, isSelected, onPointerOver, onPointerOut, onClick, onDoubleClick }) => {
  const pointerDown = useRef<{ x: number; y: number; time: number } | null>(null);
  const clickTimer = useRef<number | null>(null);
  const particleGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0], 3));
    return geometry;
  }, []);

  useEffect(() => {
    return () => {
      if (clickTimer.current) window.clearTimeout(clickTimer.current);
      particleGeometry.dispose();
    };
  }, [particleGeometry]);

  return (
    <group position={position}>
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); if (!isHovered) onPointerOver(); }}
        onPointerOut={(e) => { e.stopPropagation(); onPointerOut(); }}
        onPointerDown={(e) => { e.stopPropagation(); pointerDown.current = { x: e.clientX, y: e.clientY, time: Date.now() }; }}
        onPointerUp={(e) => {
          e.stopPropagation();
          const down = pointerDown.current;
          pointerDown.current = null;
          if (!down) return;
          const dx = e.clientX - down.x;
          const dy = e.clientY - down.y;
          if (Date.now() - down.time > 300 || Math.sqrt(dx * dx + dy * dy) >= 5) return;
          if (clickTimer.current) window.clearTimeout(clickTimer.current);
          clickTimer.current = window.setTimeout(() => {
            clickTimer.current = null;
            onClick();
          }, 180);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (clickTimer.current) {
            window.clearTimeout(clickTimer.current);
            clickTimer.current = null;
          }
          onDoubleClick();
        }}
      >
        <sphereGeometry args={[Math.max(size * 8.5, 0.55), 10, 10]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
      <points raycast={() => null} geometry={particleGeometry}>
        <shaderMaterial
          key={color}
          vertexShader={TINY_VERTEX}
          fragmentShader={TINY_FRAGMENT}
          uniforms={{
            uColor: { value: new THREE.Color(color) },
            uOpacity: { value: isSelected ? 0.92 : isHovered ? 0.78 : 0.55 },
            uSize: { value: size * (isSelected ? 1.08 : 0.82) },
          }}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <Html
        position={[0, size * 3.2, 0]}
        center
        distanceFactor={7.5}
        occlude={false}
        style={{
          pointerEvents: "none",
          opacity: isSelected ? 1 : isHovered ? 0.92 : 0.62,
          transition: "opacity .2s",
          whiteSpace: "nowrap",
        }}
      >
        <div className={`domain-node-label ${isHovered ? "hovered" : ""} ${isSelected ? "selected" : ""}`} style={{ "--node-color": color } as CSSProperties}>
          <span>{kind}</span>
          <strong>{label}</strong>
        </div>
      </Html>
    </group>
  );
};
