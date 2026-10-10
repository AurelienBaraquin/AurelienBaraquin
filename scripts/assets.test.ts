import { describe, expect, it } from "vitest";
import { buildAssets, TAGLINE } from "./assets.js";
import type { ProfileData } from "./github.js";
import { CURATED_NAMES, makeProfileData, makeRepository, SAMPLE_STATUS } from "./render/fixtures.js";

const PRIVATE_NAME = "secret-private-project";
const NOW = new Date("2026-10-10T12:00:00Z");

const data: ProfileData = makeProfileData([
  makeRepository({
    name: PRIVATE_NAME,
    isPrivate: true,
    description: "Must never be visible",
    languages: { edges: [{ size: 900, node: { name: "Rust", color: "#dea584" } }] },
  }),
]);

const status = SAMPLE_STATUS;

describe("buildAssets", () => {
  const files = buildAssets({ data, status, now: NOW });

  it("produces every section in both themes plus one card per curated repository", () => {
    const sections = ["hero", "terminal", "languages", "activity", "status"];

    for (const section of sections) {
      expect(files.has(`${section}-dark.svg`)).toBe(true);
      expect(files.has(`${section}-light.svg`)).toBe(true);
    }
    expect(files.size).toBe(sections.length * 2 + CURATED_NAMES.length * 2);
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
        repository.name === CURATED_NAMES[0] ? { ...repository, isPrivate: true } : repository,
      ),
    };

    expect(() => buildAssets({ data: leaky, status, now: NOW })).toThrow("missing or not public");
  });
});
