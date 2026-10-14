import { describe, expect, it } from "vitest";
import { colorDistance, contrastingColor, luminance, readableTextOn } from "./color";

describe("readableTextOn", () => {
  it("puts white text on dark and saturated option colors", () => {
    expect(readableTextOn("#1E7F3A")).toBe("#FFFFFF");
    expect(readableTextOn("#9E1B2F")).toBe("#FFFFFF");
    expect(readableTextOn("#2D3CFF")).toBe("#FFFFFF");
  });

  it("puts dark text on light option colors someone might pick", () => {
    expect(readableTextOn("#FFE14D")).toBe("#0F1222");
    expect(readableTextOn("#A8F0D4")).toBe("#0F1222");
    expect(readableTextOn("#FFFFFF")).toBe("#0F1222");
  });

  it("treats a malformed color as dark instead of crashing", () => {
    expect(luminance("not a color")).toBe(0);
    expect(readableTextOn("oops")).toBe("#FFFFFF");
  });
});

describe("contrastingColor", () => {
  it("keeps two colors that are already easy to tell apart", () => {
    expect(contrastingColor("#0FA958", "#E5173F")).toBe("#E5173F");
  });

  it("swaps in a clearly different color when two greens would be confused", () => {
    const stand = contrastingColor("#0FA958", "#12B886");
    expect(stand).not.toBe("#12B886");
    expect(colorDistance("#0FA958", stand)).toBeGreaterThan(colorDistance("#0FA958", "#12B886") * 2);
  });
});
