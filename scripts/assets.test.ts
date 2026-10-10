import { describe, expect, it } from "vitest";
import { buildAssets, TAGLINE } from "./assets.js";
import { SELECTED_WORK } from "./curation.js";
import type { ProfileData } from "./github.js";
import { makeRepository } from "./render/fixtures.js";
import type { StatusResult } from "./status.js";

const PRIVATE_NAME = "secret-private-project";
const NOW = new Date("2026-10-10T12:00:00Z");

const curatedNames = SELECTED_WORK.flatMap((group) => group.repos.map((repo) => repo.name));

const data: ProfileData = {
  repositories: [
    ...curatedNames.map((name) =>
      makeRepository({
        name,
        description: "A public project",
        pushedAt: "2026-10-01T00:00:00Z",
        primaryLanguage: { name: "C" },
        languages: { edges: [{ size: 100, node: { name: "C", color: "#555555" } }] },
      }),
    ),
    makeRepository({
      name: PRIVATE_NAME,
      isPrivate: true,
      description: "Must never be visible",
      languages: { edges: [{ size: 900, node: { name: "Rust", color: "#dea584" } }] },
    }),
  ],
  totalContributions: 5,
  contributionDays: [
    { date: "2026-10-08", contributionCount: 2 },
    { date: "2026-10-09", contributionCount: 3 },
  ],
};

const status: readonly StatusResult[] = [
  { name: "portfolio", host: "aurelienb.com", ok: true, status: 200, latencyMs: 100, failure: null },
];

describe("buildAssets", () => {
  const files = buildAssets({ data, status, now: NOW });

  it("produces every section in both themes plus one card per curated repository", () => {
    const sections = ["hero", "terminal", "languages", "activity", "status"];

    for (const section of sections) {
      expect(files.has(`${section}-dark.svg`)).toBe(true);
      expect(files.has(`${section}-light.svg`)).toBe(true);
    }
    expect(files.size).toBe(sections.length * 2 + curatedNames.length * 2);
  });

  it("never mentions a private repository by name in any file or path", () => {
    for (const [path, content] of files) {
      expect(path).not.toContain(PRIVATE_NAME);
      expect(content).not.toContain(PRIVATE_NAME);
      expect(content).not.toContain("Must never be visible");
    }
  });

  it("still counts private repositories and their languages in the aggregate", () => {
    expect(files.get("languages-dark.svg")).toContain(`${String(data.repositories.length)} repositories`);
    expect(files.get("languages-dark.svg")).toContain(">Rust<");
  });

  it("keeps the hero tagline within the layout limit", () => {
    expect(TAGLINE.length).toBeLessThanOrEqual(40);
  });

  it("fails rather than leak when a curated repository is private", () => {
    const leaky: ProfileData = {
      ...data,
      repositories: data.repositories.map((repository) =>
        repository.name === curatedNames[0] ? { ...repository, isPrivate: true } : repository,
      ),
    };

    expect(() => buildAssets({ data: leaky, status, now: NOW })).toThrow("missing or not public");
  });
});
