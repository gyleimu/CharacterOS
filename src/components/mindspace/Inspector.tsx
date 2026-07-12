/**
 * Inspector V6 — psychological explanation panel.
 *
 * Two layers:
 * 1. Metrics: strength, activation, decay, distance
 * 2. Explanation: natural language why this factor affects 林凡
 *
 * Content depends on selectedTarget.type:
 * - core → character overview
 * - factor → factor explanation + memories + beliefs + needs + behaviors
 * - memory → memory detail + connected factor
 * - belief/need/behavior → node detail
 */

"use client";

import { type FC } from "react";
import type { ViewMode, SelectedTarget } from "./semanticTypes";
import type { SemanticMindData, SemanticFactor, SemanticMemory, SemanticBelief, SemanticNeed, SemanticBehavior, FactorTrace } from "./semanticTypes";

interface InspectorProps {
  data: SemanticMindData;
  viewMode: ViewMode;
  selectedTarget: SelectedTarget | null;
  activeTrace: FactorTrace | null;
  onBack: () => void;
  onTraceClick: (type: string, id: string) => void;
  onEnterFactorDomain: (factorId: string) => void;
}

export const Inspector: FC<InspectorProps> = ({
  data, viewMode, selectedTarget, activeTrace, onBack, onTraceClick, onEnterFactorDomain,
}) => {
  const { character, factors, memories, beliefs, needs, behaviors } = data;

  // Determine what to show
  const isOverview = viewMode === "overview";
  const target = selectedTarget;

  const selectedFactor: SemanticFactor | null =
    target?.type === "factor" ? factors.find((f) => f.id === target.id) ?? null : null;
  const selectedMemory: SemanticMemory | null =
    target?.type === "memory" ? memories.find((m) => m.id === target.id) ?? null : null;
  const selectedBelief: SemanticBelief | null =
    target?.type === "belief" ? beliefs.find((b) => b.id === target.id) ?? null : null;
  const selectedNeed: SemanticNeed | null =
    target?.type === "need" ? needs.find((n) => n.id === target.id) ?? null : null;
  const selectedBehavior: SemanticBehavior | null =
    target?.type === "behavior" ? behaviors.find((b) => b.id === target.id) ?? null : null;

  if (isOverview && !target) return null;

  return (
    <div className={`inspector-panel ${!isOverview ? "inspector-expanded" : ""}`}>
      <div className="inspector-glow-line" />

      {!isOverview && (
        <button className="inspector-back-btn" onClick={onBack}>← 返回 Mindscape</button>
      )}

      {isOverview && target?.type === "factor" && selectedFactor && (
        <FactorMiniObservation
          factor={selectedFactor}
          memories={memories.filter((m) => selectedFactor.memoryIds.includes(m.id))}
          beliefs={beliefs.filter((b) => selectedFactor.beliefIds.includes(b.id))}
          needs={needs.filter((n) => selectedFactor.needIds.includes(n.id))}
          behaviors={behaviors.filter((b) => selectedFactor.behaviorIds.includes(b.id) || b.sourceFactorIds.includes(selectedFactor.id))}
          activeTrace={activeTrace}
          onEnterFactorDomain={onEnterFactorDomain}
        />
      )}

      {/* ── Factor detail ─────────────────────────────────────── */}
      {!isOverview && target?.type === "factor" && selectedFactor && (
        <FactorExplanation
          factor={selectedFactor}
          memories={memories.filter((m) => selectedFactor.memoryIds.includes(m.id))}
          beliefs={beliefs.filter((b) => selectedFactor.beliefIds.includes(b.id))}
          needs={needs.filter((n) => selectedFactor.needIds.includes(n.id))}
          behaviors={behaviors.filter((b) => selectedFactor.behaviorIds.includes(b.id) || b.sourceFactorIds.includes(selectedFactor.id))}
          activeTrace={activeTrace}
          onTraceClick={onTraceClick}
        />
      )}

      {/* ── Memory detail ─────────────────────────────────────── */}
      {target?.type === "memory" && selectedMemory && (
        <MemoryDetail
          memory={selectedMemory}
          factor={factors.find((f) => f.id === selectedMemory.factorId) ?? null}
          onBack={onBack}
        />
      )}

      {/* ── Belief detail ─────────────────────────────────────── */}
      {target?.type === "belief" && selectedBelief && (
        <BeliefDetail
          belief={selectedBelief}
          factor={factors.find((f) => f.id === selectedBelief.factorId) ?? null}
          memories={memories.filter((m) => selectedBelief.sourceMemoryIds.includes(m.id))}
          onBack={onBack}
        />
      )}

      {/* ── Need detail ───────────────────────────────────────── */}
      {target?.type === "need" && selectedNeed && (
        <NeedDetail
          need={selectedNeed}
          factor={factors.find((f) => f.id === selectedNeed.factorId) ?? null}
        />
      )}

      {/* ── Behavior detail ───────────────────────────────────── */}
      {target?.type === "behavior" && selectedBehavior && (
        <BehaviorDetail
          behavior={selectedBehavior}
          factors={factors.filter((f) => selectedBehavior.sourceFactorIds.includes(f.id))}
        />
      )}

      {/* ── Overview ──────────────────────────────────────────── */}
      {((isOverview && target?.type !== "factor") || target?.type === "core") && (
        <CharacterOverview character={character} factors={factors} behaviors={behaviors} />
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Factor Explanation
// ═══════════════════════════════════════════════════════════════════════════

const FactorMiniObservation: FC<{
  factor: SemanticFactor;
  memories: SemanticMemory[];
  beliefs: SemanticBelief[];
  needs: SemanticNeed[];
  behaviors: SemanticBehavior[];
  activeTrace: FactorTrace | null;
  onEnterFactorDomain: (factorId: string) => void;
}> = ({ factor, memories, beliefs, needs, behaviors, activeTrace, onEnterFactorDomain }) => (
  <>
    <div>
      <div className="inspector-subtitle">当前观测 · Mindscape</div>
      <div className="inspector-factor-name" style={{ color: factor.color }}>{factor.zhName}</div>
      <div className="inspector-factor-en">{factor.name} · 单击选中 · 双击进入详情</div>
    </div>

    <div className="inspector-metrics">
      <MetricBar label="Strength" value={factor.strength} color={factor.color} />
      <MetricBar label="Activation" value={factor.activation} color={factor.color} />
      <MetricBar label="Decay" value={factor.decay} color="#EF5350" />
      <MetricBar label="Distance" value={factor.distance / 10.5} color="#90CAF9" />
    </div>

    <div className="inspector-impact" style={{ borderLeftColor: factor.color + "60" }}>
      {factor.explanation}
    </div>

    <div className="inspector-compact-section">
      <div className="inspector-section-label">来源记忆</div>
      {(memories.length ? memories : []).slice(0, 3).map((memory) => (
        <div key={memory.id} className="inspector-memory-item">
          <div className="inspector-memory-dot" style={{ background: factor.color }} />
          <span>{memory.summary}</span>
        </div>
      ))}
    </div>

    <div className="inspector-compact-section">
      <div className="inspector-section-label">触发信念</div>
      {(beliefs.length ? beliefs : [{ id: "fallback", text: factor.traceBelief, strength: factor.activation } as SemanticBelief]).slice(0, 2).map((belief) => (
        <div key={belief.id} className="inspector-memory-item">
          <div className="inspector-memory-dot" style={{ background: "#CE93D8" }} />
          <span>{belief.text}</span>
        </div>
      ))}
    </div>

    <div className="inspector-compact-section">
      <div className="inspector-section-label">当前需求</div>
      {(needs.length ? needs : [{ id: "fallback", zhName: factor.traceNeed, urgency: factor.activation } as SemanticNeed]).slice(0, 2).map((need) => (
        <div key={need.id} className="inspector-memory-item">
          <div className="inspector-memory-dot" style={{ background: "#FFB74D" }} />
          <span>{need.zhName}</span>
        </div>
      ))}
    </div>

    <div className="inspector-compact-section">
      <div className="inspector-section-label">行为预测</div>
      {[...behaviors].sort((a,b) => b.probability - a.probability).slice(0, 3).map((behavior) => (
        <div key={behavior.id} className="inspector-behavior-row">
          <div>
            <strong>{behavior.zhName}</strong>
            <span>{behavior.reason}</span>
          </div>
          <em style={{ color: factor.color }}>{Math.round(behavior.probability * 100)}%</em>
        </div>
      ))}
    </div>

    {activeTrace && (
      <div className="inspector-compact-section">
        <div className="inspector-section-label">当前链路</div>
        <div className="inspector-mini-trace">
          {activeTrace.steps.map((step) => <span key={step.key}>{step.detail}</span>)}
        </div>
      </div>
    )}

    <button
      type="button"
      className="inspector-enter-domain-btn"
      onClick={() => onEnterFactorDomain(factor.id)}
    >
      进入因子星域
      <span>Memory → Belief → Need → Behavior</span>
    </button>
  </>
);

const FactorExplanation: FC<{
  factor: SemanticFactor;
  memories: SemanticMemory[];
  beliefs: SemanticBelief[];
  needs: SemanticNeed[];
  behaviors: SemanticBehavior[];
  activeTrace: FactorTrace | null;
  onTraceClick: (type: string, id: string) => void;
}> = ({ factor, memories, beliefs, needs, behaviors, activeTrace, onTraceClick }) => (
  <>
    <div>
      <div className="inspector-subtitle">当前观测 · Factor Domain</div>
      <div className="inspector-factor-name" style={{ color: factor.color }}>{factor.zhName}</div>
      <div className="inspector-factor-en">{factor.name} · {factor.layer === "inner" ? "核心层" : factor.layer === "middle" ? "调节层" : "探索层"}</div>
    </div>

    {/* Metrics */}
    <div className="inspector-metrics">
      <MetricBar label="Strength" value={factor.strength} color={factor.color} />
      <MetricBar label="Activation" value={factor.activation} color={factor.color} />
      <MetricBar label="Decay" value={factor.decay} color="#EF5350" />
      <MetricBar label="Disturbance" value={factor.disturbance} color="#FFB74D" />
    </div>

    {/* Explanation */}
    <div className="inspector-impact" style={{ borderLeftColor: factor.color + "60" }}>
      {factor.explanation}
    </div>

    {/* Source memories */}
    {memories.length > 0 && (
      <div>
        <div className="inspector-section-label">来源记忆</div>
        {memories.map((m) => (
          <div key={m.id} className="inspector-memory-item">
            <div className="inspector-memory-dot" style={{ background: factor.color }} />
            <span>{m.summary} <span style={{fontSize:9,opacity:.5}}>— {m.emotion}</span></span>
          </div>
        ))}
      </div>
    )}

    {/* Beliefs */}
    {beliefs.length > 0 && (
      <div>
        <div className="inspector-section-label">触发信念</div>
        {beliefs.map((b) => (
          <div key={b.id} className="inspector-memory-item">
            <div className="inspector-memory-dot" style={{ background: "#CE93D8" }} />
            <span>"{b.text}" <span style={{fontSize:9,opacity:.5}}>强度 {Math.round(b.strength*100)}%</span></span>
          </div>
        ))}
      </div>
    )}

    {/* Needs */}
    {needs.length > 0 && (
      <div>
        <div className="inspector-section-label">当前需求</div>
        {needs.map((n) => (
          <div key={n.id} className="inspector-memory-item">
            <div className="inspector-memory-dot" style={{ background: "#FFB74D" }} />
            <span>{n.zhName} <span style={{fontSize:9,opacity:.5}}>紧迫度 {Math.round(n.urgency*100)}%</span></span>
          </div>
        ))}
      </div>
    )}

    {/* Behavior predictions */}
    {behaviors.length > 0 && (
      <div>
        <div className="inspector-section-label">行为预测</div>
        {[...behaviors].sort((a,b) => b.probability - a.probability).map((b) => (
          <div key={b.id} style={{
            display:"flex",alignItems:"center",gap:8,padding:"4px 0",
          }}>
            <div style={{flex:1,fontSize:11,color:"rgba(255,255,255,.7)"}}>▶ {b.zhName}</div>
            <div style={{width:60,height:3,background:"rgba(255,255,255,.06)",borderRadius:2,overflow:"hidden"}}>
              <div style={{width:`${Math.round(b.probability*100)}%`,height:"100%",background:factor.color,borderRadius:2}} />
            </div>
            <div style={{fontSize:10,fontWeight:600,color:factor.color,width:32,textAlign:"right"}}>{Math.round(b.probability*100)}%</div>
          </div>
        ))}
      </div>
    )}

    {/* Active trace */}
    {activeTrace && (
      <div style={{marginTop:4,padding:"10px 0",borderTop:"1px solid rgba(255,255,255,.05)"}}>
        <div className="inspector-section-label">心理链路</div>
        {activeTrace.steps.map((step, i) => (
          <div key={step.key}
            onClick={() => step.targetType && step.targetId && onTraceClick(step.targetType, step.targetId)}
            style={{
              display:"flex",alignItems:"flex-start",gap:6,padding:"3px 0",fontSize:10,
              color:"rgba(255,255,255,.5)",cursor:step.targetId?"pointer":"default",
            }}
          >
            <span style={{color:factor.color,fontWeight:700,minWidth:14}}>{i+1}.</span>
            <span>{step.detail}</span>
          </div>
        ))}
      </div>
    )}
  </>
);

// ═══════════════════════════════════════════════════════════════════════════
// Memory / Belief / Character sub-panels
// ═══════════════════════════════════════════════════════════════════════════

const MemoryDetail: FC<{ memory: SemanticMemory; factor: SemanticFactor | null; onBack: () => void }> = ({ memory, factor }) => (
  <>
    <div>
      <div className="inspector-subtitle">记忆碎片 · Memory</div>
      <div style={{fontSize:16,fontWeight:700,color:factor?.color??"#fff",lineHeight:1.4}}>{memory.summary}</div>
      <div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginTop:4}}>
        情绪: {memory.emotion} · 效价: {memory.valence > 0 ? "+" : ""}{memory.valence.toFixed(1)} · {memory.timestamp}
      </div>
    </div>
    {factor && (
      <div className="inspector-impact" style={{borderLeftColor:factor.color+"60"}}>
        该记忆强化了 <b style={{color:factor.color}}>{factor.zhName}</b> 因子，使林凡在类似情境中倾向于预期关系不稳定。
      </div>
    )}
  </>
);

const BeliefDetail: FC<{ belief: SemanticBelief; factor: SemanticFactor | null; memories: SemanticMemory[]; onBack: () => void }> = ({ belief, factor, memories }) => (
  <>
    <div>
      <div className="inspector-subtitle">信念节点 · Belief</div>
      <div style={{fontSize:16,fontWeight:700,color:factor?.color??"#CE93D8",lineHeight:1.4}}>"{belief.text}"</div>
      <div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginTop:4}}>强度 {Math.round(belief.strength*100)}%</div>
    </div>
    {memories.length > 0 && (
      <div>
        <div className="inspector-section-label">来源记忆</div>
        {memories.map((m) => (
          <div key={m.id} className="inspector-memory-item">
            <div className="inspector-memory-dot" style={{background:factor?.color??"#888"}} />
            <span>{m.summary}</span>
          </div>
        ))}
      </div>
    )}
  </>
);

