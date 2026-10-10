import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { initCommand } from "./init";

const testDir = path.resolve(process.cwd(), "fixtures", "__cli_test__");

describe("initCommand", () => {
  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("creates opencode.json with agent and command config", async () => {
    await initCommand({ dir: testDir, yes: true });

    const configPath = path.join(testDir, "opencode.json");
    expect(fs.existsSync(configPath)).toBe(true);

    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    expect(config["$schema"]).toBe("https://opencode.ai/config.json");
    expect(config.agent["ui-builder"]).toBeDefined();
    expect(config.agent["ui-builder"].mode).toBe("primary");
    expect(config.agent["ui-analyzer"]).toBeDefined();
    expect(config.agent["ui-analyzer"].hidden).toBe(true);
    expect(config.command.ui2code).toBeDefined();
    expect(config.command.ui2code.agent).toBe("ui-builder");
    // The plugin is installed as an auto-loaded file in .opencode/plugins/,
    // not as an npm plugin entry (which would require a package install).
    expect(fs.existsSync(path.join(testDir, ".opencode", "plugins", "ui2code.js"))).toBe(true);
    expect(config.plugin ?? []).not.toContain("@ui2code/opencode-plugin");
  });

  it("creates .opencode/agents/ files", async () => {
    await initCommand({ dir: testDir, yes: true });

    const agentPath = path.join(testDir, ".opencode", "agents", "ui-builder.md");
    expect(fs.existsSync(agentPath)).toBe(true);

    const content = fs.readFileSync(agentPath, "utf-8");
    expect(content).toContain("ui-builder");
    expect(content).toContain("analyze_screenshot");

    const analyzerPath = path.join(testDir, ".opencode", "agents", "ui-analyzer.md");
    expect(fs.existsSync(analyzerPath)).toBe(true);
  });

  it("creates .opencode/commands/ files", async () => {
    await initCommand({ dir: testDir, yes: true });

    const cmdPath = path.join(testDir, ".opencode", "commands", "ui2code.md");
    expect(fs.existsSync(cmdPath)).toBe(true);

    const content = fs.readFileSync(cmdPath, "utf-8");
    expect(content).toContain("$ARGUMENTS");
    expect(content).toContain("ui-builder");
  });

  it("merges with existing opencode.json", async () => {
    // Write existing config
    const existing = {
      model: "anthropic/claude-sonnet-4-20250514",
      autoupdate: true,
      agent: {
        "custom-agent": { description: "My custom agent" },
      },
    };
    fs.writeFileSync(path.join(testDir, "opencode.json"), JSON.stringify(existing, null, 2));

    await initCommand({ dir: testDir, yes: true });

    const config = JSON.parse(fs.readFileSync(path.join(testDir, "opencode.json"), "utf-8"));

    // Preserves existing
    expect(config.model).toBe("anthropic/claude-sonnet-4-20250514");
    expect(config.autoupdate).toBe(true);
    expect(config.agent["custom-agent"]).toBeDefined();

    // Adds new
    expect(config.agent["ui-builder"]).toBeDefined();
    expect(config.command.ui2code).toBeDefined();
    // The plugin is installed as an auto-loaded file in .opencode/plugins/,
    // not as an npm plugin entry (which would require a package install).
    expect(fs.existsSync(path.join(testDir, ".opencode", "plugins", "ui2code.js"))).toBe(true);
    expect(config.plugin ?? []).not.toContain("@ui2code/opencode-plugin");
  });

  it("does not overwrite existing agent files", async () => {
    // Create agent dir with existing file
    const agentsDir = path.join(testDir, ".opencode", "agents");
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(path.join(agentsDir, "ui-builder.md"), "custom content");

    await initCommand({ dir: testDir, yes: true });

    // Should not overwrite
    const content = fs.readFileSync(path.join(agentsDir, "ui-builder.md"), "utf-8");
    expect(content).toBe("custom content");
  });
});