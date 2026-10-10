import { SELECTED_WORK } from "../curation.js";
import type { LanguageShare, ProfileData, Repository } from "../github.js";
import type { StatusResult } from "../status.js";

export function makeRepository(overrides: Partial<Repository> & Pick<Repository, "name">): Repository {
  return {
    description: null,
    isPrivate: false,
    isFork: false,
    isArchived: false,
    stargazerCount: 0,
    pushedAt: null,
    homepageUrl: null,
    primaryLanguage: null,
    languages: { edges: [] },
    ...overrides,
  };
}

export const SAMPLE_LANGUAGES: readonly LanguageShare[] = [
  { name: "C", color: "#aaaaaa", bytes: 500, share: 0.5 },
  { name: "Rust", color: "#dea584", bytes: 200, share: 0.2 },
  { name: "TypeScript", color: "#3178c6", bytes: 200, share: 0.2 },
  { name: "C++", color: "#f34b7d", bytes: 100, share: 0.1 },
];

export const CURATED_NAMES: readonly string[] = SELECTED_WORK.flatMap((group) => group.repos.map((repo) => repo.name));

export const SAMPLE_STATUS: readonly StatusResult[] = [
  { name: "portfolio", host: "aurelienb.com", ok: true, status: 200, latencyMs: 100, failure: null },
];

/** Every curated repository, public, plus any extra repositories (for example a private one). */
export function makeProfileData(extraRepositories: readonly Repository[] = []): ProfileData {
  const curated = CURATED_NAMES.map((name) =>
    makeRepository({
      name,
      description: "A public project",
      pushedAt: "2026-10-01T00:00:00Z",
      primaryLanguage: { name: "C" },
      languages: { edges: [{ size: 100, node: { name: "C", color: "#555555" } }] },
    }),
  );
  return {
    repositories: [...curated, ...extraRepositories],
    totalContributions: 5,
    contributionDays: [
      { date: "2026-10-08", contributionCount: 2 },
      { date: "2026-10-09", contributionCount: 3 },
    ],
  };
}
