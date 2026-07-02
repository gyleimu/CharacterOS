/**
 * DeepSpaceField V2 — background star field with subtle nebula haze.
 *
 * Adds a second layer of extremely faint, larger "nebula haze" particles
 * behind the star field, creating subtle depth texture without dominating.
 */

"use client";

import { useMemo, useRef, type FC } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { STAR_TINTS } from "./types";

// ═══════════════════════════════════════════════════════════════════════════
// Shaders
// ═══════════════════════════════════════════════════════════════════════════

const STAR_VERTEX = /* glsl */ `
  attribute float size;
  attribute vec3 color;
  varying vec3 vColor;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = size * (180.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 0.3, 2.5);
    vColor = color;
  }
`;

const STAR_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  void main() {
    float dist = length(gl_PointCoord - 0.5) * 2.0;
    float alpha = 1.0 - smoothstep(0.0, 1.0, dist);
    alpha = pow(alpha, 2.5);
    float core = exp(-dist * dist * 12.0) * 0.4;
    alpha += core;
    alpha = clamp(alpha, 0.0, 1.0);
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(vColor, alpha * 0.34);
  }
`;

// ── Nebula haze shaders (softer, larger, more transparent) ────────────

const HAZE_VERTEX = /* glsl */ `
  attribute float size;
  attribute vec3 color;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = size * (100.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 1.0, 12.0);
    vColor = color;
    vAlpha = clamp(1.0 / (1.0 + abs(mvPosition.z) * 0.02), 0.1, 0.6);
  }
`;

const HAZE_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float dist = length(gl_PointCoord - 0.5) * 2.0;
    float alpha = 1.0 - smoothstep(0.0, 1.0, dist);
    alpha = pow(alpha, 4.0) * vAlpha * 0.23;
    alpha = clamp(alpha, 0.0, 1.0);
    if (alpha < 0.005) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

// ═══════════════════════════════════════════════════════════════════════════

interface DeepSpaceFieldProps {
  starCount?: number;
  hazeCount?: number;
}

export const DeepSpaceField: FC<DeepSpaceFieldProps> = ({
  starCount = 2000,
  hazeCount = 300,
}) => {
  const starsRef = useRef<THREE.Points>(null);
  const hazeRef = useRef<THREE.Points>(null);

  // ── Stars ──────────────────────────────────────────────────────────

  const starData = useMemo(() => {
    const pos = new Float32Array(starCount * 3);
    const col = new Float32Array(starCount * 3);
    const siz = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 35 + Math.random() * 25;
      pos[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
      pos[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * radius;
      pos[i * 3 + 2] = Math.cos(phi) * radius;

      const tintHex = STAR_TINTS[Math.floor(Math.random() * STAR_TINTS.length)]!;
      const tint = new THREE.Color(tintHex);
      const brightness = 0.5 + Math.random() * 0.5;
      col[i * 3] = tint.r * brightness;
      col[i * 3 + 1] = tint.g * brightness;
      col[i * 3 + 2] = tint.b * brightness;

      siz[i] = Math.random() < 0.05 ? 0.9 + Math.random() * 0.8 : 0.24 + Math.random() * 0.5;
    }

    return { positions: pos, colors: col, sizes: siz, count: starCount };
  }, [starCount]);

  // ── Nebula haze ────────────────────────────────────────────────────

  const hazeData = useMemo(() => {
    const pos = new Float32Array(hazeCount * 3);
    const col = new Float32Array(hazeCount * 3);
    const siz = new Float32Array(hazeCount);
    const hazeColors = [
      new THREE.Color("#3A2A5A"),
      new THREE.Color("#2A2A4A"),
      new THREE.Color("#3A3A5A"),
      new THREE.Color("#2A3A4A"),
    ];

    for (let i = 0; i < hazeCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 20 + Math.random() * 30;
      pos[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
      pos[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * radius;
      pos[i * 3 + 2] = Math.cos(phi) * radius;

      const baseColor = hazeColors[Math.floor(Math.random() * hazeColors.length)]!;
      const brightness = 0.4 + Math.random() * 0.3;
      col[i * 3] = baseColor.r * brightness;
      col[i * 3 + 1] = baseColor.g * brightness;
      col[i * 3 + 2] = baseColor.b * brightness;

      siz[i] = 3 + Math.random() * 9;
    }

    return { positions: pos, colors: col, sizes: siz, count: hazeCount };
  }, [hazeCount]);

  // ── Animation ──────────────────────────────────────────────────────

  useFrame((_, delta) => {
    if (starsRef.current) {
      starsRef.current.rotation.y += delta * 0.006;
      starsRef.current.rotation.x += delta * 0.002;
    }
    if (hazeRef.current) {
      hazeRef.current.rotation.y -= delta * 0.004;
      hazeRef.current.rotation.x -= delta * 0.003;
    }
  });

  return (
    <group>
      {/* Stars */}
      <points ref={starsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[starData.positions, 3]}
            count={starData.count}
            array={starData.positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[starData.colors, 3]}
            count={starData.count}
            array={starData.colors}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-size"
            args={[starData.sizes, 1]}
            count={starData.count}
            array={starData.sizes}
            itemSize={1}
          />
        </bufferGeometry>
        <shaderMaterial
          vertexShader={STAR_VERTEX}
          fragmentShader={STAR_FRAGMENT}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Nebula haze */}
      <points ref={hazeRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[hazeData.positions, 3]}
            count={hazeData.count}
            array={hazeData.positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[hazeData.colors, 3]}
            count={hazeData.count}
            array={hazeData.colors}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-size"
            args={[hazeData.sizes, 1]}
            count={hazeData.count}
            array={hazeData.sizes}
            itemSize={1}
          />
        </bufferGeometry>
        <shaderMaterial
          vertexShader={HAZE_VERTEX}
          fragmentShader={HAZE_FRAGMENT}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
};
