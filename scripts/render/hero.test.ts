import { describe, expect, it } from "vitest";
import type { LanguageShare } from "../github.js";
import { PALETTES } from "../theme.js";
import { mix } from "./color.js";
import { renderHero } from "./hero.js";

const LANGUAGES: readonly LanguageShare[] = [
  { name: "C", color: "#555555", bytes: 600, share: 0.6 },
  { name: "Rust", color: "#dea584", bytes: 300, share: 0.3 },
  { name: "TypeScript", color: "#3178c6", bytes: 100, share: 0.1 },
];

const options = { languages: LANGUAGES, name: "Test <Name>", tagline: "Builds & breaks" };

describe("mix", () => {
  it("interpolates between two colours", () => {
    expect(mix("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mix("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  it("rejects anything that is not a six-digit hex colour", () => {
    expect(() => mix("red", "#ffffff", 0.5)).toThrow("#rrggbb");
  });
});

describe("renderHero", () => {
  it("escapes text so a hostile name cannot inject markup", () => {
    const svg = renderHero({ ...options, palette: PALETTES.dark });

    expect(svg).toContain("Test &lt;Name&gt;");
    expect(svg).toContain("Builds &amp; breaks");
    expect(svg).not.toContain("<Name>");
  });

  it("uses the language colours and names in the legend", () => {
    const svg = renderHero({ ...options, palette: PALETTES.dark });

    expect(svg).toContain(">Rust<");
    expect(svg).toContain('fill="#dea584"');
  });

  it("falls back to the signal colour when fewer than four languages exist", () => {
    const svg = renderHero({ ...options, palette: PALETTES.light });

    expect(svg).toContain(`fill="${PALETTES.light.signal}"`);
  });

  it("honours reduced motion by showing only the first frame", () => {
    const svg = renderHero({ ...options, palette: PALETTES.dark });

    expect(svg).toContain("prefers-reduced-motion:reduce");
    expect(svg).toContain(".f0{opacity:1}");
  });

  it("refuses a tagline too long for the text panel", () => {
    const tagline = "x".repeat(41);

    expect(() => renderHero({ ...options, tagline, palette: PALETTES.dark })).toThrow("fits 40");
  });

  it("contains no script, no external reference and stays light", () => {
    const svg = renderHero({ ...options, palette: PALETTES.dark });

    expect(svg).not.toMatch(/<script|href=|url\(http|@import/);
    expect(Buffer.byteLength(svg)).toBeLessThan(150_000);
  });
});
