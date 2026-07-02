/**
 * FactorClouds V5 — STABLE interaction model.
 *
 * ROOT CAUSE FIX: Removed scale animation on hover. The infinite hover loop was:
 *   hover → scale 1.08x → particles move under pointer → pointerOut fires
 *   → scale resets to 1.0 → particles back under pointer → pointerOver fires → loop.
 *
 * FIXES:
 * - Invisible hit spheres for stable raycasting (Points raycast disabled)
 * - Hover only changes opacity/brightness, NEVER position or scale
 * - Click: pointerDown→pointerUp detection with movement threshold
 * - No useFrame for scale/opacity animation
 * - Labels have pointer-events: none
 */

"use client";

import { useCallback, useMemo, useRef, useEffect, type FC } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { FactorCloud3D, FactorCloudHandle } from "./types";
import { incrementHoverOver, incrementHoverOut } from "./DebugOverlay";

// ═══════════════════════════════════════════════════════════════════════════
// Shaders
// ═══════════════════════════════════════════════════════════════════════════

const HALO_VERTEX = /* glsl */ `
  attribute float size; attribute vec3 color; attribute float alpha;
  varying vec3 vColor; varying float vAlpha;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = size * (180.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 0.3, 3.8);
    vColor = color;
    vAlpha = alpha * clamp(1.0 / (1.0 + abs(mvPosition.z) * 0.05), 0.2, 1.0);
  }
`;
const HALO_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor; varying float vAlpha;
  void main() {
    float dist = length(gl_PointCoord - 0.5) * 2.0;
    float alpha = 1.0 - smoothstep(0.0, 1.0, dist);
    alpha = pow(alpha, 2.5) * vAlpha;
    alpha = clamp(alpha, 0.0, 1.0);
    if (alpha < 0.018) discard;
    gl_FragColor = vec4(vColor, alpha * 0.7 * uOpacity);
  }
`;
const CORE_VERTEX = /* glsl */ `
  attribute float size; attribute vec3 color;
  varying vec3 vColor; varying float vAlpha;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = size * (230.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 0.5, 5.0);
    vColor = color;
    vAlpha = clamp(1.0 / (1.0 + abs(mvPosition.z) * 0.035), 0.35, 1.0);
  }
`;
const CORE_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor; varying float vAlpha;
  void main() {
    float dist = length(gl_PointCoord - 0.5) * 2.0;
    float alpha = 1.0 - smoothstep(0.0, 1.0, dist);
    alpha = pow(alpha, 1.4);
    float core = exp(-dist * dist * 9.0) * 0.5;
    alpha = (alpha * 0.65 + core) * vAlpha;
    alpha = clamp(alpha, 0.0, 1.0);
    if (alpha < 0.025) discard;
    gl_FragColor = vec4(vColor, alpha * uOpacity);
  }
`;

// ═══════════════════════════════════════════════════════════════════════════
// Seeded PRNG
// ═══════════════════════════════════════════════════════════════════════════

function sRng(seed: number): () => number {
  return () => { seed = (seed * 16807 + 0) % 2147483647; return (seed - 1) / 2147483646; };
}
function hash(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return Math.abs(h); }

// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  clouds: FactorCloud3D[];
  hoveredFactorId: string | null;
  selectedFactorId: string | null;
  domainMode?: boolean;
  onFactorHover: (id: string, phase: "over" | "out") => void;
  onFactorClick: (id: string) => void;
  onFactorDoubleClick: (id: string) => void;
  onCloudsReady?: (handles: FactorCloudHandle[]) => void;
}