const NeedDetail: FC<{ need: SemanticNeed; factor: SemanticFactor | null }> = ({ need, factor }) => (
  <>
    <div>
      <div className="inspector-subtitle">需求节点 · Need</div>
      <div style={{fontSize:18,fontWeight:800,color:factor?.color??need.color,lineHeight:1.3}}>{need.zhName}</div>
      <div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginTop:4}}>{need.name}</div>
    </div>
    <div className="inspector-metrics">
      <MetricBar label="Deficiency" value={need.deficiency} color={factor?.color??need.color} />
      <MetricBar label="Urgency" value={need.urgency} color={factor?.color??need.color} />
    </div>
    <div className="inspector-impact" style={{borderLeftColor:(factor?.color??need.color)+"60"}}>
      这个需求正在把注意力拉向 <b style={{color:factor?.color??need.color}}>{factor?.zhName ?? "当前因子"}</b>，并影响下一步行为排序。
    </div>
  </>
);

const BehaviorDetail: FC<{ behavior: SemanticBehavior; factors: SemanticFactor[] }> = ({ behavior, factors }) => (
  <>
    <div>
      <div className="inspector-subtitle">行为预测 · Behavior</div>
      <div style={{fontSize:18,fontWeight:800,color:behavior.color,lineHeight:1.3}}>{behavior.zhName}</div>
      <div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginTop:4}}>{behavior.name}</div>
    </div>
    <MetricBar label="Probability" value={behavior.probability} color={behavior.color} />
    <div className="inspector-impact" style={{borderLeftColor:behavior.color+"60"}}>{behavior.reason}</div>
    {factors.length > 0 && (
      <div>
        <div className="inspector-section-label">来源因子</div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {factors.map((factor) => (
            <span key={factor.id} style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:factor.color+"18",color:factor.color,border:`1px solid ${factor.color}28`}}>{factor.zhName}</span>
          ))}
        </div>
      </div>
    )}
  </>
);

