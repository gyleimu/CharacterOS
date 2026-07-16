import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");

describe("Repository release consistency", () => {
  it("declares every MindSpace runtime dependency", () => {
    const pkg = JSON.parse(read("package.json")) as {
      dependencies?: Record<string, string>;
    };

    for (const dependency of ["three", "@react-three/fiber", "@react-three/drei"]) {
      expect(pkg.dependencies?.[dependency], `${dependency} must be a declared dependency`).toBeTruthy();
    }
  });

  it("keeps the core headless", () => {
    const forbiddenImports: string[] = [];
    for (const file of sourceFiles(resolve(ROOT, "src/core"))) {
      const source = readFileSync(file, "utf8");
      if (/from\s+["'](?:react|next(?:\/[^"']*)?|three|@react-three\/[^"']+)["']/.test(source)) {
        forbiddenImports.push(file.replace(`${ROOT}\\`, ""));
      }
    }
    expect(forbiddenImports).toEqual([]);
  });

  it("ships the root and dedicated MindSpace routes", () => {
    expect(exists("src/app/page.tsx")).toBe(true);
    expect(exists("src/app/mindspace/page.tsx")).toBe(true);
    expect(read("src/app/page.tsx")).toContain('from "./mindspace/page"');
  });

  it("does not reintroduce retired API-only and no-3D claims", () => {
    const docs = `${read("README.md")}\n${read("docs/latest_development_flow.md")}`;
    expect(docs).not.toContain("API-only              — 无用户可见网页");
    expect(docs).not.toContain("no frontend           — Dashboard 和可视化已移除");
    expect(docs).not.toContain("no 3D                 — 不做 3D 星云");
    expect(docs).not.toContain("不恢复用户可见前端");
  });

  it("contains the V13 foundation and offline execution boundary", () => {
    const required = [
      "src/core/llmBoundary/llmBoundaryTypes.ts",
      "src/core/llmBoundary/llmBoundaryBuilders.ts",
      "src/core/llmBoundary/llmPromptBuilder.ts",
      "src/core/audit/determinismBoundaryAudit.ts",
      "src/core/audit/determinismAstScanner.ts",
      "src/core/deterministicHelpers.ts",
      "src/core/llmBoundary/mockLlmProvider.ts",
      "src/core/llmBoundary/llmOutputValidator.ts",
      "src/core/llmBoundary/llmGroundingChecker.ts",
      "src/core/llmBoundary/llmFallbackReplyGenerator.ts",
      "src/core/llmBoundary/llmBoundaryService.ts",
      "src/core/audit/llmBoundaryQualityGate.ts",
      "scripts/run-llm-boundary-quality-gate.ts",
      "outputs/llm-boundary-harness/index.html",
      "outputs/llm-boundary-harness/manifest.json",
      "outputs/llm-boundary-quality-gate.json",
      "outputs/llm-boundary-quality-gate.md",
      "outputs/v13-llm-boundary-rc-manifest.json",
      "outputs/dependency-risk-register.json",
      "outputs/dependency-security-gate.json",
      "outputs/dependency-security-gate.md",
      "src/core/audit/dependencySecurityGate.ts",
      "scripts/run-dependency-security-gate.ts",
      "docs/core_calibration_durability_roadmap.md",
      "docs/dependency_security_policy.md",
      "docs/v13.9_llm_boundary_quality_gate_rc_report.md",
    ];
    expect(required.filter((file) => !exists(file))).toEqual([]);
  });

  it("runs the V13 LLM boundary quality gate in rc:verify and CI", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts?: Record<string, string> };
    const ci = read(".github/workflows/ci.yml");
    expect(pkg.scripts?.["test:llm-quality"]).toContain("run-llm-boundary-quality-gate");
    expect(pkg.scripts?.["test:security"]).toContain("run-dependency-security-gate");
    expect(pkg.scripts?.["rc:verify"]).toContain("run-llm-boundary-quality-gate");
    expect(ci).toContain("npm run test:llm-quality");
    expect(ci).toContain("npm run test:security");
  });

  it("tracks dependency risks without allowing forced framework downgrade", () => {
    const registry = JSON.parse(read("outputs/dependency-risk-register.json")) as {
      policy: Record<string, boolean>;
      summary: Record<string, number>;
    };
    const gate = JSON.parse(read("outputs/dependency-security-gate.json")) as {
      gateVerdict: { level: string; passed: boolean };
      registeredFindings: unknown[];
      unregisteredFindings: unknown[];
    };
    expect(registry.policy).toMatchObject({
      blockCritical: true,
      blockHigh: true,
      moderateRequiresRegistry: true,
      forceFixProhibited: true,
    });
    expect(registry.summary).toMatchObject({ critical: 0, high: 0, moderate: 2, low: 1 });
    expect(gate.gateVerdict).toEqual({ level: "PASS", passed: true });
    expect(gate.registeredFindings).toHaveLength(3);
    expect(gate.unregisteredFindings).toEqual([]);
  });

  it("contains no unresolved merge markers in release-owned sources", () => {
    const roots = ["src", "tests", "scripts", "docs"];
    const findings: string[] = [];
    for (const root of roots) {
      for (const file of sourceFiles(resolve(ROOT, root), true)) {
        const source = readFileSync(file, "utf8");
        if (/^(?:<<<<<<<|=======|>>>>>>>)/m.test(source)) {
          findings.push(file.replace(`${ROOT}\\`, ""));
        }
      }
    }
    expect(findings).toEqual([]);
  });
});

function read(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

function exists(relativePath: string): boolean {
  return existsSync(resolve(ROOT, relativePath));
}

function sourceFiles(directory: string, includeDocs = false): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...sourceFiles(path, includeDocs));
      continue;
    }
    const extension = extname(entry.name);
    if ([".ts", ".tsx", ".js", ".mjs", ".json", ...(includeDocs ? [".md"] : [])].includes(extension)) {
      files.push(path);
    }
  }
  return files;
}
