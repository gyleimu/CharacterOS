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

  it("contains both V13 foundation lines", () => {
    const required = [
      "src/core/llmBoundary/llmBoundaryTypes.ts",
      "src/core/llmBoundary/llmBoundaryBuilders.ts",
      "src/core/llmBoundary/llmPromptBuilder.ts",
      "src/core/audit/determinismBoundaryAudit.ts",
      "src/core/audit/determinismAstScanner.ts",
      "src/core/deterministicHelpers.ts",
    ];
    expect(required.filter((file) => !exists(file))).toEqual([]);
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
