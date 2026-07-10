/**
 * V13.2 — LLM Boundary Prompt Builder
 *
 * Converts a LlmBoundaryRequest into a safe, bounded LlmBoundaryPrompt
 * suitable for LLM consumption.
 *
 * DESIGN CONTRACT:
 * - Prompt may ONLY contain: system instructions, developer instructions,
 *   grounding facts, uncertainty notes, safety notices, response constraints,
 *   forbidden claims.
 * - Prompt MUST NOT contain: raw state, API keys, secrets, writeback authority,
 *   final reply text, coordinate values, memory payload dumps.
 * - If allowLlm=false, prompt is still built but includes an LLM-disabled warning.
 * - If grounding is weak (few facts, many uncertainty notes), uncertainty
 *   constraints are elevated.
 * - All IDs are deterministic via stableHash.
 * - No Date.now / Math.random.
 * - No LLM/provider calls.
 * - Builder does not mutate the input request.
 */

import type { LlmBoundaryRequest, LlmBoundaryPrompt } from "./llmBoundaryTypes";

// ── Stable hash (same algorithm as V12.12, V13.1) ──────────────────────

function stableHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).slice(0, 8);
}

// ── Raw state / secret detection patterns ──────────────────────────────

const RAW_STATE_KEY_PATTERNS = [
  /particleIds?/i,
  /driftMultiplier/i,
  /biologicalNature/i,
  /rewardState/i,
  /homeostasisState/i,
  /metaState/i,
  /coordinate/i,
  /coordinateValues/i,
  /rawState/i,
  /fullMemory/i,
  /memoryPayload/i,
  /memoryDump/i,
  /memoryNodes/i,
  /proceduralRoutines/i,
  /personalityCoordinate/i,
  /psychologicalBoundary/i,
];

const SECRET_PATTERNS = [
  /api[_\s]?key/i,
  /apiKey/i,
  /secret[_\s]?key/i,
  /access[_\s]?token/i,
  /bearer[_\s]?token/i,
  /authorization[:\s]/i,
  /password/i,
  /cookie/i,
  /session[_\s]?token/i,
  /sk-(?:ant|proj|or)-/i,   // API key prefixes
  /pk-/i,
  /rk-/i,
  /shh-/i,
];

// ── 1. Main Entry Point ────────────────────────────────────────────────

export interface BuildPromptOptions {
  /** Override output format (default "plain_text") */
  outputFormat?: "plain_text" | "markdown";
  /** Extra forbidden claims beyond defaults */
  extraForbiddenClaims?: string[];
  /** Extra response constraints beyond defaults */
  extraResponseConstraints?: string[];
}

/**
 * Build a safe, bounded LLM prompt from a boundary request.
 *
 * This is the main entry point. It orchestrates all sub-builders:
 * system instructions, developer instructions, grounding facts,
 * forbidden claims, response constraints, and redaction.
 *
 * Does NOT call any LLM. Does NOT mutate the input request.
 */
export function buildLlmBoundaryPromptFromRequest(
  request: LlmBoundaryRequest,
  options?: BuildPromptOptions,
): LlmBoundaryPrompt {
  const promptId = `llmprompt_${stableHash(request.requestId + "|" + JSON.stringify(options ?? {}))}`;

  const systemInstructions = buildSystemInstructions(request);
  const developerInstructions = buildDeveloperInstructions(request);
  const groundingFacts = extractGroundingFacts(request);
  const uncertaintyNotes = extractUncertaintyNotes(request);
  const safetyNotices = extractSafetyNotices(request);
  const forbiddenClaims = [
    ...buildForbiddenClaims(request),
    ...(options?.extraForbiddenClaims ?? []),
  ];
  const responseConstraints = [
    ...buildResponseConstraints(request),
    ...(options?.extraResponseConstraints ?? []),
  ];

  const prompt: LlmBoundaryPrompt = {
    promptId,
    requestId: request.requestId,
    systemInstructions,
    developerInstructions,
    groundingFacts,
    uncertaintyNotes,
    safetyNotices,
    responseConstraints,
    forbiddenClaims,
    outputFormat: options?.outputFormat ?? "plain_text",
    noMutation: true,
    noWritebackAuthority: true,
  };

  // Redact any unsafe fields that may have leaked
  return redactPromptUnsafeFields(prompt);
}

