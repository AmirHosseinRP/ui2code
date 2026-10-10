import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

export const SUPPORTED_IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp"];

/** Warn above this size — vision APIs choke on very large images. */
export const IMAGE_SIZE_WARN_BYTES = 15 * 1024 * 1024;

export interface ResolvedImage {
  /** Absolute path to a local image file */
  path: string;
  source: "file" | "url" | "clipboard";
  /** Non-fatal warning (e.g. very large file) */
  warning?: string;
}

export interface ImageValidation {
  ok: boolean;
  /** What went wrong */
  error?: string;
  /** How to fix it */
  fix?: string;
  warning?: string;
}

/** True for http(s) URLs. */
export function isUrl(input: string): boolean {
  return /^https?:\/\//i.test(input.trim());
}

/** Validate a local image path: existence, format, and size. */
export function validateImagePath(imagePath: string): ImageValidation {
  if (!fs.existsSync(imagePath)) {
    return {
      ok: false,
      error: `Image not found: ${imagePath}`,
      fix: "Check the path. Tip: quote paths that contain spaces.",
    };
  }
  const stat = fs.statSync(imagePath);
  if (!stat.isFile()) {
    return {
      ok: false,
      error: `Not a file: ${imagePath}`,
      fix: "Pass a PNG, JPG, or WebP image file.",
    };
  }
  const ext = path.extname(imagePath).toLowerCase();
  if (!SUPPORTED_IMAGE_EXTS.includes(ext)) {
    return {
      ok: false,
      error: `Unsupported image format "${ext || "(none)"}"`,
      fix: `Convert the screenshot to one of: ${SUPPORTED_IMAGE_EXTS.join(", ")}`,
    };
  }
  const warning =
    stat.size > IMAGE_SIZE_WARN_BYTES
      ? `Image is ${(stat.size / 1024 / 1024).toFixed(1)} MB — analysis may be slow or fail. Consider cropping or resizing it.`
      : undefined;
  return { ok: true, warning };
}

/**
 * Resolve the image input for `ui2code run`:
 * a local file path, an http(s) URL, or the clipboard (--clipboard).
 */
export async function resolveImageInput(opts: {
  image?: string;
  clipboard?: boolean;
}): Promise<ResolvedImage> {
  if (opts.clipboard) {
    return captureClipboardImage();
  }
  if (!opts.image) {
    throw new Error(
      "No image given. Pass a file path or URL: ui2code run ./screenshot.png — or paste one with: ui2code run --clipboard"
    );
  }
  if (isUrl(opts.image)) {
    return downloadImage(opts.image.trim());
  }
  const abs = path.resolve(opts.image);
  const validation = validateImagePath(abs);
  if (!validation.ok) {
    throw new Error(`${validation.error}. ${validation.fix ?? ""}`.trim());
  }
  return { path: abs, source: "file", warning: validation.warning };
}

async function downloadImage(url: string): Promise<ResolvedImage> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(
      `Could not download the image from ${url}: ${(err as Error).message}. ` +
        `Check the URL and your connection, or download it manually and pass the file path instead.`,
      { cause: err }
    );
  }
  if (!response.ok) {
    throw new Error(
      `Could not download the image from ${url} (HTTP ${response.status}). ` +
        `Check the URL, or download it manually and pass the file path instead.`
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim();
  const ext =
    extFromContentType(contentType) ?? extFromUrlPath(url) ?? "";
  if (!SUPPORTED_IMAGE_EXTS.includes(ext)) {
    throw new Error(
      `URL does not point to a supported image (got "${contentType || "unknown type"}"). ` +
        `Supported formats: ${SUPPORTED_IMAGE_EXTS.join(", ")}.`
    );
  }

  const outPath = path.join(os.tmpdir(), `ui2code-download-${Date.now()}${ext}`);
  fs.writeFileSync(outPath, buffer);
  const warning =
    buffer.length > IMAGE_SIZE_WARN_BYTES
      ? `Downloaded image is ${(buffer.length / 1024 / 1024).toFixed(1)} MB — analysis may be slow or fail.`
      : undefined;
  return { path: outPath, source: "url", warning };
}

/**
 * Capture the image currently in the clipboard (best effort, per platform).
 * Writes a temp PNG and returns its path.
 */
export async function captureClipboardImage(): Promise<ResolvedImage> {
  const outPath = path.join(os.tmpdir(), `ui2code-clipboard-${Date.now()}.png`);
  const platform = process.platform;

  if (platform === "win32") {
    const script = [
      "Add-Type -AssemblyName System.Windows.Forms",
      "Add-Type -AssemblyName System.Drawing",
      "$img = [System.Windows.Forms.Clipboard]::GetImage()",
      "if ($null -eq $img) { exit 1 }",
      `$img.Save('${outPath.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png)`,
    ].join("; ");
    const result = spawnSync("powershell", ["-NoProfile", "-STA", "-Command", script], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (result.status !== 0 || !fs.existsSync(outPath)) {
      throw clipboardError(
        "No image found in the clipboard (or clipboard access was denied).",
        "Copy a screenshot first (e.g. PrtScn or Win+Shift+S), then run: ui2code run --clipboard"
      );
    }
  } else if (platform === "darwin") {
    const result = spawnSync("pngpaste", [outPath], { stdio: ["ignore", "pipe", "pipe"] });
    if (result.error || result.status !== 0 || !fs.existsSync(outPath)) {
      throw clipboardError(
        "No image found in the clipboard (or pngpaste is not installed).",
        "Install pngpaste (brew install pngpaste), copy a screenshot, then run: ui2code run --clipboard"
      );
    }
  } else {
    // Linux: Wayland first, then X11
    const wl = spawnSync("wl-paste", ["--type", "image/png"], {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "buffer",
    });
    if (!wl.error && wl.status === 0 && wl.stdout && wl.stdout.length > 0) {
      fs.writeFileSync(outPath, wl.stdout);
    } else {
      const xclip = spawnSync("xclip", ["-selection", "clipboard", "-t", "image/png", "-o"], {
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "buffer",
      });
      if (xclip.error || xclip.status !== 0 || !xclip.stdout || xclip.stdout.length === 0) {
        throw clipboardError(
          "No image found in the clipboard (or wl-paste/xclip is not installed).",
          "Install xclip (or wl-paste on Wayland), copy a screenshot, then run: ui2code run --clipboard"
        );
      }
      fs.writeFileSync(outPath, xclip.stdout);
    }
  }

  return { path: outPath, source: "clipboard" };
}

function clipboardError(reason: string, fix: string): Error {
  return new Error(`${reason} ${fix}`);
}

function extFromContentType(contentType: string): string | undefined {
  const map: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
  };
  return map[contentType.toLowerCase()];
}

function extFromUrlPath(url: string): string | undefined {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).toLowerCase();
    return SUPPORTED_IMAGE_EXTS.includes(ext) ? ext : undefined;
  } catch {
    return undefined;
  }
}
