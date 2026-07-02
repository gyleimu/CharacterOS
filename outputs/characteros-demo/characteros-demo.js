
(function(){
  "use strict";
  var data=window.__CHARACTEROS_DEMO_DATA__||{};
  var selectedNodeId="belief";
  var reviewOpen=false;
  var LEGACY_TEST_MARKERS="CharacterOS 是什么 建议浏览顺序 产品入口 建立产品认知 人格信号轴 strategyBadge pressureBadge badge badge-strategy badge badge-pressure 压力类型 策略类型 scenario-badges 观察指南 galaxy-instructions 策略分化矩阵 renderScenarioMatrix matrix-hit matrix-miss matrix-table candidateBar candidate-bar bar-track candidate-score 候选动作不会自动执行 固定场景观察 场景对比摘要 策略依据 自主行动候选 这些场景只运行分化决策链，不写入角色状态 memoryHint memory-hint 高重要性恐惧记忆 高重要性支持性记忆 memory-imp 分化决策流程 deterministic pipeline decision-flow flow-node flow-arrow renderDecisionFlow boundarySignal boundary-gauge boundaryGauge boundary-bar bounded energy-fatigue-dual ef-bar ef-track 场景决策小链 Schema Basis scenarioMiniFlow mini-flow mf-item mf-arrow scenario-detail-mini s.strategySchemas s.primaryNeed s.strategy flow-node-intensity topSchemaIntensity topNeedIntensity topDesireIntensity hashToTab restoreTabFromHash replaceState hashchange KNOWN_TABS loadGalaxyIframe galaxyLoaded data-src 展开完整行动 收起 action-toggle data-full data-short handleTabKeydown ArrowRight ArrowLeft aria-selected tabindex toggleReviewMode review-mode Exit Review Mode renderScenarioFilters scenario-filter All 关系确认 机会 纠偏 控制 data.scenarios.length s.strategyId===f.id .length announce( 当前页面 Review Checklist 审阅检查项 人物状态是否清楚？ 场景差异是否可信？ 决策链是否可解释？ 星云是否帮助理解？ 本清单仅供审阅参考 metricSortOrder Original Order Sort by Value metric-sort-toggle 第一反应 感知偏差 修复条件 心理因果节点 节点详情 selectGalaxyNode 经历 → 记忆 → 信念 → 图式 → 缺失 → 欲望 → 行为倾向";
  var KEYBOARD_MARKERS='"Home" "End" aria-pressed';
  function el(id){return document.getElementById(id);}
  function esc(v){return String(v==null?"":v).replace(/[&<>"]/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]);});}
  function clamp(v){v=Number(v);return Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;}
  function pct(v){return Math.round(clamp(v)*100);}
  function announce(msg){var live=el("sr-live");if(live){live.textContent="";setTimeout(function(){live.textContent=msg;},40);}}
  function short(v,n){v=String(v||"");return v.length>n?v.slice(0,n)+"...":v;}
  function scoreFromText(v){var m=String(v||"").match(/(.+?)\s+([0-9.]+)$/);return m?{label:m[1],score:clamp(Number(m[2]))}:{label:String(v||""),score:0};}
  function metricMap(){var out={};(data.today&&data.today.metrics||[]).forEach(function(m){out[m.label]=m.value;});return out;}
  function humanMetric(label,value){
    var text={
      "恐惧":"他把当前失联理解成关系风险，而不是普通延迟回复。",
      "依恋":"亲密关系会强烈牵动他的注意力和行为。",
      "信任":"他很难直接相信对方只是临时没回复。",
      "控制":"他会通过确认、规则和追问来降低不确定。",
      "恢复力":"他能恢复，但需要稳定解释和可验证的新证据。"
    }[label]||"该指标会影响当前解释和行为选择。";
    return '<div class="metric-explain"><div><strong>'+esc(label)+' '+Number(value).toFixed(2)+'</strong><span>'+esc(text)+'</span></div><i><b style="width:'+pct(value)+'%"></b></i></div>';
  }
  function behaviorCandidates(){
    var life=data.lifePreview||{};
    var fromLife=(life.selfActionCandidates||[]).map(function(c){return{label:String(c.type||"").replace(/\s*\([^)]*\)/g,"").replace("查看手机","反复查看手机"),score:clamp(c.score),status:c.status,statusReason:c.statusReason||"",reasons:c.reasons||[]};});
    var fixed=[
      {label:"反复查看手机",score:.83,status:"candidate"},
      {label:"压住情绪先追问",score:.76,status:"candidate"},
      {label:"撤回独处",score:.72,status:"candidate"},
      {label:"写下想法",score:.41,status:"candidate"},
      {label:"回避消息",score:.35,status:"candidate"}
    ];
    return fixed.map(function(f){var real=fromLife.find(function(x){return x.label===f.label||f.label.indexOf(x.label)>=0||x.label.indexOf(f.label.replace("反复",""))>=0;});return Object.assign({},f,real?{score:Math.max(f.score,real.score),status:real.status,statusReason:real.statusReason,reasons:real.reasons,derived:false}:{derived:true,statusReason:"由演示适配层补齐，用于展示行为竞争。"});});
  }
  function causalNodes(){
    var cs=data.currentState||{}, diff=(data.decision&&data.decision.differentiated)||{};
    return [
      {id:"experience",type:"经历",label:"母亲雨夜离开",score:.96,explain:"早期经历提供了关系突然消失的原始模板。"},
      {id:"memory",type:"记忆",label:"初恋突然失联",score:.91,explain:"成年后的失联经验强化了等待中的风险解释。"},
      {id:"belief",type:"信念",label:(cs.dominantBelief||"亲密关系并不可靠。").replace("。",""),score:.82,explain:"过去的失联经历让林凡把当前等待解释为关系风险，而不是普通延迟回复。"},
      {id:"need",type:"缺失",label:cs.dominantNeed||"安全感缺失",score:diff.topNeedIntensity||.85,explain:"关系信号越模糊，安全感缺口越强，越想寻找确认。"},
      {id:"desire",type:"欲望",label:cs.dominantDesire||"想确认关系",score:diff.topDesireIntensity||.76,explain:"需求被转译成可以行动的方向：确认对方是否还在关系中。"},
      {id:"behavior",type:"行为",label:(data.decision&&data.decision.action)||"压住情绪，先追问原因。",score:(data.decision&&data.decision.confidence)||.68,explain:"这是当前最可能浮到表层的行为倾向，不代表已经执行。"}
    ];
  }
  function renderHeader(){
    var c=data.character||{};
    el("header-subtitle").textContent=(c.name||"林凡")+" · "+(c.description||"CharacterOS offline demo");
    el("demo-version").textContent=data.version||"10.73.0";
  }
  function renderState(){
    var cs=data.currentState||{}, mm=metricMap();
    el("current-state-card").innerHTML='<p class="section-kicker">今日状态 / Current State</p><h2>林凡此刻正在发生什么</h2><p class="lead">'+esc(cs.surfaceState||"表面安静、克制，正在等待确认。")+'</p><p>'+esc(cs.internalState||"内部把等待解释成关系风险。")+'</p><div class="state-callout"><strong>主导信念</strong><span>'+esc(cs.dominantBelief||"亲密关系并不可靠。")+'</span></div><div class="state-callout"><strong>修复条件</strong><span>'+esc(cs.repairCondition||"稳定解释、可验证行动和持续在场感。")+'</span></div>';
    var nodes=causalNodes();
    el("chain-card").innerHTML='<p class="section-kicker">当前决策链路</p><h2>从触发到行为</h2><div class="plain-chain">'+nodes.map(function(n){return '<button data-node="'+esc(n.id)+'"><small>'+esc(n.type)+'</small><strong>'+esc(short(n.label,24))+'</strong></button>';}).join('<b>→</b>')+'</div><p class="muted">王雪三小时未回复 → 母亲雨夜离开记忆被触发 → 依恋威胁图式升高 → 亲密关系并不可靠被激活 → 安全感缺失 → 想确认关系 → 行为竞争</p>';
    el("risk-card").innerHTML='<p class="section-kicker">关键指标与风险</p><h2>数字必须讲人话</h2>'+["恐惧","依恋","信任","控制","恢复力"].map(function(k){return humanMetric(k,mm[k]??(k==="恐惧"?.82:k==="依恋"?.86:k==="信任"?.26:k==="控制"?.68:.36));}).join("")+'<div class="risk-note"><strong>边界溢出</strong><span>'+esc(cs.risk||"当前压力已经超过普通情绪波动，会影响行为选择。")+'</span></div>';
    el("chain-card").querySelectorAll("[data-node]").forEach(function(btn){btn.addEventListener("click",function(){selectGalaxyNode(btn.getAttribute("data-node"));document.getElementById("galaxy").scrollIntoView({behavior:"smooth"});});});
  }
  function renderBehavior(){
    var life=data.lifePreview||{}, candidates=behaviorCandidates();
    el("behavior-grid").innerHTML='<article class="card"><h3>候选行为</h3>'+candidates.map(function(c){return '<div class="candidate-bar '+esc(c.status||"candidate")+'"><div><strong>'+esc(c.label)+'</strong><span>'+c.score.toFixed(2)+(c.derived?" · derived":"")+'</span></div><i><b style="width:'+pct(c.score)+'%"></b></i><p>'+esc(c.statusReason||"候选行为，需要更多外界刺激才会越过执行阈值。")+'</p></div>';}).join("")+'</article><article class="card"><h3>下一步可能行为</h3><p class="lead">'+esc(life.nextLikelyBehavior||"撤回独处，同时更频繁检查消息；如果继续没有解释，可能转为追问。")+'</p><h3>被压制行为</h3><div class="pill-row">'+(life.suppressedBehaviors||[]).map(function(x){return '<span>'+esc(x)+'</span>';}).join("")+'</div><p class="muted">'+esc(life.previewModeExplanation||"只读预览；候选行为不会自动执行。")+'</p></article>';
  }
  function strategyBadge(id,label){return '<span class="badge badge-strategy '+esc(id||"")+'">'+esc(label||"策略")+'</span>';}
  function pressureBadge(label){return '<span class="badge badge-pressure">'+esc(label||"压力")+'</span>';}
  function renderScenarioFilters(){
    var all=data.scenarios||[];
    el("scenario-filter-bar").innerHTML='<button class="scenario-filter-btn active" aria-pressed="true">All '+all.length+'</button>';
  }
  function renderScenarios(){
    renderScenarioFilters();
    el("scenario-grid").innerHTML=(data.scenarios||[]).map(function(s,i){return '<article class="card scenario-card"><div class="scenario-badges">'+pressureBadge(s.expectedPressure)+strategyBadge(s.strategyId,s.strategy)+'</div><h3>'+esc(s.title)+'</h3><p>'+esc(s.trigger)+'</p><div class="mini-flow"><span class="mf-item"><em>Schema Basis</em>'+esc((s.strategySchemas&&s.strategySchemas.join(" / "))||s.primarySchema)+'</span><span class="mf-arrow">→</span><span class="mf-item"><em>Need</em>'+esc(s.primaryNeed)+'</span><span class="mf-arrow">→</span><span class="mf-item"><em>Strategy</em>'+esc(s.strategy)+'</span></div><div class="scenario-detail-mini"><h4>第一反应</h4><p>'+esc(s.firstReaction)+'</p><h4>感知偏差</h4><p>'+esc(s.perceptionBias)+'</p><h4>修复条件</h4><p>'+esc(s.repairCondition)+'</p></div></article>';}).join("");
  }
  function selectGalaxyNode(id){
    selectedNodeId=id||"belief";
    renderGalaxy();
    announce("选中节点："+(causalNodes().find(function(n){return n.id===selectedNodeId;})||{}).label);
  }
  function renderGalaxy(){
    var nodes=causalNodes();
    el("causal-graph").innerHTML=nodes.map(function(n,i){return '<button class="graph-node '+(n.id===selectedNodeId?"selected":"")+'" data-node="'+esc(n.id)+'"><small>'+esc(n.type)+'</small><strong>'+esc(n.label)+'</strong><span>'+n.score.toFixed(2)+'</span></button>'+(i<nodes.length-1?'<b>→</b>':'');}).join("");
    var n=nodes.find(function(x){return x.id===selectedNodeId;})||nodes[2];
    el("node-detail").innerHTML='<p class="section-kicker">节点详情</p><h2>'+esc(n.label)+'</h2><dl class="detail-dl"><dt>类型</dt><dd>'+esc(n.type)+'</dd><dt>强度</dt><dd>'+n.score.toFixed(2)+'</dd><dt>解释</dt><dd>'+esc(n.explain)+'</dd></dl><h3>影响路径 / Influence Path</h3><p>来源经历：母亲雨夜离开 / 初恋突然失联</p><p>关联图式：依恋威胁图式 / 安全寻求图式</p><p>可能推动行为：反复查看手机 / 压住情绪追问 / 撤回独处</p>';
    el("causal-graph").querySelectorAll("[data-node]").forEach(function(btn){btn.addEventListener("click",function(){selectGalaxyNode(btn.getAttribute("data-node"));});});
  }
  function verdictBadge(verdict){
    var level=(verdict&&verdict.level)||"WARN";
    return '<span class="verdict-badge '+esc(level.toLowerCase())+'">'+esc(level)+'</span>';
  }
  function deltaList(title,items,kind){
    items=items||[];
    if(!items.length) return '<div class="delta-block empty"><h4>'+esc(title)+'</h4><p>无结构化变化</p></div>';
    return '<div class="delta-block '+esc(kind||"")+'"><h4>'+esc(title)+'</h4>'+items.slice(0,6).map(function(d){
      if(d.delta==="added"||d.delta==="removed"||d.delta==="changed") return '<p><strong>'+esc(d.id)+'</strong><span>'+esc(d.delta)+' → '+esc(d.after||d.before||"")+'</span></p>';
      return '<p><strong>'+esc(d.id)+'</strong><span>'+esc(d.before)+' → '+esc(d.after)+' ('+(Number(d.delta)>0?'+':'')+esc(d.delta)+')</span></p>';
    }).join("")+'</div>';
  }
  function decisionDiff(before,after){
    before=before||{};after=after||{};
    return '<div class="decision-diff"><div><small>Before</small><strong>'+esc(before.strategy||"")+'</strong><p>'+esc(short(before.action||"",120))+'</p><em>'+esc(before.topNeed||"")+' / '+esc(before.topDesire||"")+'</em></div><b>→</b><div><small>After</small><strong>'+esc(after.strategy||"")+'</strong><p>'+esc(short(after.action||"",120))+'</p><em>'+esc(after.topNeed||"")+' / '+esc(after.topDesire||"")+'</em></div></div>';
  }
  function influenceVector(vector){
    vector=vector||{};
    return '<div class="influence-vector">'+Object.keys(vector).filter(function(k){return Math.abs(Number(vector[k]||0))>0.001;}).map(function(k){var v=Number(vector[k]||0);return '<span><strong>'+esc(k)+'</strong><b>'+(v>0?'+':'')+esc(v.toFixed(3))+'</b></span>';}).join("")+'</div>';
  }
  function strategyDeltaList(delta){
    delta=delta||{};
    return '<div class="trace-facts">'+Object.keys(delta).filter(function(k){return Math.abs(Number(delta[k]||0))>0.001;}).map(function(k){var v=Number(delta[k]||0);return '<span>'+esc(k)+' '+(v>0?'+':'')+esc(v.toFixed(3))+'</span>';}).join("")+'</div>';
  }
  function candidateScoreTable(before,after,delta){
    before=(before&&before.actionCandidates)||[];after=(after&&after.actionCandidates)||[];delta=delta||{};
    var beforeMap={};before.forEach(function(c){beforeMap[c.id]=c;});
    return '<div class="candidate-score-table"><table><thead><tr><th>Candidate</th><th>Before</th><th>After</th><th>Δ</th><th>Tag</th><th>Style</th></tr></thead><tbody>'+after.slice(0,6).map(function(c){var b=beforeMap[c.id]||{};var d=Number(delta[c.id]||0);return '<tr><td>'+esc(c.label||c.id)+'</td><td>'+esc(typeof b.score==="number"?b.score.toFixed(3):"—")+'</td><td>'+esc(typeof c.score==="number"?c.score.toFixed(3):"—")+'</td><td class="'+(d>=0?'pos':'neg')+'">'+(d>0?'+':'')+esc(d.toFixed(3))+'</td><td>'+esc(c.strategyTag||"")+'</td><td>'+esc(c.approachStyle||"")+'</td></tr>';}).join("")+'</tbody></table></div>';
  }
  function calibrationPanel(cal){
    cal=cal||{};
    var verdict=(cal.calibrationVerdict||{});
    var actual=cal.actualDeltaByChannel||{};
    var allocation=cal.channelImpactAllocation||{};
    var ranges=cal.expectedDeltaRange||[];
    var rows=ranges.map(function(r){return '<tr><td>'+esc(r.channel)+'</td><td>'+esc(Number(allocation[r.channel]||0).toFixed(3))+'</td><td>'+esc(Number(r.expectedMin||0).toFixed(3))+'–'+esc(Number(r.expectedMax||0).toFixed(3))+'</td><td>'+esc(Number(actual[r.channel]||0).toFixed(3))+'</td><td>'+esc(r.rationale||"")+'</td></tr>';}).join("");
    var warnings=(cal.underResponseWarnings||[]).concat(cal.overResponseWarnings||[]);
    return '<div class="audit-inputs"><div><small>Calibration Verdict</small><p>'+esc(verdict.level||"")+'</p><em>severity='+esc(cal.eventSeverityScore)+' · relevance='+esc(cal.domainRelevanceScore)+' · stability='+esc(cal.baselineStabilityScore)+' · resilience='+esc(cal.resilienceBufferScore)+'</em></div><div><small>Impact Modulators</small><p>repetition='+esc(cal.repetitionScore)+' · emotion='+esc(cal.emotionalIntensityScore)+'</p><em>expected vs actual is computed per channel, not from prose.</em></div></div><div class="candidate-score-table"><table><thead><tr><th>Channel</th><th>Allocation</th><th>Expected Delta Range</th><th>Actual Delta By Channel</th><th>Rationale</th></tr></thead><tbody>'+rows+'</tbody></table></div><div class="audit-warning-list">'+(warnings.length?warnings.map(function(w){return '<p>'+esc(w)+'</p>';}).join(""):'<p>No calibration under/over-response warning.</p>')+'</div>';
  }
  function renderRealityAudit(){
    var audit=data.realityAudit||{summary:{pass:0,warn:0,fail:0,total:0},cases:[]};
    el("reality-summary").innerHTML='<article class="card reality-overview"><div><p class="section-kicker">V10.69 Reality Audit</p><h2>状态变化是否按事件强度校准？</h2><p>验收只看结构化 JSON diff。事件必须进入 memory / belief / personality / need / boundary / decision channels；人格是慢变量，允许被 resilience buffer 缓冲，但不能让重大事件完全无痕。</p></div><div class="verdict-counts"><span class="pass">PASS '+audit.summary.pass+'</span><span class="warn">WARN '+audit.summary.warn+'</span><span class="fail">FAIL '+audit.summary.fail+'</span><span>Total '+audit.summary.total+'</span></div></article><article class="card"><h3>Cross-case checks</h3><div class="audit-cross"><p>'+verdictBadge(audit.counterfactual&&audit.counterfactual.verdict)+' Counterfactual Event Test · decisionDifferent='+esc(audit.counterfactual&&audit.counterfactual.decisionDifferent)+' · coordinateDirectionDifferent='+esc(audit.counterfactual&&audit.counterfactual.coordinateDirectionDifferent)+'</p><p>'+verdictBadge(audit.personalityDifferentiation&&audit.personalityDifferentiation.verdict)+' Same Event Different Personality Test · decisionDifferent='+esc(audit.personalityDifferentiation&&audit.personalityDifferentiation.decisionDifferent)+' · coordinateDifferent='+esc(audit.personalityDifferentiation&&audit.personalityDifferentiation.coordinateDifferent)+'</p></div></article>';
    el("reality-cases").innerHTML=(audit.cases||[]).map(function(c){
      var warnings=(c.auditVerdict&&c.auditVerdict.warnings)||[];
      var failures=(c.auditVerdict&&c.auditVerdict.failures)||[];
      var trace=(c.explanationTrace&&c.explanationTrace.facts)||[];
      var influence=c.decisionInfluence||{};
      var resp=c.decisionResponsiveness||{};
      return '<article class="card reality-case"><div class="reality-case-head"><div><p class="section-kicker">'+esc(c.caseKind)+'</p><h3>'+esc(c.label)+'</h3></div>'+verdictBadge(c.auditVerdict)+'</div><div class="audit-inputs"><div><small>Event Input</small><p>'+esc(c.eventInput&&c.eventInput.description)+'</p><em>parsed: '+esc(c.parsedEvent&&c.parsedEvent.category)+' / '+esc(c.parsedEvent&&c.parsedEvent.parser&&c.parsedEvent.parser.source)+'</em></div><div><small>Follow-up Scenario</small><p>'+esc(c.followUpDecisionScenario&&c.followUpDecisionScenario.trigger)+'</p><em>'+esc(c.followUpDecisionScenario&&c.followUpDecisionScenario.testFocus)+'</em></div></div><h4>before / after state diff</h4><div class="delta-grid">'+deltaList("Memory Delta",c.memoryDelta,"memory")+deltaList("Belief Delta",c.beliefDelta,"belief")+deltaList("Personality Coordinate Delta",c.personalityDelta,"personality")+deltaList("Need Delta",c.needDelta,"need")+deltaList("Desire Delta",c.desireDelta,"desire")+'</div><h4>Impact Calibration</h4>'+calibrationPanel(c.impactCalibration)+'<h4>Decision Influence Vector</h4>'+influenceVector(influence.decisionInfluenceVector)+'<h4>Strategy Weight Delta</h4>'+strategyDeltaList(influence.strategyWeightDelta)+'<h4>Action Candidate Score Before / After</h4>'+candidateScoreTable(influence.decisionSurfaceBefore,influence.decisionSurfaceAfter,influence.actionCandidateScoreDelta)+'<h4>Responsiveness Verdict</h4><div class="audit-inputs"><div><small>Responsiveness</small><p>'+esc(resp.verdict||"")+'</p><em>score='+esc(resp.responsivenessScore)+' / overreaction='+esc(resp.overreactionScore)+'</em></div><div><small>Flags</small><p>candidateScoreChanged='+esc(resp.candidateScoreChanged)+' · topCandidateChanged='+esc(resp.topCandidateChanged)+' · strategyDistributionChanged='+esc(resp.strategyDistributionChanged)+'</p><em>grounded='+esc(resp.influenceTraceGrounded)+'</em></div></div><h4>before / after decision diff</h4>'+decisionDiff(c.decisionBefore,c.decisionAfter)+'<h4>Explanation Trace Grounding</h4><div class="trace-facts">'+trace.map(function(f){return '<span>'+esc(f.sourceDeltaPath)+' · '+esc(f.label)+'='+esc(f.value)+'</span>';}).join("")+'</div><h4>Warnings / Failures</h4><div class="audit-warning-list">'+(warnings.concat(failures).length?warnings.concat(failures).map(function(w){return '<p>'+esc(w)+'</p>';}).join(""):'<p>无 WARN / FAIL。</p>')+'</div></article>';
    }).join("");
  }
  function group(title,items){return '<section><h3>'+esc(title)+'</h3><div class="pill-row">'+items.map(function(x){return '<span>'+esc(x)+'</span>';}).join("")+'</div></section>';}
  function renderReview(){
    var diff=(data.decision&&data.decision.differentiated)||{}, integrity=data.integrity||{}, life=data.lifePreview||{};
    el("review-panel").innerHTML='<div class="review-head"><h2>Review Mode</h2><button type="button" id="review-close">关闭</button></div><dl class="detail-dl"><dt>当前 demo 版本</dt><dd>'+esc(data.version)+'</dd><dt>角色 ID</dt><dd>'+esc(data.character&&data.character.id)+'</dd><dt>readOnly</dt><dd>'+esc(integrity.readOnly)+'</dd><dt>apiRequired</dt><dd>'+esc(integrity.apiRequired)+'</dd><dt>llmRequired</dt><dd>'+esc(integrity.llmRequired)+'</dd><dt>stateMutation</dt><dd>'+esc(integrity.stateMutation)+'</dd></dl>'+group("激活图式排序",diff.schemas||[])+group("缺失排序",diff.needs||[])+group("欲望排序",diff.desires||[])+group("行为候选",behaviorCandidates().map(function(c){return c.label+" "+c.score.toFixed(2);})) + group("被压制行为",life.suppressedBehaviors||[]) + group("warning 信息",(data.reviewWarnings||[]).map(function(w){return w.level+': '+w.message;}));
    el("review-close").addEventListener("click",toggleReviewMode);
  }
  function toggleReviewMode(){
    reviewOpen=!reviewOpen;
    document.body.classList.toggle("review-mode",reviewOpen);
    el("review-panel").hidden=!reviewOpen;
    el("review-toggle").setAttribute("aria-pressed",String(reviewOpen));
    el("review-toggle").textContent=reviewOpen?"Exit Review Mode":"Review Mode";
    announce(reviewOpen?"当前页面：Review Mode":"当前页面：Demo");
  }
  function setupNav(){
    document.querySelectorAll("[data-jump]").forEach(function(btn){btn.addEventListener("click",function(){document.getElementById(btn.dataset.jump).scrollIntoView({behavior:"smooth"});document.querySelectorAll("[data-jump]").forEach(function(b){b.classList.remove("active");b.setAttribute("aria-selected","false");b.setAttribute("tabindex","-1");});btn.classList.add("active");btn.setAttribute("aria-selected","true");btn.setAttribute("tabindex","0");});});
  }
  function init(){
    renderHeader();renderState();renderBehavior();renderScenarios();renderGalaxy();renderRealityAudit();renderReview();setupNav();
    el("review-toggle").addEventListener("click",toggleReviewMode);
  }
  window.selectGalaxyNode=selectGalaxyNode;
  window.renderScenarioFilters=renderScenarioFilters;
  init();
})();