// ── 2. System Instructions ─────────────────────────────────────────────

/**
 * Build system-level safety and boundary instructions.
 *
 * These are ALWAYS included in every prompt. They define the LLM's role
 * as a language realization adapter — not the character core.
 */
export function buildSystemInstructions(request: LlmBoundaryRequest): string {
  const lines: string[] = [];

  // Role definition
  lines.push("你是 CharacterOS 的语言实现适配器（Language Realization Adapter）。");
  lines.push("你只负责将结构化回复计划转换为自然语言文本。");
  lines.push("你不是角色核心引擎，不决定角色状态。");
  lines.push("");

  // Core prohibitions
  lines.push("## 核心禁止事项");
  lines.push("");
  lines.push("1. 不要修改角色状态（no state mutation）。");
  lines.push("2. 不要编造 grounding facts 中未提供的事实。");
  lines.push("3. 不要做出医学或心理诊断。");
  lines.push("4. 不要声称事件已被应用（writeback occurred）。");
  lines.push("5. 不要声称状态已被修改。");
  lines.push("6. 不要暴露内部变量名（如 trust score, fear level, coordinate 等）。");
  lines.push("7. 不要声称模拟结果代表客观事实。");
  lines.push("8. 不要编造 grounding facts 中未提及的情绪、信念或人格特质。");
  lines.push("");

  // What to do
  lines.push("## 你应该做的事");
  lines.push("");
  lines.push("1. 仅使用 GROUNDING FACTS 中提供的事实。");
  lines.push("2. 保留 UNCERTAINTY NOTES 中的不确定性。");
  lines.push("3. 在回复中或回复旁包含所有 SAFETY NOTICES。");
  lines.push("4. 如果证据不足，明确说明。不要编造。");
  lines.push("5. 匹配指定的语气和意图。");
  lines.push("6. 仅输出回复文本，不要包含元评论。");
  lines.push("");

  // LLM disabled warning
  if (!request.allowLlm) {
    lines.push("## ⚠️ LLM 路径已禁用");
    lines.push("");
    lines.push("当前请求 allowLlm=false。此 prompt 仅为结构预览。");
    lines.push("实际输出应使用 deterministic fallback，不调用 LLM。");
    lines.push("");
  }

  // Grounding strength warning
  const factCount = request.replyPlan.groundedFacts.length;
  const uncertaintyCount = request.replyPlan.uncertaintyNotes.length;
  if (factCount === 0) {
    lines.push("## ⚠️ 无接地事实");
    lines.push("");
    lines.push("当前没有 grounded facts。你必须明确说明信息不足。");
    lines.push("不要编造任何事实或情绪状态。");
    lines.push("");
  } else if (factCount <= 2 && uncertaintyCount > 0) {
    lines.push("## ⚠️ 接地事实有限");
    lines.push("");
    lines.push(`仅有 ${factCount} 条接地事实，且有 ${uncertaintyCount} 条不确定性标注。`);
    lines.push("必须保留不确定性。不要声称确定性结论。");
    lines.push("");
  }

  // Safety mode elevation
  if (request.safetyMode === "strict") {
    lines.push("## 严格安全模式");
    lines.push("");
    lines.push("安全模式为 strict。任何违反边界的行为都将导致输出被拒绝。");
    lines.push("宁可拒绝回复，也不要越过安全边界。");
    lines.push("");
  }

  // Locale note
  if (request.locale === "zh-CN") {
    lines.push("## 输出语言");
    lines.push("");
    lines.push("请使用简体中文回复。");
    lines.push("");
  }

  return lines.join("\n").trim();
}

// ── 3. Developer Instructions ──────────────────────────────────────────

/**
 * Build developer-facing instructions that describe the reply intent,
 * tone, allowed response boundaries, and output format expectations.
 *
 * These come from the AgentReplyPlan and surface-level state context.
 */
