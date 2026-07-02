/**
 * CameraRig V5 — reports camera position for debug overlay.
 */

"use client";

import { useRef, useEffect, type FC } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { CameraView, FactorCloudHandle } from "./types";

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const OVERVIEW_POS = new THREE.Vector3(0, 1.85, 7.05);
const OVERVIEW_TGT = new THREE.Vector3(0, 0.08, 0);

interface CameraRigProps {
  cameraView: CameraView;
  cloudHandles: FactorCloudHandle[];
  onCameraPos?: (pos: {x:number;y:number;z:number}) => void;
}

export const CameraRig: FC<CameraRigProps> = ({
  cameraView, cloudHandles, onCameraPos,
}) => {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  const anim = useRef({
    active: false, progress: 0, duration: 1.0,
    startPos: new THREE.Vector3(), startTgt: new THREE.Vector3(),
    endPos: new THREE.Vector3(), endTgt: new THREE.Vector3(),
  });
  const desiredTargetRef = useRef(OVERVIEW_TGT.clone());
  const cameraKey = useRef("overview");

  useEffect(() => {
    const factorHandle =
      cameraView.mode === "factor"
        ? cloudHandles.find((x) => x.id === cameraView.factorId)
        : cameraView.mode === "target" && cameraView.parentFactorId
          ? cloudHandles.find((x) => x.id === cameraView.parentFactorId)
          : undefined;
    if (cameraView.mode === "factor" && !factorHandle) return;

    const resetKey = cameraView.resetKey ?? 0;
    const nextKey =
      cameraView.mode === "factor" && factorHandle
        ? `factor:${cameraView.factorId}:${factorHandle.position.join(",")}:${resetKey}`
        : cameraView.mode === "target"
          ? `target:${cameraView.targetType}:${cameraView.targetId}:${cameraView.position.join(",")}:${cameraView.parentFactorId ?? "none"}:${factorHandle?.position.join(",") ?? "no-factor"}:${resetKey}`
          : `${cameraView.mode}:${resetKey}`;
    if (nextKey === cameraKey.current) return;
    cameraKey.current = nextKey;
    const a = anim.current;
    a.startPos.copy(camera.position);
    a.startTgt.copy(controlsRef.current?.target ?? OVERVIEW_TGT);
    a.progress = 0;
    a.duration =
      cameraView.mode === "factor" ? 1.18 :
      cameraView.mode === "overview" ? 0.92 :
      cameraView.mode === "target" ? 0.82 :
      0.9;
    if (cameraView.mode === "overview") {
      a.endPos.copy(OVERVIEW_POS);
      a.endTgt.copy(OVERVIEW_TGT);
    } else if (cameraView.mode === "core") {
      a.endPos.set(0, 1.6, 5.4);
      a.endTgt.set(0, 0, 0);
    } else if (cameraView.mode === "factor" && factorHandle) {
      const fp = new THREE.Vector3(...factorHandle.position);
      const dir = fp.lengthSq() > 0.001
        ? fp.clone().normalize()
        : new THREE.Vector3(0.25, 0.12, 1).normalize();
      a.endPos.copy(fp.clone().add(dir.multiplyScalar(2.72)));
      a.endPos.y += 0.62;
      a.endTgt.copy(fp);
    } else if (cameraView.mode === "target") {
      const tp = new THREE.Vector3(...cameraView.position);
      const factorCenter = factorHandle ? new THREE.Vector3(...factorHandle.position) : null;
      const focusTarget = factorCenter ? factorCenter.clone().lerp(tp, 0.18) : tp.clone();
      const dir = factorCenter
        ? tp.clone().sub(factorCenter).lengthSq() > 0.001
          ? tp.clone().sub(factorCenter).normalize()
          : factorCenter.clone().normalize()
        : tp.lengthSq() > 0.001
          ? tp.clone().normalize()
          : new THREE.Vector3(0, 0.2, 1);
      a.endPos.copy(focusTarget.clone().add(dir.multiplyScalar(2.16)));
      a.endPos.y += 0.35;
      a.endTgt.copy(focusTarget);
    }
    desiredTargetRef.current.copy(a.endTgt);
    a.active = true;
  }, [cameraView, cloudHandles, camera]);

  useFrame((_, delta) => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    const a = anim.current;

    // Report camera position for debug
    onCameraPos?.({ x: camera.position.x, y: camera.position.y, z: camera.position.z });

    if (a.active) {
      a.progress += delta / a.duration;
      if (a.progress >= 1) { a.progress = 1; a.active = false; }
      const t = easeInOutCubic(a.progress);
      camera.position.lerpVectors(a.startPos, a.endPos, t);
      const tg = new THREE.Vector3().lerpVectors(a.startTgt, a.endTgt, t);
      ctrl.target.copy(tg); ctrl.update();
    } else {
      ctrl.target.lerp(desiredTargetRef.current, Math.min(delta * 6, 1));
      ctrl.update();
    }
  });

  return (
    <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.12}
      minDistance={3} maxDistance={30} maxPolarAngle={Math.PI*.75} minPolarAngle={Math.PI*.25}
      enablePan={false} rotateSpeed={0.4} zoomSpeed={0.8} />
  );
};
