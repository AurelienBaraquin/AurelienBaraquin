import type { LanguageShare, Repository } from "../github.js";

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