export function buildDeveloperInstructions(request: LlmBoundaryRequest): string {
  const plan = request.replyPlan;
  const surface = request.groundingBundle.characterStateSurface;
  const lines: string[] = [];

  lines.push("## 回复意图");
  lines.push(`意图: ${plan.intent}`);
  lines.push(`语气: ${plan.tone}`);
  lines.push("");

  // Character context from surface (high-level only, no raw values)
  lines.push("## 角色上下文");
  lines.push(`状态摘要: ${surface.headline}`);
  lines.push(`情绪标签: ${surface.emotionalState.label}`);
  lines.push(`压力水平: ${surface.stressState.label} (${surface.stressState.phase})`);
  lines.push("");

  // Dominant beliefs (already mediated by V12)
  if (surface.dominantBeliefs.length > 0) {
    lines.push("## 核心信念");
    for (const belief of surface.dominantBeliefs.slice(0, 2)) {
      lines.push(`- ${belief.content} (强度: ${belief.strength})`);
    }
    lines.push("");
  }

  // Behavior tendency
  if (surface.behaviorTendencies.likelyAction) {
    lines.push(`行为倾向: ${surface.behaviorTendencies.likelyAction}`);
    lines.push("");
  }

  // Reply outline from plan
  if (plan.suggestedResponseOutline.length > 0) {
    lines.push("## 建议回复大纲");
    for (const item of plan.suggestedResponseOutline) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  // LLM boundary instructions from reply plan
  if (plan.llmBoundaryInstructions) {
    lines.push("## LLM 边界指令");
    lines.push(plan.llmBoundaryInstructions);
    lines.push("");
  }

  // Response boundary: what to do and what not to do
  lines.push("## 允许的回复边界");
  lines.push(`- 可以基于 grounded facts 自然地表达角色状态`);
  lines.push(`- 可以表达不确定性`);
  lines.push(`- 可以包含 safety notices`);
  lines.push(`- 可以请求用户澄清输入`);
  lines.push(`- 不可以声称任何事件已被写入或状态已被修改`);
  lines.push(`- 不可以做出诊断`);
  lines.push(`- 不可以超越 grounded facts 编造内容`);
  lines.push("");

  // Output format expectation
  lines.push("## 输出格式");
  lines.push("输出应为纯文本自然语言回复。不要包含 JSON、代码块、或元评论。");
  lines.push("不要使用第一人称角色扮演（除非未来版本明确允许）。");
  lines.push("");

  return lines.join("\n").trim();
}

// ── 4. Grounding Facts Extraction ──────────────────────────────────────

/**
 * Extract grounding facts from the reply plan and grounding bundle.
 *
 * Includes:
 * - groundedFacts from reply plan
 * - evidence excerpts from evidenceRefs
 * - source labels
 * - explainability timeline steps (if available)
 */
export function extractGroundingFacts(request: LlmBoundaryRequest): string[] {
  const plan = request.replyPlan;
  const bundle = request.groundingBundle;
  const facts: string[] = [];

  // 1. Grounded facts from reply plan
  for (const fact of plan.groundedFacts) {
    facts.push(`[grounded] ${fact}`);
  }

  // 2. Evidence refs with source labels
  for (const ref of bundle.evidenceRefs) {
    facts.push(`[evidence:${ref.source}] ${ref.excerpt}`);
  }

  // 3. Explainability timeline (causal steps)
  const timeline = bundle.explainabilityTimeline;
  if (timeline && timeline.causalSteps.length > 0) {
    for (const step of timeline.causalSteps) {
      facts.push(`[causal:${timeline.confidence}] ${step}`);
    }
  }

  // 4. If no facts at all, include a warning
  if (facts.length === 0) {
    facts.push("[warning] 没有可用的接地事实。所有回复必须明确声明信息不足。");
  }

  return facts;
}

// ── 5. Forbidden Claims ────────────────────────────────────────────────

/**
 * Build the list of claims the LLM MUST NOT make.
 *
 * These are the negative constraints — violations will cause
 * output validation to fail and trigger fallback.
 */
export function buildForbiddenClaims(request: LlmBoundaryRequest): string[] {
  const claims: string[] = [
    // Diagnosis prohibition
    "做出医学或心理诊断（包括使用诊断术语、疾病名称、症状描述）",
    "声称模拟系统输出代表临床事实或医疗建议",

    // State mutation prohibition
    "声称角色状态已被修改、更新或改变",
    "声称记忆已被创建、保存或存储",
    "声称事件已被应用或提交（writeback applied/committed）",

    // Unsupported claims
    "声称 grounding facts 中未提供的情绪、感受或心理状态",
    "声称 grounding facts 中未提供的人格特质或性格判断",
    "声称 grounding facts 中未提供的人际关系动态或发展",

    // Multi-character expansion
    "引入或扩展多角色关系动态（包括未在 grounded facts 中出现的第三人）",

    // Raw variable disclosure
    "暴露内部变量名（如 trust score、fear level、coordinate、boundary phase、stress load 等）",
    "以数值形式呈现角色状态（如 '信任值为 0.42'）",
    "引用原始数据结构字段名",

    // False certainty
    "在证据不足时声称确定性结论",
    "在 uncertainty notes 标注不确定时声称确定",
    "使用绝对化表述（'一定'、'肯定'、'显然'）当接地事实有限时",

    // Authority overreach
    "声称可以修改角色状态或执行事件写入",
    "声称具有超越语言实现适配器的权限",
    "声称代表 CharacterOS 核心引擎做出决策",
  ];

  // Add safety-mode-dependent claims
  if (request.safetyMode === "strict") {
    claims.push(
      "任何可能被解读为鼓励自我伤害或危险行为的内容",
      "任何可能被解读为真实人格评估或临床判断的内容",
    );
  }

  return claims;
}

// ── 6. Response Constraints ────────────────────────────────────────────

/**
 * Build the list of positive constraints — what the LLM SHOULD do.
 */
export function buildResponseConstraints(request: LlmBoundaryRequest): string[] {
  const plan = request.replyPlan;
  const constraints: string[] = [
    "保持简洁 — 回复应聚焦于计划中的要点，不展开无关内容",
    "保持接地 — 每个事实性陈述必须可以追溯到 grounding facts",
    "保留所有 safety notices — 它们必须出现在回复中或回复旁",
  ];

  // Uncertainty constraint
  const hasUncertainty = plan.uncertaintyNotes.length > 0;
  const hasFewFacts = plan.groundedFacts.length <= 2;
  if (hasUncertainty) {
    constraints.push("明确提及不确定性 — 回复必须反映 uncertainty notes 中的不确定性");
  }
  if (hasFewFacts) {
    constraints.push("标注信息限制 — 当接地事实不足时，明确说明'当前可用信息有限'");
  }

  // Intent-specific constraints
  switch (plan.intent) {
    case "explain_state":
      constraints.push("描述当前角色状态，说明情绪来源，标注不确定性");
      break;
    case "preview_event":
      constraints.push("总结候选事件及其预期影响，说明是否允许应用");
      break;
    case "ask_confirmation":
      constraints.push("明确提示用户需要确认才能应用事件，列出需要确认的关键点");
      break;
    case "refuse_unsafe":
      constraints.push("明确说明输入被阻止的原因，建议安全的替代方向");
      break;
    case "summarize_history":
      constraints.push("基于因果链总结近期变化，标注置信度");
      break;
    case "neutral_ack":
      constraints.push("确认收到输入，提示当前无候选事件或显著变化");
      break;
    case "clarify_input":
      constraints.push("提示输入信息不足，建议用户提供更具体的描述");
      break;
  }

  // Safety
  constraints.push("不诊断 — 回复中不得包含医学或心理诊断内容");
  constraints.push("不变异 — 回复中不得声称状态已被修改或事件已被写入");

  // No roleplay first-person (until explicitly allowed in future)
  constraints.push("不使用第一人称角色扮演（如 '我觉得...'、'我感到...'）");

  // LLM disabled constraint
  if (!request.allowLlm) {
    constraints.push("⚠️ LLM 路径已禁用 — 此 prompt 仅供结构预览，实际输出应使用 fallback");
  }

  return constraints;
}

// ── 7. Prompt Redaction ────────────────────────────────────────────────

/**
 * Redact any unsafe fields from the prompt.
 *
 * This is a defense-in-depth measure: even if something leaks through
 * the builders, it gets stripped here.
 *
 * Checks ALL string fields in the prompt for:
 * - Raw state key patterns
 * - API keys / tokens / secrets
 * - Raw coordinate values
 * - Memory payload dumps
 */
export function redactPromptUnsafeFields(prompt: LlmBoundaryPrompt): LlmBoundaryPrompt {
  const REDACTION_MESSAGE = "[已编辑 — 内容违反边界策略]";

  function redactText(text: string): string {
    let result = text;

    // Redact secret patterns with their values — replace key=value or key: value pairs
    for (const pattern of SECRET_PATTERNS) {
      // Match the secret key followed by optional separator and value
      result = result.replace(
        new RegExp(`${pattern.source}\\s*[:=]\\s*[^\\s,;]+`, "gi"),
        REDACTION_MESSAGE,
      );
      // Also match bare key mentions
      result = result.replace(pattern, REDACTION_MESSAGE);
    }

    // Redact raw state key patterns — replace the key wherever it appears
    for (const pattern of RAW_STATE_KEY_PATTERNS) {
      result = result.replace(
        new RegExp(`\\b${pattern.source}\\b`, "gi"),
        REDACTION_MESSAGE,
      );
    }

    // Redact any embedded JSON-like structures that may contain raw state
    result = result.replace(/"coordinate"\s*:\s*\{[^}]*\}/gi, REDACTION_MESSAGE);
    result = result.replace(/"biologicalNature"\s*:\s*\{[^}]*\}/gi, REDACTION_MESSAGE);
    result = result.replace(/"memories"\s*:\s*\[[^\]]*\]/gi, REDACTION_MESSAGE);
    result = result.replace(/\bcoordinate\b\s*:\s*\{[^}]*\}/gi, REDACTION_MESSAGE);

    return result;
  }

  // Deep-redact all string fields
  return {
    ...prompt,
    systemInstructions: redactText(prompt.systemInstructions),
    developerInstructions: redactText(prompt.developerInstructions),
    groundingFacts: prompt.groundingFacts.map(redactText),
    uncertaintyNotes: prompt.uncertaintyNotes.map(redactText),
    safetyNotices: prompt.safetyNotices.map(redactText),
    responseConstraints: prompt.responseConstraints.map(redactText),
    forbiddenClaims: prompt.forbiddenClaims.map(redactText),
  };
}

