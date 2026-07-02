import { NextResponse } from "next/server";
import { parseExperienceEventWithProvider } from "@/core/event/llmEventParser";
import type { EventCategory } from "@/core/event/categoryPhysics";
import { createOpenAICompatibleProviderFromEnv } from "@/llm/providers/openaiCompatible";
import { requireAuth } from "@/app/api/_shared/auth";
import { readJsonBody } from "@/app/api/_shared/routeUtils";

interface ParseRequest {
  description?: string;
  tags?: string[];
  categoryHint?: EventCategory | "auto";
  useLLM?: boolean;
}

export async function POST(request: Request) {
  const blocked = requireAuth(request);
  if (blocked) return blocked;

  const bodyResult = await readJsonBody<ParseRequest>(request);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.body;

  if (!body.description) {
    return NextResponse.json({ error: "Missing description" }, { status: 400 });
  }

  const provider = body.useLLM === false ? undefined : createOpenAICompatibleProviderFromEnv();
  const event = await parseExperienceEventWithProvider(
    {
      description: body.description,
      tags: body.tags ?? [],
      categoryHint: body.categoryHint ?? "auto"
    },
    provider
  );

  return NextResponse.json({
    event,
    llmConfigured: Boolean(provider)
  });
}
