import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { verifyProject, formatVerifyResult } from "./verify";

const testDir = path.resolve(process.cwd(), "fixtures", "__verify_test__");

describe("verifyProject", () => {
  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Windows may lock dirs after child processes exit; ignore
    }
  });

  it("returns empty result when no package.json exists", async () => {
    const result = await verifyProject({ projectRoot: testDir });
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(0);
    expect(result.summary).toContain("No verification scripts found");
  });

  it("returns empty result when no matching scripts", async () => {
    fs.writeFileSync(path.join(testDir, "package.json"), JSON.stringify({
      scripts: { dev: "vite", start: "node server.js" },
    }));

    const result = await verifyProject({ projectRoot: testDir });
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(0);
  });

  it("runs a passing script", async () => {
    fs.writeFileSync(path.join(testDir, "package.json"), JSON.stringify({
      scripts: { hello: "node -e \"console.log('hello')\"" },
    }));

    const result = await verifyProject({
      projectRoot: testDir,
      scripts: ["hello"],
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0].passed).toBe(true);
    expect(result.results[0].stdout).toContain("hello");
  });

  it("detects a failing script", async () => {
    fs.writeFileSync(path.join(testDir, "package.json"), JSON.stringify({
      scripts: { fail: "node -e \"process.exit(1)\"" },
    }));

    const result = await verifyProject({
      projectRoot: testDir,
      scripts: ["fail"],
      timeout: 10000,
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0].passed).toBe(false);
    expect(result.results[0].exitCode).toBe(1);
    expect(result.success).toBe(false);
  });

  it("auto-detects typecheck, lint, build scripts", async () => {
    fs.writeFileSync(path.join(testDir, "package.json"), JSON.stringify({
      scripts: {
        typecheck: "node -e \"console.log('typecheck-ok')\"",
        lint: "node -e \"console.log('lint-ok')\"",
        build: "node -e \"console.log('build-ok')\"",
        dev: "vite",
      },
    }));

    const result = await verifyProject({ projectRoot: testDir });

    expect(result.results).toHaveLength(3);
    expect(result.results.map((r) => r.name)).toEqual(["typecheck", "lint", "build"]);
    expect(result.success).toBe(true);
  });

  it("respects timeout", async () => {
    fs.writeFileSync(path.join(testDir, "package.json"), JSON.stringify({
      scripts: { slow: "node -e \"setTimeout(() => {}, 30000)\"" },
    }));

    const result = await verifyProject({
      projectRoot: testDir,
      scripts: ["slow"],
      timeout: 1000,
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0].passed).toBe(false);
  });

  it("formatVerifyResult produces readable output", () => {
    const output = formatVerifyResult({
      success: false,
      results: [
        {
          name: "typecheck",
          command: "tsc --noEmit",
          exitCode: 1,
          stdout: "",
          stderr: "error TS2322",
          passed: false,
          errors: [
            { file: "src/Button.tsx", line: 10, column: 5, message: "Type 'string' is not assignable to type 'number'.", severity: "error", source: "typescript" },
          ],
        },
      ],
      summary: "0/1 checks passed. Failed: typecheck.",
    });

    expect(output).toContain("0/1 checks passed");
    expect(output).toContain("✗ typecheck");
    expect(output).toContain("src/Button.tsx:10:5");
  });
});