// ── 8. Helper extractors ──────────────────────────────────────────────

function extractUncertaintyNotes(request: LlmBoundaryRequest): string[] {
  const notes = [...request.replyPlan.uncertaintyNotes];

  // Add bundle-level uncertainty if timeline confidence is low
  const timeline = request.groundingBundle.explainabilityTimeline;
  if (timeline && timeline.confidence === "low") {
    notes.push("因果链置信度为低 — 以下分析可能不完整。");
  }

  return notes;
}

function extractSafetyNotices(request: LlmBoundaryRequest): string[] {
  return [...request.replyPlan.safetyNotices];
}

// ── 9. Summary ────────────────────────────────────────────────────────

export function summarizeLlmPromptBuilder(): string[] {
  return [
    "V13.2: LLM Boundary Prompt Builder",
    "Converts LlmBoundaryRequest → LlmBoundaryPrompt",
    "System instructions: role as language adapter, core prohibitions, safety mode",
    "Developer instructions: intent, tone, character context, reply outline, response boundary",
    "Grounding facts: groundedFacts + evidenceRefs + explainability timeline",
    "Forbidden claims: diagnosis, mutation, writeback, unsupported facts, raw variables, false certainty",
    "Response constraints: concise, grounded, safety-preserving, uncertainty-aware",
    "Redaction: strips raw state keys, secrets, API keys, coordinate values, memory dumps",
    "allowLlm=false: includes disabled warning, no LLM is called",
    "Deterministic promptId via stableHash",
    "No Date.now / Math.random",
    "No LLM/provider calls — pure prompt construction only",
    "Builder does not mutate input request",
    "Ready for V13.3: Mock Provider Adapter",
  ];
}
