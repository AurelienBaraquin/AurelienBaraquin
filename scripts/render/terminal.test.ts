import { describe, expect, it } from "vitest";
import { PALETTES } from "../theme.js";
import { makeRepository, SAMPLE_LANGUAGES } from "./fixtures.js";
import { buildTerminalLines, renderTerminal, type TerminalOptions } from "./terminal.js";

const options: TerminalOptions = {
  palette: PALETTES.dark,
  name: "Test <Name>",
  login: "tester",
  repositories: [
    makeRepository({ name: "a", pushedAt: "2026-10-10T08:00:00Z" }),
    makeRepository({ name: "b", isPrivate: true, pushedAt: "2026-10-12T09:00:00Z" }),
    makeRepository({ name: "c", pushedAt: null }),
  ],
  totalContributions: 159,
  languages: SAMPLE_LANGUAGES,
};

describe("buildTerminalLines", () => {
  it("reports repository counts with the public subset", () => {
    const texts = buildTerminalLines(options).map((line) => line.text);

    expect(texts).toContain("3 repositories, 2 public");
  });

  it("reports contributions, top languages and the latest push date", () => {
    const texts = buildTerminalLines(options).map((line) => line.text);

    expect(texts).toContain("159 contributions in the last year");
    expect(texts).toContain("C 50% · Rust 20% · TypeScript 20% · C++ 10%");
    expect(texts).toContain("last push 2026-10-12");
  });

  it("says so when there is no language data and no push", () => {
    const texts = buildTerminalLines({ ...options, languages: [], repositories: [] }).map((line) => line.text);

    expect(texts).toContain("no language data");
    expect(texts).toContain("last push never");
  });

  it("alternates commands and their output", () => {
    const kinds = buildTerminalLines(options).map((line) => line.kind);

    expect(kinds.filter((_, index) => index % 2 === 0).every((kind) => kind === "command")).toBe(true);
  });
});

describe("renderTerminal", () => {
  it("escapes hostile text", () => {
    const svg = renderTerminal(options);

    expect(svg).toContain("Test &lt;Name&gt;");
    expect(svg).not.toContain("<Name>");
  });

  it("types lines one after another", () => {
    const delays = [...renderTerminal(options).matchAll(/steps\(\d+,end\) ([\d.]+)s forwards/g)].map((match) =>
      Number(match[1]),
    );

    expect(delays).toHaveLength(10);
    expect([...delays].sort((a, b) => a - b)).toEqual(delays);
  });

  it("shows the final state without animation under reduced motion", () => {
    const svg = renderTerminal(options);

    expect(svg).toContain("prefers-reduced-motion:reduce){.cover{display:none}");
    expect(svg).toContain(".cursor{animation:none;opacity:1}");
  });

  it("sizes the canvas so every line and the prompt stay inside the panel", () => {
    const svg = renderTerminal(options);
    const height = Number(/viewBox="0 0 \d+ (\d+)"/.exec(svg)?.[1]);
    const baselines = [...svg.matchAll(/<text class="mono"[^>]* y="(\d+)" font-size="14"/g)].map((match) =>
      Number(match[1]),
    );

    expect(baselines).toHaveLength(11);
    expect(Math.max(...baselines)).toBeLessThan(height - 24);
  });

  it("clips the sliding covers to the panel so they never poke out", () => {
    const svg = renderTerminal(options);

    expect(svg).toContain('<clipPath id="panel">');
    expect(svg).toContain('<g clip-path="url(#panel)">');
  });

  it("contains no script or external reference and stays light", () => {
    const svg = renderTerminal(options);

    expect(svg).not.toMatch(/<script|href=|url\(http|@import/);
    expect(Buffer.byteLength(svg)).toBeLessThan(150_000);
  });
});
