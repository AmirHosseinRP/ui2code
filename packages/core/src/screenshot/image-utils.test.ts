import { describe, it, expect, vi, beforeEach } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";
import { readImage, readImages, isValidImageFile, toDataUrl } from "./image-utils";

const fixturesDir = path.resolve(process.cwd(), "fixtures");

describe("image-utils", () => {
  it("isValidImageFile detects valid formats", () => {
    expect(isValidImageFile("screenshot.png")).toBe(true);
    expect(isValidImageFile("photo.jpg")).toBe(true);
    expect(isValidImageFile("photo.jpeg")).toBe(true);
    expect(isValidImageFile("image.webp")).toBe(true);
    expect(isValidImageFile("anim.gif")).toBe(true);
    expect(isValidImageFile("doc.pdf")).toBe(false);
    expect(isValidImageFile("file.txt")).toBe(false);
  });

  it("reads a real image file", async () => {
    // Create a tiny test PNG (1x1 pixel)
    const testDir = path.join(fixturesDir, "__test_images__");
    fs.mkdirSync(testDir, { recursive: true });
    const testPng = path.join(testDir, "test.png");

    // Minimal valid PNG (1x1 red pixel)
    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
      "base64"
    );
    fs.writeFileSync(testPng, pngBuffer);

    try {
      const image = await readImage(testPng);
      expect(image.filePath).toBe(testPng);
      expect(image.extension).toBe("png");
      expect(image.mimeType).toBe("image/png");
      expect(image.sizeBytes).toBeGreaterThan(0);
      expect(image.base64).toBeTruthy();
    } finally {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  it("throws for nonexistent file", async () => {
    await expect(readImage("/nonexistent/file.png")).rejects.toThrow("Image file not found");
  });

  it("throws for unsupported format", async () => {
    const testDir = path.join(fixturesDir, "__test_images__");
    fs.mkdirSync(testDir, { recursive: true });
    const testFile = path.join(testDir, "test.pdf");
    fs.writeFileSync(testFile, "not a real pdf");

    try {
      await expect(readImage(testFile)).rejects.toThrow("Unsupported image format");
    } finally {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  it("toDataUrl produces correct format", async () => {
    const testDir = path.join(fixturesDir, "__test_images__");
    fs.mkdirSync(testDir, { recursive: true });
    const testPng = path.join(testDir, "test.png");
    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
      "base64"
    );
    fs.writeFileSync(testPng, pngBuffer);

    try {
      const image = await readImage(testPng);
      const dataUrl = toDataUrl(image);
      expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    } finally {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  it("readImages reads multiple files", async () => {
    const testDir = path.join(fixturesDir, "__test_images__");
    fs.mkdirSync(testDir, { recursive: true });
    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
      "base64"
    );
    fs.writeFileSync(path.join(testDir, "a.png"), pngBuffer);
    fs.writeFileSync(path.join(testDir, "b.png"), pngBuffer);

    try {
      const images = await readImages([
        path.join(testDir, "a.png"),
        path.join(testDir, "b.png"),
      ]);
      expect(images).toHaveLength(2);
      expect(images[0].filePath).toContain("a.png");
      expect(images[1].filePath).toContain("b.png");
    } finally {
      fs.rmSync(testDir, { recursive: true });
    }
  });
});