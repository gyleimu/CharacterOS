import { NextResponse } from "next/server";

export type CharacterRouteContext = {
  params: Promise<{ characterId: string }> | { characterId: string };
};

export async function resolveCharacterRouteParams(
  context: CharacterRouteContext
): Promise<{ characterId: string }> {
  return await context.params;
}

export type JsonBodyResult<T> =
  | { ok: true; body: Partial<T> }
  | { ok: false; response: NextResponse };

export async function readJsonBody<T>(request: Request): Promise<JsonBodyResult<T>> {
  try {
    return {
      ok: true,
      body: (await request.json()) as Partial<T>
    };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    };
  }
}