export const FactorClouds: FC<Props> = ({
  clouds, hoveredFactorId, selectedFactorId, domainMode = false, onFactorHover, onFactorClick, onFactorDoubleClick, onCloudsReady,
}) => {
  const groupRef = useRef<THREE.Group>(null);

  const handles: FactorCloudHandle[] = useMemo(
    () => clouds.map((c) => ({ id: c.id, position: c.position, boundingRadius: c.haloSpread * 3.5 })),
    [clouds]
  );
  useEffect(() => { onCloudsReady?.(handles); }, [handles, onCloudsReady]);

  // ✅ NO rotation — keeps hit spheres stationary under pointer
  // Previously: rotation caused hit spheres to move while pointer was still,
  // triggering infinite pointerOver/Out loops.

  return (
    <group ref={groupRef}>
      {clouds.map((cloud) => (
        <StableFactorNode
          key={cloud.id}
          cloud={cloud}
          isHovered={hoveredFactorId === cloud.id}
          isSelected={selectedFactorId === cloud.id}
          isDimmed={selectedFactorId !== null && selectedFactorId !== cloud.id}
          domainMode={domainMode}
          onHover={onFactorHover}
          onClick={onFactorClick}
          onDoubleClick={onFactorDoubleClick}
        />
      ))}
    </group>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// STABLE Factor Node: invisible hit sphere + visual particles
// ═══════════════════════════════════════════════════════════════════════════

interface NodeProps {
  cloud: FactorCloud3D;
  isHovered: boolean;
  isSelected: boolean;
  isDimmed: boolean;
  domainMode: boolean;
  onHover: (id: string, phase: "over" | "out") => void;
  onClick: (id: string) => void;
  onDoubleClick: (id: string) => void;
}

interface FactorMotion {
  seed: number;
  rotationSpeed: number;
  pulseSpeed: number;
  pulseAmount: number;
  opacityPulse: number;
  wobble: number;
  driftX: number;
  driftY: number;
  driftZ: number;
  driftSpeed: number;
}

function motionForFactor(id: string): FactorMotion {
  const seed = (hash(`${id}:motion`) % 1000) / 1000;
  const base: FactorMotion = {
    seed: seed * Math.PI * 2,
    rotationSpeed: 0.055 + seed * 0.025,
    pulseSpeed: 0.62 + seed * 0.22,
    pulseAmount: 0.018,
    opacityPulse: 0.035,
    wobble: 0.018,
    driftX: 0.018,
    driftY: 0.012,
    driftZ: 0.016,
    driftSpeed: 0.28 + seed * 0.16,
  };
  const presets: Record<string, Partial<FactorMotion>> = {
    security: { rotationSpeed: 0.034, pulseSpeed: 0.48, pulseAmount: 0.012, opacityPulse: 0.022, wobble: 0.01, driftX: 0.01, driftY: 0.006, driftZ: 0.01 },
    attachment: { rotationSpeed: 0.048, pulseSpeed: 0.58, pulseAmount: 0.018, opacityPulse: 0.032, wobble: 0.017, driftX: 0.024, driftY: 0.01, driftZ: 0.018 },
    fear: { rotationSpeed: 0.082, pulseSpeed: 1.08, pulseAmount: 0.02, opacityPulse: 0.05, wobble: 0.032, driftX: 0.016, driftY: 0.018, driftZ: 0.014 },
    shame: { rotationSpeed: 0.026, pulseSpeed: 0.42, pulseAmount: 0.01, opacityPulse: 0.02, wobble: 0.009, driftX: 0.008, driftY: 0.006, driftZ: 0.008 },
    trust: { rotationSpeed: 0.036, pulseSpeed: 0.72, pulseAmount: 0.012, opacityPulse: 0.042, wobble: 0.012, driftX: 0.01, driftY: 0.008, driftZ: 0.01 },
    hope: { rotationSpeed: 0.05, pulseSpeed: 0.56, pulseAmount: 0.022, opacityPulse: 0.04, wobble: 0.016, driftX: 0.014, driftY: 0.026, driftZ: 0.014 },
    control: { rotationSpeed: 0.045, pulseSpeed: 0.68, pulseAmount: 0.012, opacityPulse: 0.03, wobble: 0.018, driftX: 0.01, driftY: 0.008, driftZ: 0.012 },
    loneliness: { rotationSpeed: 0.022, pulseSpeed: 0.38, pulseAmount: 0.012, opacityPulse: 0.055, wobble: 0.008, driftX: 0.01, driftY: 0.008, driftZ: 0.01 },
  };
  return { ...base, ...(presets[id] ?? {}) };
}

const StableFactorNode: FC<NodeProps> = ({
  cloud, isHovered, isSelected, isDimmed, domainMode, onHover, onClick, onDoubleClick,
}) => {
  const visualGroupRef = useRef<THREE.Group>(null);
  const haloMatRef = useRef<THREE.ShaderMaterial>(null);
  const coreMatRef = useRef<THREE.ShaderMaterial>(null);
  const hitMeshRef = useRef<THREE.Mesh>(null);
  const pointerDown = useRef<{ x: number; y: number; time: number } | null>(null);
  const pointerInside = useRef(false);
  const clickTimer = useRef<number | null>(null);

  // Visual brightness: selected > hovered > normal > dimmed
  const brightness = isSelected ? (domainMode ? 1.52 : 1.58) : isHovered ? 1.18 : isDimmed ? (domainMode ? 0.04 : 0.2) : 1.0;
  const canInteract = !domainMode || isSelected;
  const motion = useMemo(() => motionForFactor(cloud.id), [cloud.id]);

  // Apply brightness via shader uniforms (opacity)
  useEffect(() => {
    if (haloMatRef.current?.uniforms.uOpacity) haloMatRef.current.uniforms.uOpacity.value = brightness;
    if (coreMatRef.current?.uniforms.uOpacity) coreMatRef.current.uniforms.uOpacity.value = brightness;
  }, [brightness]);

  useEffect(() => {
    return () => {
      if (clickTimer.current) window.clearTimeout(clickTimer.current);
      if (pointerInside.current) document.body.style.cursor = "";
    };
  }, []);

  // ── Halo particles ────────────────────────────────────────────────

  const halo = useMemo(() => {
    const n = cloud.haloParticleCount;
    const pos = new Float32Array(n*3), col = new Float32Array(n*3);
    const siz = new Float32Array(n), alp = new Float32Array(n);
    const base = new THREE.Color(cloud.color);
    const rng = sRng(hash(cloud.id));
    const es = cloud.haloSpread * 0.6;

    for (let i=0;i<n;i++) {
      const g = (m:number,s:number)=>{let u=0,v=0;while(u===0)u=rng();while(v===0)v=rng();return m+s*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};
      pos[i*3]=g(0,es);pos[i*3+1]=g(0,es);pos[i*3+2]=g(0,es);
      const d=Math.sqrt(pos[i*3]!**2+pos[i*3+1]!**2+pos[i*3+2]!**2)/(es*3);
      const b=0.25+(1-Math.min(d,.95))*.55;
      col[i*3]=base.r*b;col[i*3+1]=base.g*b;col[i*3+2]=base.b*b;
      siz[i]=0.02+(1-Math.min(d,.9))*.05+rng()*.012;
      alp[i]=Math.max(.06,.75-d*.7);
    }
    return { positions:pos,colors:col,sizes:siz,alphas:alp,count:n };
  }, [cloud]);

  // ── Core particles ─────────────────────────────────────────────────

  const coreData = useMemo(() => {
    const n = cloud.coreParticleCount;
    const pos = new Float32Array(n*3), col = new Float32Array(n*3), siz = new Float32Array(n);
    const base = new THREE.Color(cloud.color), acc = new THREE.Color(cloud.accentColor);
    const rng = sRng(hash(cloud.id+"_core"));
    const cr = cloud.coreRadius * 0.45;
    for (let i=0;i<n;i++) {
      const g=(m:number,s:number)=>{let u=0,v=0;while(u===0)u=rng();while(v===0)v=rng();return m+s*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};
      pos[i*3]=g(0,cr);pos[i*3+1]=g(0,cr);pos[i*3+2]=g(0,cr);
      const mix=base.clone().lerp(acc,rng());const b=.7+rng()*.3;
      col[i*3]=mix.r*b;col[i*3+1]=mix.g*b;col[i*3+2]=mix.b*b;
      siz[i]=.04+rng()*.07;
    }
    return { positions:pos,colors:col,sizes:siz,count:n };
  }, [cloud]);

  // Hit sphere radius: large enough to be easily clickable
  const hitRadius = Math.max(cloud.haloSpread * 2.4, cloud.coreRadius * 8, 1.35);
  const hitRaycast = useCallback((raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) => {
    if (!canInteract || !hitMeshRef.current) return;
    THREE.Mesh.prototype.raycast.call(hitMeshRef.current, raycaster, intersects);
  }, [canInteract]);

  useFrame(({ clock }, delta) => {
    const selectedScale = domainMode && isSelected ? 1.26 : isSelected ? 1.24 : 1;
    const t = clock.getElapsedTime();
    const breathe = 1 + Math.sin(t * motion.pulseSpeed + motion.seed) * (isSelected ? motion.pulseAmount * 1.35 : motion.pulseAmount);
    if (visualGroupRef.current) {
      visualGroupRef.current.rotation.y += delta * motion.rotationSpeed * (domainMode && !isSelected ? 0.18 : 1);
      visualGroupRef.current.rotation.x = Math.sin(t * motion.pulseSpeed * 0.55 + motion.seed) * motion.wobble;
      visualGroupRef.current.rotation.z = Math.cos(t * motion.pulseSpeed * 0.72 + motion.seed) * motion.wobble;
      visualGroupRef.current.position.set(
        Math.sin(t * motion.driftSpeed + motion.seed) * motion.driftX,
        Math.sin(t * motion.driftSpeed * 0.8 + motion.seed * 1.7) * motion.driftY,
        Math.cos(t * motion.driftSpeed * 0.9 + motion.seed) * motion.driftZ,
      );
      visualGroupRef.current.scale.setScalar(selectedScale * breathe);
    }
    const shimmer = 1 + Math.sin(t * (motion.pulseSpeed + 0.23) + motion.seed) * motion.opacityPulse;
    if (haloMatRef.current?.uniforms.uOpacity) haloMatRef.current.uniforms.uOpacity.value = brightness * shimmer;
    if (coreMatRef.current?.uniforms.uOpacity) coreMatRef.current.uniforms.uOpacity.value = brightness * (1 + (shimmer - 1) * 0.55);
  });

  return (
    <group position={cloud.position}>
      {/* ═══ INVISIBLE HIT SPHERE — stable, never changes size ═══ */}
      <mesh
        ref={hitMeshRef}
        raycast={hitRaycast}
        onPointerOver={(e) => {
          if (!canInteract) return;
          e.stopPropagation();
          if (pointerInside.current) return;
          pointerInside.current = true;
          document.body.style.cursor = "pointer";
          incrementHoverOver();
          onHover(cloud.id, "over");
        }}
        onPointerOut={(e) => {
          if (!canInteract) return;
          e.stopPropagation();
          if (!pointerInside.current && !isHovered) return;
          pointerInside.current = false;
          document.body.style.cursor = "";
          incrementHoverOut();
          onHover(cloud.id, "out");
        }}
        onPointerDown={(e) => {
          if (!canInteract) return;
          e.stopPropagation();
          pointerDown.current = { x: e.clientX, y: e.clientY, time: Date.now() };
        }}
        onPointerUp={(e) => {
          if (!canInteract) return;
          e.stopPropagation();
          const d = pointerDown.current;
          if (!d) return;
          pointerDown.current = null;
          const dt = Date.now() - d.time;
          const dx = e.clientX - d.x, dy = e.clientY - d.y;
          if (dt < 300 && Math.sqrt(dx*dx+dy*dy) < 5) {
            if (clickTimer.current) window.clearTimeout(clickTimer.current);
            clickTimer.current = window.setTimeout(() => {
              clickTimer.current = null;
              onClick(cloud.id);
            }, 180);
          }
        }}
        onDoubleClick={(e) => {
          if (!canInteract) return;
          e.stopPropagation();
          if (clickTimer.current) {
            window.clearTimeout(clickTimer.current);
            clickTimer.current = null;
          }
          onDoubleClick(cloud.id);
        }}
      >
        <sphereGeometry args={[hitRadius, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>

      {/* ═══ VISUAL PARTICLES — raycast disabled ═══ */}
      <group ref={visualGroupRef}>
        {/* Halo */}
        <points raycast={() => null}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[halo.positions,3]} count={halo.count} array={halo.positions} itemSize={3} />
            <bufferAttribute attach="attributes-color" args={[halo.colors,3]} count={halo.count} array={halo.colors} itemSize={3} />
            <bufferAttribute attach="attributes-size" args={[halo.sizes,1]} count={halo.count} array={halo.sizes} itemSize={1} />
            <bufferAttribute attach="attributes-alpha" args={[halo.alphas,1]} count={halo.count} array={halo.alphas} itemSize={1} />
          </bufferGeometry>
          <shaderMaterial
            ref={haloMatRef}
            vertexShader={HALO_VERTEX}
            fragmentShader={HALO_FRAGMENT}
            uniforms={{ uOpacity: { value: brightness } }}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>

        {/* Core */}
        <points raycast={() => null}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[coreData.positions,3]} count={coreData.count} array={coreData.positions} itemSize={3} />
            <bufferAttribute attach="attributes-color" args={[coreData.colors,3]} count={coreData.count} array={coreData.colors} itemSize={3} />
            <bufferAttribute attach="attributes-size" args={[coreData.sizes,1]} count={coreData.count} array={coreData.sizes} itemSize={1} />
          </bufferGeometry>
          <shaderMaterial
            ref={coreMatRef}
            vertexShader={CORE_VERTEX}
            fragmentShader={CORE_FRAGMENT}
            uniforms={{ uOpacity: { value: brightness } }}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      </group>
    </group>
  );
};
