import * as fs from "node:fs";
import * as path from "node:path";

export interface ImageInfo {
  /** Absolute path to the image file */
  filePath: string;
  /** File extension (png, jpg, webp) */
  extension: string;
  /** File size in bytes */
  sizeBytes: number;
  /** Base64-encoded data */
  base64: string;
  /** MIME type */
  mimeType: string;
}

const MAX_DIMENSION = 2000;
const MAX_BASE64_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Read an image file and return its info.
 * If the image exceeds limits, it's flagged for resizing (actual resize requires sharp/jimp).
 */
export async function readImage(filePath: string, options?: {
  maxDimension?: number;
  maxBase64Bytes?: number;
}): Promise<ImageInfo> {
  const absPath = path.resolve(filePath);

  if (!fs.existsSync(absPath)) {
    throw new Error(`Image file not found: ${absPath}`);
  }

  const ext = path.extname(absPath).toLowerCase().replace(".", "");
  const validExts = ["png", "jpg", "jpeg", "webp", "gif"];
  if (!validExts.includes(ext)) {
    throw new Error(`Unsupported image format: .${ext}. Supported: ${validExts.join(", ")}`);
  }

  const buffer = fs.readFileSync(absPath);
  const base64 = buffer.toString("base64");
  const maxDim = options?.maxDimension ?? MAX_DIMENSION;
  const maxBytes = options?.maxBase64Bytes ?? MAX_BASE64_BYTES;

  let needsResize = false;
  if (base64.length > maxBytes) {
    needsResize = true;
  }

  const mimeType = ext === "jpg" ? "image/jpeg" : `image/${ext}`;

  return {
    filePath: absPath,
    extension: ext,
    sizeBytes: buffer.length,
    base64: needsResize ? base64 : base64, // In real impl, would resize here
    mimeType,
  };
}

/**
 * Read multiple image files.
 */
export async function readImages(filePaths: string[], options?: {
  maxDimension?: number;
  maxBase64Bytes?: number;
}): Promise<ImageInfo[]> {
  const images: ImageInfo[] = [];
  for (const fp of filePaths) {
    images.push(await readImage(fp, options));
  }
  return images;
}

/**
 * Check if an image file is a valid image format.
 */
export function isValidImageFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase().replace(".", "");
  return ["png", "jpg", "jpeg", "webp", "gif"].includes(ext);
}

/**
 * Get a data URL for an image (for embedding in prompts).
 */
export function toDataUrl(image: ImageInfo): string {
  return `data:${image.mimeType};base64,${image.base64}`;
}