const CharacterOverview: FC<{ character: SemanticMindData["character"]; factors: SemanticFactor[]; behaviors: SemanticBehavior[] }> = ({ character, factors, behaviors }) => (
  <>
    <div>
      <div className="inspector-subtitle">星域总览 · Nebula Overview</div>
      <div className="inspector-title">{character.name}</div>
      <div style={{fontSize:11,color:"rgba(255,255,255,.3)",marginTop:3}}>{factors.length} 因子 · {character.emotionalTone}</div>
    </div>
    <div>
      <div className="inspector-section-label">人格核心</div>
      <div className="inspector-bar-track"><div className="inspector-bar-fill" style={{width:"55%",background:"linear-gradient(90deg,#C9A95C,#FFD700)"}} /></div>
      <div className="inspector-value"><span>整体强度</span><span>55%</span></div>
    </div>
    <div className="inspector-impact" style={{borderLeftColor:"rgba(255,213,79,.6)"}}>{character.summary}</div>
    <div>
      <div className="inspector-section-label">主导因子</div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
        {character.dominantFactorIds.map((id) => {
          const f = factors.find((x) => x.id === id);
          if (!f) return null;
          return <span key={id} style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:f.color+"18",color:f.color,border:`1px solid ${f.color}28`}}>{f.zhName}</span>;
        })}
      </div>
    </div>
    {/* Top behaviors across all factors */}
    <div>
      <div className="inspector-section-label">当前行为倾向</div>
      {[...behaviors].sort((a,b)=>b.probability-a.probability).slice(0,4).map((b) => (
        <div key={b.id} style={{display:"flex",alignItems:"center",gap:6,padding:"2px 0",fontSize:10,color:"rgba(255,255,255,.45)"}}>
          <span>▶ {b.zhName}</span>
          <span style={{color:b.color,fontWeight:600}}>{Math.round(b.probability*100)}%</span>
        </div>
      ))}
    </div>
  </>
);

// ═══════════════════════════════════════════════════════════════════════════

const MetricBar: FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className="inspector-metric">
    <div className="inspector-metric-label">{label}</div>
    <div className="inspector-bar-track" style={{height:3}}>
      <div className="inspector-bar-fill" style={{width:`${Math.round(value*100)}%`,background:color}} />
    </div>
    <div className="inspector-metric-value">{Math.round(value*100)}%</div>
  </div>
);
