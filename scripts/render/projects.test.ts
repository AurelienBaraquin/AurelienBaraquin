import { describe, expect, it } from "vitest";
import { resolveCuratedWork, SELECTED_WORK } from "../curation.js";
import { PALETTES } from "../theme.js";
import { makeRepository } from "./fixtures.js";
import { renderProjectCard, wrapText } from "./projects.js";

const NOW = new Date("2026-10-10T12:00:00Z");

const repository = makeRepository({
  name: "nlc",
  description: "A new libc from scratch",
  stargazerCount: 7,
  pushedAt: "2026-10-01T00:00:00Z",
  primaryLanguage: { name: "C" },
  languages: { edges: [{ size: 10, node: { name: "C", color: "#555555" } }] },
});

describe("wrapText", () => {
  it("breaks on word boundaries within the limit", () => {
    expect(wrapText("one two three four", 9, 3)).toEqual(["one two", "three", "four"]);
  });

  it("ends the last line with an ellipsis when the text is cut", () => {
    const lines = wrapText("alpha beta gamma delta epsilon zeta", 12, 2);

    expect(lines).toHaveLength(2);
    expect(lines[1]?.endsWith("…")).toBe(true);
    expect(lines.every((line) => line.length <= 12)).toBe(true);
  });

  it("returns nothing for empty text", () => {
    expect(wrapText("   ", 10, 2)).toEqual([]);
  });
});

describe("resolveCuratedWork", () => {
  const groups = [{ title: "Systems", repos: [{ name: "nlc" }, { name: "x", blurb: "custom" }] }];

  it("uses the GitHub description unless a blurb overrides it", () => {
    const resolved = resolveCuratedWork(groups, [repository, makeRepository({ name: "x", description: "ignored" })]);

    expect(resolved[0]?.projects.map((project) => project.blurb)).toEqual(["A new libc from scratch", "custom"]);
  });

  it("fails the build when a curated repository is private, so its name cannot leak", () => {
    const privateRepo = makeRepository({ name: "x", isPrivate: true });

    expect(() => resolveCuratedWork(groups, [repository, privateRepo])).toThrow('"x" is missing or not public');
  });

  it("fails the build when a curated repository does not exist", () => {
    expect(() => resolveCuratedWork(groups, [repository])).toThrow('"x" is missing or not public');
  });

  it("curates only repositories that appear once", () => {
    const names = SELECTED_WORK.flatMap((group) => group.repos.map((repo) => repo.name));

    expect(new Set(names).size).toBe(names.length);
  });
});

describe("renderProjectCard", () => {
  const project = { repository, blurb: repository.description ?? "" };

  it("shows name, language, stars and last push month", () => {
    const svg = renderProjectCard({ palette: PALETTES.dark, project, now: NOW });

    expect(svg).toContain(">nlc<");
    expect(svg).toContain(">C<");
    expect(svg).toContain("★ 7   pushed 2026-10");
  });

  it("marks a repository pushed within 30 days as active", () => {
    const svg = renderProjectCard({ palette: PALETTES.dark, project, now: NOW });

    expect(svg).toContain('class="ring"');
  });

  it("does not mark an old repository as active", () => {
    const old = { ...project, repository: { ...repository, pushedAt: "2025-01-01T00:00:00Z" } };
    const svg = renderProjectCard({ palette: PALETTES.dark, project: old, now: NOW });

    expect(svg).not.toContain('class="ring"');
  });

  it("escapes hostile text and stays self-contained", () => {
    const hostile = { ...project, blurb: "<script>alert(1)</script>" };
    const svg = renderProjectCard({ palette: PALETTES.light, project: hostile, now: NOW });

    expect(svg).not.toContain("<script>");
    expect(svg).not.toMatch(/href=|url\(http|@import/);
  });

  it("stops the pulse under reduced motion", () => {
    const svg = renderProjectCard({ palette: PALETTES.dark, project, now: NOW });

    expect(svg).toContain("prefers-reduced-motion:reduce){.ring{animation:none;opacity:0}");
  });
});
