/**
 * ConnectionStreams V3 — animated particle flow from core to factors.
 *
 * - 80 particles per stream (was 60)
 * - Flowing animation: particles drift along bezier curve
 * - Slightly brighter, more visible
 * - Selected factor stream brightens, others dim
 */

"use client";

import { useMemo, useRef, type FC } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { ConnectionStreamData } from "./types";

const STREAM_VERTEX = /* glsl */ `
  attribute float size;
  attribute vec3 color;
  attribute float alpha;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = size * (130.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 0.2, 2.2);
    vColor = color;
    vAlpha = alpha;
  }
`;

const STREAM_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float dist = length(gl_PointCoord - 0.5) * 2.0;
    float alpha = 1.0 - smoothstep(0.0, 1.0, dist);
    alpha = pow(alpha, 3.0) * vAlpha;
    alpha = clamp(alpha, 0.0, 1.0);
    if (alpha < 0.015) discard;
    gl_FragColor = vec4(vColor, alpha * 0.42 * uOpacity);
  }
`;

interface ConnectionStreamsProps {
  streams: ConnectionStreamData[];
  selectedFactorId: string | null;
  dominantFactorIds?: string[];
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seed: number): number {
  seed = Math.imul(seed ^ (seed >>> 15), 2246822507);
  seed = Math.imul(seed ^ (seed >>> 13), 3266489909);
  return ((seed ^ (seed >>> 16)) >>> 0) / 4294967295;
}

function stableJitter(factorId: string, index: number, axis: number, amount: number): number {
  return (seededUnit(hashSeed(`${factorId}:${index}:${axis}`)) - 0.5) * amount;
}

export const ConnectionStreams: FC<ConnectionStreamsProps> = ({ streams, selectedFactorId, dominantFactorIds = [] }) => {
  return (
    <group>
      {streams.map((s) => (
        <StreamLine
          key={s.factorId}
          stream={s}
          highlighted={selectedFactorId === s.factorId}
          dominant={dominantFactorIds.includes(s.factorId)}
          dimmed={selectedFactorId !== null && selectedFactorId !== s.factorId}
        />
      ))}
    </group>
  );
};

// ═══════════════════════════════════════════════════════════════════════════

const StreamLine: FC<{
  stream: ConnectionStreamData;
  highlighted: boolean;
  dominant: boolean;
  dimmed: boolean;
}> = ({ stream, highlighted, dominant, dimmed }) => {
  const meshRef = useRef<THREE.Points>(null);
  const flowRef = useRef(0);

  const { positions, colors, sizes, alphas, count } = useMemo(() => {
    const n = highlighted ? 132 : dominant ? 112 : 82;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const siz = new Float32Array(n);
    const alp = new Float32Array(n);
    const baseColor = new THREE.Color(stream.color);
    const { startPoint: s, midPoint: m, endPoint: e } = stream;

    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const u = 1 - t;
      const jitter = 0.06;
      pos[i * 3]     = u*u*s[0] + 2*u*t*m[0] + t*t*e[0] + stableJitter(stream.factorId, i, 0, jitter);
      pos[i * 3 + 1] = u*u*s[1] + 2*u*t*m[1] + t*t*e[1] + stableJitter(stream.factorId, i, 1, jitter);
      pos[i * 3 + 2] = u*u*s[2] + 2*u*t*m[2] + t*t*e[2] + stableJitter(stream.factorId, i, 2, jitter);

      const edge = 1 - Math.abs(t - 0.5) * 2;
      const brightness = 0.25 + edge * 0.5;
      col[i * 3]     = baseColor.r * brightness;
      col[i * 3 + 1] = baseColor.g * brightness;
      col[i * 3 + 2] = baseColor.b * brightness;
      siz[i] = (highlighted ? 0.026 : dominant ? 0.021 : 0.015) + edge * (highlighted ? 0.064 : dominant ? 0.052 : 0.034);
      alp[i] = (highlighted ? 0.11 : dominant ? 0.075 : 0.035) + edge * (highlighted ? 0.58 : dominant ? 0.46 : 0.24);
    }
    return { positions: pos, colors: col, sizes: siz, alphas: alp, count: n };
  }, [stream, highlighted, dominant]);

  // Flow animation: shift a phase offset over time
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    flowRef.current = (t * 0.3) % 1;

    // Subtle drift
    meshRef.current.position.x = Math.sin(t * 0.4 + stream.startPoint[0]) * 0.08;
    meshRef.current.position.y = Math.cos(t * 0.5 + stream.startPoint[1]) * 0.06;
  });

  // Opacity based on highlight/dim state
  const targetOpacity = highlighted ? 1.0 : dimmed ? 0.1 : dominant ? 0.58 : 0.24;
  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.ShaderMaterial;
    if (!mat.uniforms) return;
    const cur = (mat as any)._opacity || 0.65;
    const next = cur + (targetOpacity - cur) * Math.min(delta * 4, 1);
    (mat as any)._opacity = next;
    if (mat.uniforms.uOpacity) mat.uniforms.uOpacity.value = next;
  });

  return (
    <points ref={meshRef} raycast={() => null}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} count={count} array={colors} itemSize={3} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} count={count} array={sizes} itemSize={1} />
        <bufferAttribute attach="attributes-alpha" args={[alphas, 1]} count={count} array={alphas} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={STREAM_VERTEX}
        fragmentShader={STREAM_FRAGMENT}
        uniforms={{ uOpacity: { value: targetOpacity } }}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        opacity={0.65}
      />
    </points>
  );
};
