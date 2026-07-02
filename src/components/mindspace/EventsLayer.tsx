/**
 * EventsLayer V2 — ONLY shows event particles when:
 * 1. A factor IS selected (selectedFactorId matches)
 * 2. Camera is close enough to that factor's cloud
 *
 * Event labels are tiny, non-overlapping. Hidden entirely in overview mode.
 */

"use client";

import { useMemo, useRef, type FC } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { FactorCloud3D, EventParticle3D } from "./types";

const EVENT_VERTEX = /* glsl */ `
  attribute float size;
  attribute vec3 color;
  attribute float alpha;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = size * (140.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 0.3, 2.8);
    vColor = color;
    vAlpha = alpha;
  }
`;

const EVENT_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float dist = length(gl_PointCoord - 0.5) * 2.0;
    float alpha = 1.0 - smoothstep(0.0, 1.0, dist);
    alpha = pow(alpha, 2.2) * vAlpha;
    alpha = clamp(alpha, 0.0, 1.0);
    if (alpha < 0.03) discard;
    gl_FragColor = vec4(vColor, alpha * 0.65);
  }
`;

const VISIBLE_DIST = 6.5;
const FULL_DIST = 3.0;

interface EventsLayerProps {
  clouds: FactorCloud3D[];
  selectedFactorId: string | null;
  hoveredEvent: EventParticle3D | null;
  onEventHover: (event: EventParticle3D | null) => void;
}

export const EventsLayer: FC<EventsLayerProps> = ({
  clouds, selectedFactorId, hoveredEvent, onEventHover,
}) => {
  const { camera } = useThree();

  // Only show events for the SELECTED factor
  if (!selectedFactorId) return null;
  const cloud = clouds.find((c) => c.id === selectedFactorId);
  if (!cloud || cloud.events.length === 0) return null;

  return (
    <CloudEvents
      cloud={cloud}
      camera={camera}
      hoveredEvent={hoveredEvent}
      onEventHover={onEventHover}
    />
  );
};

// ═══════════════════════════════════════════════════════════════════════════

const CloudEvents: FC<{
  cloud: FactorCloud3D;
  camera: THREE.Camera;
  hoveredEvent: EventParticle3D | null;
  onEventHover: (event: EventParticle3D | null) => void;
}> = ({ cloud, camera, hoveredEvent, onEventHover }) => {
  const distRef = useRef(999);

  useFrame(() => {
    const cp = new THREE.Vector3(...cloud.position);
    distRef.current = camera.position.distanceTo(cp);
  });

  const allEvents = useMemo(() => {
    const events = cloud.events;
    if (events.length === 0) return null;
    const n = events.length;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const siz = new Float32Array(n);
    const alp = new Float32Array(n);
    const baseColor = new THREE.Color(cloud.color);

    for (let i = 0; i < n; i++) {
      const e = events[i]!;
      pos[i*3] = e.position[0]; pos[i*3+1] = e.position[1]; pos[i*3+2] = e.position[2];
      const b = 0.45 + e.intensity * 0.55;
      col[i*3]=baseColor.r*b; col[i*3+1]=baseColor.g*b; col[i*3+2]=baseColor.b*b;
      siz[i] = 0.05 + e.intensity * 0.05;
      alp[i] = 0.35 + e.intensity * 0.65;
    }
    return { positions: pos, colors: col, sizes: siz, alphas: alp, count: n, events };
  }, [cloud]);

  if (!allEvents) return null;

  const dist = distRef.current;
  const visibility = dist > VISIBLE_DIST ? 0 : dist < FULL_DIST ? 1
    : 1 - (dist - FULL_DIST) / (VISIBLE_DIST - FULL_DIST);

  if (visibility < 0.03) return null;

  // Simple overlap avoidance: only show top N labels based on intensity
  const sortedEvents = [...allEvents.events]
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, 6);

  return (
    <group>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[allEvents.positions,3]} count={allEvents.count} array={allEvents.positions} itemSize={3} />
          <bufferAttribute attach="attributes-color" args={[allEvents.colors,3]} count={allEvents.count} array={allEvents.colors} itemSize={3} />
          <bufferAttribute attach="attributes-size" args={[allEvents.sizes,1]} count={allEvents.count} array={allEvents.sizes} itemSize={1} />
          <bufferAttribute attach="attributes-alpha" args={[allEvents.alphas,1]} count={allEvents.count} array={allEvents.alphas} itemSize={1} />
        </bufferGeometry>
        <shaderMaterial vertexShader={EVENT_VERTEX} fragmentShader={EVENT_FRAGMENT} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={visibility} />
      </points>

      {/* Tiny event labels — only top 6, very small */}
      {visibility > 0.35 && sortedEvents.map((event) => {
        const isHov = hoveredEvent?.id === event.id;
        return (
          <Html key={event.id} position={event.position} center distanceFactor={14} occlude={false}
            style={{ pointerEvents: "auto", cursor: "pointer", opacity: visibility * (isHov ? 1 : 0.45), transition: "opacity 0.2s" }}
            onPointerOver={(e) => { e.stopPropagation(); onEventHover(event); }}
            onPointerOut={() => onEventHover(null)}
          >
            <div style={{
              padding: "1px 6px", borderRadius: 8,
              background: "rgba(6,8,20,0.88)", border: `1px solid ${cloud.color}30`,
              fontSize: 8, color: isHov ? cloud.color : "rgba(255,255,255,0.5)", whiteSpace: "nowrap",
            }}>
              {event.label}
            </div>
          </Html>
        );
      })}
    </group>
  );
};
