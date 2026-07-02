/**
 * DebugOverlay V2 — with hover loop detection.
 * Shows pointerOver/Out counts to detect infinite hover loops.
 * Toggle with 'D' key.
 */

"use client";

import { useState, useEffect, useRef, type FC } from "react";

// Global counters (survive re-renders)
let globalOverCount = 0;
let globalOutCount = 0;

export function incrementHoverOver() { globalOverCount++; }
export function incrementHoverOut() { globalOutCount++; }

interface DebugOverlayProps {
  viewMode: string;
  hoveredFactorId: string | null;
  hoveredNodeId?: string | null;
  selectedTarget?: string | null;
  cameraPos: { x: number; y: number; z: number };
  clouds: any[];
  visibleLabelCount?: number;
}

export const DebugOverlay: FC<DebugOverlayProps> = ({
  viewMode, hoveredFactorId, hoveredNodeId = null, selectedTarget = null, cameraPos, clouds, visibleLabelCount = clouds.length,
}) => {
  const [visible, setVisible] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "d" || e.key === "D") setVisible((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Refresh every 500ms to show live counters
  useEffect(() => {
    if (!visible) return;
    const iv = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(iv);
  }, [visible]);

  if (!visible) return null;

  // Detect hover loop: if over/out counts are very close and changing rapidly
  const total = globalOverCount + globalOutCount;
  const ratio = total > 0 ? Math.abs(globalOverCount - globalOutCount) / total : 1;
  const isLooping = total > 20 && ratio < 0.3;

  return (
    <div style={{
      position: "fixed", bottom: 100, left: 24, zIndex: 200,
      padding: "12px 16px", borderRadius: 10,
      background: "rgba(0,0,0,0.88)", border: `1px solid ${isLooping ? "rgba(255,80,80,.6)" : "rgba(255,255,255,.15)"}`,
      fontSize: 11, fontFamily: "monospace", color: "#0f0",
      display: "flex", flexDirection: "column", gap: 3, maxWidth: 360,
      pointerEvents: "none",
    }}>
      <div><b>DEBUG</b> (D to toggle) {isLooping && <span style={{color:"#f44"}}>⚠ HOVER LOOP DETECTED</span>}</div>
      <div>viewMode: <span style={{color:"#ff0"}}>{viewMode}</span></div>
      <div>hovered: <span style={{color:"#0ff"}}>{hoveredFactorId ?? "none"}</span></div>
      <div>hoveredNode: <span style={{color:"#0ff"}}>{hoveredNodeId ?? "none"}</span></div>
      <div>selectedTarget: <span style={{color:"#ff0"}}>{selectedTarget ?? "none"}</span></div>
      <div>camera: ({cameraPos.x.toFixed(1)}, {cameraPos.y.toFixed(1)}, {cameraPos.z.toFixed(1)})</div>
      <div>hit proxies: {clouds.length}</div>
      <div>visible labels: {visibleLabelCount}</div>
      <div style={{marginTop:4,padding:"4px 0",borderTop:"1px solid rgba(255,255,255,.1)"}}>
        <div>pointerOver: <span style={{color:"#0f0"}}>{globalOverCount}</span></div>
        <div>pointerOut: <span style={{color:"#f80"}}>{globalOutCount}</span></div>
        <div>total: {total} | ratio: {ratio.toFixed(2)}</div>
        <div style={{fontSize:9,opacity:.5}}>ratio {'<'} 0.3 + total {'>'} 20 = hover loop</div>
      </div>
    </div>
  );
};
