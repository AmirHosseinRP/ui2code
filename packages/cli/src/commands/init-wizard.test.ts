import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { initCommand } from "./init";
import type { Prompter, SelectOption, SpinnerHandle } from "../prompter";

const KEY_ENV_VARS = [
  "UI2CODE_API_KEY",
  "UI2CODE_MODEL",
  "UI2CODE_VISION_MODEL",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "DEEPSEEK_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "OPENROUTER_API_KEY",
  "OPENCODE_API_KEY",
];

/**
 * Scripted prompter that walks the interactive wizard deterministically
 * and records every prompt for assertions.
 */
function scriptedPrompter(answers: {
  confirm?: boolean[];
  select?: string[];
  text?: string[];
  password?: string[];
}): { prompter: Prompter; asked: string[] } {
  const asked: string[] = [];
  const confirmQueue = [...(answers.confirm ?? [])];
  const selectQueue = [...(answers.select ?? [])];
  const textQueue = [...(answers.text ?? [])];
  const passwordQueue = [...(answers.password ?? [])];

  const prompter: Prompter = {
    intro: () => {},
    note: () => {},
    warn: () => {},
    outro: () => {},
    confirm: async (message) => {
      asked.push(`confirm: ${message}`);
      return confirmQueue.shift() ?? true;
    },
    select: async <T extends string>(
      message: string,
      options: SelectOption<T>[]
    ): Promise<T> => {
      asked.push(`select: ${message}`);
      const next = selectQueue.shift();
      const match = options.find((o) => o.value === next);
      return (match?.value ?? options[0].value) as T;
    },
    text: async (message) => {
      asked.push(`text: ${message}`);
      return textQueue.shift() ?? "";
    },
    password: async (message) => {
      asked.push(`password: ${message}`);
      return passwordQueue.shift() ?? "";
    },
    spinner: (): SpinnerHandle => ({
      start: () => {},
      message: () => {},
      stop: () => {},
    }),
  };
  return { prompter, asked };
}

describe("initCommand interactive wizard", () => {
  const dirs: string[] = [];
  const originalEnv = { ...process.env };

  beforeEach(() => {
    for (const name of KEY_ENV_VARS) delete process.env[name];
  });

  const makeProject = (): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ui2code-wizard-"));
    dirs.push(dir);
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "test-app", dependencies: { react: "*" } })
    );
    return dir;
  };

  afterEach(() => {
    process.env = { ...originalEnv };
    for (const dir of dirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("walks the full interactive flow and stores the API key in .env.local", async () => {
    const dir = makeProject();
    const { prompter } = scriptedPrompter({
      confirm: [true], // project detection looks right
      select: [
        "openai", // provider
        "openai/gpt-4o", // agent model
        "openai/gpt-4o", // vision model (same)
        "paste", // API key: paste it
        ".env.local", // where to store
      ],
      password: ["sk-test-123"],
    });

    await initCommand({ dir, prompter, runDoctor: false });

    // Config written with chosen models
    const config = JSON.parse(fs.readFileSync(path.join(dir, "opencode.json"), "utf-8"));
    expect(config.model).toBe("openai/gpt-4o");
    expect(config.ui2code.model).toBe("openai/gpt-4o");
    expect(config.ui2code.visionModel).toBe("openai/gpt-4o");

    // API key stored in .env.local and gitignored
    const envLocal = fs.readFileSync(path.join(dir, ".env.local"), "utf-8");
    expect(envLocal).toContain("OPENAI_API_KEY=sk-test-123");
    const gitignore = fs.readFileSync(path.join(dir, ".gitignore"), "utf-8");
    expect(gitignore).toContain(".env.local");

    // Files in place
    expect(fs.existsSync(path.join(dir, ".opencode", "plugins", "ui2code.js"))).toBe(true);
    expect(fs.existsSync(path.join(dir, ".opencode", "agents", "ui-builder.md"))).toBe(true);
    expect(fs.existsSync(path.join(dir, ".opencode", "commands", "ui2code.md"))).toBe(true);
  });

  it("applies project overrides when the user corrects detection", async () => {
    const dir = makeProject();
    const { prompter } = scriptedPrompter({
      confirm: [false], // detection is wrong
      select: [
        "pnpm", // package manager override
        "nextjs", // framework override
        "tailwind", // styling override
        "typescript", // language override
        "openai", // provider
        "openai/gpt-4o", // agent model
        "openai/gpt-4o", // vision model
        "skip", // API key: skip
      ],
    });

    await initCommand({ dir, prompter, runDoctor: false });

    const config = JSON.parse(fs.readFileSync(path.join(dir, "opencode.json"), "utf-8"));
    expect(config.ui2code.project).toEqual({
      packageManager: "pnpm",
      framework: "nextjs",
      styling: "tailwind",
      language: "typescript",
    });
  });

  it("is safe to re-run (idempotent)", async () => {
    const dir = makeProject();
    const answers = {
      confirm: [true],
      select: ["openai", "openai/gpt-4o", "openai/gpt-4o", "skip"],
    };
    await initCommand({ dir, ...scriptedPrompter(answers), runDoctor: false });
    const configPath = path.join(dir, "opencode.json");
    const firstRun = fs.readFileSync(configPath, "utf-8");

    await initCommand({ dir, ...scriptedPrompter(answers), runDoctor: false });
    const secondRun = fs.readFileSync(configPath, "utf-8");
    expect(secondRun).toBe(firstRun);
    // No backup of an unchanged config
    expect(fs.existsSync(configPath + ".bak")).toBe(false);
  });
});
