"use client";

import type { BreadcrumbItem } from "./useSelectedSemanticContext";

interface MindSpaceBreadcrumbProps {
  items: BreadcrumbItem[];
  onNavigate: (item: BreadcrumbItem) => void;
}

export function MindSpaceBreadcrumb({ items, onNavigate }: MindSpaceBreadcrumbProps) {
  return (
    <nav className="mindspace-breadcrumb" aria-label="MindSpace path">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="mindspace-breadcrumb-item">
          {index > 0 && <span className="mindspace-breadcrumb-sep">/</span>}
          <button
            type="button"
            onClick={() => onNavigate(item)}
            className={index === items.length - 1 ? "current" : ""}
          >
            {item.label.length > 22 ? `${item.label.slice(0, 22)}...` : item.label}
          </button>
        </span>
      ))}
    </nav>
  );
}
