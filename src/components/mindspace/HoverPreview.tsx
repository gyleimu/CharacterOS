"use client";

import type { TargetPreview } from "./useSelectedSemanticContext";

interface HoverPreviewProps {
  preview: TargetPreview | null;
}

export function HoverPreview({ preview }: HoverPreviewProps) {
  if (!preview) return null;
  return (
    <div className="mindspace-hover-preview" style={{ borderColor: `${preview.color}55` }}>
      <div className="hover-preview-kicker" style={{ color: preview.color }}>{preview.typeLabel}</div>
      <div className="hover-preview-title">{preview.title}</div>
      <div className="hover-preview-subtitle">{preview.subtitle}</div>
      <div className="hover-preview-action">{preview.actionHint}</div>
    </div>
  );
}
