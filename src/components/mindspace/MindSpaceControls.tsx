"use client";

import { useState } from "react";

interface MindSpaceControlsProps {
  viewMode: string;
  onResetView: () => void;
  onOverview: () => void;
}

export function MindSpaceControls({ viewMode, onResetView, onOverview }: MindSpaceControlsProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const modeLabel: Record<string, string> = {
    overview: "Mindscape / 心理宇宙总览",
    factorDomain: "Factor Domain / 因子星域",
    focusCore: "Core / 人格核心",
    focusFactor: "Factor Domain / 因子星域",
    focusMemory: "Memory Detail / 记忆详情",
    behaviorPreview: "Behavior / 行为预测",
  };

  return (
    <div className="mindspace-controls">
      <div className="mindspace-mode-pill">{modeLabel[viewMode] ?? viewMode}</div>
      <button type="button" onClick={onResetView}>Reset View</button>
      <button type="button" onClick={onOverview}>Overview</button>
      <button type="button" onClick={() => setHelpOpen((value) => !value)}>Help</button>
      {helpOpen && (
        <div className="mindspace-help-panel">
          <div>拖拽：旋转星图</div>
          <div>滚轮：缩放视角</div>
          <div>单击：观察节点</div>
          <div>双击：进入详情层</div>
          <div>ESC / Back：返回上一层</div>
        </div>
      )}
    </div>
  );
}
