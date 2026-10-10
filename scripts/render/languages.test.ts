import { describe, expect, it } from "vitest";
import type { LanguageShare } from "../github.js";
import { PALETTES } from "../theme.js";
import { SAMPLE_LANGUAGES } from "./fixtures.js";
import { formatPercent, renderLanguages } from "./languages.js";

function manyLanguages(count: number): LanguageShare[] {
  return Array.from({ length: count }, (_, index) => ({
    name: `Lang${String(index)}`,
    color: "#336699",
    bytes: 100 - index,
    share: 1 / count,
  }));
}

describe("formatPercent", () => {
  it("rounds large shares and keeps one decimal for small ones", () => {
    expect(formatPercent(0.412)).toBe("41%");
    expect(formatPercent(0.034)).toBe("3.4%");
    expect(formatPercent(0.1)).toBe("10%");
  });
});

describe("renderLanguages", () => {
  const options = { palette: PALETTES.dark, languages: SAMPLE_LANGUAGES, repositoryCount: 52 };

  it("shows every language and its share", () => {
    const svg = renderLanguages(options);

    for (const language of SAMPLE_LANGUAGES) {
      expect(svg).toContain(`>${language.name}<`);
    }
    expect(svg).toContain(">50%<");
  });

  it("states the repository count without naming any repository", () => {
    expect(renderLanguages(options)).toContain("52 repositories, private ones included");
  });

  it("limits tiles to eight and folds the rest into an other segment", () => {
    const svg = renderLanguages({ ...options, languages: manyLanguages(12) });

    expect(svg).toContain(">Lang7<");
    expect(svg).not.toContain(">Lang8<");
    expect(svg).toContain("<title>other ");
  });

  it("keeps the caption below the last row of tiles", () => {
    const svg = renderLanguages({ ...options, languages: manyLanguages(8) });
    const tileBottoms = [...svg.matchAll(/<rect x="[\d.]+" y="([\d.]+)" width="[\d.]+" height="80" rx="8"/g)].map(
      (match) => Number(match[1]) + 80,
    );
    const captionY = Number(/<text class="mono" x="48" y="([\d.]+)" font-size="11" fill="#8a8780">\d+ repositories/.exec(svg)?.[1]);

    expect(tileBottoms).toHaveLength(8);
    expect(captionY).toBeGreaterThan(Math.max(...tileBottoms));
  });

  it("degrades gracefully with no data", () => {
    const svg = renderLanguages({ ...options, languages: [] });

    expect(svg).toContain("No language data yet.");
  });

  it("escapes hostile language names", () => {
    const svg = renderLanguages({
      ...options,
      languages: [{ name: "<script>x</script>", color: null, bytes: 1, share: 1 }],
    });

    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });

  it("disables animation under reduced motion and stays self-contained", () => {
    const svg = renderLanguages(options);

    expect(svg).toContain("prefers-reduced-motion:reduce){.seg{animation:none}");
    expect(svg).not.toMatch(/<script|href=|url\(http|@import/);
  });
});
