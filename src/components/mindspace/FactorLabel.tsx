/**
 * FactorLabel V5 — STABLE. No position change. No scale change.
 * Only opacity and border brightness change on hover.
 * pointer-events: none — never blocks raycasting.
 */

"use client";

import { type FC } from "react";
import { Html } from "@react-three/drei";
import type { FactorCloud3D } from "./types";

interface FactorLabelProps {
  cloud: FactorCloud3D;
  isHovered: boolean;
  isSelected: boolean;
  isDimmed: boolean;
}

export const FactorLabel: FC<FactorLabelProps> = ({
  cloud, isHovered, isSelected, isDimmed,
}) => {
  const active = isHovered || isSelected;
  // Overview labels stay readable; selected factor must match the inspector.
  const opacity = isSelected ? 1 : isHovered ? 0.94 : isDimmed ? 0.12 : 0.38;

  return (
    <Html
      position={[
        cloud.position[0],
        cloud.position[1] + cloud.haloSpread * 1.12,
        cloud.position[2],
      ]}
      center
      distanceFactor={6.4}
      occlude={false}
      style={{
        pointerEvents: "none",   // ← CRITICAL: never block raycasting
        opacity,
        transition: "opacity 0.25s",
        whiteSpace: "nowrap",
      }}
    >
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "3px 8px 3px 4px", borderRadius: 14,
        background: active ? "rgba(10,10,28,0.85)" : "rgba(10,10,28,0.45)",
        backdropFilter: "blur(6px)",
        border: isSelected ? `1px solid ${cloud.color}80`
          : active ? `1px solid ${cloud.color}40`
          : "1px solid rgba(255,255,255,0.04)",
        boxShadow: isSelected ? `0 0 14px ${cloud.color}22` : active ? `0 0 8px ${cloud.color}10` : "none",
      }}>
        <div style={{
          width: isSelected ? 8 : 6, height: isSelected ? 8 : 6, borderRadius: "50%",
          background: cloud.color,
          boxShadow: active ? `0 0 6px ${cloud.color}` : "none",
          flexShrink: 0, transition: "all 0.25s",
        }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <span style={{
            fontSize: isSelected ? 12 : 11, fontWeight: active ? 760 : 560,
            color: active ? cloud.color : "rgba(255,255,255,0.72)",
            letterSpacing: "0.03em", lineHeight: 1.3, transition: "color 0.25s",
          }}>{cloud.labelZh}</span>
          <span style={{
            fontSize: 8, fontWeight: 500,
            color: "rgba(255,255,255,0.28)",
            letterSpacing: "0.05em", textTransform: "uppercase", lineHeight: 1.2,
          }}>{cloud.labelEn}</span>
        </div>
      </div>
    </Html>
  );
};
