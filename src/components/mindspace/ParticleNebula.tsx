/**
 * ParticleNebula — diffuse connecting nebula dust between factor clouds.
 *
 * Soft, sparse particles that fill the space between the core and factor clouds.
 * Creates the "nebula" feel — not solid shapes, but wispy connecting dust
 * that gives the overall structure atmosphere and depth.
 *
 * Uses additive blending with very low opacity for a subtle, ethereal look.
 */

"use client";

import { useMemo, useRef, type FC } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

// ═══════════════════════════════════════════════════════════════════════════
// Shaders
// ═══════════════════════════════════════════════════════════════════════════

const NEBULA_VERTEX = /* glsl */ `
  attribute float size;
  attribute vec3 color;
  attribute float alpha;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = size * (150.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 0.3, 3.0);
    vColor = color;
    vAlpha = alpha;
  }
`;

const NEBULA_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float dist = length(gl_PointCoord - 0.5) * 2.0;
    float alpha = 1.0 - smoothstep(0.0, 1.0, dist);
    alpha = pow(alpha, 3.0);
    alpha *= vAlpha;
    alpha = clamp(alpha, 0.0, 1.0);
    if (alpha < 0.015) discard;
    gl_FragColor = vec4(vColor, alpha * 0.46);
  }
`;

// ═══════════════════════════════════════════════════════════════════════════

interface ParticleNebulaProps {
  count?: number;
}

export const ParticleNebula: FC<ParticleNebulaProps> = ({ count = 3000 }) => {
  const meshRef = useRef<THREE.Points>(null);

  const palette = useMemo(
    () => [
      new THREE.Color("#4A3A6A"),
      new THREE.Color("#3A4A6A"),
      new THREE.Color("#5A4A7A"),
      new THREE.Color("#3A3A5A"),
      new THREE.Color("#6A5A8A"),
    ],
    []
  );

  const { positions, colors, sizes, alphas } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const siz = new Float32Array(count);
    const alp = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const t = Math.random();

      const innerRadius = 0.5 + Math.random() * 2.0;
      const outerRadius = 2.6 + Math.random() * 8.8;
      const radius = innerRadius + t * outerRadius;

      const yCompression = 0.6;
      const x = Math.sin(phi) * Math.cos(theta) * radius;
      const y = Math.sin(phi) * Math.sin(theta) * radius * yCompression;
      const z = Math.cos(phi) * radius;

      const filamentAngle = Math.floor(theta / (Math.PI / 4)) * (Math.PI / 4);
      const filamentOffset = (Math.random() - 0.5) * 1.2;

      pos[i * 3] = x + Math.cos(filamentAngle) * filamentOffset;
      pos[i * 3 + 1] = y + (Math.random() - 0.5) * 1.0;
      pos[i * 3 + 2] = z + Math.sin(filamentAngle) * filamentOffset;

      const baseColor = palette[Math.floor(Math.random() * palette.length)]!;
      const distanceFromCenter = Math.sqrt(
        pos[i * 3]! ** 2 + pos[i * 3 + 1]! ** 2 + pos[i * 3 + 2]! ** 2
      );
      const brightness = Math.max(0.2, 0.9 - (distanceFromCenter / 10) * 0.6);
      col[i * 3] = baseColor.r * brightness;
      col[i * 3 + 1] = baseColor.g * brightness;
      col[i * 3 + 2] = baseColor.b * brightness;

      siz[i] = 0.032 + Math.random() * 0.072;
      alp[i] = Math.max(0.055, 0.68 - (distanceFromCenter / 9) * 0.5);
    }

    return { positions: pos, colors: col, sizes: siz, alphas: alp };
  }, [count, palette]);

  // Very slow rotation
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.02;
      meshRef.current.rotation.x += delta * 0.01;
    }
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
          count={count}
          array={colors}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          args={[sizes, 1]}
          count={count}
          array={sizes}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-alpha"
          args={[alphas, 1]}
          count={count}
          array={alphas}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={NEBULA_VERTEX}
        fragmentShader={NEBULA_FRAGMENT}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};
