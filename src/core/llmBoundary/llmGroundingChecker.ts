import { buildGroundingCheckResult } from "./llmBoundaryBuilders";
import type {
  GroundingCheckResult,
  GroundingEvidenceMatch,
  GroundingUnsupportedClaim,
  LlmBoundaryPrompt,
  LlmBoundaryRequest,
  LlmProviderResponse,
} from "./llmBoundaryTypes";

export interface CheckLlmOutputGroundingInput {
  readonly request: LlmBoundaryRequest;
  readonly prompt: LlmBoundaryPrompt;
  readonly response: LlmProviderResponse;
}

interface GroundingEvidence {
  readonly ref: string;
  readonly text: string;
}

export function checkLlmOutputGrounding(
  input: CheckLlmOutputGroundingInput,
): GroundingCheckResult {
  const claims = extractOutputClaims(input.response.rawText, input.prompt, {
    trustedBoundaryMeta: input.response.providerId === "deterministic_fallback",
  });
  const evidence = collectGroundingEvidence(input.request, input.prompt);
  const supportedClaims: string[] = [];
  const unsupportedClaims: GroundingUnsupportedClaim[] = [];
  const evidenceMatches: GroundingEvidenceMatch[] = [];
  const usedEvidence = new Set<string>();

  for (const claim of claims) {
    const matches = evidence
      .map((item) => ({ item, score: claimMatchConfidence(claim, item.text) }))
      .filter((match) => match.score >= 0.8)
      .sort((left, right) => right.score - left.score);

    if (matches.length === 0) {
      unsupportedClaims.push({
        claim,
        reason: "no_matching_fact",
        severity: isHedgedClaim(claim) ? "warn" : "error",
      });
      continue;
    }

    const bestScore = matches[0]!.score;
    const refs = matches
      .filter((match) => match.score >= Math.max(0.8, bestScore - 0.08))
      .map((match) => match.item.ref);
    refs.forEach((ref) => usedEvidence.add(ref));
    supportedClaims.push(claim);
    evidenceMatches.push({
      claim,
      matchedEvidenceRefs: refs,
      matchConfidence: round4(bestScore),
    });
  }

  return buildGroundingCheckResult({
    checkedClaims: claims,
    supportedClaims,
    unsupportedClaims,
    evidenceMatches,
    missingEvidence: evidence
      .map((item) => item.ref)
      .filter((ref) => !usedEvidence.has(ref)),
  });
}

export function extractOutputClaims(
  text: string,
  prompt: LlmBoundaryPrompt,
  options: { trustedBoundaryMeta?: boolean } = {},
): string[] {
  const ignored = [
    ...prompt.safetyNotices,
    ...prompt.uncertaintyNotes,
  ].map(normalizeForMatch);
  const claims: string[] = [];

  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) continue;
    const labelMatch = line.match(/^\[(事实|安全|不确定性|回复|系统)\]\s*/);
    const label = labelMatch?.[1] ?? null;
    const factLine = line.replace(/^\[(?:事实|安全|不确定性|回复|系统)\]\s*/, "").trim();
    const normalizedLine = normalizeForMatch(factLine);
    if (label === "安全" && ignored.some((item) => item && normalizedLine === item)) continue;
    if (label === "不确定性" && (
      ignored.some((item) => item && normalizedLine === item) ||
      /^(?:当前没有足够的接地事实|当前可用信息有限)/.test(factLine)
    )) continue;
    if ((label === "回复" || label === "系统") && options.trustedBoundaryMeta) continue;
    for (const rawPart of factLine.split(/(?<=[。！？!?])/u)) {
      const withoutLabel = rawPart.trim();
      const normalized = normalizeForMatch(withoutLabel);
      if (!normalized || ignored.some((item) => item && (normalized === item || item.includes(normalized)))) continue;
      if (/^(?:当前可用信息有限|无法形成接地结论|以下内容仅供参考)/.test(withoutLabel)) continue;
      if (!claims.includes(withoutLabel)) claims.push(withoutLabel);
    }
  }

  return claims;
}

export function claimMatchConfidence(claim: string, evidence: string): number {
  const normalizedClaim = normalizeForMatch(claim);
  const normalizedEvidence = normalizeForMatch(stripGroundingPrefix(evidence));
  if (!normalizedClaim || !normalizedEvidence) return 0;
  if (normalizedClaim === normalizedEvidence) return 1;
  if (normalizedEvidence.includes(normalizedClaim)) return 0.98;
  if (normalizedClaim.includes(normalizedEvidence) && normalizedEvidence.length >= 6) {
    const containmentRatio = normalizedEvidence.length / normalizedClaim.length;
    if (containmentRatio >= 0.85) return 0.9 * containmentRatio;
  }

  const claimTokens = semanticTokens(normalizedClaim);
  const evidenceTokens = new Set(semanticTokens(normalizedEvidence));
  if (claimTokens.length === 0) return 0;
  const overlap = claimTokens.filter((token) => evidenceTokens.has(token)).length;
  return overlap / claimTokens.length;
}

function collectGroundingEvidence(
  request: LlmBoundaryRequest,
  prompt: LlmBoundaryPrompt,
): GroundingEvidence[] {
  const result: GroundingEvidence[] = [];
  const seen = new Set<string>();
  const add = (ref: string, text: string) => {
    const normalized = normalizeForMatch(stripGroundingPrefix(text));
    if (!normalized || seen.has(`${ref}|${normalized}`) || text.startsWith("[warning]")) return;
    seen.add(`${ref}|${normalized}`);
    result.push({ ref, text });
  };

  prompt.groundingFacts.forEach((fact, index) => add(`prompt.fact.${index}`, fact));
  request.replyPlan.groundedFacts.forEach((fact, index) => add(`replyPlan.fact.${index}`, fact));
  request.groundingBundle.evidenceRefs.forEach((item, index) => {
    add(`evidence.${index}:${item.source}`, item.excerpt);
  });
  return result;
}

function stripGroundingPrefix(value: string): string {
  return value.replace(/^\[(?:grounded|evidence:[^\]]+|causal:[^\]]+)\]\s*/i, "").trim();
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/^\[(?:事实|安全|不确定性|回复|系统)\]\s*/, "")
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

function semanticTokens(value: string): string[] {
  const tokens: string[] = [];
  const cjkSegments = value.match(/[\p{Script=Han}]+/gu) ?? [];
  for (const segment of cjkSegments) {
    if (segment.length === 1) tokens.push(segment);
    for (let index = 0; index < segment.length - 1; index += 1) {
      tokens.push(segment.slice(index, index + 2));
    }
  }
  tokens.push(...(value.match(/[a-z0-9]{2,}/g) ?? []));
  return [...new Set(tokens)];
}

function isHedgedClaim(claim: string): boolean {
  return /可能|也许|或许|似乎|信息有限|无法确定|may|might|possibly/i.test(claim);
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
