import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { writeComponentFiles, formatWriteResult } from "./writer";

const testDir = path.resolve(process.cwd(), "fixtures", "__writer_test__");

describe("writeComponentFiles", () => {
  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("creates new files", async () => {
    const result = await writeComponentFiles({
      projectRoot: testDir,
      files: [
        { filePath: "src/Button.tsx", content: "export const Button = () => <button>Click</button>;" },
        { filePath: "src/Card.tsx", content: "export const Card = ({ children }) => <div>{children}</div>;" },
      ],
    });

    expect(result.written).toHaveLength(2);
    expect(result.written[0].action).toBe("created");
    expect(result.skipped).toHaveLength(0);
    expect(result.errors).toHaveLength(0);

    expect(fs.readFileSync(path.join(testDir, "src/Button.tsx"), "utf-8")).toContain("Button");
    expect(fs.readFileSync(path.join(testDir, "src/Card.tsx"), "utf-8")).toContain("Card");
  });

  it("skips existing files when overwrite=false", async () => {
    fs.writeFileSync(path.join(testDir, "existing.tsx"), "original content");

    const result = await writeComponentFiles({
      projectRoot: testDir,
      files: [
        { filePath: "existing.tsx", content: "new content" },
      ],
    });

    expect(result.written).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toContain("already exists");
    expect(fs.readFileSync(path.join(testDir, "existing.tsx"), "utf-8")).toBe("original content");
  });

  it("overwrites existing files when overwrite=true", async () => {
    fs.writeFileSync(path.join(testDir, "existing.tsx"), "original content");

    const result = await writeComponentFiles({
      projectRoot: testDir,
      files: [
        { filePath: "existing.tsx", content: "new content", overwrite: true },
      ],
    });

    expect(result.written).toHaveLength(1);
    expect(result.written[0].action).toBe("overwritten");
    expect(fs.readFileSync(path.join(testDir, "existing.tsx"), "utf-8")).toBe("new content");
  });

  it("respects dry-run mode", async () => {
    const result = await writeComponentFiles({
      projectRoot: testDir,
      files: [
        { filePath: "src/Button.tsx", content: "export const Button = () => {};" },
      ],
      dryRun: true,
    });

    expect(result.written).toHaveLength(0);
    expect(result.dryRun).toHaveLength(1);
    expect(result.dryRun[0].action).toBe("create");
    expect(fs.existsSync(path.join(testDir, "src/Button.tsx"))).toBe(false);
  });

  it("blocks paths outside project root", async () => {
    const result = await writeComponentFiles({
      projectRoot: testDir,
      files: [
        { filePath: "../../../etc/passwd", content: "malicious" },
      ],
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain("outside project root");
  });

  it("blocks sensitive files", async () => {
    const result = await writeComponentFiles({
      projectRoot: testDir,
      files: [
        { filePath: ".env", content: "SECRET=123" },
        { filePath: ".env.local", content: "LOCAL_SECRET=456" },
      ],
    });

    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].error).toContain("sensitive");
  });

  it("creates nested directories", async () => {
    const result = await writeComponentFiles({
      projectRoot: testDir,
      files: [
        { filePath: "src/components/ui/forms/Input.tsx", content: "export const Input = () => {};" },
      ],
    });

    expect(result.written).toHaveLength(1);
    expect(fs.existsSync(path.join(testDir, "src/components/ui/forms/Input.tsx"))).toBe(true);
  });

  it("formatWriteResult produces readable output", () => {
    const output = formatWriteResult({
      written: [{ filePath: "src/Button.tsx", action: "created" }],
      skipped: [{ filePath: "src/existing.tsx", reason: "File already exists" }],
      dryRun: [],
      errors: [{ filePath: ".env", error: "Refusing to write to sensitive file" }],
    });

    expect(output).toContain("Written (1)");
    expect(output).toContain("+ src/Button.tsx");
    expect(output).toContain("Skipped (1)");
    expect(output).toContain("Errors (1)");
  });
});