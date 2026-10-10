import { describe, it, expect } from "vitest";
import { detectStack } from "./index";

describe("core", () => {
  it("exports detectStack function", () => {
    expect(typeof detectStack).toBe("function");
  });
});