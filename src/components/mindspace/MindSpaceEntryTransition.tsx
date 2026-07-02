"use client";

interface MindSpaceEntryTransitionProps {
  active: boolean;
}

export function MindSpaceEntryTransition({ active }: MindSpaceEntryTransitionProps) {
  if (!active) return null;
  return (
    <div className="mindspace-entry-transition" aria-hidden>
      <div className="entry-transition-line" />
      <div className="entry-transition-copy">
        <span>Entering MindSpace</span>
        <strong>正在进入三维心理空间</strong>
      </div>
    </div>
  );
}
