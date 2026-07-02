"use client";

import { useMemo, useRef, type FC } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const FOREGROUND_VERTEX = /* glsl */ `
  attribute float size;
  attribute float alpha;
  varying float vAlpha;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = clamp(size * (150.0 / -mvPosition.z), 0.4, 3.2);
    vAlpha = alpha * clamp(1.0 / (1.0 + abs(mvPosition.z) * 0.035), 0.18, 0.85);
  }
`;

const FOREGROUND_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float dist = length(gl_PointCoord - 0.5) * 2.0;
    float alpha = 1.0 - smoothstep(0.0, 1.0, dist);
    alpha = pow(alpha, 2.2) * vAlpha;
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

interface ForegroundParticlesProps {
  count?: number;
}

function seededUnit(seed: number): number {
  const x = Math.sin(seed * 9176.317) * 43758.5453;
  return x - Math.floor(x);
}

export const ForegroundParticles: FC<ForegroundParticlesProps> = ({ count = 420 }) => {
  const ref = useRef<THREE.Points>(null);

  const data = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const theta = seededUnit(i + 1) * Math.PI * 2;
      const radius = 8 + seededUnit(i + 17) * 12;
      const height = (seededUnit(i + 31) - 0.5) * 7;
      positions[i * 3] = Math.cos(theta) * radius + (seededUnit(i + 43) - 0.5) * 2.5;
      positions[i * 3 + 1] = height;
      positions[i * 3 + 2] = Math.sin(theta) * radius + (seededUnit(i + 59) - 0.5) * 2.5;
      sizes[i] = 0.018 + seededUnit(i + 71) * 0.05;
      alphas[i] = 0.05 + seededUnit(i + 83) * 0.16;
    }

    return { positions, sizes, alphas };
  }, [count]);

  useFrame(({ clock }, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.008;
    ref.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.12) * 0.035;
  });

  return (
    <points ref={ref} raycast={() => null}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.positions, 3]} count={count} array={data.positions} itemSize={3} />
        <bufferAttribute attach="attributes-size" args={[data.sizes, 1]} count={count} array={data.sizes} itemSize={1} />
        <bufferAttribute attach="attributes-alpha" args={[data.alphas, 1]} count={count} array={data.alphas} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={FOREGROUND_VERTEX}
        fragmentShader={FOREGROUND_FRAGMENT}
        uniforms={{ uColor: { value: new THREE.Color("#B9C6FF") } }}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};
