import * as fs from "node:fs";
import * as path from "node:path";

export interface FileToWrite {
  /** Relative path from project root */
  filePath: string;
  /** File content */
  content: string;
  /** Whether to overwrite if file exists (default: false) */
  overwrite?: boolean;
}

export interface WriteResult {
  /** Files that were written */
  written: Array<{ filePath: string; action: "created" | "overwritten" }>;
  /** Files that were skipped (already exist, overwrite=false) */
  skipped: Array<{ filePath: string; reason: string }>;
  /** Files in dry-run mode (would be written) */
  dryRun: Array<{ filePath: string; action: "create" | "overwrite" }>;
  /** Errors encountered */
  errors: Array<{ filePath: string; error: string }>;
}

export interface WriteComponentFilesOptions {
  /** Absolute path to the project root */
  projectRoot: string;
  /** Files to write */
  files: FileToWrite[];
  /** If true, don't actually write — just report what would happen */
  dryRun?: boolean;
}

/**
 * Write component files to the project.
 * Respects dry-run mode. Never overwrites existing files unless overwrite=true.
 * All paths are confined to the project root.
 */
export async function writeComponentFiles(options: WriteComponentFilesOptions): Promise<WriteResult> {
  const { projectRoot, files, dryRun = false } = options;

  const result: WriteResult = {
    written: [],
    skipped: [],
    dryRun: [],
    errors: [],
  };

  for (const file of files) {
    const absPath = path.resolve(projectRoot, file.filePath);

    // Security: ensure path is within project root
    if (!absPath.startsWith(path.resolve(projectRoot))) {
      result.errors.push({
        filePath: file.filePath,
        error: `Path is outside project root: ${file.filePath}`,
      });
      continue;
    }

    // Security: block writing to sensitive files
    const basename = path.basename(file.filePath);
    if (isSensitiveFile(basename)) {
      result.errors.push({
        filePath: file.filePath,
        error: `Refusing to write to sensitive file: ${basename}`,
      });
      continue;
    }

    const exists = fs.existsSync(absPath);

    if (dryRun) {
      result.dryRun.push({
        filePath: file.filePath,
        action: exists ? "overwrite" : "create",
      });
      continue;
    }

    if (exists && !file.overwrite) {
      result.skipped.push({
        filePath: file.filePath,
        reason: "File already exists and overwrite=false",
      });
      continue;
    }

    try {
      // Ensure parent directory exists
      const dir = path.dirname(absPath);
      fs.mkdirSync(dir, { recursive: true });

      fs.writeFileSync(absPath, file.content, "utf-8");
      result.written.push({
        filePath: file.filePath,
        action: exists ? "overwritten" : "created",
      });
    } catch (err) {
      result.errors.push({
        filePath: file.filePath,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

/** Check if a file is sensitive and should never be auto-written */
function isSensitiveFile(name: string): boolean {
  const sensitive = [
    ".env", ".env.local", ".env.production", ".env.development",
    "id_rsa", "id_ed25519", "id_dsa",
    ".npmrc", ".yarnrc",
    "credentials", "secrets",
  ];
  return sensitive.some((s) => name === s || name.startsWith(s + "."));
}

/**
 * Format a WriteResult as a human-readable summary.
 */
export function formatWriteResult(result: WriteResult): string {
  const lines: string[] = [];

  if (result.written.length > 0) {
    lines.push(`Written (${result.written.length}):`);
    for (const f of result.written) {
      lines.push(`  ${f.action === "overwritten" ? "~" : "+"} ${f.filePath}`);
    }
  }

  if (result.skipped.length > 0) {
    lines.push(`Skipped (${result.skipped.length}):`);
    for (const f of result.skipped) {
      lines.push(`  - ${f.filePath} (${f.reason})`);
    }
  }

  if (result.dryRun.length > 0) {
    lines.push(`Dry run — would write (${result.dryRun.length}):`);
    for (const f of result.dryRun) {
      lines.push(`  ${f.action === "overwrite" ? "~" : "+"} ${f.filePath}`);
    }
  }

  if (result.errors.length > 0) {
    lines.push(`Errors (${result.errors.length}):`);
    for (const f of result.errors) {
      lines.push(`  ! ${f.filePath}: ${f.error}`);
    }
  }

  return lines.join("\n");
}