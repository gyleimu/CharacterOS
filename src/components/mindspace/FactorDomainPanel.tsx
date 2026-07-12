"use client";

import { useMemo, type CSSProperties, type FC, type ReactNode } from "react";
import type {
  SelectedTarget,
  SemanticBehavior,
  SemanticBelief,
  SemanticFactor,
  SemanticMemory,
  SemanticMindData,
  SemanticNeed,
} from "./semanticTypes";

interface FactorDomainPanelProps {
  data: SemanticMindData;
  factor: SemanticFactor;
  selectedTarget: SelectedTarget | null;
  onSelectTarget: (target: SelectedTarget) => void;
  onOpenTarget?: (target: SelectedTarget) => void;
}

export const FactorDomainPanel: FC<FactorDomainPanelProps> = ({
  data,
  factor,
  selectedTarget,
  onSelectTarget,
  onOpenTarget,
}) => {
  const domain = useMemo(() => {
    const behaviorIds = new Set(factor.behaviorIds);
    data.behaviors
      .filter((behavior) => behavior.sourceFactorIds.includes(factor.id))
      .forEach((behavior) => behaviorIds.add(behavior.id));

    return {
      memories: data.memories.filter((memory) => factor.memoryIds.includes(memory.id)).slice(0, 3),
      beliefs: data.beliefs.filter((belief) => factor.beliefIds.includes(belief.id)),
      needs: data.needs.filter((need) => factor.needIds.includes(need.id)),
      behaviors: data.behaviors
        .filter((behavior) => behaviorIds.has(behavior.id))
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 3),
    };
  }, [data, factor]);

  const selectedKey = selectedTarget ? `${selectedTarget.type}:${selectedTarget.id}` : `factor:${factor.id}`;

  return (
    <section className="factor-domain-panel" style={{ "--factor-color": factor.color } as CSSProperties}>
      <div className="factor-domain-header">
        <div>
          <div className="factor-domain-kicker">Factor Domain · 因子因果剖面</div>
          <div className="factor-domain-title">
            {factor.zhName}
            <span>{factor.name}</span>
          </div>
        </div>
        <div className="factor-domain-metrics">
          <Metric label="STR" value={factor.strength} />
          <Metric label="ACT" value={factor.activation} />
          <Metric label="DECAY" value={factor.decay} />
        </div>
      </div>

      <div className="factor-domain-flow" aria-label="Memory to behavior causal chain">
        <DomainColumn
          label="Memory"
          subtitle="来源沉积"
          items={domain.memories}
          selectedKey={selectedKey}
          type="memory"
          color={factor.color}
          onSelectTarget={onSelectTarget}
          onOpenTarget={onOpenTarget}
          renderItem={(memory) => (
            <>
              <b>{memory.summary}</b>
              <span>{memory.timestamp} · {memory.emotion} · 激活 {Math.round(memory.activation * 100)}%</span>
            </>
          )}
        />

        <div className="factor-domain-arrow">→</div>

        <div className="factor-domain-column">
          <div className="factor-domain-column-head">
            <strong>Factor</strong>
            <span>当前因子</span>
          </div>
          <button
            type="button"
            className={`factor-domain-card factor-domain-card-core ${selectedKey === `factor:${factor.id}` ? "selected" : ""}`}
            onClick={() => onSelectTarget({ type: "factor", id: factor.id })}
          >
            <b>{factor.zhName}被激活</b>
            <span>{factor.explanation}</span>
          </button>
        </div>

        <div className="factor-domain-arrow">→</div>

        <DomainColumn
          label="Belief"
          subtitle="认知预测"
          items={domain.beliefs}
          selectedKey={selectedKey}
          type="belief"
          color={factor.color}
          onSelectTarget={onSelectTarget}
          onOpenTarget={onOpenTarget}
          renderItem={(belief) => (
            <>
              <b>{belief.text}</b>
              <span>强度 {Math.round(belief.strength * 100)}%</span>
            </>
          )}
        />

        <div className="factor-domain-arrow">→</div>

        <DomainColumn
          label="Need"
          subtitle="需求缺口"
          items={domain.needs}
          selectedKey={selectedKey}
          type="need"
          color={factor.color}
          onSelectTarget={onSelectTarget}
          onOpenTarget={onOpenTarget}
          renderItem={(need) => (
            <>
              <b>{need.zhName}</b>
              <span>缺口 {Math.round(need.deficiency * 100)}% · 紧迫 {Math.round(need.urgency * 100)}%</span>
            </>
          )}
        />

        <div className="factor-domain-arrow">→</div>

        <DomainColumn
          label="Behavior"
          subtitle="行为预测"
          items={domain.behaviors}
          selectedKey={selectedKey}
          type="behavior"
          color={factor.color}
          onSelectTarget={onSelectTarget}
          onOpenTarget={onOpenTarget}
          renderItem={(behavior) => (
            <>
              <b>{behavior.zhName}</b>
              <span>{Math.round(behavior.probability * 100)}% · {behavior.reason}</span>
            </>
          )}
        />
      </div>
    </section>
  );
};

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="factor-domain-metric">
      <span>{label}</span>
      <strong>{Math.round(value * 100)}%</strong>
    </div>
  );
}

function DomainColumn<T extends SemanticMemory | SemanticBelief | SemanticNeed | SemanticBehavior>({
  label,
  subtitle,
  items,
  type,
  selectedKey,
  onSelectTarget,
  onOpenTarget,
  renderItem,
}: {
  label: string;
  subtitle: string;
  items: T[];
  type: SelectedTarget["type"];
  color: string;
  selectedKey: string;
  onSelectTarget: (target: SelectedTarget) => void;
  onOpenTarget: ((target: SelectedTarget) => void) | undefined;
  renderItem: (item: T) => ReactNode;
}) {
  return (
    <div className="factor-domain-column">
      <div className="factor-domain-column-head">
        <strong>{label}</strong>
        <span>{subtitle}</span>
      </div>
      <div className="factor-domain-card-stack">
        {items.map((item) => {
          const target: SelectedTarget = { type, id: item.id };
          return (
            <button
              type="button"
              key={item.id}
              className={`factor-domain-card ${selectedKey === `${type}:${item.id}` ? "selected" : ""}`}
              onClick={() => onSelectTarget(target)}
              onDoubleClick={() => (onOpenTarget ?? onSelectTarget)(target)}
              title="单击预览，双击进入第三层详情"
            >
              {renderItem(item)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
