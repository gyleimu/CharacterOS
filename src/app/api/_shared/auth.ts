import { NextResponse } from "next/server";

const AUTH_HEADER = "x-api-key";

/**
 * Returns true when CHARACTEROS_API_KEY is set and the incoming
 * request carries a matching x-api-key header.
 *
 * When CHARACTEROS_API_KEY is NOT set (local dev), all requests
 * are treated as authorized — no header is required.
 */
export function isRequestAuthorized(request: Request): boolean {
  const expectedKey = process.env.CHARACTEROS_API_KEY;
  if (!expectedKey) {
    // Local development: auth is disabled.
    return true;
  }
  const providedKey = request.headers.get(AUTH_HEADER);
  if (!providedKey) {
    return false;
  }
  // Constant-time-ish string comparison to reduce timing leakage.
  return timingSafeEqual(providedKey, expectedKey);
}

/**
 * Convenience wrapper: returns null when the request is authorized,
 * or a 401 NextResponse when it is not.
 *
 * Usage in a route handler:
 *
 *   const blocked = requireAuth(request);
 *   if (blocked) return blocked;
 */
export function requireAuth(request: Request): NextResponse | null {
  if (isRequestAuthorized(request)) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * Returns true when CHARACTEROS_API_KEY is configured.
 * Routes may use this to decide whether to apply optional GET protection.
 */
export function isAuthEnabled(): boolean {
  return Boolean(process.env.CHARACTEROS_API_KEY);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
