/**
 * PersonalityCore V4 — golden core with dim mode.
 *
 * When a factor is selected, the core label dims so users aren't confused
 * about what's currently being observed.
 */

"use client";

import { useMemo, useRef, type FC } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";

const CORE_VERTEX = /* glsl */ `
  attribute float size; attribute vec3 color;
  varying vec3 vColor; varying float vAlpha;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 0.5, 6.0);
    vColor = color;
    vAlpha = clamp(1.0 / (1.0 + abs(mvPosition.z) * 0.025), 0.3, 1.0);
  }
`;
const CORE_FRAGMENT = /* glsl */ `
  varying vec3 vColor; varying float vAlpha;
  void main() {
    float dist = length(gl_PointCoord - 0.5) * 2.0;
    float alpha = 1.0 - smoothstep(0.0, 1.0, dist);
    alpha = pow(alpha, 1.5);
    float core = exp(-dist * dist * 8.0) * 0.5;
    alpha = (alpha * 0.6 + core) * vAlpha;
    alpha = clamp(alpha, 0.0, 1.0);
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

const GOLD = [
  new THREE.Color("#FFD700"), new THREE.Color("#E6BE3A"),
  new THREE.Color("#C9A95C"), new THREE.Color("#D4A843"),
  new THREE.Color("#F0C840"), new THREE.Color("#B8943E"),
];

interface Props {
  particleCount?: number;
  label?: string;
  statusLine?: string;
  isDimmed?: boolean;
}

export const PersonalityCore: FC<Props> = ({
  particleCount = 3500, label = "", statusLine = "", isDimmed = false,
}) => {
  const groupRef = useRef<THREE.Group>(null);

  const coreData = useMemo(() => {
    const n = Math.round(particleCount * 1.55);
    const pos = new Float32Array(n*3), col = new Float32Array(n*3), siz = new Float32Array(n);
    for (let i=0;i<n;i++) {
      const th=Math.random()*Math.PI*2;
      const ph=Math.acos(2*Math.random()-1);
      const dense=i<n*.72;
      const rad=dense
        ? Math.pow(Math.random(),2.2)*1.16
        : .72+Math.pow(Math.random(),1.7)*.96;
      const squash=dense?.84:.74;
      const x=Math.sin(ph)*Math.cos(th)*rad;
      const y=Math.sin(ph)*Math.sin(th)*rad*squash;
      const z=Math.cos(ph)*rad;
      pos[i*3]=x;pos[i*3+1]=y;pos[i*3+2]=z;
      const bc=GOLD[Math.floor(Math.random()*GOLD.length)]!,v=.72+Math.random()*.34;
      col[i*3]=bc.r*v;col[i*3+1]=bc.g*v;col[i*3+2]=bc.b*v;
      siz[i]=Math.random()<.04?.09+Math.random()*.09:.032+Math.random()*.06;
    }
    return {positions:pos,colors:col,sizes:siz,count:n};
  }, [particleCount]);

  const glowData = useMemo(() => {
    const n=780;const pos=new Float32Array(n*3),col=new Float32Array(n*3),siz=new Float32Array(n);
    const bg=new THREE.Color("#FFD54F");
    for(let i=0;i<n;i++){const th=Math.random()*Math.PI*2,ph=Math.acos(2*Math.random()-1),rad=.08+Math.random()*.48;
      pos[i*3]=Math.sin(ph)*Math.cos(th)*rad;pos[i*3+1]=Math.sin(ph)*Math.sin(th)*rad;pos[i*3+2]=Math.cos(ph)*rad;
      const b=.42+Math.random()*.42;col[i*3]=bg.r*b;col[i*3+1]=bg.g*b;col[i*3+2]=bg.b*b;siz[i]=.042+Math.random()*.062;}
    return {positions:pos,colors:col,sizes:siz,count:n};
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const breathe = 1 + Math.sin(t*.7)*.035 + Math.sin(t*1.3)*.02;
    const totalScale = breathe;
    if(groupRef.current){groupRef.current.rotation.y+=.12*.016;groupRef.current.rotation.x+=.05*.016;groupRef.current.rotation.z+=.04*.016;groupRef.current.scale.setScalar(totalScale);}
  });

  // Dim label when a factor is focused
  const labelOpacity = isDimmed ? 0.25 : 1;

  return (
    <group>
      <group ref={groupRef}>
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[coreData.positions,3]} count={coreData.count} array={coreData.positions} itemSize={3} />
            <bufferAttribute attach="attributes-color" args={[coreData.colors,3]} count={coreData.count} array={coreData.colors} itemSize={3} />
            <bufferAttribute attach="attributes-size" args={[coreData.sizes,1]} count={coreData.count} array={coreData.sizes} itemSize={1} />
          </bufferGeometry>
          <shaderMaterial vertexShader={CORE_VERTEX} fragmentShader={CORE_FRAGMENT} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </points>
      </group>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[glowData.positions,3]} count={glowData.count} array={glowData.positions} itemSize={3} />
          <bufferAttribute attach="attributes-color" args={[glowData.colors,3]} count={glowData.count} array={glowData.colors} itemSize={3} />
          <bufferAttribute attach="attributes-size" args={[glowData.sizes,1]} count={glowData.count} array={glowData.sizes} itemSize={1} />
        </bufferGeometry>
        <shaderMaterial vertexShader={CORE_VERTEX} fragmentShader={CORE_FRAGMENT} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      {label && (
        <Html position={[0,1.55,0]} center distanceFactor={9} occlude={false} style={{ transition: "opacity 0.4s", opacity: labelOpacity, pointerEvents: "none" }}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,whiteSpace:"nowrap",pointerEvents:"none",padding:"6px 16px",borderRadius:14,background:"rgba(10,10,26,0.6)",backdropFilter:"blur(6px)",border:"1px solid rgba(255,215,0,0.25)"}}>
            <span style={{fontSize:17,fontWeight:800,color:"#FFD54F",textShadow:"0 0 18px rgba(255,213,79,0.55)",letterSpacing:"0.06em"}}>{label}</span>
            {statusLine && <span style={{fontSize:10,color:"rgba(255,255,255,0.45)",letterSpacing:"0.03em"}}>{statusLine}</span>}
          </div>
        </Html>
      )}
    </group>
  );
};
