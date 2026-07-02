import { describe, expect, it, beforeEach, afterEach } from "vitest";

const AUTH_HEADER = "x-api-key";
const AUTH_ENV_KEY = "CHARACTEROS_API_KEY";

function uniqueCharacterId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

describe("API authentication", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("when AUTH_ENV_KEY is NOT set (local dev)", () => {
    it("allows POST requests without auth header", async () => {
      delete process.env[AUTH_ENV_KEY];
      const { POST } = await import("../../src/app/api/characters/[characterId]/physics/route");
      const characterId = uniqueCharacterId("auth-open-post");

      const response = await POST(
        new Request("http://localhost/api/characters/test/physics", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ event: { id: "ev-1", description: "test", tags: [], category: "general" } })
        }),
        { params: { characterId } }
      );
      // Should not be 401
      expect(response.status).not.toBe(401);
    });

    it("allows DELETE requests without auth header", async () => {
      delete process.env[AUTH_ENV_KEY];
      const { DELETE } = await import("../../src/app/api/characters/[characterId]/physics/route");
      const characterId = uniqueCharacterId("auth-open-delete");

      const response = await DELETE(
        new Request(`http://localhost/api/characters/${characterId}/physics`, { method: "DELETE" }),
        { params: { characterId } }
      );
      expect(response.status).not.toBe(401);
    });

    it("allows GET requests without auth header", async () => {
      delete process.env[AUTH_ENV_KEY];
      const { GET } = await import("../../src/app/api/characters/[characterId]/physics/route");
      const characterId = uniqueCharacterId("auth-open-get");

      const response = await GET(
        new Request(`http://localhost/api/characters/${characterId}/physics`),
        { params: { characterId } }
      );
      expect(response.status).toBe(200);
    });
  });

  describe("when AUTH_ENV_KEY IS set", () => {
    const apiKey = "test-secret-key-123";

    beforeEach(() => {
      process.env[AUTH_ENV_KEY] = apiKey;
    });

    it("returns 401 for POST without x-api-key header", async () => {
      const { POST } = await import("../../src/app/api/characters/[characterId]/physics/route");
      const characterId = uniqueCharacterId("auth-block-post");

      const response = await POST(
        new Request("http://localhost/api/characters/test/physics", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ event: { id: "ev-1", description: "test", tags: [], category: "general" } })
        }),
        { params: { characterId } }
      );
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("returns 401 for POST with wrong x-api-key header", async () => {
      const { POST } = await import("../../src/app/api/characters/[characterId]/physics/route");
      const characterId = uniqueCharacterId("auth-wrong-post");

      const response = await POST(
        new Request("http://localhost/api/characters/test/physics", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            [AUTH_HEADER]: "wrong-key"
          },
          body: JSON.stringify({ event: { id: "ev-1", description: "test", tags: [], category: "general" } })
        }),
        { params: { characterId } }
      );
      expect(response.status).toBe(401);
    });

    it("allows POST with correct x-api-key header", async () => {
      const { POST } = await import("../../src/app/api/characters/[characterId]/physics/route");
      const characterId = uniqueCharacterId("auth-ok-post");

      const response = await POST(
        new Request("http://localhost/api/characters/test/physics", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            [AUTH_HEADER]: apiKey
          },
          body: JSON.stringify({ event: { id: "ev-1", description: "test", tags: [], category: "general" } })
        }),
        { params: { characterId } }
      );
      expect(response.status).not.toBe(401);
    });

    it("returns 401 for DELETE without x-api-key header", async () => {
      const { DELETE } = await import("../../src/app/api/characters/[characterId]/physics/route");
      const characterId = uniqueCharacterId("auth-block-delete");

      const response = await DELETE(
        new Request(`http://localhost/api/characters/${characterId}/physics`, { method: "DELETE" }),
        { params: { characterId } }
      );
      expect(response.status).toBe(401);
    });

    it("allows DELETE with correct x-api-key header", async () => {
      const { DELETE } = await import("../../src/app/api/characters/[characterId]/physics/route");
      const characterId = uniqueCharacterId("auth-ok-delete");

      const response = await DELETE(
        new Request(`http://localhost/api/characters/${characterId}/physics`, {
          method: "DELETE",
          headers: { [AUTH_HEADER]: apiKey }
        }),
        { params: { characterId } }
      );
      expect(response.status).not.toBe(401);
    });

    it("GET routes remain open even with AUTH_ENV_KEY set", async () => {
      const { GET } = await import("../../src/app/api/characters/[characterId]/physics/route");
      const characterId = uniqueCharacterId("auth-open-get");

      const response = await GET(
        new Request(`http://localhost/api/characters/${characterId}/physics`),
        { params: { characterId } }
      );
      expect(response.status).toBe(200);
    });

    it("returns 401 for import apply POST without auth", async () => {
      const { POST } = await import("../../src/app/api/characters/[characterId]/import/apply/route");
      const characterId = uniqueCharacterId("auth-import");

      const response = await POST(
        new Request("http://localhost/api/characters/test/import/apply", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({})
        }),
        { params: { characterId } }
      );
      expect(response.status).toBe(401);
    });

    it("returns 401 for tick POST without auth", async () => {
      const { POST } = await import("../../src/app/api/characters/[characterId]/physics/tick/route");
      const characterId = uniqueCharacterId("auth-tick");

      const response = await POST(
        new Request("http://localhost/api/characters/test/physics/tick", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({})
        }),
        { params: { characterId } }
      );
      expect(response.status).toBe(401);
    });

    it("returns 401 for adjustment apply POST without auth", async () => {
      const { POST } = await import("../../src/app/api/characters/[characterId]/physics/adjustment/apply/route");
      const characterId = uniqueCharacterId("auth-adj");

      const response = await POST(
        new Request("http://localhost/api/characters/test/physics/adjustment/apply", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({})
        }),
        { params: { characterId } }
      );
      expect(response.status).toBe(401);
    });

    it("returns 401 for adjustment rollback POST without auth", async () => {
      const { POST } = await import("../../src/app/api/characters/[characterId]/physics/adjustment/rollback/route");
      const characterId = uniqueCharacterId("auth-rollback");

      const response = await POST(
        new Request("http://localhost/api/characters/test/physics/adjustment/rollback", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({})
        }),
        { params: { characterId } }
      );
      expect(response.status).toBe(401);
    });

    it("returns 401 for simulate POST without auth", async () => {
      const { POST } = await import("../../src/app/api/characters/[characterId]/physics/simulate/route");
      const characterId = uniqueCharacterId("auth-sim");

      const response = await POST(
        new Request("http://localhost/api/characters/test/physics/simulate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ events: [] })
        }),
        { params: { characterId } }
      );
      expect(response.status).toBe(401);
    });

    it("returns 401 for import validate POST without auth", async () => {
      const { POST } = await import("../../src/app/api/characters/[characterId]/import/validate/route");
      const characterId = uniqueCharacterId("auth-validate");

      const response = await POST(
        new Request("http://localhost/api/characters/test/import/validate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({})
        }),
        { params: { characterId } }
      );
      expect(response.status).toBe(401);
    });

    it("returns 401 for parse POST without auth", async () => {
      const { POST } = await import("../../src/app/api/characters/[characterId]/physics/parse/route");
      const response = await POST(
        new Request("http://localhost/api/characters/test/physics/parse", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ description: "test" })
        })
      );
      expect(response.status).toBe(401);
    });
  });
});
