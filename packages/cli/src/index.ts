import { Command } from "commander";
import { runCommand } from "./commands/run";
import { initCommand } from "./commands/init";
import { doctorCommand } from "./commands/doctor";
import { cliVersion } from "./assets";

const program = new Command();

program
  .name("ui2code")
  .description("Turn UI screenshots into frontend components using AI")
  .version(cliVersion())
  .option("--debug", "Show full stack traces on error");

program
  .command("run [image]")
  .description("Generate a component from a UI screenshot (file path, URL, or --clipboard)")
  .option("--clipboard", "Use the image currently in the system clipboard")
  .option("-b, --brief <text>", "Optional text brief describing the UI")
  .option("-o, --out <dir>", "Target directory for the generated component")
  .option("--framework <name>", "Override the detected framework (e.g. react, nextjs, vue)")
  .option("-d, --dir <path>", "Project directory (defaults to cwd)")
  .option("-m, --model <id>", "Model to use (provider/model format)")
  .option("-y, --yes", "Accept recommended defaults; never prompt for questions")
  .option("--verbose", "Show the raw agent output instead of the progress UI")
  .action(async (image: string | undefined, opts) => {
    await runCommand({
      image,
      clipboard: opts.clipboard,
      brief: opts.brief,
      out: opts.out,
      framework: opts.framework,
      dir: opts.dir,
      model: opts.model,
      yes: opts.yes,
      verbose: opts.verbose,
    });
  });

program
  .command("init")
  .description("Set up ui2code in the current project (guided wizard)")
  .option("-d, --dir <path>", "Project directory (defaults to cwd)")
  .option("-y, --yes", "Non-interactive: accept defaults and never prompt (for CI)")
  .option("-m, --model <id>", "Model for the agent (e.g. openai/gpt-4o)")
  .option("--vision-model <id>", "Vision-capable model for screenshot analysis")
  .option("--provider <id>", "Provider: openai, anthropic, deepseek, google, opencode, openrouter")
  .action(async (opts) => {
    await initCommand({
      dir: opts.dir,
      yes: opts.yes,
      model: opts.model,
      visionModel: opts.visionModel,
      provider: opts.provider,
    });
  });

program
  .command("doctor")
  .description("Check ui2code setup and configuration")
  .option("-d, --dir <path>", "Project directory (defaults to cwd)")
  .option("--fix", "Automatically repair safe issues (missing files, malformed config)")
  .option("--online", "Make a cheap test API call to verify the configured key works")
  .action(async (opts) => {
    await doctorCommand({
      dir: opts.dir,
      fix: opts.fix,
      online: opts.online,
    });
  });

program.parseAsync().catch((err: unknown) => {
  const debug = process.argv.includes("--debug");
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\nError: ${message}`);
  if (debug && err instanceof Error && err.stack) {
    console.error(err.stack);
  } else {
    console.error("(run with --debug for the full stack trace)");
  }
  process.exit(1);
});