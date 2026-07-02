import { NextResponse } from "next/server";
import { explainDecision } from "@/core/decision/decisionNarrative";
import { serializeCharacterPhysicsState } from "@/core/physics/serialization";
import { createOpenAICompatibleProviderFromEnv } from "@/llm/providers/openaiCompatible";
import { characterPhysicsService } from "@/server/characterPhysicsServiceSingleton";
import { requireAuth } from "@/app/api/_shared/auth";
import {
  resolveCharacterRouteParams,
  type CharacterRouteContext
} from "@/app/api/_shared/routeUtils";
import { explainDifferentiatedDecision } from "@/core/explainability/differentiatedDecisionExplanation";
import { buildDifferentiatedDecisionForState } from "@/core/differentiation/differentiationAdapter";
import { runLifeTickDryRun } from "@/core/life/lifeTickRunner";
import {
  buildLifeDecisionContextFromDryRun,
  type LifeDecisionContext,
} from "@/core/differentiation/lifeDecisionContext";

export async function GET(_request: Request, context: CharacterRouteContext) {
  const blocked = requireAuth(_request);
  if (blocked) return blocked;

  const { characterId } = await resolveCharacterRouteParams(context);
  const charState = characterPhysicsService.getState(characterId);
  const state = serializeCharacterPhysicsState(charState);
  const provider = createOpenAICompatibleProviderFromEnv();
  const narrative = await explainDecision({
    decision: state.derived.decision,
    derived: state.derived,
    ...(provider ? { provider } : {})
  });

  // V10.15: Check for life context integration
  const url = new URL(_request.url);
  const includeLifeContext = url.searchParams.get("includeLifeContext") === "true";
  const paramElapsed = parseInt(url.searchParams.get("elapsedHours") ?? "6", 10);
  const paramSeed = url.searchParams.get("seed") ?? `${characterId}-v10.15`;
  const elapsedHours = Math.max(1, Math.min(168, Number.isFinite(paramElapsed) ? paramElapsed : 6));

  let lifeContext: LifeDecisionContext | undefined;

  if (includeLifeContext) {
    try {
      const dryRun = runLifeTickDryRun(charState, {
        characterId,
        elapsedHours,
        observed: true,
        requestedAt: new Date().toISOString(),
        mode: "dry_run",
        seed: paramSeed,
      });
      lifeContext = buildLifeDecisionContextFromDryRun(dryRun);
    } catch {
      // Life dry-run failed — proceed without life context
    }
  }

  // Build differentiated decision (possibly with life context)
  let dd = state.derived.differentiatedDecision;
  if (lifeContext && !dd) {
    dd = buildDifferentiatedDecisionForState(charState, { lifeContext });
  } else if (lifeContext && dd) {
    // Re-derive with life context when explicitly requested
    dd = buildDifferentiatedDecisionForState(charState, { lifeContext });
  }

  const response: Record<string, unknown> = {
    characterId,
    decision: state.derived.decision,
    derived: state.derived,
    narrative,
  };

  // V10.12-V10.13: Include differentiated decision chain when available
  if (dd) {
    response.differentiatedDecision = dd;
    response.schemas = dd.schemas;
    response.needs = dd.needs;
    response.desires = dd.desires;
    response.selectedStrategy = dd.selectedStrategy;
    response.actionSurface = dd.actionSurface;

    // V10.15: Include life context in response when enabled
    if (lifeContext) {
      response.lifeDecisionContext = lifeContext;
      response.lifeInfluences = dd.lifeInfluences;
    }

    // V10.13: Include differentiated explanation
    try {
      const explInput: Parameters<typeof explainDifferentiatedDecision>[0] = {
        legacyDecision: state.derived.decision,
        differentiatedDecision: dd,
        seed: characterId,
        environmentName: state.boundary?.phase === "overflow" ? "高压环境" : "日常环境",
      };
      if (state.identity?.name) {
        explInput.personaName = state.identity.name;
      }
      if (lifeContext) {
        explInput.lifeContext = lifeContext;
      }
      const explanation = explainDifferentiatedDecision(explInput);
      response.differentiatedExplanation = explanation.trace;
    } catch (err) {
      response.differentiatedExplanation = null;
      const warnings = (response.warnings as string[]) ?? [];
      warnings.push(`Differentiated explanation generation failed: ${String(err)}.`);
      response.warnings = warnings;
    }

    const warnings = (response.warnings as string[]) ?? [];
    const lifeNote = lifeContext ? " V10.15 life context included." : "";
    warnings.push(`V10.12 differentiated decision chain included. V10.13 differentiated explanation included.${lifeNote} Legacy decision and derived fields remain unchanged.`);
    response.warnings = warnings;
  }

  return NextResponse.json(response);
}
